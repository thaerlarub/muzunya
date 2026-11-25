import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import "./app.css";
import { api, ApiError, setCsrf } from "./api";
import { Toaster, setAccent, toast, Field } from "./ui";
import type { MeAdmin, MeCustomer } from "../shared/types";
import { AdminApp } from "./admin/App";
import { CustomerApp } from "./customer/App";
import { Print } from "./pages/Print";
import { Gift } from "./pages/Gift";
import { cachedMe } from "./store";

type Me = MeAdmin | MeCustomer;

export function useHash() {
  const [h, setH] = useState(location.hash.slice(1) || "/");
  useEffect(() => { const f = () => setH(location.hash.slice(1) || "/"); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return h;
}

function Login(p: { done: () => void }) {
  const [phone, setPhone] = useState(""), [pw, setPw] = useState(""), [busy, setBusy] = useState(false);
  const go = async (e: Event) => {
    e.preventDefault(); setBusy(true);
    try { await api.post("/api/auth/login", { phone, password: pw }); p.done(); }
    catch (x) {
      const c = x instanceof ApiError ? (x.status === 429 ? "محاولات كثيرة، حاولي بعد 15 دقيقة" : x.code === "archived" ? "هذا الحساب موقوف، تواصلي معنا" : "الرقم أو كلمة المرور غير صحيحة") : "تعذر الاتصال، تأكدي من الإنترنت";
      toast(c);
    } finally { setBusy(false); }
  };
  return (
    <main class="auth">
      <div class="logo big">مزيونة</div>
      <p class="tl">خلطة الأنوثة</p>
      <form class="card" onSubmit={go}>
        <Field label="رقم الهاتف"><input dir="ltr" inputMode="tel" autoComplete="username" value={phone} onInput={(e) => setPhone(e.currentTarget.value)} required /></Field>
        <Field label="كلمة المرور"><input type="password" autoComplete="current-password" value={pw} onInput={(e) => setPw(e.currentTarget.value)} required /></Field>
        <button class="btn wide" disabled={busy}>{busy ? "جاري الدخول..." : "دخول"}</button>
      </form>
    </main>
  );
}

function SetPassword(p: { done: () => void }) {
  const [cur, setCur] = useState(""), [a, setA] = useState(""), [b, setB] = useState(""), [busy, setBusy] = useState(false);
  const go = async (e: Event) => {
    e.preventDefault();
    if (a.length < 6) return toast("كلمة المرور 6 أحرف على الأقل");
    if (a !== b) return toast("كلمتا المرور غير متطابقتين");
    setBusy(true);
    try { await api.post("/api/auth/password", { current: cur, next: a }); toast("تم حفظ كلمة المرور"); p.done(); }
    catch { toast("كلمة المرور المؤقتة غير صحيحة"); } finally { setBusy(false); }
  };
  return (
    <main class="auth">
      <div class="logo big">مزيونة</div>
      <form class="card" onSubmit={go}>
        <h2>اختاري كلمة مرور جديدة</h2>
        <p class="note">هذه أول مرة تدخلين، اكتبي كلمة المرور المؤقتة ثم كلمة مرورك الجديدة.</p>
        <Field label="كلمة المرور المؤقتة"><input type="password" autoComplete="current-password" value={cur} onInput={(e) => setCur(e.currentTarget.value)} required /></Field>
        <Field label="كلمة المرور الجديدة"><input type="password" autoComplete="new-password" value={a} onInput={(e) => setA(e.currentTarget.value)} required /></Field>
        <Field label="تأكيد كلمة المرور"><input type="password" autoComplete="new-password" value={b} onInput={(e) => setB(e.currentTarget.value)} required /></Field>
        <button class="btn wide" disabled={busy}>حفظ</button>
      </form>
    </main>
  );
}

function Root() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const hash = useHash();
  const load = async () => {
    try { const m = await api.get<Me>("/api/me"); setCsrf(m.csrf); if ("settings" in m && m.settings?.accent) setAccent(m.settings.accent); setMe(m); }
    catch (e) {
      if (e instanceof ApiError && e.status === 401) return setMe(null);
      const cached = await cachedMe(); // offline: open her saved copy, ticks queue until back online
      if (cached) return setMe(cached);
      toast("تعذر الاتصال، تأكدي من الإنترنت");
    }
  };
  useEffect(() => { load(); }, []);
  if (me === undefined) return <div class="loading">مزيونة</div>;
  if (me === null) return <Login done={load} />;
  if (me.user.must_change) return <SetPassword done={load} />;
  const pm = hash.match(/^\/print\/(plan|gift)\/([\w-]+)/);
  if (pm) return pm[1] === "plan" ? <Print cid={pm[2]} me={me} /> : <Gift cid={pm[2]} me={me} />;
  return me.user.role === "admin" ? <AdminApp me={me as MeAdmin} hash={hash} reload={load} /> : <CustomerApp me={me as MeCustomer} hash={hash} reload={load} />;
}

render(<><Root /><Toaster /></>, document.getElementById("app")!);
