import { logger } from "../logger.js";
import type { BookingOutcome, BookingRequest, ISODate, SlotAvailability } from "./types.js";

export interface PortalClientOptions {
  baseUrl: string;
  availabilityPath: string;
  bookingPath: string;
  /** Session cookie(s) obtained after OTP login. Optional for unauthenticated availability checks. */
  cookie?: string;
  dryRun: boolean;
  timeoutMs?: number;
}

export class PortalNotMappedError extends Error {
  constructor(what: string) {
    super(
      `${what} is not mapped yet. Run the recon steps in recon/README.md, then ` +
        `implement the request/response in src/portal/client.ts and set PORTAL_*_PATH in .env.`,
    );
    this.name = "PortalNotMappedError";
  }
}

/**
 * Thin HTTP client for the portal.
 *
 * Deliberately built on plain `fetch` so a booking is a single request once the
 * API is mapped. If recon shows the portal is server-rendered with CSRF tokens
 * and no JSON API, swap the internals for Playwright — the public surface stays
 * the same.
 */
export class PortalClient {
  private readonly log = logger.child({ mod: "portal" });

  constructor(private readonly opts: PortalClientOptions) {}

  async getAvailability(trekId: string, date: ISODate): Promise<SlotAvailability> {
    if (this.opts.availabilityPath.startsWith("/TODO")) {
      throw new PortalNotMappedError("availability endpoint");
    }
    const url = new URL(this.opts.availabilityPath, this.opts.baseUrl);
    url.searchParams.set("trekId", trekId);
    url.searchParams.set("date", date);

    const res = await this.request(url, { method: "GET" });
    // TODO(recon): parse the real response shape.
    const body = (await res.json()) as { available?: number; capacity?: number };
    return {
      trekId,
      date,
      available: body.available ?? null,
      capacity: body.capacity ?? null,
      observedAt: new Date(),
    };
  }

  async book(req: BookingRequest, date: ISODate): Promise<BookingOutcome> {
    const payload = this.buildPayload(req, date);

    if (this.opts.dryRun) {
      this.log.warn({ requestId: req.requestId, date }, "DRY_RUN — not submitting booking");
      return { status: "dry_run", payload };
    }
    if (this.opts.bookingPath.startsWith("/TODO")) {
      throw new PortalNotMappedError("booking endpoint");
    }
    if (!this.opts.cookie) {
      return { status: "rejected", reason: "no authenticated session" };
    }

    const url = new URL(this.opts.bookingPath, this.opts.baseUrl);
    const res = await this.request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    // TODO(recon): map real success / sold-out / validation responses.
    if (res.status === 409) return { status: "sold_out", date };
    if (!res.ok) return { status: "rejected", reason: `HTTP ${res.status}` };
    const body = (await res.json()) as { bookingRef: string; payBy?: string; paymentUrl?: string };
    return {
      status: "held",
      bookingRef: body.bookingRef,
      payBy: body.payBy ? new Date(body.payBy) : new Date(Date.now() + 10 * 60_000),
      ...(body.paymentUrl ? { paymentUrl: body.paymentUrl } : {}),
    };
  }

  /** Builds the exact body the portal expects. Kept separate so it can be prepared before release time. */
  buildPayload(req: BookingRequest, date: ISODate): Record<string, unknown> {
    return {
      trekId: req.trekId,
      date,
      mobile: req.contactMobile,
      participants: req.participants.map((p) => ({
        name: p.name,
        age: p.age,
        gender: p.gender,
        idProofType: p.idProofType,
        idNumber: p.idNumber,
      })),
      clientRequestId: req.requestId,
    };
  }

  private async request(url: URL, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("user-agent", "ka-trek-booking/0.1 (+personal booking assistant)");
    if (this.opts.cookie) headers.set("cookie", this.opts.cookie);

    const started = performance.now();
    const res = await fetch(url, {
      ...init,
      headers,
      signal: AbortSignal.timeout(this.opts.timeoutMs ?? 8_000),
    });
    this.log.debug(
      { method: init.method, path: url.pathname, status: res.status, ms: Math.round(performance.now() - started) },
      "portal request",
    );
    return res;
  }
}
