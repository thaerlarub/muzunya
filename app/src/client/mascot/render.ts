// Style B renderer: tonal outlines and a light sheen on the head. Returns a full <svg> string.
import { mix } from "../ui";
import type { Prim } from "./shapes";

function shape(pr: Prim, extra: string): string {
  if (pr.e) {
    const [cx, cy, rx, ry] = pr.e;
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${pr.rot ? ` transform="rotate(${pr.rot} ${cx} ${cy})"` : ""} ${extra}/>`;
  }
  return `<polygon points="${pr.p!.map((p) => p.join(",")).join(" ")}" stroke-linejoin="round" ${extra}/>`;
}

export function softSvg(prims: Prim[], viewBox = "0 0 100 100"): string {
  let s = "";
  for (const pr of prims) {
    s += shape(pr, `fill="${pr.f}"${pr.o ? ` opacity="${pr.o}"` : ""}${pr.d ? "" : ` stroke="${mix(pr.f, "#3b2947", .38)}" stroke-width="1.3"`}`);
    if (pr.head && pr.e) {
      const [cx, cy, rx, ry] = pr.e, x = cx - rx * .38, y = cy - ry * .5;
      s += `<ellipse cx="${x}" cy="${y}" rx="${rx * .32}" ry="${ry * .18}" fill="#fff" opacity=".4" transform="rotate(-20 ${x} ${y})"/>`;
    }
  }
  return `<svg viewBox="${viewBox}" aria-hidden="true" style="display:block;width:100%;height:100%;overflow:visible">${s}</svg>`;
}
