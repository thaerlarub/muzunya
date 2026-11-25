// Shared UI primitives. Keep this small; screens own their own CSS files.
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";

let toastFn: (m: string) => void = () => {};
export const toast = (m: string) => toastFn(m);
export function Toaster() {
  const [m, setM] = useState("");
  useEffect(() => {
    let t: number | undefined;
    toastFn = (x) => { setM(x); clearTimeout(t); t = window.setTimeout(() => setM(""), 2600); };
  }, []);
  return m ? <div class="toast" role="status">{m}</div> : null;
}

export function Sheet(p: { title: string; onClose: () => void; children: ComponentChildren }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") p.onClose(); };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, []);
  return (
    <div class="sheet" onClick={(e) => { if (e.target === e.currentTarget) p.onClose(); }}>
      <div class="sbody" role="dialog" aria-modal="true" aria-label={p.title}>
        <div class="shead"><h2>{p.title}</h2><button class="x" onClick={p.onClose} aria-label="إغلاق">×</button></div>
        {p.children}
      </div>
    </div>
  );
}

export function Field(p: { label: string; children: ComponentChildren }) {
  return <label class="field">{p.label}{p.children}</label>;
}

/** Two-tap confirm button for destructive actions (no confirm() dialogs). */
export function ConfirmButton(p: { label: string; confirm: string; onConfirm: () => void; class?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (armed) { const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); } }, [armed]);
  return <button type="button" class={p.class ?? "btn r"} onClick={() => (armed ? (setArmed(false), p.onConfirm()) : setArmed(true))}>{armed ? p.confirm : p.label}</button>;
}

/** Colour mix in JS (no color-mix in print pages). */
export function mix(hex: string, to: string, p: number): string {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const ch = (x: number, s: number) => (x >> s) & 255;
  const m = (s: number) => Math.round(ch(a, s) * (1 - p) + ch(b, s) * p);
  return "#" + [16, 8, 0].map((s) => m(s).toString(16).padStart(2, "0")).join("");
}
export function setAccent(c: string) {
  const r = document.documentElement.style;
  r.setProperty("--a", c); r.setProperty("--a2", mix(c, "#ffffff", .78)); r.setProperty("--a3", mix(c, "#ffffff", .91));
  r.setProperty("--ad", mix(c, "#000000", .3)); r.setProperty("--c1", mix(c, "#ffffff", .18)); r.setProperty("--c2", mix(c, "#000000", .08));
}

export const fmtDate = (d: string) => d ? new Date(d + "T12:00:00").toLocaleDateString("ar-OM-u-nu-latn", { day: "numeric", month: "short" }) : "";
export const Phone = (p: { n: string }) => <bdo dir="ltr">{p.n}</bdo>;
