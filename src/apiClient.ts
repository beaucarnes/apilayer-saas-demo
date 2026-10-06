import type { z } from 'zod';
import { BASE_URL, type Config, type Service } from './config.js';

type ErrorKind = 'http_error' | 'provider_error' | 'invalid_json' | 'invalid_response' | 'timeout' | 'network_error';

const publicErrorCodes = new Set([
  'endpoint_not_available', 'invalid_access_key', 'missing_access_key', 'inactive_user',
  'usage_limit_reached', 'rate_limit_reached', 'function_access_restricted',
  'https_access_restricted', 'invalid_api_function', 'invalid_request',
  'invalid_ip_address', 'invalid_email_address', 'internal_error', '404_not_found',
]);

export function providerErrorCode(data: unknown): string | undefined {
  if (!data || typeof data !== 'object' || !('error' in data)) return undefined;
  const error = data.error;
  if (!error || typeof error !== 'object') return undefined;
  for (const field of ['type', 'code'] as const) {
    const value: unknown = field in error ? (error as Record<string, unknown>)[field] : undefined;
    if (typeof value === 'string' && publicErrorCodes.has(value)) return value;
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 10000) return String(value);
  }
  return undefined;
}

export class ApiError extends Error {
  readonly service: Service;
  readonly kind: ErrorKind;
  readonly status: number | undefined;
  readonly providerCode: string | undefined;
  constructor(service: Service, kind: ErrorKind, status?: number, providerCode?: string) {
    // Never include raw URLs, provider bodies, or fetch errors: they can contain the key.
    super(`${service}: ${kind}${status === undefined ? '' : ` (HTTP ${status})`}${providerCode ? ` [${providerCode}]` : ''}`);
    this.name = 'ApiError';
    this.service = service;
    this.kind = kind;
    this.status = status;
    this.providerCode = providerCode;
  }
}

export function safeError(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Unexpected service failure';
}

export class ApiClient {
  constructor(
    private readonly config: Config,
    private readonly onRequest: (service: Service) => void = () => {},
  ) {}

  async get<T>(service: Service, path: string, params: Record<string, string>, schema: z.ZodType<T>): Promise<T> {
    const url = new URL(path, BASE_URL);
    if (url.origin !== BASE_URL || !url.pathname.startsWith(`/${service}/`)) {
      throw new Error('Invalid API route.');
    }
    url.search = new URLSearchParams({ ...params, access_key: this.config.apiKey }).toString();
    const controller = new AbortController();
    // This deadline includes reading the response body, not just receiving headers.
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      this.onRequest(service);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
        redirect: 'error',
      });
      let data: unknown;
      try {
        data = await response.json();
      } catch (error) {
        if (controller.signal.aborted) throw error;
        if (!response.ok) throw new ApiError(service, 'http_error', response.status);
        throw new ApiError(service, 'invalid_json', response.status);
      }
      if (!response.ok) throw new ApiError(service, 'http_error', response.status, providerErrorCode(data));
      // Some products return success:false or an error object with HTTP 200.
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const body = data as Record<string, unknown>;
        if (body.success === false || body.error != null) {
          throw new ApiError(service, 'provider_error', response.status, providerErrorCode(data));
        }
      }
      const parsed = schema.safeParse(data);
      if (!parsed.success) throw new ApiError(service, 'invalid_response', response.status);
      return parsed.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(service, controller.signal.aborted ? 'timeout' : 'network_error');
    } finally {
      clearTimeout(timer);
    }
  }
}
