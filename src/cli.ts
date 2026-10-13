import { Command } from "commander";
import { randomUUID } from "node:crypto";
import { loadConfig } from "./config.js";
import { logger } from "./logger.js";
import { makeNotifier } from "./notify/telegram.js";
import { PortalClient } from "./portal/client.js";
import type { BookingRequest } from "./portal/types.js";
import { nextReleasedTrekDate, releaseInstantFor } from "./scheduler/release.js";
import { watchForOpening } from "./watcher/index.js";

const program = new Command()
  .name("ka-trek-booking")
  .description("Booking assistant for Aranya Vihaara trek permits")
  .version("0.1.0");

program
  .command("schedule")
  .description("Print the next release instant and the trek date it unlocks")
  .action(() => {
    const cfg = loadConfig();
    const trekDate = nextReleasedTrekDate(new Date(), cfg.RELEASE_DAYS_AHEAD);
    const at = releaseInstantFor(trekDate, cfg.RELEASE_DAYS_AHEAD, cfg.RELEASE_TIME_IST);
    console.log(`Next release:  ${at.toISOString()} (UTC)`);
    console.log(`Unlocks date:  ${trekDate}`);
    console.log(`In:            ${Math.round((at.getTime() - Date.now()) / 1000)}s`);
  });

program
  .command("watch")
  .description("Watch availability for a trek/date and notify when it opens")
  .requiredOption("-t, --trek <id>", "portal trek id (from recon)")
  .option("-d, --date <yyyy-mm-dd>", "trek date; defaults to the next date to be released")
  .action(async (o: { trek: string; date?: string }) => {
    const cfg = loadConfig();
    const date = o.date ?? nextReleasedTrekDate(new Date(), cfg.RELEASE_DAYS_AHEAD);
    const releaseAt = releaseInstantFor(date, cfg.RELEASE_DAYS_AHEAD, cfg.RELEASE_TIME_IST);
    const client = new PortalClient({
      baseUrl: cfg.PORTAL_BASE_URL,
      availabilityPath: cfg.PORTAL_AVAILABILITY_PATH,
      bookingPath: cfg.PORTAL_BOOKING_PATH,
      dryRun: cfg.DRY_RUN,
    });
    const hit = await watchForOpening(client, [{ trekId: o.trek, date }], makeNotifier(cfg), {
      idleIntervalMs: cfg.WATCH_IDLE_INTERVAL_MS,
      tightIntervalMs: cfg.WATCH_TIGHT_INTERVAL_MS,
      leadMs: cfg.RELEASE_LEAD_SECONDS * 1000,
      releaseAt,
    });
    process.exit(hit ? 0 : 2);
  });

program
  .command("book")
  .description("Submit a booking (DRY_RUN=true by default — prints the payload)")
  .requiredOption("-t, --trek <id>", "portal trek id")
  .requiredOption("-d, --date <yyyy-mm-dd...>", "trek date(s), preferred first")
  .option("--cookie <cookie>", "session cookie from an OTP login")
  .action(async (o: { trek: string; date: string[]; cookie?: string }) => {
    const cfg = loadConfig();
    const client = new PortalClient({
      baseUrl: cfg.PORTAL_BASE_URL,
      availabilityPath: cfg.PORTAL_AVAILABILITY_PATH,
      bookingPath: cfg.PORTAL_BOOKING_PATH,
      dryRun: cfg.DRY_RUN,
      ...(o.cookie ? { cookie: o.cookie } : {}),
    });

    // Placeholder participant — real requests come from the intake store (phase 3).
    const req: BookingRequest = {
      requestId: randomUUID(),
      trekId: o.trek,
      dates: o.date,
      participants: [
        { name: "Test Person", age: 30, gender: "M", idProofType: "AADHAAR", idNumber: "XXXX-XXXX-0000" },
      ],
      contactMobile: "9999999999",
      upiId: "test@upi",
    };

    for (const date of req.dates) {
      const outcome = await client.book(req, date);
      logger.info({ date, outcome }, "booking outcome");
      if (outcome.status !== "sold_out") break;
    }
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  logger.error({ err }, "fatal");
  process.exit(1);
});
