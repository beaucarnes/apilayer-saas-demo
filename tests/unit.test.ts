import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { z } from 'zod';
import { ApiClient, ApiError, providerErrorCode, safeError } from '../src/apiClient.js';
import { loadConfig } from '../src/config.js';
import { readInput, validateInput } from '../src/inputs.js';
import { countriesSchema, emailSchema } from '../src/schemas.js';

// These are pure input/validation checks. No fetch stubs, intercepted requests,
// fabricated service responses, or real network calls are used by this file.
test('requires a real configured key', () => {
  assert.throws(() => loadConfig({}), /APILAYER_ACCESS_KEY/);
  assert.throws(() => loadConfig({ APILAYER_ACCESS_KEY: 'YOUR_ACCESS_KEY' }), /APILAYER_ACCESS_KEY/);
});

test('security is opt-in and the request deadline is validated', () => {
  const settings = { APILAYER_ACCESS_KEY: 'local-validation-only' };
  assert.equal(loadConfig(settings).securityEnabled, false);
  assert.equal(loadConfig({ ...settings, IPSTACK_SECURITY: 'true' }).securityEnabled, true);
  assert.throws(() => loadConfig({ ...settings, IPSTACK_SECURITY: 'yes' }), /IPSTACK_SECURITY/);
  for (const value of ['NaN', '0', '60001', '2.5']) {
    assert.throws(() => loadConfig({ ...settings, API_REQUEST_TIMEOUT_MS: value }), /TIMEOUT/);
  }
});

test('normalizes input without changing the email local part', () => {
  const input = validateInput({ email: ' Alex+demo@example.com ', userIp: ' 192.0.2.1 ', primaryTicker: ' aapl ' });
  assert.equal(input.email, 'Alex+demo@example.com');
  assert.equal(input.userIp, '192.0.2.1');
  assert.equal(input.primaryTicker, 'AAPL');
});

test('each scene requires only its own inputs', () => {
  assert.doesNotThrow(() => readInput('feeds', { DEMO_TICKER: 'AAPL' }));
  assert.doesNotThrow(() => readInput('email', { DEMO_EMAIL: 'person@example.com' }));
  assert.doesNotThrow(() => readInput('context', { DEMO_IP: '2001:db8::1' }));
  assert.throws(() => readInput('all', { DEMO_TICKER: 'AAPL' }), /DEMO_EMAIL/);
});

test('invalid email, IP, and ticker inputs fail locally', () => {
  assert.throws(() => readInput('email', { DEMO_EMAIL: 'bad' }), /DEMO_EMAIL/);
  assert.throws(() => readInput('context', { DEMO_IP: '../check' }), /DEMO_IP/);
  assert.throws(() => readInput('feeds', { DEMO_TICKER: 'AAPL&access_key=x' }), /DEMO_TICKER/);
});

test('response field validators preserve uncertainty and reject misleading types', () => {
  assert.equal(emailSchema.shape.score.parse(null), null);
  assert.equal(emailSchema.shape.smtp_check.parse(undefined), null);
  assert.equal(emailSchema.shape.score.safeParse(1.5).success, false);
  assert.equal(emailSchema.shape.format_valid.safeParse('true').success, false);
});

test('country contract requires a list but permits omitted optional plan fields', () => {
  assert.equal(countriesSchema.safeParse({}).success, false);
  assert.equal(countriesSchema.element.shape.currencies.parse(undefined), undefined);
  assert.equal(countriesSchema.element.shape.capital.parse(null), null);
});

test('provider diagnostics expose only recognized codes', () => {
  assert.equal(providerErrorCode({ error: { code: 'endpoint_not_available' } }), 'endpoint_not_available');
  assert.equal(providerErrorCode({ error: { type: 'invalid_access_key' } }), 'invalid_access_key');
  assert.equal(providerErrorCode({ error: { code: 104 } }), '104');
  assert.equal(providerErrorCode({ error: { code: 'secret-string', message: 'private input' } }), undefined);
  assert.equal(safeError(new Error('private input')), 'Unexpected service failure');
  assert.match(safeError(new ApiError('countrylayer', 'http_error', 403, 'endpoint_not_available')), /endpoint_not_available/);
});

test('an external route is rejected before any network call', async () => {
  const client = new ApiClient(loadConfig({ APILAYER_ACCESS_KEY: 'local-validation-only' }));
  await assert.rejects(client.get('mailboxlayer', 'https://example.com/mailboxlayer/check', {}, z.unknown()), /Invalid API route/);
});

test('help explains the real requests without loading credentials', () => {
  const command = spawnSync(process.execPath, ['--import', 'tsx', 'src/demo.ts', '--help'], { encoding: 'utf8', timeout: 5000 });
  assert.equal(command.status, 0);
  assert.match(command.stdout, /every example makes real API requests/);
});

test('unsupported options fail before any API request', () => {
  for (const args of [['--scenario', 'success'], ['--step', 'missing'], ['--typo']]) {
    const command = spawnSync(process.execPath, ['--import', 'tsx', 'src/demo.ts', ...args], { encoding: 'utf8', timeout: 5000 });
    assert.equal(command.status, 1);
    assert.equal(command.stdout, '');
  }
});
