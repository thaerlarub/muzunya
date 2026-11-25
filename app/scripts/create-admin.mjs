// Prints one SQL statement that inserts the admin user. Same PBKDF2 params and phone rules as the Worker.
// Usage: node scripts/create-admin.mjs <phone> <password>
//   then: ./node_modules/.bin/wrangler d1 execute DB --local --command "<sql>"   (or --remote for production)
const [phoneIn, pw] = process.argv.slice(2);
if (!phoneIn || !pw || pw.length < 6) {
  console.error("usage: node scripts/create-admin.mjs <phone> <password (6+ chars)>");
  process.exit(1);
}

// Copy of src/shared/phone.ts normPhone.
function normPhone(s) {
  let p = s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
    .replace(/[\s\-.()]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (/^[79]\d{7}$/.test(p)) return "+968" + p;
  if (/^968\d{8}$/.test(p)) return "+" + p;
  return /^\+\d{8,15}$/.test(p) ? p : null;
}
const phone = normPhone(phoneIn);
if (!phone) {
  console.error("invalid phone");
  process.exit(1);
}

const { subtle } = globalThis.crypto;
const b64 = (u) => Buffer.from(u).toString("base64");
const saltBytes = crypto.getRandomValues(new Uint8Array(16));
const key = await subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
const hash = new Uint8Array(await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations: 20000 }, key, 256));
const id = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64url");
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

console.log(
  `INSERT INTO users (id, role, phone, salt, pw_hash, must_change, status, created_at) VALUES (${q(id)}, 'admin', ${q(phone)}, ${q(b64(saltBytes))}, ${q(b64(hash))}, 0, 'active', ${Date.now()});`,
);
