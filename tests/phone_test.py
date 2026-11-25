"""Phone-sized smoke test: add a customer, log 2 weekly weights, open her plan, export the PDF.

Setup (once):  npm i html2canvas@1.4.1 jspdf@2.5.1  &&  pip install playwright  &&  playwright install chromium
Run:           python3 build.py --test && python3 tests/phone_test.py
Outputs:       tests/out/*.png screenshots and tests/out/test.pdf
"""
import asyncio, pathlib
from playwright.async_api import async_playwright

HERE = pathlib.Path(__file__).parent
OUT = HERE / "out"; OUT.mkdir(exist_ok=True)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto((HERE / "app_test.html").resolve().as_uri()); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=str(OUT / "1_empty.png"))
        await pg.click("#newBtn")
        await pg.fill("#fN", "سارة أحمد"); await pg.fill("#fP", "+968 9123 4567")
        await pg.fill("#fH", "158"); await pg.fill("#fW", "49"); await pg.fill("#fS", "2026-11-01")
        await pg.click("#fSave"); await pg.wait_for_timeout(300)
        for d, w in [("2026-11-08", "49.4"), ("2026-11-15", "49.9")]:
            await pg.fill("#aW", w); await pg.fill("#aD", d); await pg.click("#aBtn"); await pg.wait_for_timeout(200)
        await pg.screenshot(path=str(OUT / "2_customer_sheet.png"))
        await pg.click("#sx"); await pg.wait_for_timeout(200)
        await pg.screenshot(path=str(OUT / "3_list.png"), full_page=True)
        await pg.click(".tab[data-view=plan]"); await pg.select_option("#pick", index=1); await pg.wait_for_timeout(500)
        await pg.screenshot(path=str(OUT / "4_plan.png"))
        await pg.click("#pdfBtn"); await pg.wait_for_function("window.__saved", timeout=90000)
        arr = await pg.evaluate("Array.from(new Uint8Array(window.__saved))")
        (OUT / "test.pdf").write_bytes(bytes(arr))
        print("pdf bytes", len(arr), "| page errors:", errs or "none")
        await b.close()

asyncio.run(main())
