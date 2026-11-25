// Exercise library: list, add, edit, delete.
import { useEffect, useState } from "preact/hooks";
import { api } from "../api";
import { ConfirmButton, Field, Sheet, toast } from "../ui";
import type { Exercise } from "../../shared/types";

const KIND: Record<Exercise["kind"], string> = { r: "عدات", e: "لكل جهة", s: "ثواني" };
const PLACE = { home: "البيت", gym: "النادي" } as const;
const okUrl = (s: string) => { try { return new URL(s).protocol === "https:"; } catch { return false; } };

export function Exercises() {
  const [list, setList] = useState<Exercise[] | null>(null), [ed, setEd] = useState<Exercise | "new" | null>(null), [q, setQ] = useState("");
  const load = () => api.get<Exercise[]>("/api/admin/exercises").then(setList, () => { setList([]); toast("تعذر التحميل"); });
  useEffect(() => { load(); }, []);
  if (!list) return <p class="empty">جاري التحميل...</p>;
  const shown = list.filter((x) => !q.trim() || x.name_ar.includes(q.trim()) || x.name_en.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div class="stack">
      <h2>مكتبة التمارين</h2>
      <div class="row">
        <input class="grow" type="search" placeholder="بحث" aria-label="بحث" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
        <button class="btn" onClick={() => setEd("new")}>+ تمرين</button>
      </div>
      <ul class="clist">
        {shown.map((x) => (
          <li><button class="crow card" onClick={() => setEd(x)}>
            <div class="cmain"><b>{x.name_ar}</b><span class="note" dir="ltr">{x.name_en}</span></div>
            <div class="cstat"><span class="chip">{KIND[x.kind]}</span>{x.places.map((p) => <span class="chip">{PLACE[p]}</span>)}{x.video_url && <span title="فيديو">▶</span>}</div>
          </button></li>
        ))}
      </ul>
      {ed && <ExSheet x={ed === "new" ? null : ed} onClose={() => setEd(null)} done={() => { setEd(null); load(); }} />}
    </div>
  );
}

function ExSheet(p: { x: Exercise | null; onClose: () => void; done: () => void }) {
  const [f, setF] = useState({ name_ar: p.x?.name_ar ?? "", name_en: p.x?.name_en ?? "", kind: p.x?.kind ?? "r", places: p.x?.places ?? ["home", "gym"], video_url: p.x?.video_url ?? "" });
  const [uerr, setUerr] = useState("");
  const togg = (pl: "home" | "gym") => setF({ ...f, places: f.places.includes(pl) ? f.places.filter((y) => y !== pl) : [...f.places, pl] });
  const go = async (e: Event) => {
    e.preventDefault();
    const url = f.video_url.trim();
    if (url && !okUrl(url)) return setUerr("الرابط غير صحيح، استخدم رابطا آمنا كاملا كما في المثال");
    if (!f.places.length) return toast("اختر مكانا واحدا على الأقل");
    const body = { ...f, name_ar: f.name_ar.trim(), name_en: f.name_en.trim(), video_url: url || null };
    try {
      p.x ? await api.put(`/api/admin/exercises/${encodeURIComponent(p.x.id)}`, body) : await api.post("/api/admin/exercises", body);
      toast("تم الحفظ"); p.done();
    } catch { toast("تعذر الحفظ"); }
  };
  const del = async () => { try { await api.del(`/api/admin/exercises/${encodeURIComponent(p.x!.id)}`); toast("تم الحذف"); p.done(); } catch { toast("تعذر الحذف"); } };
  return (
    <Sheet title={p.x ? "تعديل تمرين" : "تمرين جديد"} onClose={p.onClose}>
      <div class="stack">
      <form class="stack" onSubmit={go}>
        <Field label="الاسم بالعربي"><input value={f.name_ar} onInput={(e) => setF({ ...f, name_ar: e.currentTarget.value })} required /></Field>
        <Field label="الاسم بالإنجليزي"><input dir="ltr" value={f.name_en} onInput={(e) => setF({ ...f, name_en: e.currentTarget.value })} /></Field>
        <Field label="النوع">
          <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.currentTarget.value as Exercise["kind"] })}>
            {(Object.keys(KIND) as Exercise["kind"][]).map((k) => <option value={k}>{KIND[k]}</option>)}
          </select>
        </Field>
        <div class="row">
          {(["home", "gym"] as const).map((pl) => <label class="fchip"><input type="checkbox" checked={f.places.includes(pl)} onChange={() => togg(pl)} /> {PLACE[pl]}</label>)}
        </div>
        <Field label="رابط الفيديو">
          <input dir="ltr" type="url" inputMode="url" placeholder="https://" value={f.video_url} onInput={(e) => { setF({ ...f, video_url: e.currentTarget.value }); setUerr(""); }} aria-invalid={!!uerr} />
          {uerr && <span class="err" role="alert">{uerr}</span>}
        </Field>
        <button class="btn wide">حفظ</button>
      </form>
      {p.x && <ConfirmButton label="حذف التمرين" confirm="متأكد؟ اضغط مرة ثانية" onConfirm={del} />}
      </div>
    </Sheet>
  );
}
