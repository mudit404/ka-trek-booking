import { describe, expect, it } from "vitest";
import { nextReleasedTrekDate, releaseInstantFor, sleepUntil, toISODateIST } from "../src/scheduler/release.js";

describe("release schedule", () => {
  it("formats dates in IST, not UTC", () => {
    // 2026-10-13 20:00 UTC is 2026-10-14 01:30 IST
    expect(toISODateIST(new Date("2026-10-13T20:00:00Z"))).toBe("2026-10-14");
  });

  it("computes the trek date unlocked by the next release", () => {
    expect(nextReleasedTrekDate(new Date("2026-10-13T10:00:00Z"), 15)).toBe("2026-10-28");
  });

  it("computes the release instant in UTC for an IST release time", () => {
    // Trek on 2026-10-28, released 15 days earlier at 00:00:00 IST = 2026-10-12T18:30:00Z
    const at = releaseInstantFor("2026-10-28", 15, "00:00:00");
    expect(at.toISOString()).toBe("2026-10-12T18:30:00.000Z");
  });

  it("round-trips: the next released date's release instant is in the future", () => {
    const now = new Date("2026-10-13T10:00:00Z");
    const date = nextReleasedTrekDate(now, 15);
    // Release for that date was at 00:00 IST today, which is before 10:00 UTC — so expect the *next* midnight for date+1.
    const nextDate = nextReleasedTrekDate(new Date(now.getTime() + 86_400_000), 15);
    expect(releaseInstantFor(nextDate, 15, "00:00:00").getTime()).toBeGreaterThan(now.getTime());
    expect(date < nextDate).toBe(true);
  });

  it("sleepUntil lands at or after the target", async () => {
    const target = new Date(Date.now() + 40);
    await sleepUntil(target);
    expect(Date.now()).toBeGreaterThanOrEqual(target.getTime());
  });
});
