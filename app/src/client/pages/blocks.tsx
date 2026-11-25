// Block renderers for the A4 plan pages. Text strings go through sanitize, then portion tokens become spans.
import type { Block, Card, ExBody, ExDay, ExItem, MealBody, PlanBody, PlanCtx, PlanType } from "../../shared/types";
import { renderTokens, targets } from "../../shared/portions";
import { sanitize } from "../../shared/sanitize";
import { PAGE_TEXT } from "../../shared/templates";
import { EX } from "../../shared/generator";

export interface RCtx {
  type: PlanType;
  body: PlanBody;
  ctx: PlanCtx;
  tg: ReturnType<typeof targets>;
  editable: boolean;
  date: string;
  cycle: number;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Sanitized html with portion tokens. With a path (edit mode) tokens are editable spans that report back on blur. */
export function tokHtml(s: string, rc: RCtx, path: string): string {
  return renderTokens(sanitize(s || ""), rc.tg.f, (val, i, man) =>
    rc.editable
      ? `<span class="q${man ? " m" : ""}" contenteditable="true" spellcheck="false" data-path="${path}" data-i="${i}" data-o="${esc(val)}">${esc(val)}</span>`
      : `<span class="q">${esc(val)}</span>`);
}

function H(p: { s: string; rc: RCtx; path: string; as?: string; class?: string }) {
  const T = (p.as || "span") as "span";
  return <T class={p.class} dangerouslySetInnerHTML={{ __html: tokHtml(p.s, p.rc, p.path) }} />;
}

const ICON: Record<string, string> = {
  low: `<svg viewBox="0 0 100 100"><path d="M28 12h44l4 30-8 50H56l-6-40-6 40H32l-8-50z" fill="#fff" stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"/><path d="M26 30q24-10 48 0l2 14q-26 10-52 0z" fill="var(--a)" opacity=".85"/><path d="M50 30v22" stroke="var(--ink)" stroke-width="2"/></svg>`,
  up: `<svg viewBox="0 0 100 100"><path d="M38 14h24l4 10 18 8 4 30h-10l-4-20-6 4v40H32V46l-6-4-4 20H12l4-30 18-8z" fill="#fff" stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"/><circle cx="24" cy="36" r="9" fill="var(--a)" opacity=".85"/><circle cx="76" cy="36" r="9" fill="var(--a)" opacity=".85"/><path d="M40 52h20M40 62h20M40 72h20" stroke="var(--a)" stroke-width="3"/></svg>`,
  full: `<svg viewBox="0 0 100 100"><circle cx="50" cy="14" r="8" fill="var(--a)"/><path d="M50 24v34M50 30l-20 14M50 30l20-10M50 58l-14 30M50 58l16 28" stroke="var(--ink)" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M70 20l8-6M30 44l-6 6" stroke="var(--a)" stroke-width="8" stroke-linecap="round"/></svg>`,
  rest: `<svg viewBox="0 0 100 100"><path d="M64 16a34 34 0 1 0 20 52A28 28 0 0 1 64 16z" fill="var(--a)"/><circle cx="74" cy="26" r="3" fill="var(--a)"/><circle cx="84" cy="42" r="2" fill="var(--a)"/></svg>`,
};
const Svg = (p: { k: string }) => <span style="display:contents" dangerouslySetInnerHTML={{ __html: ICON[p.k] || ICON.full }} />;

const dayName = (i: number) => "اليوم " + (PAGE_TEXT.dn[i] ?? String(i + 1));
const dots = (s: string | null | undefined) => (s && s.trim() ? s : "..............");
const fmtD = (d: string) => (d ? new Date(d + "T12:00:00").toLocaleDateString("ar-OM-u-nu-latn") : "");

/** Exercise names: library first, then the built-in list, then the custom name. */
export function exInfo(it: ExItem, rc: RCtx) {
  const lib = it.ex ? rc.ctx.exercises.find((e) => e.id === it.ex) : undefined;
  const b = it.ex ? EX[it.ex] : undefined;
  return {
    ar: lib?.name_ar ?? b?.[0] ?? it.name ?? "",
    en: lib?.name_en ?? b?.[1] ?? "",
    kind: lib?.kind ?? b?.[2] ?? "r",
    video: lib?.video_url ?? null,
  };
}

function Cards(p: { items: Card[]; style: "cards" | "tiles" | "ways"; rc: RCtx; base: string }) {
  const { rc, base } = p;
  if (p.style === "tiles")
    return <div class="tiles">{p.items.map((c, j) => (
      <div class="tile"><div class="ico">{c.icon}</div>{c.lines.map((l, k) => <>{k > 0 && <br />}<H s={l} rc={rc} path={`${base}.${j}.lines.${k}`} /></>)}</div>
    ))}</div>;
  if (p.style === "ways")
    return <div class="ways">{p.items.map((c, j) => (
      <div class="way"><div class="ico">{c.icon}</div>{c.lines.map((l, k) => <H as={k ? "div" : "b"} s={l} rc={rc} path={`${base}.${j}.lines.${k}`} />)}</div>
    ))}</div>;
  return <div class="cards">{p.items.map((c, j) => (
    <div class="pcard">
      {c.tag && <span class="tag">{c.tag}</span>}
      <div class="ico">{c.icon}</div>
      {c.lines.map((l, k) => <div class="chk"><H s={l} rc={rc} path={`${base}.${j}.lines.${k}`} /></div>)}
      {c.note && <H as="div" class="pnote" s={c.note} rc={rc} path={`${base}.${j}.note`} />}
    </div>
  ))}</div>;
}

/** Blocks that fill the remaining page height. */
export const grows = (b: Block) => (b.t === "cards" || b.t === "slotCards") && b.style === "cards";

export function renderBlock(b: Block, pi: number, bi: number, rc: RCtx, part: number, cover: boolean) {
  const P = `pages.${pi}.blocks.${bi}`;
  const meal = rc.body as MealBody, exb = rc.body as ExBody;
  const { ctx, tg } = rc;
  switch (b.t) {
    case "bar": return <div class="bar"><H s={b.text} rc={rc} path={P + ".text"} />{b.small && <small><H s={b.small} rc={rc} path={P + ".small"} /></small>}</div>;
    case "sub": return <H as="div" class="sub" s={b.text} rc={rc} path={P + ".text"} />;
    case "text": return <H as="div" class="tx" s={b.html} rc={rc} path={P + ".html"} />;
    case "table": {
      const n = Math.max(b.head.length, ...b.rows.map((r) => r.length), 1);
      return <table class={"ptb" + (b.head.length ? "" : " nh") + (n === 2 ? " c2" : "")}>
        {b.head.length > 0 && <thead><tr>{b.head.map((h, j) => <H as="th" s={h} rc={rc} path={`${P}.head.${j}`} />)}{b.check && <th style="width:12%">تم</th>}</tr></thead>}
        <tbody>{b.rows.map((r, i) => <tr>{Array.from({ length: n }, (_, j) => <H as="td" s={r[j] ?? ""} rc={rc} path={`${P}.rows.${i}.${j}`} />)}{b.check && <td><span class="box" /></td>}</tr>)}</tbody>
      </table>;
    }
    case "image": {
      const src = b.src === "product" ? "/product.jpg" : ctx.photoUrl(b.src);
      return cover ? <div class="photo"><img src={src} alt="" /></div> : <img class="pimg" src={src} alt="" style={{ height: (b.h || 60) + "mm" }} />;
    }
    case "spacer": return <div class="spc" style={{ height: (b.h || 0) + "mm" }} />;
    case "divider": return <hr />;
    case "cols": return <div class="pcols"><H as="div" s={b.a} rc={rc} path={P + ".a"} /><H as="div" s={b.b} rc={rc} path={P + ".b"} /></div>;
    case "points": return <div class="pr">{b.items.map((it, j) => (
      <div class="pi"><div class="badge" dangerouslySetInnerHTML={{ __html: sanitize(it.badge) }} /><H as="div" class="pt" s={it.html} rc={rc} path={`${P}.items.${j}.html`} /></div>
    ))}</div>;
    case "cards": return <Cards items={b.items} style={b.style} rc={rc} base={P + ".items"} />;
    case "slotCards": {
      const si = (meal.slots || []).findIndex((s) => s.id === b.slot);
      const s = meal.slots?.[si];
      if (!s?.options) return <p class="pnote">لا توجد خانة اختيار بهذا الاسم.</p>;
      return <Cards items={s.options} style={b.style} rc={rc} base={`slots.${si}.options`} />;
    }
    case "rotation": {
      const sl = b.slots.map((id) => ({ id, si: (meal.slots || []).findIndex((s) => s.id === id) })).filter((x) => x.si >= 0);
      const from = part * 7, to = Math.min(rc.cycle, from + 7);
      return <table class="wk"><thead><tr><th style="width:9%">اليوم</th><th style="width:12%">الوقت</th><th>الوجبة</th></tr></thead><tbody>
        {Array.from({ length: Math.max(0, to - from) }, (_, k) => from + k).map((d) => sl.map(({ si }, r) => {
          const s = meal.slots[si];
          return <tr class={r === 0 ? "l" : ""}>
            {r === 0 && <td rowSpan={sl.length} class="mn">{d + 1}</td>}
            <td class={r === 0 ? "mn" : ""}>{r === 0 ? s.name : <b>{s.name}</b>}</td>
            <H as="td" class={r === 0 ? "ml" : ""} s={s.items?.[d] ?? ""} rc={rc} path={`slots.${si}.items.${d}`} />
          </tr>;
        }))}
      </tbody></table>;
    }
    case "dose": {
      const { muzuna_kcal: k, muzuna_prot: pr } = ctx.settings;
      return <div class="big25"><div class="n">25 غ</div><div>{PAGE_TEXT.dose}{(k || pr) && <span class="lb">{[k ? `${k} سعرة` : "", pr ? `${pr} غ بروتين` : ""].filter(Boolean).join("، ")}</span>}</div></div>;
    }
    case "mzWeek": return <table><thead><tr><th>اليوم</th><th>الحصة</th><th>طريقة التناول</th><th>تم التناول</th></tr></thead><tbody>
      {b.rows.map((m, i) => <tr><td>{i + 1}</td><td><b>25 غ</b></td><H as="td" s={m} rc={rc} path={`${P}.rows.${i}`} /><td><span class="box" /></td></tr>)}
    </tbody></table>;
    case "customer": {
      const c = ctx.customer;
      if (rc.type === "exercise") {
        const work = (exb.days || []).filter((d) => !d.rest).length;
        const lv = ["مبتدئة", "متوسطة", "متقدمة"][exb.level ?? -1];
        return <div class="xbox">خاص بـ <b>{c.name}</b>{exb.place && <> | {exb.place === "home" ? "تمارين منزلية" : "تمارين النادي"}</>} | {work} أيام بالأسبوع{lv && <> | مستوى {lv}</>}</div>;
      }
      const { muzuna_kcal: k, muzuna_prot: pr } = ctx.settings;
      const bmi = tg.bmi ? tg.bmi.toFixed(1) + (tg.bmi < 18.5 ? " (نقص وزن)" : tg.bmi < 25 ? " (طبيعي)" : " (فوق الطبيعي)") : "";
      return <div class="cc"><table><tbody>
        <tr><td>اسم الزبونة</td><td><b>{c.name}</b></td></tr>
        <tr><td>الطول / الوزن</td><td>{c.height ?? ""} سم / {ctx.weight ?? ""} كجم</td></tr>
        <tr><td>مؤشر كتلة الجسم</td><td>{bmi}</td></tr>
        <tr><td>السعرات اليومية المستهدفة</td><td><b>{tg.kcal}</b> سعرة</td></tr>
        <tr><td>البروتين اليومي</td><td><b>{tg.prot}</b> غ تقريبا</td></tr>
        {(k || pr) && <tr><td>حصة مزيونة 25 غ</td><td>{[k ? `${k} سعرة` : "", pr ? `${pr} غ بروتين` : ""].filter(Boolean).join("، ")}</td></tr>}
        <tr><td>الهدف</td><td>{c.track === "loss" ? "نزول 0.5 إلى 1 كجم أسبوعيا" : PAGE_TEXT.goal}</td></tr>
        <tr><td>الأخصائية / التاريخ</td><td>{dots(rc.body.vars?.dt)} / {fmtD(rc.date)}</td></tr>
      </tbody></table></div>;
    }
    case "tracker": return <table class="trk"><thead><tr><th>المؤشر</th><th>قبل البدء</th>{[1, 2, 3, 4].map((w) => <th>الأسبوع {w}</th>)}</tr></thead><tbody>
      {PAGE_TEXT.trRows.map((r) => <tr><td>{r}</td><td /><td /><td /><td /><td /></tr>)}
    </tbody></table>;
    case "signoff": {
      const v: Record<string, string> = { kcal: String(tg.kcal), prot: String(tg.prot), dt: dots(rc.body.vars?.dt), date: fmtD(rc.date) || ".............." };
      const html = PAGE_TEXT.sign.replace(/<(b|span) data-v="(\w+)"><\/\1>/g, (_m: string, t: string, k: string) => `<${t}>${esc(v[k] ?? "")}</${t}>`);
      return <div class="sign" dangerouslySetInnerHTML={{ __html: html }} />;
    }
    case "exWeek": return <div class="week">{(exb.days || []).map((d, i) => d.rest
      ? <div class="day off"><div class="dn">{dayName(i)}</div><Svg k="rest" /><div class="dt">راحة{d.note && <small>{d.note}</small>}</div></div>
      : <div class="day on"><div class="dn">{dayName(i)}</div><Svg k={d.ic} /><div class="dt">{d.title}</div></div>)}</div>;
    case "exDays": {
      const d = exb.days?.[part] as Extract<ExDay, { title: string }> | undefined;
      if (!d || d.rest) return <p class="pnote">لا توجد أيام تمرين في هذه الخطة.</p>;
      const f = d.items[0];
      return <>
        <div class="dhead"><h2 class="ttl">{dayName(part)}: {d.title}</h2>{f && <span class="dchip">{f.sets} مجموعات | راحة {f.rest}</span>}</div>
        <div class="wu" dangerouslySetInnerHTML={{ __html: PAGE_TEXT.wu[0] }} />
        {d.items.map((it, j) => {
          const e = exInfo(it, rc);
          return <div class="ex"><div class="num">{j + 1}</div>
            <div class="exn">{e.ar}{e.en && <small class="en">{e.en}</small>}{it.note && <small>{it.note}</small>}{e.video && <a href={e.video} target="_blank" rel="noopener noreferrer">شاهدي الفيديو</a>}</div>
            <div class="sr">{it.reps}<small>{e.kind === "e" ? "تكرار لكل جهة" : e.kind === "s" ? "ثبات" : "تكرار"}، {it.sets} مجموعات</small></div></div>;
        })}
        <div class="wu" dangerouslySetInnerHTML={{ __html: PAGE_TEXT.wu[1] }} />
        <div class="ill"><Svg k={d.ic} /></div>
      </>;
    }
    case "exLog": {
      const seen = new Set<string>(), rows: string[] = [];
      for (const d of exb.days || []) if (!d.rest) for (const it of d.items) {
        const e = exInfo(it, rc);
        if (e.kind !== "s" && e.ar && !seen.has(e.ar) && rows.length < 8) { seen.add(e.ar); rows.push(e.ar); }
      }
      return <table class="exlog"><thead><tr><th>التمرين</th>{[1, 2, 3, 4].map((w) => <th>الأسبوع {w}</th>)}</tr></thead><tbody>
        {rows.map((r) => <tr><td>{r}</td><td /><td /><td /><td /></tr>)}
      </tbody></table>;
    }
  }
}

/** Arabic labels for the builder palette. */
export const BLOCK_LABEL: Record<Block["t"], string> = {
  bar: "شريط عنوان", sub: "عنوان فرعي", text: "نص", table: "جدول", image: "صورة", spacer: "مسافة", divider: "خط فاصل",
  cols: "عمودان", points: "نقاط بشارات", cards: "بطاقات", slotCards: "بطاقات خانة", rotation: "جدول الأيام", dose: "حصة مزيونة",
  mzWeek: "جدول مزيونة الأسبوعي", customer: "بطاقة الزبونة", tracker: "جدول القياسات", signoff: "اعتماد الأخصائية",
  exWeek: "جدول أيام التمرين", exDays: "صفحات أيام التمرين", exLog: "جدول متابعة الأوزان",
};
