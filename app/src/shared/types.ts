// Shared contract between the Worker, the client and the pure logic.
// Dates: 'YYYY-MM-DD' in Asia/Muscat. Times: ms since epoch.

export type Track = "gain" | "loss";
export type PlanType = "meal" | "exercise";
export type Author = "admin" | "customer";
export type MascotKind = "girl" | "kitten" | "bunny" | "camel";
export type BadgeId = "week1" | "kg1" | "streak7" | "perfect" | "half" | "finish";
export type WearItem = "bow" | "necklace" | "scarf" | "glasses" | "flower" | "crown";
/** Which wearables are switched on. Missing key = worn (every earned item is worn by default). */
export type Wardrobe = Partial<Record<WearItem, boolean>>;

export interface Customer {
  user_id: string;
  name: string;
  phone: string;
  status: "active" | "archived";
  height: number | null;
  w0: number | null;
  start_date: string;
  track: Track;
  goal_w: number | null;
  act: string; // "1.2" | "1.375" | "1.55" | "1.725"
  sur: string; // "300" | "400" | "500"
  man_kcal: number | null;
  mascot: MascotKind | null;
  wardrobe: Wardrobe;
  allergies: string | null;
  journey_finished_at: string | null;
  letter: string | null;
}

export interface Order { id: string; customer_id: string; order_date: string; months: number }

// ---------- plans ----------
/** A card in a `choose` slot or a free cards block. Text strings may contain portion tokens {b|u} or {b|u|manual}. */
export interface Card { icon: string; lines: string[]; note?: string; tag?: string }

export interface Slot {
  id: string;
  name: string;            // shown in the checklist, e.g. "الإفطار"
  icon: string;            // emoji
  kind: "fixed" | "choose" | "rotation" | "counter";
  text?: string;           // fixed: the text shown every day
  options?: Card[];        // choose: the options she picks one from
  items?: string[];        // rotation: one text per plan day, length = cycle_len
  target?: number;         // counter: e.g. 8 glasses
}

export interface ExItem {
  ex?: string;             // exercise library id
  name?: string;           // custom name when not from the library
  sets: number;
  reps: string;            // e.g. "12 إلى 15" or "30 ث"
  rest: string;            // e.g. "60 ث"
  note?: string;
}
export type ExDay = { rest: true; note?: string } | { rest?: false; title: string; ic: "low" | "up" | "full"; items: ExItem[] };

export type Block =
  | { t: "bar"; text: string; small?: string }
  | { t: "sub"; text: string }
  | { t: "text"; html: string }                       // sanitized rich text: b, strong, br, ul, ol, li, p, div, span.acc
  | { t: "table"; head: string[]; rows: string[][]; check?: boolean }
  | { t: "image"; src: "product" | string; h?: number } // "product" or a photo id
  | { t: "spacer"; h: number }                         // mm
  | { t: "divider" }
  | { t: "cols"; a: string; b: string }                // two rich-text columns
  | { t: "points"; items: { badge: string; html: string }[] }
  | { t: "cards"; style: "cards" | "tiles" | "ways"; items: Card[] }
  | { t: "slotCards"; slot: string; style: "cards" | "tiles" }  // a choose slot's options
  | { t: "rotation"; slots: string[] }                 // rotation slots by plan day, 7 days per page
  | { t: "dose" }                                      // Muzuna 25 g box (+ label kcal/protein when set)
  | { t: "mzWeek"; rows: string[] }                    // Muzuna weekly table with tick boxes
  | { t: "customer" }                                  // customer card (name, height, weight, BMI, kcal, protein, goal)
  | { t: "tracker" }                                   // measurement tracker table
  | { t: "signoff" }                                   // nutritionist sign-off
  | { t: "exWeek" }                                    // the cycle's days as a grid
  | { t: "exDays" }                                    // one page per workout day
  | { t: "exLog" };                                    // weights progress table

export interface Page { id: string; cover?: boolean; solid?: boolean; blocks: Block[] }

export interface PlanVars { dt: string; hd: string; title?: string }
export interface MealBody { slots: Slot[]; pages: Page[]; vars: PlanVars }
export interface ExBody { days: ExDay[]; pages: Page[]; vars: PlanVars; place?: "home" | "gym"; level?: 0 | 1 | 2 }
export type PlanBody = MealBody | ExBody;

export interface PlanVersion {
  id: string;
  customer_id: string;
  type: PlanType;
  start_date: string;
  cycle_len: number;
  body: PlanBody;
  created_at: number;
}
export interface Template { id: string; type: PlanType; track: Track; name: string; cycle_len: number; body: PlanBody; created_at: number }
export interface Exercise { id: string; name_ar: string; name_en: string; kind: "r" | "e" | "s"; places: ("home" | "gym")[]; video_url: string | null }

// ---------- tracking ----------
/** Day log body. Keys: `m:<slotId>` (meal slot; value 1/0, or glasses count for counter slots),
 *  `x:<exerciseIndex>` (exercise ticked 1/0), `kg:<exerciseIndex>` (kg used). Value tuple: [value, time the change was made]. */
export type DayBody = Record<string, [number, number]>;
export interface DayLog { date: string; body: DayBody }

export interface FollowupInput {
  date: string;
  weight?: number | null; arm?: number | null; chest?: number | null; waist?: number | null;
  hips?: number | null; thigh?: number | null; appetite?: number | null; note?: string | null;
}
export interface Followup extends FollowupInput { id: string; customer_id: string; author: Author; updated_at: number }

export interface Photo { id: string; customer_id: string | null; recipe_id: string | null; date: string; caption: string | null; author: Author; created_at: number }
export interface Note { id: string; customer_id: string; date: string; text: string; private: boolean; created_at: number }
export interface Badge { badge: BadgeId; earned_at: number }

export interface Recipe {
  id: string;
  section: "m" | "b" | "l" | "n";  // Muzuna, breakfast, main, snack
  title: string;
  tag: string | null;
  body: { e: string[]; ing: string[]; st: string[]; why?: string; nt?: string };
  sort: number;
  photos: string[];                  // photo ids, up to 2
}

export interface Settings { whatsapp: string; accent: string; muzuna_kcal: number | null; muzuna_prot: number | null }

// ---------- sync ----------
export type Op =
  | { kind: "tick"; date: string; key: string; v: number; t: number }
  | { kind: "fu"; id: string; data: FollowupInput; t: number }   // create or update her own follow-up
  | { kind: "fudel"; id: string; t: number };

// ---------- API responses ----------
export interface SessionUser { id: string; role: "admin" | "customer"; must_change: boolean }

/** GET /api/me for a customer (one call on open). */
export interface MeCustomer {
  user: SessionUser;
  csrf: string;
  customer: Customer;
  settings: Settings;
  orders: Order[];
  versions: PlanVersion[];      // all versions, both types
  logs: DayLog[];               // all day logs
  followups: Followup[];
  photos: Photo[];              // her gallery
  notes: Note[];                // public notes only
  badges: Badge[];
  exercises: Exercise[];        // library (names, videos)
}
/** GET /api/me for the admin. */
export interface MeAdmin { user: SessionUser; csrf: string; settings: Settings }

/** GET /api/admin/overview */
export interface AdminRow {
  customer: Customer;
  orders: Order[];
  versions: PlanVersion[];      // active version of each type only (today), plus the latest one if newer
  logs: DayLog[];               // last 14 days
  last_followup: Followup | null;
  badges: Badge[];
}
/** GET /api/admin/customers/:id */
export interface AdminCustomer {
  customer: Customer;
  orders: Order[];
  versions: PlanVersion[];
  logs: DayLog[];
  followups: Followup[];
  photos: Photo[];
  notes: Note[];                // public and private
  badges: Badge[];
}

/** Everything a plan page needs to render numbers. */
export interface PlanCtx {
  customer: Customer;
  weight: number | null;        // latest weight (latest followup weight, else w0)
  settings: Settings;
  exercises: Exercise[];
  photoUrl: (id: string) => string;
}
