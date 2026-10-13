import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("config", () => {
  it("defaults to DRY_RUN=true so nothing is ever booked by accident", () => {
    const cfg = loadConfig({});
    expect(cfg.DRY_RUN).toBe(true);
    expect(cfg.RELEASE_DAYS_AHEAD).toBe(15);
  });
});
