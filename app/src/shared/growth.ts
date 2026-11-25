import type { Customer, Followup } from "./types.ts";
import { latestWeight, progress } from "./badges.ts";

/** Mascot growth 0..1: share of the way to the goal, or whole kg toward the track direction out of 6. */
export function growth(customer: Customer, followups: Followup[]): number {
  const p = progress(customer, followups);
  if (p != null) return p;
  const lw = latestWeight(customer, followups);
  if (lw == null || customer.w0 == null) return 0;
  const kg = Math.floor((lw - customer.w0) * (customer.track === "loss" ? -1 : 1) + 1e-9);
  return Math.min(1, Math.max(0, kg / 6));
}
