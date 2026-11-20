const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const db = new Database("darktrade.sqlite");
const PORT = Number(process.env.PORT || 3000);
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error("Set SESSION_SECRET to a random string of at least 32 characters.");
  process.exit(1);
}

db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  balance REAL NOT NULL DEFAULT 10000,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS holdings (
  user_id INTEGER NOT NULL,
  symbol TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id, symbol),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  quantity REAL NOT NULL,
  price REAL NOT NULL,
  total REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  store: new SQLiteStore({ db: "sessions.sqlite", dir: "." }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24
  }
}));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false });
const prices = { BTC: 67420.50, ETH: 3245.80, SOL: 182.45, BNB: 615.20 };

function currentUser(req) {
  if (!req.session.userId) return null;
  return db.prepare("SELECT id, name, email, role, balance, created_at FROM users WHERE id = ?").get(req.session.userId) || null;
}
function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "Please sign in first." });
  req.user = user;
  next();
}
function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin access required." });
  next();
}

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/market", (_req, res) => {
  res.json(Object.entries(prices).map(([symbol, price]) => ({ symbol, price, label: symbol + "/USDT" })));
});

app.post("/api/register", authLimiter, async (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 60);
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10) {
    return res.status(400).json({ error: "Enter a name, valid email, and password with at least 10 characters." });
  }
  try {
    const hash = await bcrypt.hash(password, 12);
    const role = ADMIN_EMAIL && email === ADMIN_EMAIL ? "admin" : "user";
    const result = db.prepare("INSERT INTO users (name,email,password_hash,role,balance) VALUES (?,?,?,?,10000)")
      .run(name, email, hash, role);
    req.session.userId = Number(result.lastInsertRowid);
    res.json({ ok: true });
  } catch (err) {
    if (String(err.code).includes("SQLITE_CONSTRAINT")) return res.status(409).json({ error: "That email is already registered." });
    res.status(500).json({ error: "Could not create account." });
  }
});

app.post("/api/login", authLimiter, async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Email or password is incorrect." });
  }
  req.session.userId = user.id;
  res.json({ ok: true });
});

app.post("/api/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.get("/api/me", requireAuth, (req, res) => {
  const holdings = db.prepare("SELECT symbol, quantity FROM holdings WHERE user_id = ? AND quantity > 0 ORDER BY symbol").all(req.user.id);
  const trades = db.prepare("SELECT id, symbol, side, quantity, price, total, created_at FROM trades WHERE user_id = ? ORDER BY id DESC LIMIT 30").all(req.user.id);
  res.json({ user: req.user, holdings, trades, prices });
});

app.post("/api/trade", requireAuth, (req, res) => {
  const symbol = String(req.body.symbol || "").toUpperCase();
  const side = String(req.body.side || "").toLowerCase();
  const quantity = Number(req.body.quantity);
  if (!Object.hasOwn(prices, symbol) || !["buy", "sell"].includes(side) || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1e9) {
    return res.status(400).json({ error: "Invalid demo order." });
  }
  const price = prices[symbol];
  const total = Number((price * quantity).toFixed(2));
  const transact = db.transaction(() => {
    const user = db.prepare("SELECT balance FROM users WHERE id = ?").get(req.user.id);
    const holding = db.prepare("SELECT quantity FROM holdings WHERE user_id = ? AND symbol = ?").get(req.user.id, symbol);
    const held = holding ? holding.quantity : 0;
    if (side === "buy" && user.balance < total) throw new Error("Not enough virtual USDT in your demo wallet.");
    if (side === "sell" && held + 1e-12 < quantity) throw new Error("You do not have enough of this asset to sell.");
    const nextBalance = side === "buy" ? user.balance - total : user.balance + total;
    const nextHolding = side === "buy" ? held + quantity : held - quantity;
    db.prepare("UPDATE users SET balance = ? WHERE id = ?").run(Number(nextBalance.toFixed(2)), req.user.id);
    db.prepare(`INSERT INTO holdings(user_id,symbol,quantity) VALUES(?,?,?)
      ON CONFLICT(user_id,symbol) DO UPDATE SET quantity=excluded.quantity`).run(req.user.id, symbol, Math.max(0, nextHolding));
    db.prepare("INSERT INTO trades(user_id,symbol,side,quantity,price,total) VALUES(?,?,?,?,?,?)")
      .run(req.user.id, symbol, side, quantity, price, total);
  });
  try {
    transact();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message || "Trade failed." });
  }
});

app.get("/api/admin", requireAuth, requireAdmin, (_req, res) => {
  const users = db.prepare("SELECT id,name,email,role,balance,created_at FROM users ORDER BY id DESC LIMIT 200").all();
  const totals = db.prepare("SELECT COUNT(*) AS users, COALESCE(SUM(balance),0) AS virtual_balance FROM users").get();
  res.json({ users, totals });
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`DarkTrade running at http://localhost:${PORT}`));
