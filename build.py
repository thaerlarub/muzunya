#!/usr/bin/env python3
"""Build dist/muzuna_app.html from src/.

Usage:
  python3 build.py          -> dist/muzuna_app.html (CDN libs, for publishing as a Claude artifact)
  python3 build.py --test   -> tests/app_test.html  (local libs + a fake window.claude, for Playwright)
"""
import base64, pathlib, sys

ROOT = pathlib.Path(__file__).parent
CDN = ('<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>\n'
       '<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>')
LOCAL = ('<script src="../node_modules/html2canvas/dist/html2canvas.min.js"></script>\n'
         '<script src="../node_modules/jspdf/dist/jspdf.umd.min.js"></script>\n'
         '<script>window.__saved=null;window.claude={use:async n=>n==="downloads"?'
         '{save:async r=>{window.__saved=await r.data.arrayBuffer();return{status:"saved"}}}:null}</script>')

def build(test=False):
    html = (ROOT / "src/app.html").read_text(encoding="utf-8")
    data = (ROOT / "src/meal-data.js").read_text(encoding="utf-8")
    photo = base64.b64encode((ROOT / "assets/product-photo.jpg").read_bytes()).decode()
    for ph in ("__DATA__", "__PHOTO__", "__LIBS__"):
        assert ph in html, f"placeholder {ph} missing from src/app.html"
    html = (html.replace("__DATA__", data)
                .replace("__PHOTO__", "data:image/jpeg;base64," + photo)
                .replace("__LIBS__", LOCAL if test else CDN))
    out = ROOT / ("tests/app_test.html" if test else "dist/muzuna_app.html")
    out.write_text(html, encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size:,} bytes)")

if __name__ == "__main__":
    build(test="--test" in sys.argv)
