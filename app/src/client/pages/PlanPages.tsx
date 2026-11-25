// A4 plan pages: expands rotation (7 plan days a page) and exDays (one page per workout day), adds page tab and footer.
import "./pages.css";
import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { Page, PlanBody, PlanCtx, PlanType } from "../../shared/types";
import { targets } from "../../shared/portions";
import { todayMuscat } from "../../shared/dates";
import { PAGE_TEXT } from "../../shared/templates";
import { grows, renderBlock, type RCtx } from "./blocks";

interface Phys { pi: number; page: Page; part: number; first: boolean }

export function PlanPages(p: {
  type: PlanType; body: PlanBody; cycle_len: number; ctx: PlanCtx;
  editable?: boolean;
  onTokenEdit?: (path: string, i: number, value: string) => void;
  onPick?: (page: number, block: number) => void;
  selected?: [number, number] | null;
  /** Plan date shown on the cover and sign-off (default today). */
  date?: string;
  /** Source page indexes whose content runs past the page bottom. */
  onOverflow?: (pages: number[]) => void;
}) {
  const { ctx, body, type } = p;
  const c = ctx.customer;
  const tg = targets({ w: ctx.weight, h: c.height, act: c.act, sur: c.sur, man: c.man_kcal, muzunaKcal: ctx.settings.muzuna_kcal });
  const rc: RCtx = { type, body, ctx, tg, editable: !!p.editable, date: p.date || todayMuscat(), cycle: p.cycle_len };

  const phys: Phys[] = [];
  body.pages.forEach((page, pi) => {
    let parts = [0];
    if (page.blocks.some((b) => b.t === "exDays") && "days" in body) {
      const w = body.days.map((d, i) => (d.rest ? -1 : i)).filter((i) => i >= 0);
      if (w.length) parts = w;
    } else if (page.blocks.some((b) => b.t === "rotation")) parts = Array.from({ length: Math.max(1, Math.ceil(p.cycle_len / 7)) }, (_, k) => k);
    parts.forEach((part, k) => phys.push({ pi, page, part, first: k === 0 }));
  });

  const root = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState<number[]>([]);
  const measure = () => {
    const el = root.current;
    if (!el) return;
    const o: number[] = [];
    el.querySelectorAll<HTMLElement>(".page").forEach((s, i) => {
      const pc = s.querySelector<HTMLElement>(".pc");
      if (pc && pc.scrollHeight > pc.clientHeight + 2) o.push(i);
    });
    setOver((prev) => (prev.join() === o.join() ? prev : o));
  };
  useLayoutEffect(measure);
  useEffect(() => { document.fonts?.ready.then(measure); }, []);
  const overSrc = [...new Set(over.map((i) => phys[i]?.pi).filter((x) => x != null))];
  useEffect(() => { p.onOverflow?.(overSrc); }, [overSrc.join()]);

  const onFocusOut = (e: FocusEvent) => {
    const q = e.target as HTMLElement;
    if (!q.classList?.contains("q") || !q.dataset.path) return;
    const v = (q.textContent || "").trim();
    if (v !== q.dataset.o) p.onTokenEdit?.(q.dataset.path, +q.dataset.i!, v);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const q = e.target as HTMLElement;
    if (e.key === "Enter" && q.classList?.contains("q")) { e.preventDefault(); q.blur(); }
  };
  const onClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (!p.onPick || t.closest(".q,a")) return;
    const b = t.closest<HTMLElement>(".blk"), s = t.closest<HTMLElement>(".page");
    if (b && s) p.onPick(+s.dataset.p!, +b.dataset.b!);
  };

  let n = 0;
  return (
    <div class="mzp" ref={root} onFocusOut={p.editable ? onFocusOut : undefined} onKeyDown={p.editable ? onKeyDown : undefined} onClick={p.onPick ? onClick : undefined}>
      {phys.map((ph, i) => {
        const { page, pi } = ph;
        const plain = !page.cover && !page.solid;
        if (plain) n++;
        const blocks = page.blocks.map((b, bi) => {
          const expands = b.t === "rotation" || b.t === "exDays";
          if (!expands && !ph.first) return null;
          const sel = p.selected && p.selected[0] === pi && p.selected[1] === bi;
          return <div class={"blk" + (grows(b) ? " grow" : "") + (sel ? " sel" : "")} data-b={bi} key={bi}>{renderBlock(b, pi, bi, rc, ph.part, !!page.cover)}</div>;
        });
        const cls = "page" + (page.cover ? " cover" : "") + (page.solid ? " solid" : "") + (p.editable ? " ed" : "") + (p.onPick ? " pick" : "") + (over.includes(i) && p.editable ? " over" : "");
        return (
          <section class={cls} data-p={pi} key={page.id + ":" + ph.part}>
            {page.cover && <><div class="blob" /><div class="blob2" /></>}
            {page.solid && <div class="ring" />}
            {type === "exercise" && plain && <div class="wm">مزيونة</div>}
            <div class="pc">
              {page.cover && <div class="ch"><div class="lg">مزيونة</div><div class="tl">خلطة الأنوثة</div><h1>{body.vars?.title || PAGE_TEXT.coverTitle}</h1></div>}
              {page.solid && <div class="lg">مزيونة</div>}
              {blocks}
            </div>
            <div class="foot"><div class="brand">مزيونة</div><div class="h">{body.vars?.hd ?? ""}</div></div>
            {plain && <div class="pno">{n}</div>}
            {over.includes(i) && p.editable && <div class="overtag noprint">المحتوى أطول من الصفحة</div>}
          </section>
        );
      })}
    </div>
  );
}

/** Scales the A4 pages down to the available width (screen only; print resets it). */
export function Fit(p: { children: ComponentChildren }) {
  const o = useRef<HTMLDivElement>(null), i = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const f = () => {
      if (!o.current || !i.current) return;
      const s = Math.min(1, o.current.clientWidth / i.current.offsetWidth);
      i.current.style.transform = `scale(${s})`;
      o.current.style.height = i.current.offsetHeight * s + "px";
    };
    const ro = new ResizeObserver(f);
    ro.observe(o.current!); ro.observe(i.current!);
    f();
    return () => ro.disconnect();
  }, []);
  return <div class="fit" ref={o}><div class="pages" ref={i}>{p.children}</div></div>;
}
