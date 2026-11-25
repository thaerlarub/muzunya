// Settings: WhatsApp number, accent colour, Muzuna label per 25 g.
import { useState } from "preact/hooks";
import { api } from "../api";
import { Field, setAccent, toast } from "../ui";
import type { MeAdmin } from "../../shared/types";
import { normPhone } from "../../shared/phone";
import { num } from "./List";

const SW = ["#c48bd9", "#d98ca3", "#b98a6e", "#7fa9a0"];

export function Settings(p: { me: MeAdmin; reload: () => void }) {
  const s = p.me.settings;
  const [wa, setWa] = useState(s.whatsapp ?? ""), [acc, setAcc] = useState(s.accent || SW[0]);
  const [kcal, setKcal] = useState(s.muzuna_kcal == null ? "" : String(s.muzuna_kcal)), [prot, setProt] = useState(s.muzuna_prot == null ? "" : String(s.muzuna_prot));
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const pick = (c: string) => { setAcc(c); setAccent(c); };
  const go = async (e: Event) => {
    e.preventDefault();
    const w = wa.trim() ? normPhone(wa) : "";
    if (w === null) return setErr("رقم غير صحيح");
    setBusy(true);
    try { await api.put("/api/admin/settings", { whatsapp: w, accent: acc, muzuna_kcal: num(kcal), muzuna_prot: num(prot) }); toast("تم الحفظ"); p.reload(); }
    catch { toast("تعذر الحفظ"); } finally { setBusy(false); }
  };
  return (
    <form class="stack narrow" onSubmit={go}>
      <h2>الإعدادات</h2>
      <div class="card stack">
        <Field label="رقم واتساب للتجديد والتواصل">
          <input dir="ltr" inputMode="tel" value={wa} onInput={(e) => { setWa(e.currentTarget.value); setErr(""); }} aria-invalid={!!err} />
          {err && <span class="err" role="alert">{err}</span>}
        </Field>
      </div>
      <div class="card stack">
        <h3>لون التطبيق</h3>
        <div class="row" role="radiogroup" aria-label="اللون">
          {SW.map((c) => <button type="button" role="radio" aria-checked={acc === c} class={"sw" + (acc === c ? " on" : "")} style={{ background: c }} onClick={() => pick(c)} aria-label={c} />)}
          <label class="sw cust" title="لون آخر"><input type="color" value={acc} onInput={(e) => pick(e.currentTarget.value)} aria-label="لون آخر" /></label>
        </div>
      </div>
      <div class="card stack">
        <h3>مزيونة لكل 25 غ</h3>
        <div class="two">
          <Field label="السعرات"><input type="number" inputMode="numeric" min="0" value={kcal} onInput={(e) => setKcal(e.currentTarget.value)} /></Field>
          <Field label="البروتين (غ)"><input type="number" inputMode="decimal" step="0.1" min="0" value={prot} onInput={(e) => setProt(e.currentTarget.value)} /></Field>
        </div>
        <p class="note">عند إدخال السعرات تطرح من هدف اليوم قبل تحجيم الكميات، فيبقى مجموع اليوم على الهدف. اتركها فارغة إذا لم تعرف الملصق.</p>
      </div>
      <button class="btn" disabled={busy}>{busy ? "جاري الحفظ..." : "حفظ الإعدادات"}</button>
    </form>
  );
}
