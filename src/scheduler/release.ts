import type { ISODate } from "../portal/types.js";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Format a Date as YYYY-MM-DD in IST. */
export function toISODateIST(d: Date): ISODate {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * The trek date that becomes bookable at the next release.
 * Design doc: "bookings open 15 days in advance" — verify in recon.
 */
export function nextReleasedTrekDate(now: Date, daysAhead: number): ISODate {
  const nowIST = new Date(now.getTime() + IST_OFFSET_MS);
  nowIST.setUTCDate(nowIST.getUTCDate() + daysAhead);
  return nowIST.toISOString().slice(0, 10);
}

/**
 * Instant (UTC) at which bookings for `trekDate` are expected to open,
 * given the release happens `daysAhead` days before at `releaseTimeIST` (HH:MM:SS).
 */
export function releaseInstantFor(trekDate: ISODate, daysAhead: number, releaseTimeIST: string): Date {
  const [hh, mm, ss] = releaseTimeIST.split(":").map(Number) as [number, number, number];
  const [y, m, d] = trekDate.split("-").map(Number) as [number, number, number];
  // Build the release day in IST, then convert to UTC by subtracting the offset.
  const releaseDayIST = Date.UTC(y, m - 1, d - daysAhead, hh, mm, ss);
  return new Date(releaseDayIST - IST_OFFSET_MS);
}

/**
 * Sleep until `target`, waking a little early and then busy-waiting the last
 * few milliseconds so we land as close to the instant as the event loop allows.
 * setTimeout alone can be late by tens of ms under load.
 */
export async function sleepUntil(target: Date, { spinMs = 15 }: { spinMs?: number } = {}): Promise<void> {
  const remaining = () => target.getTime() - Date.now();
  while (remaining() > spinMs) {
    await new Promise((r) => setTimeout(r, Math.min(remaining() - spinMs, 1_000)));
  }
  while (remaining() > 0) {
    /* spin */
  }
}
