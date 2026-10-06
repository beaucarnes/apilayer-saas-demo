import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import type { Service } from '../src/config.js';
import type { runExamples } from '../src/examples.js';

type Output = {
  mode: string; requestCount: number; requestedServices: Service[]; elapsedMs: number;
  result: Awaited<ReturnType<typeof runExamples>>;
};

test('real API examples through the CLI', { timeout: 90000 }, async (t) => {
  // Execute the same command path used in the video. It reads .env and uses real fetch.
  // Capture stdout privately: it contains actual location data. Never log it wholesale.
  const command = spawnSync(process.execPath, ['--import', 'tsx', 'src/demo.ts', '--json'], {
    encoding: 'utf8', timeout: 75000, maxBuffer: 1024 * 1024,
  });
  let output: Output;
  try { output = JSON.parse(command.stdout) as Output; }
  catch { assert.fail('Live CLI did not produce JSON. Run npm run demo locally to inspect its sanitized error.'); }

  const { email, context, dashboard } = output.result;
  const report = {
    checkedAt: new Date().toISOString(), mode: output.mode,
    requestCount: output.requestCount, requestedServices: output.requestedServices, elapsedMs: output.elapsedMs,
    mailboxlayer: email.status === 'available'
      ? { status: 'available', decision: email.data.decision } : email,
    ipstack: context.status === 'available'
      ? { status: 'available', countryReturned: !!context.data.countryCode, security: context.data.security.status } : context,
    countrylayer: context.status === 'available' ? {
      status: context.data.countryLookup, capitalReturned: !!context.data.countryCapital,
      callingCodesReturned: context.data.callingCodes.length, currenciesReturned: context.data.currencyCodes.length,
      languagesReturned: context.data.languageCodes.length,
    } : { status: 'not_reached' },
    marketstack: dashboard.status === 'available'
      ? { status: dashboard.data.market.status, kind: dashboard.data.market.kind, sessionDate: dashboard.data.market.quote?.date ?? null } : dashboard,
    mediastack: dashboard.status === 'available'
      ? { status: dashboard.data.news.status, articleCount: dashboard.data.news.articles.length,
        newestPublishedAt: dashboard.data.news.articles[0]?.published_at ?? null } : dashboard,
    warnings: [ ...(context.status === 'available' ? context.data.warnings : []),
      ...(dashboard.status === 'available' ? dashboard.data.warnings : []) ],
  };
  mkdirSync('docs', { recursive: true });
  writeFileSync('docs/live-verification.json', JSON.stringify(report, null, 2) + '\n');

  await t.test('Mailboxlayer returns a validated email assessment', () => assert.equal(email.status, 'available'));
  await t.test('IPstack returns country context', () => {
    assert.equal(context.status, 'available');
    if (context.status === 'available') assert.ok(context.data.countryCode);
  });
  await t.test('Countrylayer /all contains a matching record', () => {
    assert.equal(context.status, 'available');
    if (context.status === 'available') assert.equal(context.data.countryLookup, 'matched');
  });
  await t.test('Marketstack returns the requested end-of-day quote', () => {
    assert.equal(dashboard.status, 'available');
    if (dashboard.status === 'available') assert.equal(dashboard.data.market.status, 'available');
  });
  await t.test('Mediastack returns news articles', () => {
    assert.equal(dashboard.status, 'available');
    if (dashboard.status === 'available') assert.equal(dashboard.data.news.status, 'available');
  });
  await t.test('the CLI completes exactly five real requests', () => {
    assert.equal(output.mode, 'live');
    assert.equal(output.requestCount, 5);
    assert.deepEqual([...output.requestedServices].sort(), ['countrylayer', 'ipstack', 'mailboxlayer', 'marketstack', 'mediastack']);
    assert.equal(command.status, 0);
  });
});
