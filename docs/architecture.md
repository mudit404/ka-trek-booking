# Aranya Vihaara Auto-Booking Service — Architecture & Design

_Status: proposal · 2026-09-27 · Target site: https://aranyavihaara.karnataka.gov.in/_

## Portal facts (from public guides — VERIFY in recon)
- Login: mobile number + 6-digit OTP (no password).
- Booking: participant name/age/gender + govt ID (Aadhaar/passport/DL) → online payment (UPI/card/netbanking) → permit PDF.
- Window: opens 15 days ahead, closes 1 day before. ~50 permits/day/trek.
- Popular weekend slots (Kudremukh, Nethravathi) sell out in 3–15 min; other automation is already competing.

Core framing: automate everything except the two legally human steps (OTP login, payment 2FA), and make those one-tap.

## Flow
0. **Recon** — DevTools/mitmproxy HAR capture. Determine: SPA/JSON vs server-rendered; unauthenticated availability endpoint?; exact release clock time; captcha?; session lifetime; payment gateway; **slot hold window during pending payment** (most important number).
1. **Intake** — trek, date(s) + fallbacks, participants, ID doc, user's mobile, user's UPI ID. Encrypted. One job per booking.
2. **Session pre-warm (T−30 min)** — trigger login; user relays OTP via Telegram/WhatsApp bot or SMS-forwarder app; keep session alive with heartbeat.
3. **Release detection** — NTP-synced scheduler wakes at T−5 s; tight but polite poller (few req/s) on availability until target date flips.
4. **Booking strike** — pre-built payload; API-level submit (~100 ms) preferred over Playwright UI drive (3–8 s). Retry w/ jitter on 5xx, fall through to fallback dates, idempotency key.
5. **Payment (human-in-loop)** — push UPI collect + notification with deep link; user approves within hold window. Do not attempt to bypass 2FA.
6. **Confirmation** — poll status, download permit PDF, deliver via bot/email, close job.
7. **Ops** — dry-run mode, pre-release canary, alerts on API/HTML shape change.

## Limitations → mitigations
| Limitation | Mitigation |
|---|---|
| OTP login | Pre-login; persist sessions; OTP relay via bot / SMS forwarder |
| Payment 2FA | UPI collect + push; pre-arm user; design UX around hold window |
| Captcha | Assisted mode (hand session to user). No captcha-solving services |
| Rate limits / bans | Timing precision over volume; one session/user; backoff; no proxy rotation |
| Latency | Host in BLR/Mumbai; measure ping; chrony |
| Portal changes | Contract tests on recorded API; nightly smoke; Sentry |
| Self-competition | Queue by intake order; cap requests per slot; be transparent |
| PII (Aadhaar) | DPDP Act 2023: encrypt at rest, minimize, auto-delete post-trek |
| ToS / legitimacy | User's own credentials & payment, one booking per person, no reselling. Scaled hoarding invites captchas/blocks |

## Tech stack
- Recon: Chrome DevTools, mitmproxy, HARs stored as fixtures.
- Language: TypeScript/Node (`fetch` for API replay, Playwright as fallback).
- Workflow: **Temporal** (timers, retries, wait-for-human signals). Lighter: BullMQ/Redis.
- State: PostgreSQL (jobs/users/audit), Redis (locks, session cache).
- Secrets/PII: libsodium-encrypted columns, keys in KMS/sops. Never log payloads.
- Human channel: Telegram bot first; WhatsApp Business API later.
- Intake UI: bot first; Next.js form when multi-user.
- Hosting: single VM in Bengaluru (DigitalOcean BLR1 / AWS ap-south-1), Docker Compose, chrony.
- Observability: Prometheus + Grafana (time-to-book histogram = north-star), Loki, Sentry, Healthchecks.io.

## Build order
1. Recon + availability watcher bot ("slot open for X on date") — useful standalone, forces API mapping.
2. Single-user auto-book for self (own number, own UPI).
3. Multi-user with queue + human-in-loop payment, after measuring hold window and success rate.

## Sources
- https://hikershorizon.in/Blog/Kudremukh-Trek-Permit-Booking-Aranya-Vihara/
- https://aravindgundumane.com/2025/11/trekking-situation-in-karnataka/
- https://nammatrip.in/blogs/how-to-book-trek-permits-in-aranya-vihara
- https://backpackersunited.in/destinations/bangalore/how-to-book-aranya-vihara-forest-permit
