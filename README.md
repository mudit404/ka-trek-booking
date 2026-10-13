# ka-trek-booking

A booking assistant for Karnataka Forest Department's [Aranya Vihaara](https://aranyavihaara.karnataka.gov.in/) trek-permit portal. Popular weekend slots sell out minutes after they open; this service watches for the release, submits a pre-built booking the instant a slot appears, and hands the two steps only a human can do (OTP login, payment approval) back to the user as a one-tap action.

Full design: [`docs/architecture.md`](docs/architecture.md).

## Status

**Phase 0 — recon.** The portal's endpoints are not mapped yet. Nothing here books anything; `DRY_RUN=true` is the default and the client throws `PortalNotMappedError` until `recon/FINDINGS.md` is filled in and `src/portal/client.ts` is wired to the real API.

Build order:

1. Recon + availability watcher ("slot open for X on date" → Telegram)
2. Single-user auto-book (your own number, your own UPI)
3. Multi-user queue with human-in-loop payment

## Quick start

```bash
cp .env.example .env
npm install
npm test
npm run dev -- schedule          # when is the next release, and which trek date does it unlock
npm run dev -- watch -t <trekId> # watch availability (needs recon first)
npm run dev -- book -t <trekId> -d 2026-10-28   # DRY_RUN prints the payload
```

Local infra (Postgres + Redis) when you get to phase 3:

```bash
docker compose up -d
```

## Layout

```
src/
  cli.ts              commands: schedule | watch | book
  config.ts           env → typed config (zod); DRY_RUN defaults to true
  logger.ts           pino with PII redaction
  portal/             types + HTTP client for the portal (TODO(recon) markers)
  scheduler/          release-time maths (IST), precise sleepUntil
  watcher/            idle → tight polling loop, notifies on first open slot
  notify/             Telegram / console notifier
recon/
  README.md           how to capture a HAR and the 10 questions to answer
  FINDINGS.md         fill in as you go
  scripts/            har-summarize: HAR → endpoint table
docs/
  architecture.md     design, limitations, stack
test/                 vitest
```

## Ground rules

- Your own credentials, your own payment, one booking per person. No reselling, no hoarding.
- No captcha-solving services, no proxy rotation. Speed comes from timing, not volume.
- Aadhaar/ID data is encrypted at rest and never logged. HAR captures are git-ignored because they contain it.
