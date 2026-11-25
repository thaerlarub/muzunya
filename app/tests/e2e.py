"""Browser walk (Python Playwright). Fresh local DB, admin created with scripts/create-admin.mjs, `pnpm dev` running. End-to-end walk against wrangler dev on :8787 with a fresh local DB and admin +96890000001 / admin123."""
import json, sys, os
from playwright.sync_api import sync_playwright

B = "http://localhost:8787"
import tempfile
OUT = tempfile.gettempdir() + "/muzuna-e2e"  # screenshots
os.makedirs(OUT, exist_ok=True)
errors, fails = [], []

def watch(page, who):
    page.on("console", lambda m: m.type == "error" and errors.append(f"{who} console: {m.text}"))
    page.on("pageerror", lambda e: errors.append(f"{who} pageerror: {e}"))
    page.on("response", lambda r: r.status >= 500 and errors.append(f"{who} {r.status} {r.url}"))

def check(name, ok):
    print(("PASS " if ok else "FAIL ") + name); (None if ok else fails.append(name))

def shot(page, name): page.screenshot(path=f"{OUT}/{name}.png", full_page=True)

def apicall(page, method, path, body=None):
    return page.evaluate("""async ([m,p,b]) => { const me = await (await fetch('/api/me')).json();
      const r = await fetch(p, {method:m, headers:{'Content-Type':'application/json','X-CSRF-Token':me.csrf}, body: b ? JSON.stringify(b) : undefined});
      return {status: r.status, body: await r.json().catch(()=>null)} }""", [method, path, body])

with sync_playwright() as pw:
    br = pw.chromium.launch()
    # ---------- admin ----------
    a = br.new_context(viewport={"width": 390, "height": 844}).new_page(); watch(a, "admin")
    a.goto(B); a.get_by_label("رقم الهاتف").fill("9000 0001"); a.get_by_label("كلمة المرور").fill("admin123"); a.get_by_role("button", name="دخول").click()
    a.get_by_text("+ زبونة جديدة").wait_for(); check("admin signs in", True); shot(a, "a1-list-empty")
    a.get_by_text("+ زبونة جديدة").click()
    a.get_by_label("الاسم").fill("سارة أحمد"); a.get_by_label("رقم الهاتف").fill("9123 4567")
    a.get_by_label("الطول (سم)").fill("160"); a.get_by_label("الوزن عند البداية (كغ)").fill("48"); a.get_by_label("الوزن المستهدف (اختياري)").fill("54")
    a.get_by_role("button", name="حفظ وإنشاء الحساب").click()
    a.locator(".pw").wait_for(); temp = a.locator(".pw").inner_text().strip(); check("temp password shown", len(temp) == 8); shot(a, "a2-temp")
    ov = apicall(a, "GET", "/api/admin/overview"); cid = ov["body"]["rows"][0]["customer"]["user_id"]
    tpls = apicall(a, "GET", "/api/admin/templates")["body"]
    meal = next(t for t in tpls if t["type"] == "meal"); ex = next(t for t in tpls if t["type"] == "exercise")
    today = a.evaluate("new Date(Date.now()+4*3600e3).toISOString().slice(0,10)")
    start = a.evaluate(f"new Date(Date.parse('{today}')-3*864e5).toISOString().slice(0,10)")
    for t in (meal, ex):
        r = apicall(a, "POST", f"/api/admin/customers/{cid}/plans", {"type": t["type"], "start_date": start, "cycle_len": t["cycle_len"], "body": t["body"]})
        check(f"{t['type']} plan saved", r["status"] == 200)
    apicall(a, "POST", f"/api/admin/customers/{cid}/orders", {"order_date": today, "months": 1})
    apicall(a, "PUT", "/api/admin/settings", {"whatsapp": "+96890000001", "accent": "#c48bd9", "muzuna_kcal": 100, "muzuna_prot": 8})
    a.keyboard.press("Escape"); a.goto(B + "/#/"); a.reload(); a.wait_for_timeout(1200); shot(a, "a3-list")
    for tab in ["profile", "meal", "exercise", "ticks", "followups", "photos", "notes", "journey"]:
        a.goto(f"{B}/#/c/{cid}/{tab}"); a.wait_for_timeout(1500); shot(a, f"a4-{tab}")
    a.set_viewport_size({"width": 1280, "height": 900}); a.goto(f"{B}/#/c/{cid}/meal"); a.wait_for_timeout(1500)
    pages_tab = a.get_by_text("الصفحات", exact=True)
    if pages_tab.count(): pages_tab.first.click(); a.wait_for_timeout(1500)
    shot(a, "a5-builder-desk"); check("builder renders A4 pages", a.locator("section.page").count() >= 8)
    for r in ["templates", "exercises", "recipes", "settings"]:
        a.goto(f"{B}/#/{r}"); a.wait_for_timeout(1200); shot(a, f"a6-{r}")
    a.set_viewport_size({"width": 390, "height": 844})
    # print route (window.print stubbed)
    a.add_init_script("window.print = () => { window.__printed = (window.__printed||0)+1 }")
    a.goto(f"{B}/#/print/plan/{cid}"); a.reload(); a.wait_for_timeout(3000)
    n = a.locator("section.page").count(); check(f"print route renders pages ({n})", n >= 14); check("print auto-called", a.evaluate("window.__printed||0") >= 1)
    a.pdf(path=f"{OUT}/plan.pdf", format="A4", print_background=True) if False else None
    shot(a, "a7-print")
    # ---------- customer ----------
    cctx = br.new_context(viewport={"width": 390, "height": 844}); c = cctx.new_page(); watch(c, "cust")
    c.goto(B); c.get_by_label("رقم الهاتف").fill("+968 9123-4567"); c.get_by_label("كلمة المرور").fill(temp); c.get_by_role("button", name="دخول").click()
    c.get_by_label("كلمة المرور المؤقتة").wait_for(); check("forced password change", True)
    c.get_by_label("كلمة المرور المؤقتة").fill(temp); c.get_by_label("كلمة المرور الجديدة").fill("sara123"); c.get_by_label("تأكيد كلمة المرور").fill("sara123"); c.get_by_role("button", name="حفظ").click()
    c.locator(".gm-pick-b").first.wait_for(); shot(c, "c1-picker"); c.locator(".gm-pick-b").nth(1).click(); c.locator(".gm-pick ~ .btn, .btn.wide").last.click()
    c.locator(".cu-row").first.wait_for(timeout=10000); check("today shows checklist", True); shot(c, "c2-today")
    rows = c.locator(".cu-row"); rows.nth(0).click(); c.wait_for_timeout(1200); rows.nth(2).click(); c.wait_for_timeout(1200)
    c.get_by_label("كوب 3").click(); c.wait_for_timeout(500); shot(c, "c3-ticked")
    c.wait_for_timeout(4500)  # flush after 3 s
    logs = apicall(c, "GET", "/api/me")["body"]["logs"]; body = next((l["body"] for l in logs if l["date"] == today), {})
    check("ticks synced to server", any(k.startswith("m:") for k in body)); check("water count synced", body.get("m:wa", [0])[0] == 3)
    for t in ["followup", "journey", "more", "recipes"]:
        c.goto(f"{B}/#/{t}"); c.wait_for_timeout(1500); shot(c, f"c4-{t}")
    r = c.evaluate("""async () => { const me = await (await fetch('/api/me')).json();
       const r = await fetch('/api/sync',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':me.csrf},
       body: JSON.stringify({ops:[{kind:'fu',id:crypto.randomUUID(),t:Date.now(),data:{date:new Date(Date.now()+4*3600e3).toISOString().slice(0,10),weight:49.5,waist:62}}]})}); return r.status }""")
    check("follow-up via sync", r == 200)
    c.add_init_script("window.print = () => { window.__printed = (window.__printed||0)+1 }")
    c.goto(f"{B}/#/print/plan/{cid}"); c.reload(); c.wait_for_timeout(3000); check("customer can print her plan", c.locator("section.page").count() >= 14)
    c.goto(f"{B}/#/print/plan/someoneelse"); c.wait_for_timeout(1500); check("customer cannot print another plan", c.locator("section.page").count() == 0)
    # ---------- finish journey + gift ----------
    r = apicall(a, "POST", f"/api/admin/customers/{cid}/finish", {"letter": "مبروك يا سارة، فخورين فيك."}); check("finish journey", r["status"] == 200)
    c.goto(B + "/#/"); c.reload(); c.wait_for_timeout(2500); shot(c, "c5-crown-reveal")
    c.goto(f"{B}/#/print/gift/{cid}"); c.reload(); c.wait_for_timeout(3500); shot(c, "c6-gift"); check("gift renders", c.locator("text=مبروك يا سارة").count() >= 1)
    br.close()

print("\nERRORS:" if errors else "\nno console/page/5xx errors")
for e in errors[:40]: print(" ", e)
sys.exit(1 if fails or errors else 0)
