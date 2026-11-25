// Throwaway harness for agent 4's mascot and game components.
import { render } from "preact";
import { useRef, useState } from "preact/hooks";
import "../src/client/app.css";
import type { MascotKind, Wardrobe as W, WearItem } from "../src/shared/types";
import { MASCOTS, WEAR } from "../src/client/mascot/shapes";
import { Mascot, wornItems, type MascotApi } from "../src/client/mascot/Mascot";
import { Rings } from "../src/client/game/Rings";
import { JourneyPath } from "../src/client/game/JourneyPath";
import { BadgeShelf, BadgeReveal } from "../src/client/game/Badges";
import { MascotPicker } from "../src/client/game/MascotPicker";
import { Wardrobe } from "../src/client/game/Wardrobe";

const apis: Record<string, { current: MascotApi | null }> = {};
const ref = (k: string) => (apis[k] ??= { current: null });
(window as any).apis = apis;

function App() {
  const [sleepy, setSleepy] = useState(false), [meals, setMeals] = useState(.57), [rev, setRev] = useState(false);
  const [ward, setWard] = useState<W>({ glasses: false }), [picked, setPicked] = useState<MascotKind | null>(null);
  const feedBtn = useRef<HTMLButtonElement>(null);
  const all = (f: (a: MascotApi) => void) => Object.values(apis).forEach((a) => a.current && f(a.current));
  const earned: WearItem[] = ["bow", "necklace", "scarf", "glasses"];
  return (
    <main class="wrap" style="display:grid;gap:16px">
      <div class="row">
        <button ref={feedBtn} id="feed" class="btn sm" onClick={() => all((a) => a.feed(feedBtn.current, "🍌"))}>feed</button>
        <button id="flex" class="btn sm" onClick={() => all((a) => a.flex())}>flex</button>
        <button id="hop" class="btn sm" onClick={() => all((a) => a.hop())}>hop</button>
        <button id="reveal" class="btn sm" onClick={() => all((a) => a.reveal("flower"))}>reveal</button>
        <button id="sleepy" class="btn sm g" onClick={() => setSleepy(!sleepy)}>sleepy</button>
        <button id="badge" class="btn sm g" onClick={() => setRev(true)}>badge reveal</button>
      </div>
      {[0, .5, 1].map((g) => (
        <div class="card" key={g}><div class="note" dir="ltr">growth {g}</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr)">
            {MASCOTS.map((m) => <Mascot key={m.id} kind={m.id} growth={g} wear={g === 0 ? [] : g === .5 ? ["bow", "necklace", "glasses"] : WEAR} sleepy={sleepy} size={86} apiRef={ref(m.id + g)} />)}
          </div>
        </div>
      ))}
      <div class="card row" style="justify-content:space-around">
        <Rings meals={meals} workout={.4} />
        <Rings meals={1} workout={null} size={100} />
        <button class="btn sm g" onClick={() => setMeals(meals > .9 ? .14 : meals + .29)}>meals+</button>
      </div>
      <div class="card"><JourneyPath w0={48} latest={51.4} goal={55} track="gain" /></div>
      <div class="card"><JourneyPath w0={48} latest={50.2} goal={null} track="gain" /></div>
      <div class="card"><BadgeShelf earned={[{ badge: "week1", earned_at: Date.now() - 864e6 }, { badge: "kg1", earned_at: Date.now() }]} /></div>
      <div class="card"><MascotPicker current={picked} onPick={setPicked} /></div>
      <div class="card"><Wardrobe kind="bunny" growth={.4} earned={earned} wardrobe={ward} onChange={setWard} /></div>
      <p class="note" dir="ltr">worn: {wornItems(earned, ward).join(",")}</p>
      {rev && <BadgeReveal badge="perfect" kind="kitten" growth={.5} wear={["bow"]} onClose={() => setRev(false)} />}
    </main>
  );
}
render(<App />, document.getElementById("app")!);
