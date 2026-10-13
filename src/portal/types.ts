/**
 * Domain types for the Aranya Vihaara portal.
 *
 * Everything here is a best guess from public guides and will be refined once
 * recon maps the real request/response shapes (see recon/README.md).
 */

/** ISO date, YYYY-MM-DD, interpreted in IST. */
export type ISODate = string;

export interface Trek {
  /** Portal's identifier for the trek — discovered in recon. */
  id: string;
  name: string;
  /** Forest division / district the portal groups it under (e.g. "Chikkamagaluru"). */
  division?: string;
}

export interface SlotAvailability {
  trekId: string;
  date: ISODate;
  /** Permits still available. `null` when the portal only says "available"/"full". */
  available: number | null;
  capacity: number | null;
  observedAt: Date;
}

export type Gender = "M" | "F" | "O";
export type IdProofType = "AADHAAR" | "PASSPORT" | "DRIVING_LICENCE";

export interface Participant {
  name: string;
  age: number;
  gender: Gender;
  idProofType: IdProofType;
  /** Stored encrypted at rest; never logged. */
  idNumber: string;
}

export interface BookingRequest {
  /** Our own id for idempotency — the same request must never book twice. */
  requestId: string;
  trekId: string;
  /** Preferred date first, fallbacks after, in priority order. */
  dates: ISODate[];
  participants: Participant[];
  contactMobile: string;
  /** UPI VPA to send the collect request to once the slot is held. */
  upiId: string;
}

export type BookingOutcome =
  | { status: "held"; bookingRef: string; payBy: Date; paymentUrl?: string }
  | { status: "confirmed"; bookingRef: string; permitUrl?: string }
  | { status: "sold_out"; date: ISODate }
  | { status: "rejected"; reason: string }
  | { status: "dry_run"; payload: unknown };
