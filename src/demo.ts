import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { ApiClient } from './apiClient.js';
import { loadConfig, type Service } from './config.js';
import { examplesComplete, runExamples } from './examples.js';
import { readInput, steps, type Step } from './inputs.js';
import { handleUserSignup } from './pipeline.js';
import { validateRegistrationEmail } from './services/verifyUser.js';
import { getClientContext } from './services/geoService.js';
import { getDashboardFeeds } from './services/dashboardFeed.js';

const help = `APILayer SaaS demo — every example makes real API requests

  npm run demo                         Show all five APIs independently
  npm run demo -- --step email          Email deliverability checks
  npm run demo -- --step context        IP location and country reference data
  npm run demo -- --step feeds          EOD stock quote and recent headlines
  npm run demo -- --step signup         Run the gated onboarding workflow
  npm run demo -- --json                Print JSON without trace messages
  npm run test:live                     Test all five APIs and save a safe summary

Options: --step <${steps.join('|')}> --json --help

Reads .env: APILAYER_ACCESS_KEY, DEMO_EMAIL, DEMO_IP, DEMO_TICKER,
IPSTACK_SECURITY, API_REQUEST_TIMEOUT_MS. Each step requires only its own inputs.
Requests consume API quotas. Mailboxlayer's SMTP check is enabled.
Use an email you control or have permission to validate, and an IP you intend to look up.
This demo does not create an account or send an email verification message.`;

const labels: Record<Service, string> = {
  mailboxlayer: 'Mailboxlayer: email deliverability checks',
  ipstack: 'IPstack: approximate location and optional security signals',
  countrylayer: 'Countrylayer: country reference data',
  marketstack: 'Marketstack: latest end-of-day quote',
  mediastack: 'Mediastack: recent headlines',
};

async function main() {
  const { values } = parseArgs({ options: {
    json: { type: 'boolean', default: false }, help: { type: 'boolean', default: false },
    step: { type: 'string', default: 'all' },
  }, strict: true, allowPositionals: false });
  if (values.help) { console.log(help); return; }
  if (!steps.includes(values.step as Step)) throw new Error('Unknown step. Use --help.');
  const step = values.step as Step;
  if (existsSync('.env')) process.loadEnvFile('.env');
  const config = loadConfig();
  const input = readInput(step);
  const requests: Service[] = [];
  const client = new ApiClient(config, (service) => {
    requests.push(service);
    if (!values.json) console.log(`  Request ${requests.length}: ${labels[service]}`);
  });
  if (!values.json) {
    console.log('\nLIVE API REQUESTS — results and availability depend on your account and the provider.');
    console.log(`Step: ${step}\n`);
  }
  const started = performance.now();
  let result: unknown;
  switch (step) {
    case 'all': {
      const examples = await runExamples(client, input, config.securityEnabled);
      result = examples;
      if (!examplesComplete(examples)) process.exitCode = 1;
      break;
    }
    case 'email': result = await validateRegistrationEmail(client, input.email); break;
    case 'context': {
      const context = await getClientContext(client, input.userIp, config.securityEnabled);
      result = context;
      if (context.countryLookup === 'unavailable') process.exitCode = 1;
      break;
    }
    case 'feeds': {
      const feeds = await getDashboardFeeds(client, input.primaryTicker);
      result = feeds;
      if (feeds.market.status === 'unavailable' || feeds.news.status === 'unavailable') process.exitCode = 1;
      break;
    }
    case 'signup': result = await handleUserSignup(client, input, config.securityEnabled); break;
  }
  if (!values.json) console.log('\nResult (no account created):');
  console.log(JSON.stringify({ mode: 'live', step, requestCount: requests.length,
    requestedServices: requests, elapsedMs: Math.round(performance.now() - started), result }, null, 2));
}

main().catch((error: unknown) => {
  console.error(`Demo failed: ${error instanceof Error ? error.message : 'Unexpected error'}`);
  process.exitCode = 1;
});
