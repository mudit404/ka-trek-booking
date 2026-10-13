import { logger } from "../logger.js";
import { PortalClient } from "../portal/client.js";
import type { ISODate, SlotAvailability } from "../portal/types.js";
import { sleepUntil } from "../scheduler/release.js";
import type { Notifier } from "../notify/types.js";

export interface WatchTarget {
  trekId: string;
  date: ISODate;
}

export interface WatcherOptions {
  idleIntervalMs: number;
  tightIntervalMs: number;
  /** Switch from idle to tight polling this many ms before `releaseAt`. */
  leadMs: number;
  /** When bookings for these targets are expected to open. */
  releaseAt: Date;
  /** Give up this long after `releaseAt` if nothing appeared. */
  giveUpAfterMs?: number;
}

/**
 * Phase 1: watch availability and shout the moment a slot appears.
 *
 * Two regimes:
 *  - idle:  polite polling (tens of seconds) long before release
 *  - tight: fast polling (hundreds of ms) in the final seconds and just after
 *
 * Resolves with the first availability observation that has slots, or null on give-up.
 */
export async function watchForOpening(
  client: PortalClient,
  targets: WatchTarget[],
  notifier: Notifier,
  opts: WatcherOptions,
): Promise<SlotAvailability | null> {
  const log = logger.child({ mod: "watcher" });
  const tightFrom = new Date(opts.releaseAt.getTime() - opts.leadMs);
  const giveUpAt = new Date(opts.releaseAt.getTime() + (opts.giveUpAfterMs ?? 15 * 60_000));

  log.info({ targets, releaseAt: opts.releaseAt, tightFrom }, "watching");

  // Idle regime: check occasionally in case the portal opens early or the schedule is wrong.
  while (Date.now() < tightFrom.getTime()) {
    const hit = await checkAll(client, targets, log);
    if (hit) return announce(hit, notifier, log);
    await Promise.race([
      new Promise((r) => setTimeout(r, opts.idleIntervalMs)),
      sleepUntil(tightFrom),
    ]);
  }

  // Tight regime.
  await sleepUntil(tightFrom);
  log.info("entering tight polling");
  while (Date.now() < giveUpAt.getTime()) {
    const hit = await checkAll(client, targets, log);
    if (hit) return announce(hit, notifier, log);
    await new Promise((r) => setTimeout(r, opts.tightIntervalMs));
  }

  log.warn("gave up — no slots appeared");
  await notifier.send(`No slots appeared for ${targets.map((t) => `${t.trekId}@${t.date}`).join(", ")}.`);
  return null;
}

async function checkAll(
  client: PortalClient,
  targets: WatchTarget[],
  log: typeof logger,
): Promise<SlotAvailability | null> {
  const results = await Promise.allSettled(targets.map((t) => client.getAvailability(t.trekId, t.date)));
  for (const r of results) {
    if (r.status === "rejected") {
      log.debug({ err: String(r.reason) }, "availability check failed");
      continue;
    }
    if (r.value.available === null || r.value.available > 0) return r.value;
  }
  return null;
}

async function announce(hit: SlotAvailability, notifier: Notifier, log: typeof logger): Promise<SlotAvailability> {
  log.info({ hit }, "SLOT OPEN");
  await notifier.send(
    `🟢 Slot open: trek ${hit.trekId} on ${hit.date}` +
      (hit.available !== null ? ` (${hit.available}/${hit.capacity ?? "?"} left)` : ""),
  );
  return hit;
}
