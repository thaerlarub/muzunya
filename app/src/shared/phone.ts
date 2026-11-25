/** Normalise a phone number to +<digits>; 8-digit Omani numbers get +968. Null when invalid. */
export function normPhone(s: string): string | null {
  let p = s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
    .replace(/[\s\-.()\p{Cf}]/gu, ""); // \p{Cf}: invisible direction marks from pasted numbers
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (/^[79]\d{7}$/.test(p)) return "+968" + p;
  if (/^968\d{8}$/.test(p)) return "+" + p;
  return /^\+\d{8,15}$/.test(p) ? p : null;
}
