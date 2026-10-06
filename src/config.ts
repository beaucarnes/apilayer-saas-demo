export const BASE_URL = 'https://api.apilayer.net';

// Product-specific paths come from the suite's API endpoint references.
// A shared host and key do not imply identical paths or response schemas.
export const endpoints = {
  mailboxlayer: '/mailboxlayer/api/check',
  ipstack: '/ipstack',
  // /alpha/{code} is restricted on the demo account. Select a record from /all.
  countrylayer: '/countrylayer/v2/all',
  marketstack: '/marketstack/v2/eod/latest',
  mediastack: '/mediastack/v1/news',
} as const;

export type Service = keyof typeof endpoints;
export interface Config {
  apiKey: string;
  securityEnabled: boolean;
  timeoutMs: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const apiKey = env.APILAYER_ACCESS_KEY?.trim();
  if (!apiKey || /^(your[_-]|replace|changeme)/i.test(apiKey)) {
    throw new Error('Set APILAYER_ACCESS_KEY in .env before running the demo.');
  }
  const security = env.IPSTACK_SECURITY ?? 'false';
  if (security !== 'true' && security !== 'false') {
    throw new Error('IPSTACK_SECURITY must be true or false.');
  }
  const timeoutMs = Number(env.API_REQUEST_TIMEOUT_MS ?? 10000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) {
    throw new Error('API_REQUEST_TIMEOUT_MS must be an integer from 1 to 60000.');
  }
  return { apiKey, securityEnabled: security === 'true', timeoutMs };
}
