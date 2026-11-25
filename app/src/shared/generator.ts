import type { ExDay } from "./types.ts";

// Ported verbatim from standalone/Muzuna_Workout_Plan.html. EX kind: r reps, e per side, s seconds.
export const EX: Record<string, [string, string, "r" | "e" | "s"]> = {
 gb:["جسر الأرداف","Glute Bridge","r"],sglb:["جسر الأرداف برجل واحدة","Single Leg Glute Bridge","e"],
 ht:["رفع الحوض بالبار أو الجهاز","Hip Thrust","r"],bss:["السكوات البلغاري","Bulgarian Split Squat","e"],
 sumo:["سكوات سومو","Sumo Squat","r"],sq:["السكوات","Bodyweight Squat","r"],gsq:["سكوات بالدمبل","Goblet Squat","r"],
 dk:["ركلة الأرداف للخلف","Donkey Kick","e"],ckb:["ركلة الأرداف بالكيبل","Cable Kickback","e"],
 fh:["رفع الرجل الجانبي من وضع الكلب","Fire Hydrant","e"],clam:["تمرين المحارة بالمطاط","Clamshell","e"],
 abd:["جهاز فتح الأرجل","Hip Abduction Machine","r"],rdl:["الرفعة الرومانية بالدمبل","Romanian Deadlift","r"],
 rl:["اللانج للخلف","Reverse Lunge","e"],wl:["اللانج المتحرك بالدمبل","Walking Lunge","e"],lp:["جهاز ضغط الأرجل (القدمين للأعلى)","Leg Press","r"],
 fp:["ضخ الضفدع","Frog Pumps","r"],pu:["الضغط على الركبتين","Knee Push Up","r"],sp:["ضغط الأكتاف بالدمبل","Shoulder Press","r"],
 lr:["الرفرفة الجانبية","Lateral Raise","r"],row:["التجديف بالدمبل","Dumbbell Row","e"],lpd:["السحب العلوي","Lat Pulldown","r"],
 cr:["التجديف بالكيبل","Seated Cable Row","r"],cp:["جهاز ضغط الصدر","Chest Press","r"],pl:["البلانك","Plank","s"],db:["الحشرة الميتة","Dead Bug","e"]
};
export const PLAN: Record<string, { t: string; ic: "low" | "up" | "full"; home: string[]; gym: string[] }> = {
 LA:{t:"الأرداف والأفخاذ (أ)",ic:"low",home:["gb","bss","sumo","dk","fh"],gym:["ht","gsq","rdl","ckb","abd"]},
 UP:{t:"الجزء العلوي والبطن",ic:"up",home:["pu","sp","lr","row","pl","db"],gym:["lpd","cr","sp","lr","cp","pl"]},
 LB:{t:"الأرداف والأفخاذ (ب)",ic:"low",home:["sglb","rl","sq","fp","clam"],gym:["lp","bss","ht","wl","abd"]},
 FB:{t:"الجسم كامل",ic:"full",home:["sq","gb","row","sp","pl"],gym:["gsq","ht","lpd","sp","pl"]}
};
export const SCHED: Record<3 | 4, (string | 0)[]> = {3:["LA",0,"UP",0,"LB",0,0],4:["LA","UP",0,"LB","FB",0,0]};
export const LV: { s: number; r: string; t: string; rest: string }[] = [{s:3,r:"12 إلى 15",t:"30",rest:"60 ث"},{s:4,r:"10 إلى 12",t:"45",rest:"90 ث"},{s:4,r:"8 إلى 10",t:"60",rest:"120 ث"}];

/** A 7-day exercise cycle from place, level and workouts per week. */
export function generateExDays(place: "home" | "gym", level: 0 | 1 | 2, perWeek: 3 | 4): ExDay[] {
  const lv = LV[level];
  return SCHED[perWeek].map((k, i): ExDay => {
    if (!k) return i === 2 || i === 5 ? { rest: true, note: "أو مشي خفيف 20 دقيقة" } : { rest: true };
    const p = PLAN[k];
    return { title: p.t, ic: p.ic, items: p[place].map((ex) => ({ ex, sets: lv.s, reps: EX[ex][2] === "s" ? `${lv.t} ث` : lv.r, rest: lv.rest })) };
  });
}
