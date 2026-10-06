import { isIP } from 'node:net';
import { ApiClient, safeError } from '../apiClient.js';
import { endpoints } from '../config.js';
import { countriesSchema, ipSchema } from '../schemas.js';

export interface ClientContext {
  ip: string;
  city: string | null;
  region: string | null;
  countryName: string | null;
  countryCode: string | null;
  timeZone: string | null;
  countryLookup: 'skipped' | 'matched' | 'empty' | 'unavailable';
  countryCapital: string | null;
  countryRegion: string | null;
  currencyCodes: string[];
  callingCodes: string[];
  languageCodes: string[];
  security: { status: 'not_requested' | 'unavailable' | 'no_flags' | 'review'; reasons: string[] };
  warnings: string[];
}

export async function getClientContext(client: ApiClient, clientIp: string, securityEnabled: boolean): Promise<ClientContext> {
  if (!isIP(clientIp)) throw new Error('Provide a valid IPv4 or IPv6 address.');
  const params: Record<string, string> = securityEnabled ? { security: '1' } : {};
  const data = await client.get('ipstack', `${endpoints.ipstack}/${encodeURIComponent(clientIp)}`, params, ipSchema);
  const context: ClientContext = {
    ip: clientIp, city: data.city || null, region: data.region_name || null,
    countryName: data.country_name || null, countryCode: data.country_code?.toUpperCase() || null,
    timeZone: data.time_zone?.id || null, currencyCodes: [], callingCodes: [], languageCodes: [],
    countryLookup: 'skipped', countryCapital: null, countryRegion: null,
    security: { status: securityEnabled ? 'unavailable' : 'not_requested', reasons: [] }, warnings: [],
  };

  if (securityEnabled && data.security) {
    const security = data.security;
    if (security.is_proxy === true) context.security.reasons.push('Proxy signal');
    if (security.is_tor === true) context.security.reasons.push('Tor signal');
    if (['medium', 'high'].includes(security.threat_level ?? '')) context.security.reasons.push('Elevated threat level');
    if (context.security.reasons.length) context.security.status = 'review';
    else if (security.is_proxy === false && security.is_tor === false && security.threat_level === 'low') {
      context.security.status = 'no_flags';
    }
  }
  if (context.security.status === 'unavailable') context.warnings.push('Requested security assessment is unavailable');
  if (!securityEnabled) context.warnings.push('IP security module was not requested');

  if (!context.countryCode) {
    context.warnings.push('No country code returned; country lookup skipped');
    return context;
  }
  try {
    const countries = await client.get('countrylayer', endpoints.countrylayer, {}, countriesSchema);
    const country = countries.find((item) => item.alpha2Code.toUpperCase() === context.countryCode);
    if (!country) {
      context.countryLookup = 'empty';
      context.warnings.push('No matching country record returned');
      return context;
    }
    context.countryLookup = 'matched';
    context.countryCapital = country.capital || null;
    context.countryRegion = country.region || null;
    context.currencyCodes = country.currencies?.flatMap((item) => item.code ? [item.code] : []) ?? [];
    context.callingCodes = country.callingCodes?.filter(Boolean) ?? [];
    context.languageCodes = country.languages?.flatMap((item) => item.iso639_1 ? [item.iso639_1] : []) ?? [];
    if (!context.currencyCodes.length) context.warnings.push('Countrylayer did not return currencies for this record');
    if (!context.languageCodes.length) context.warnings.push('Countrylayer did not return languages for this record');
  } catch (error) {
    context.countryLookup = 'unavailable';
    context.warnings.push(safeError(error));
  }
  return context;
}
