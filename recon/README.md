# Recon: mapping the Aranya Vihaara portal

Nothing in `src/portal/` can be finished until these questions are answered.
Do one full manual booking (a cheap weekday slot is fine) with DevTools recording.

## Capture

1. Open Chrome → DevTools → **Network** tab. Tick **Preserve log** and **Disable cache**.
2. Go to https://aranyavihaara.karnataka.gov.in/ and complete a booking end to end:
   landing → login (mobile + OTP) → trek list → date → participants → payment → permit download.
3. Right-click the request list → **Save all as HAR with content** → `recon/fixtures/full-booking.har`.
4. Also save the **Application → Cookies** view (screenshot is fine) so we know cookie names and expiry.
5. Run `npm run recon:summarize -- recon/fixtures/full-booking.har` to get an endpoint table.

HAR files contain your session cookie, OTP and ID details. They are git-ignored.
If you want to commit one, scrub it first into `recon/fixtures/redacted/` (also ignored by default — remove the ignore line deliberately).

## Questions to answer (fill in `recon/FINDINGS.md`)

| # | Question | Why it matters |
|---|---|---|
| 1 | SPA with JSON APIs, or server-rendered forms with CSRF tokens? | Decides `fetch` replay (fast) vs Playwright (slow) |
| 2 | Does the availability/calendar endpoint work **without** login? | Lets the watcher run with no session |
| 3 | Exact wall-clock instant a new date appears (watch the calendar across midnight IST with a 1s poll) | `RELEASE_TIME_IST` and `RELEASE_DAYS_AHEAD` |
| 4 | Any captcha? Where? | Human-in-loop design; we don't bypass captchas |
| 5 | Session cookie lifetime; does it survive idle 30+ min? | Pre-warm strategy |
| 6 | Which payment gateway, and does the portal **hold the slot** while payment is pending? For how long? | The single most important number in the system |
| 7 | Max participants per booking; is ID proof uploaded as a file or typed as a number? | Payload shape |
| 8 | Rate-limit behaviour: what happens at 2 req/s? 5 req/s? | Watcher polling intervals |
| 9 | Error bodies for "sold out" vs "validation failed" vs "session expired" | `BookingOutcome` mapping |
| 10 | Terms of use text — anything about automation, resale, one-booking-per-person | Legitimacy boundaries |

## Then

- Set `PORTAL_AVAILABILITY_PATH` / `PORTAL_BOOKING_PATH` in `.env`.
- Replace the `TODO(recon)` blocks in `src/portal/client.ts`.
- Add a contract test in `test/` that replays the recorded response bodies.
