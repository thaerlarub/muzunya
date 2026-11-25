// Recipe book (read only for the customer).
import { useEffect, useState } from "preact/hooks";
import type { Recipe } from "../../shared/types";
import { api, photoUrl } from "../api";
import { Sheet } from "../ui";

const SECTIONS: [Recipe["section"], string][] = [["m", "وصفات مزيونة"], ["b", "الإفطار"], ["l", "الوجبات الأساسية"], ["n", "السناك"]];

export function RecipeBook() {
  const [list, setList] = useState<Recipe[] | null>(null), [err, setErr] = useState(false), [open, setOpen] = useState<Recipe | null>(null);
  useEffect(() => { api.get<Recipe[]>("/api/recipes").then(setList, () => setErr(true)); }, []);
  if (err) return <p class="empty">تعذر تحميل الوصفات، تأكدي من الإنترنت.</p>;
  if (!list) return <p class="empty">جاري التحميل...</p>;
  return (
    <div class="stack">
      <h2>كتاب الوصفات</h2>
      {SECTIONS.map(([s, name]) => {
        const rs = list.filter((r) => r.section === s).sort((a, b) => a.sort - b.sort);
        return rs.length ? (
          <section key={s}>
            <h3>{name}</h3>
            <div class="rc-grid">
              {rs.map((r) => (
                <button class="rc" key={r.id} onClick={() => setOpen(r)}>
                  {r.photos[0] ? <img src={photoUrl(r.photos[0])} alt="" loading="lazy" /> : <div class="rc-e" aria-hidden="true">{r.body.e.join(" ")}</div>}
                  <b>{r.title}</b>
                  {r.tag && <span class="chip">{r.tag}</span>}
                </button>
              ))}
            </div>
          </section>
        ) : null;
      })}
      {open && (
        <Sheet title={open.title} onClose={() => setOpen(null)}>
          <div class="rc-d">
            {open.photos.length ? <div class="rc-ph">{open.photos.map((id) => <img key={id} src={photoUrl(id)} alt="" />)}</div> : null}
            <h3>المكونات</h3>
            <ul>{open.body.ing.map((x, i) => <li key={i}>{x}</li>)}</ul>
            <h3>طريقة التحضير</h3>
            <ol>{open.body.st.map((x, i) => <li key={i}>{x}</li>)}</ol>
            {open.body.why && <p class="rc-why"><b>لماذا هذه الوصفة؟</b><br />{open.body.why}</p>}
            {open.body.nt && <p class="note">{open.body.nt}</p>}
          </div>
        </Sheet>
      )}
    </div>
  );
}
