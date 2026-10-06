# APILayer SaaS Demo

TypeScript examples using real requests to Mailboxlayer, IPstack, Countrylayer, Marketstack, and Mediastack.

## Setup

Requires Node.js 22.14 or newer and an APILayer account with the five products enabled. Product plans and limits apply.

```sh
npm ci
cp .env.example .env
```

Fill in `APILAYER_ACCESS_KEY`, `DEMO_EMAIL`, and `DEMO_IP` in `.env`. Keep this file private. The demo sends these inputs to APILayer; Mailboxlayer may check the mail server via SMTP. Requests consume your API quota.

```sh
npm run demo
```

Run individual examples with `npm run demo -- --step email`, `--step context`, or `--step feeds`. Use `--step signup` for the combined onboarding flow. Marketstack retrieves the latest available end-of-day quote. This demo does not create accounts or send verification emails.

## Checks

```sh
npm run check
```

This runs type checking, local unit tests, and the build without making API requests.

```sh
npm run test:live
```

Live tests require the configured `.env`, call all five products, and write an ignored report in `docs/`. They use your API quota. There are no mock API responses.
