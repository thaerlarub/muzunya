// Photo gallery: grid by date, tap to view large. Shared by the customer Journey and the admin customer page.
import { useState } from "preact/hooks";
import type { Photo } from "../shared/types";
import { photoUrl } from "./api";
import { ConfirmButton, Field, Sheet, fmtDate, toast } from "./ui";
import { OFFLINE_MSG } from "./photo";
import { todayMuscat } from "../shared/dates";

export function Gallery(p: { photos: Photo[]; canDelete: (p: Photo) => boolean; onAdd?: (file: File, date: string, caption: string) => Promise<void>; onDelete: (p: Photo) => Promise<void> }) {
  const [open, setOpen] = useState<Photo | null>(null);
  const [adding, setAdding] = useState(false);
  const list = [...p.photos].sort((a, b) => b.date.localeCompare(a.date) || b.created_at - a.created_at);
  return (
    <div class="gal">
      {p.onAdd && <button class="btn g wide" onClick={() => setAdding(true)}>+ إضافة صورة</button>}
      {list.length ? (
        <div class="gal-grid">
          {list.map((x) => (
            <button class="gal-it" key={x.id} onClick={() => setOpen(x)} aria-label={x.caption || fmtDate(x.date)}>
              <img src={photoUrl(x.id)} alt="" loading="lazy" />
              <span>{fmtDate(x.date)}</span>
            </button>
          ))}
        </div>
      ) : <p class="empty">لا توجد صور بعد. صورة الميزان، وجبة، أو فستان تحبينه.</p>}
      {open && (
        <Sheet title={fmtDate(open.date)} onClose={() => setOpen(null)}>
          <img class="gal-big" src={photoUrl(open.id)} alt={open.caption || ""} />
          {open.caption && <p>{open.caption}</p>}
          {p.canDelete(open) && <ConfirmButton label="حذف الصورة" confirm="اضغطي مرة ثانية للحذف" onConfirm={async () => {
            try { await p.onDelete(open); setOpen(null); toast("تم حذف الصورة"); } catch { toast("تعذر الحذف، حاولي لاحقا"); }
          }} />}
        </Sheet>
      )}
      {adding && p.onAdd && <AddPhoto onAdd={p.onAdd} onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddPhoto(p: { onAdd: (file: File, date: string, caption: string) => Promise<void>; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null), [date, setDate] = useState(todayMuscat()), [cap, setCap] = useState(""), [busy, setBusy] = useState(false);
  const online = navigator.onLine;
  const go = async (e: Event) => {
    e.preventDefault();
    if (!file) return toast("اختاري صورة أولا");
    setBusy(true);
    try { await p.onAdd(file, date, cap.trim()); toast("تمت إضافة الصورة"); p.onClose(); }
    catch (x) { toast(x instanceof Error && x.message === OFFLINE_MSG ? OFFLINE_MSG : "تعذر رفع الصورة، حاولي مرة ثانية"); }
    finally { setBusy(false); }
  };
  return (
    <Sheet title="صورة جديدة" onClose={p.onClose}>
      <form class="gal-form" onSubmit={go}>
        <Field label="الصورة"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)} /></Field>
        <Field label="التاريخ"><input type="date" value={date} max={todayMuscat()} onInput={(e) => setDate(e.currentTarget.value)} required /></Field>
        <Field label="وصف قصير"><input value={cap} maxLength={140} onInput={(e) => setCap(e.currentTarget.value)} /></Field>
        <button class="btn wide" disabled={busy || !online}>{!online ? OFFLINE_MSG : busy ? "جاري الرفع..." : "رفع الصورة"}</button>
      </form>
    </Sheet>
  );
}
