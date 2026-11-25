// Admin shell: top bar, nav and hash routes.
import "./admin.css";
import { api } from "../api";
import { toast } from "../ui";
import type { MeAdmin } from "../../shared/types";
import { List } from "./List";
import { CustomerPage } from "./Customer";
import { Templates } from "./Templates";
import { Exercises } from "./Exercises";
import { RecipesAdmin } from "./RecipesAdmin";
import { Settings } from "./Settings";

const NAV: [string, string][] = [["/", "الزبونات"], ["/templates", "القوالب"], ["/exercises", "التمارين"], ["/recipes", "الوصفات"], ["/settings", "الإعدادات"]];

export function AdminApp(p: { me: MeAdmin; hash: string; reload: () => void }) {
  const h = p.hash;
  const cm = h.match(/^\/c\/([\w-]+)(?:\/(\w+))?/);
  const cur = cm ? "/" : NAV.find(([k]) => k !== "/" && h.startsWith(k))?.[0] ?? "/";
  const out = async () => {
    try { await api.post("/api/auth/logout"); } catch { toast("تعذر تسجيل الخروج"); }
    p.reload();
  };
  let view;
  if (cm) view = <CustomerPage key={cm[1]} id={cm[1]} tab={cm[2] || "profile"} me={p.me} />;
  else if (cur === "/templates") view = <Templates />;
  else if (cur === "/exercises") view = <Exercises />;
  else if (cur === "/recipes") view = <RecipesAdmin />;
  else if (cur === "/settings") view = <Settings me={p.me} reload={p.reload} />;
  else view = <List />;
  return (
    <div class="adm">
      <header class="atop noprint">
        <a class="logo" href="#/">مزيونة</a>
        <nav class="anav">
          {NAV.map(([k, t]) => <a href={"#" + k} class={cur === k ? "on" : ""} aria-current={cur === k ? "page" : undefined}>{t}</a>)}
        </nav>
        <button class="btn g sm out" onClick={out}>خروج</button>
      </header>
      <main class="wrap">{view}</main>
    </div>
  );
}
