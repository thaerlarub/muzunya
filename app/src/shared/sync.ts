import type { DayBody } from "./types.ts";

/** Per key the tuple with the larger time wins; on a tie b wins. */
export function mergeDay(a: DayBody, b: DayBody): DayBody {
  const out: DayBody = { ...a };
  for (const k in b) if (!out[k] || b[k][1] >= out[k][1]) out[k] = b[k];
  return out;
}

export const applyTick = (body: DayBody, key: string, v: number, t: number): DayBody => mergeDay(body, { [key]: [v, t] });
