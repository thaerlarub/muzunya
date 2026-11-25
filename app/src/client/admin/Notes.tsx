// Notes tab: a dated log she sees, plus private notes only the admin sees.
import { useState } from "preact/hooks";
import { api } from "../api";
import { ConfirmButton, Field, fmtDate, toast } from "../ui";
import { todayMuscat } from "../../shared/dates";
import type { TabProps } from "./Customer";

export function Notes({ d, reload }: TabProps) {
  const [date, setDate] = useState(todayMuscat()), [text, setText] = useState(""), [priv, setPriv] = useState(false), [busy, setBusy] = useState(false);
  const add = async (e: Event) => {
    e.preventDefault(); if (!text.trim()) return;
    setBusy(true);
    try { await api.post(`/api/admin/customers/${encodeURIComponent(d.customer.user_id)}/notes`, { date, text: text.trim(), private: priv }); setText(""); await reload(); }
    catch { toast("تعذر الحفظ"); } finally { setBusy(false); }
  };
  const rm = async (id: string) => { try { await api.del(`/api/admin/notes/${encodeURIComponent(id)}`); await reload(); } catch { toast("تعذر الحذف"); } };
  const list = [...d.notes].sort((a, b) => b.date.localeCompare(a.date) || b.created_at - a.created_at);
  return (
    <div class="stack">
      <form class="card stack" onSubmit={add}>
        <Field label="التاريخ"><input type="date" value={date} onInput={(e) => setDate(e.currentTarget.value)} required /></Field>
        <Field label="الملاحظة"><textarea value={text} onInput={(e) => setText(e.currentTarget.value)} required /></Field>
        <label class="row"><input type="checkbox" class="cb" checked={priv} onChange={(e) => setPriv(e.currentTarget.checked)} /> خاصة، لا تظهر لها</label>
        <button class="btn" disabled={busy}>إضافة</button>
      </form>
      {list.length === 0 && <p class="empty">لا توجد ملاحظات.</p>}
      {list.map((n) => (
        <div class={"card note-it" + (n.private ? " priv" : "")}>
          <div class="row between"><b>{fmtDate(n.date)}</b>{n.private ? <span class="chip warn">خاص</span> : <span class="chip">تراها</span>}</div>
          <p class="pre">{n.text}</p>
          <ConfirmButton class="btn r sm" label="حذف" confirm="تأكيد الحذف" onConfirm={() => rm(n.id)} />
        </div>
      ))}
    </div>
  );
}
