// Recipe book admin: list by section, add, edit, delete, two photos per recipe.
import { useEffect, useState } from "preact/hooks";
import { api, photoUrl } from "../api";
import { ConfirmButton, Field, Sheet, toast } from "../ui";
import type { Recipe } from "../../shared/types";
import { todayMuscat } from "../../shared/dates";
import { OFFLINE_MSG, uploadPhoto } from "../photo";

const SECTIONS: [Recipe["section"], string][] = [["m", "وصفات مزيونة"], ["b", "الإفطار"], ["l", "الوجبات الأساسية"], ["n", "السناك"]];
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export function RecipesAdmin() {
  const [list, setList] = useState<Recipe[] | null>(null), [ed, setEd] = useState<Recipe | "new" | null>(null);
  const load = () => api.get<Recipe[]>("/api/recipes").then((l) => { setList(l); if (ed && ed !== "new") setEd(l.find((r) => r.id === ed.id) ?? null); }, () => { setList([]); toast("تعذر التحميل"); });
  useEffect(() => { load(); }, []);
  if (!list) return <p class="empty">جاري التحميل...</p>;
  return (
    <div class="stack">
      <div class="row between"><h2>كتاب الوصفات</h2><button class="btn" onClick={() => setEd("new")}>+ وصفة</button></div>
      {SECTIONS.map(([s, name]) => {
        const rs = list.filter((r) => r.section === s).sort((a, b) => a.sort - b.sort);
        return (
          <section class="stack">
            <h3>{name} <small class="note">({rs.length})</small></h3>
            <ul class="clist">
              {rs.map((r) => (
                <li><button class="crow card" onClick={() => setEd(r)}>
                  <div class="cmain"><b>{r.body.e.join(" ")} {r.title}</b>{r.tag && <span class="note">{r.tag}</span>}</div>
                  <div class="cstat">{r.photos.map((id) => <img class="thumb" src={photoUrl(id)} alt="" loading="lazy" />)}</div>
                </button></li>
              ))}
            </ul>
          </section>
        );
      })}
      {ed && <RecipeSheet r={ed === "new" ? null : ed} nextSort={Math.max(0, ...list.map((r) => r.sort)) + 1} onClose={() => setEd(null)} saved={load} />}
    </div>
  );
}

function RecipeSheet(p: { r: Recipe | null; nextSort: number; onClose: () => void; saved: () => Promise<void> }) {
  const r = p.r;
  const [f, setF] = useState({ title: r?.title ?? "", section: r?.section ?? "m", tag: r?.tag ?? "", e: r?.body.e.join(" ") ?? "", ing: r?.body.ing.join("\n") ?? "", st: r?.body.st.join("\n") ?? "", why: r?.body.why ?? "", nt: r?.body.nt ?? "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { currentTarget: { value: string } }) => setF({ ...f, [k]: e.currentTarget.value });
  const go = async (e: Event) => {
    e.preventDefault(); setBusy(true);
    const body = { e: f.e.split(/\s+/).filter(Boolean), ing: lines(f.ing), st: lines(f.st), ...(f.why.trim() && { why: f.why.trim() }), ...(f.nt.trim() && { nt: f.nt.trim() }) };
    const data = { section: f.section, title: f.title.trim(), tag: f.tag.trim() || null, body, sort: r?.sort ?? p.nextSort };
    try {
      r ? await api.put(`/api/admin/recipes/${encodeURIComponent(r.id)}`, data) : await api.post("/api/admin/recipes", data);
      toast("تم الحفظ"); await p.saved(); p.onClose();
    } catch { toast("تعذر الحفظ"); setBusy(false); }
  };
  const del = async () => { try { await api.del(`/api/admin/recipes/${encodeURIComponent(r!.id)}`); toast("تم الحذف"); p.onClose(); await p.saved(); } catch { toast("تعذر الحذف"); } };
  const addPhoto = async (file: File | undefined) => {
    if (!file || !r) return;
    setBusy(true);
    try { await uploadPhoto({ file, date: todayMuscat(), caption: "", recipe_id: r.id }); await p.saved(); } catch (x) { toast(x instanceof Error && x.message === OFFLINE_MSG ? OFFLINE_MSG : "تعذر رفع الصورة"); }
    finally { setBusy(false); }
  };
  const rmPhoto = async (id: string) => { try { await api.del(`/api/photos/${encodeURIComponent(id)}`); await p.saved(); } catch { toast("تعذر الحذف"); } };
  return (
    <Sheet title={r ? "تعديل وصفة" : "وصفة جديدة"} onClose={p.onClose}>
      <div class="stack">
      <form class="stack" onSubmit={go}>
        <Field label="العنوان"><input value={f.title} onInput={set("title")} required /></Field>
        <div class="two">
          <Field label="القسم"><select value={f.section} onChange={set("section")}>{SECTIONS.map(([k, n]) => <option value={k}>{n}</option>)}</select></Field>
          <Field label="الوسم"><input value={f.tag} onInput={set("tag")} /></Field>
        </div>
        <Field label="الرموز (مفصولة بمسافة)"><input value={f.e} onInput={set("e")} /></Field>
        <Field label="المكونات (سطر لكل مكون)"><textarea value={f.ing} onInput={set("ing")} /></Field>
        <Field label="طريقة التحضير (سطر لكل خطوة)"><textarea value={f.st} onInput={set("st")} /></Field>
        <Field label="لماذا تفيدها"><textarea rows={2} value={f.why} onInput={set("why")} /></Field>
        <Field label="ملاحظة"><textarea rows={2} value={f.nt} onInput={set("nt")} /></Field>
        <button class="btn wide" disabled={busy}>حفظ</button>
      </form>
        {r && (
          <div class="stack">
            <h3>الصور ({r.photos.length}/2)</h3>
            <div class="row">
              {r.photos.map((id) => (
                <div class="rph"><img src={photoUrl(id)} alt="" /><ConfirmButton class="btn r sm" label="حذف" confirm="تأكيد" onConfirm={() => rmPhoto(id)} /></div>
              ))}
            </div>
            {r.photos.length < 2 && <label class="btn g">{busy ? "جاري الرفع..." : "+ إضافة صورة"}<input type="file" hidden accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => { addPhoto(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }} /></label>}
          </div>
        )}
        {!r && <p class="note">احفظ الوصفة أولا ثم أضف الصور.</p>}
        {r && <ConfirmButton label="حذف الوصفة" confirm="متأكد؟ اضغط مرة ثانية" onConfirm={del} />}
      </div>
    </Sheet>
  );
}
