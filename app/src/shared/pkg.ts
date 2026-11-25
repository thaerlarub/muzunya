import { addDays, diffDays } from "./dates.ts";

/** Orders stack: each starts at the later of its date and the current end; a month is 30 days. */
export function packageEnd(orders: { order_date: string; months: number }[]): string | null {
  let end: string | null = null;
  for (const o of [...orders].sort((a, b) => (a.order_date < b.order_date ? -1 : 1))) {
    end = addDays(end && end > o.order_date ? end : o.order_date, o.months * 30);
  }
  return end;
}
export const packageDaysLeft = (end: string, today: string): number => diffDays(end, today);
/** Due 5 days or less before the end, and while overdue. */
export const packageDue = (end: string | null, today: string): boolean => end != null && packageDaysLeft(end, today) <= 5;
