-- Muzuna schema. Dates are TEXT YYYY-MM-DD (Asia/Muscat). Times are INTEGER ms since epoch. JSON in TEXT.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin','customer')),
  phone TEXT NOT NULL UNIQUE,
  salt TEXT NOT NULL,
  pw_hash TEXT NOT NULL,
  must_change INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at INTEGER NOT NULL
);
CREATE TABLE sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE login_attempts (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
CREATE TABLE customers (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  height REAL,
  w0 REAL,
  start_date TEXT NOT NULL,
  track TEXT NOT NULL DEFAULT 'gain' CHECK (track IN ('gain','loss')),
  goal_w REAL,
  act TEXT NOT NULL DEFAULT '1.375',
  sur TEXT NOT NULL DEFAULT '400',
  man_kcal REAL,
  mascot TEXT,
  wardrobe TEXT NOT NULL DEFAULT '{}',
  allergies TEXT,
  journey_finished_at TEXT,
  letter TEXT
);
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(user_id) ON DELETE CASCADE,
  order_date TEXT NOT NULL,
  months INTEGER NOT NULL CHECK (months > 0)
);
CREATE INDEX orders_c ON orders(customer_id);
CREATE TABLE plan_versions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('meal','exercise')),
  start_date TEXT NOT NULL,
  cycle_len INTEGER NOT NULL DEFAULT 7,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX plan_versions_c ON plan_versions(customer_id, type, start_date);
CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('meal','exercise')),
  track TEXT NOT NULL DEFAULT 'gain',
  name TEXT NOT NULL,
  cycle_len INTEGER NOT NULL DEFAULT 7,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE exercises (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'r' CHECK (kind IN ('r','e','s')),
  places TEXT NOT NULL DEFAULT '["home","gym"]',
  video_url TEXT
);
CREATE TABLE day_logs (
  customer_id TEXT NOT NULL REFERENCES customers(user_id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (customer_id, date)
);
CREATE TABLE followups (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(user_id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  weight REAL, arm REAL, chest REAL, waist REAL, hips REAL, thigh REAL,
  appetite INTEGER CHECK (appetite BETWEEN 1 AND 5),
  note TEXT,
  author TEXT NOT NULL CHECK (author IN ('admin','customer')),
  updated_at INTEGER NOT NULL
);
CREATE INDEX followups_c ON followups(customer_id, date);
CREATE TABLE recipes (
  id TEXT PRIMARY KEY,
  section TEXT NOT NULL,
  title TEXT NOT NULL,
  tag TEXT,
  body TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(user_id) ON DELETE CASCADE,
  recipe_id TEXT REFERENCES recipes(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  date TEXT NOT NULL,
  caption TEXT,
  author TEXT NOT NULL CHECK (author IN ('admin','customer')),
  created_at INTEGER NOT NULL
);
CREATE INDEX photos_c ON photos(customer_id);
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(user_id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  text TEXT NOT NULL,
  private INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX notes_c ON notes(customer_id);
CREATE TABLE badges (
  customer_id TEXT NOT NULL REFERENCES customers(user_id) ON DELETE CASCADE,
  badge TEXT NOT NULL,
  earned_at INTEGER NOT NULL,
  PRIMARY KEY (customer_id, badge)
);
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
