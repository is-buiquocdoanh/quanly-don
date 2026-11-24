import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { nowVN } from './util.js';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
fs.mkdirSync(DATA_DIR, { recursive: true });
export const DB_PATH = path.join(DATA_DIR, 'don.db');

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'kho' CHECK (role IN ('admin','kho')),
  api_token     TEXT UNIQUE,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER PRIMARY KEY,
  phone      TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL DEFAULT '',
  address    TEXT NOT NULL DEFAULT '',
  flag       TEXT NOT NULL DEFAULT '',          -- '', 'vip', 'bom'
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id            INTEGER PRIMARY KEY,
  code          TEXT UNIQUE NOT NULL,
  created_at    TEXT NOT NULL,
  customer_id   INTEGER REFERENCES customers(id),
  name          TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL,
  address       TEXT NOT NULL DEFAULT '',
  product       TEXT NOT NULL DEFAULT '',
  qty           INTEGER NOT NULL DEFAULT 0,
  total         INTEGER NOT NULL DEFAULT 0,
  ship_fee      INTEGER NOT NULL DEFAULT 0,
  note          TEXT NOT NULL DEFAULT '',
  kho_note      TEXT NOT NULL DEFAULT '',
  page          TEXT NOT NULL DEFAULT '',
  link          TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'moi' CHECK (status IN ('moi','da_gui','da_giao','hoan','huy')),
  tracking_code TEXT NOT NULL DEFAULT '',
  shipped_at    TEXT,
  done_at       TEXT,
  cod_received  INTEGER NOT NULL DEFAULT 0,
  cod_at        TEXT,
  dup_codes     TEXT NOT NULL DEFAULT '',
  created_by    INTEGER REFERENCES users(id),
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_phone   ON orders(phone);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);
CREATE TABLE IF NOT EXISTS order_events (
  id       INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  at       TEXT NOT NULL,
  user_id  INTEGER REFERENCES users(id),
  action   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_order ON order_events(order_id);
CREATE TABLE IF NOT EXISTS transactions (
  id         INTEGER PRIMARY KEY,
  date       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('thu','chi')),
  category   TEXT NOT NULL,
  amount     INTEGER NOT NULL,
  page       TEXT NOT NULL DEFAULT '',
  note       TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

// nâng cấp database cũ: thêm cột nếu chưa có
function addColumn(table, column, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
}
// đơn chia cho tài khoản kho nào (mỗi tài khoản kho = 1 bên có hàng gửi đơn)
addColumn('orders', 'kho_id', 'INTEGER REFERENCES users(id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_orders_kho ON orders(kho_id, status)');
// lý do đơn bị hoàn (chọn khi bấm "Bị hoàn")
addColumn('orders', 'return_reason', "TEXT NOT NULL DEFAULT ''");
// thời điểm khách bị đưa vào sổ đỏ (flag = 'bom')
addColumn('customers', 'flagged_at', 'TEXT');
// lúc đơn được gửi cho kho qua Zalo (tự gửi hoặc chép lần lượt) — để biết đơn nào đã báo kho
addColumn('orders', 'zalo_sent_at', 'TEXT');
{
  // nâng cấp: chỉ có 1 tài khoản kho thì mọi đơn chưa chia thuộc về tài khoản đó
  const act = db.prepare(`SELECT id FROM users WHERE role = 'kho' AND active = 1 LIMIT 2`).all();
  if (act.length === 1) db.prepare('UPDATE orders SET kho_id = ? WHERE kho_id IS NULL').run(act[0].id);
}

export const SETTING_DEFAULTS = {
  shop_name: 'Trứng sâu canxi',
  cost_per_unit: 0,          // giá vốn 1 hộp, để tính lãi ước tính
  dup_days: 7,               // số ngày kiểm tra trùng SĐT
  default_product: 'trứng sâu canxi Ruồi Lính Đen (35g/hộp)',
  chi_categories: ['Quảng cáo', 'Nhập hàng', 'Phí ship', 'Đóng gói', 'Lương', 'Khác'],
  thu_categories: ['Thu khác'],
  // lý do hoàn để chọn nhanh; lý do đầu tiên = khách cố tình phá → gợi ý đưa vào sổ đỏ
  return_reasons: ['Đơn ảo / cố tình phá', 'Khách không nghe máy', 'Khách từ chối nhận', 'Khách đổi ý / đặt nhầm', 'Sai địa chỉ / SĐT', 'Giao lâu, khách hủy', 'Hàng lỗi / hỏng'],
  fb_pages: [],              // các page Facebook của shop (extension chọn page theo danh sách này)
  active_kho: 0,             // tài khoản kho đang nhận đơn mới (0 = tự động nếu chỉ có 1 tài khoản kho)
  copy_sep: 'pipe',          // ký tự ngăn cách khi chép đơn: pipe | dash | semi | tab | newline
  copy_labels: 0,            // 1 = kèm nhãn "Tên:", "SĐT:"…
  // giá theo số hộp: extension + form tạo đơn tự điền tổng tiền khi đổi số lượng (mỗi dòng "số hộp = giá")
  price_table: '1 = 95000\n2 = 130000\n3 = 195000\n4 = 250000\n5 = 300000',
  // nhóm Zalo nhận đơn (chọn ở Cài đặt → Gửi đơn qua Zalo; không sửa qua form Cài đặt chung)
  zalo_group_id: '',
  zalo_group_name: '',
  // giãn cách giữa 2 đơn khi tự gửi Zalo: mỗi lần lấy ngẫu nhiên trong khoảng [min, max] giây (2–60)
  zalo_gap_min: 3,
  zalo_gap_max: 5,
  zalo_auto_shipped: 0,      // 1 = báo kho qua Zalo xong thì đơn Chờ gửi tự chuyển sang Đã gửi
};

export function getSettings() {
  const out = { ...SETTING_DEFAULTS };
  for (const r of db.prepare('SELECT key, value FROM settings').all()) {
    try { out[r.key] = JSON.parse(r.value); } catch { /* bỏ qua giá trị hỏng */ }
  }
  return out;
}
export function getSetting(key) {
  return getSettings()[key];
}
export function setSetting(key, value) {
  db.prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, JSON.stringify(value));
}

/** "2 = 130000" / "2: 130k" / "2 hộp 130k" (mỗi dòng 1 mức) → { 2: 130000, … } */
export function parsePriceTable(text) {
  const out = {};
  for (const line of String(text || '').split(/[\n;]+/)) {
    const m = line.match(/^\s*(\d{1,3})\s*(?:hộp|hop|h)?\s*[=:\-–→>]*\s*([\d.,]+)\s*(k|nghìn|ngàn|ng)?\s*đ?\s*$/i);
    if (!m) continue;
    let v = Number(m[2].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'));
    if (m[3] || v < 1000) v *= 1000;
    const qty = Number(m[1]);
    if (qty > 0 && v > 0) out[qty] = Math.round(v);
  }
  return out;
}

/** Chạy fn trong 1 transaction. */
export function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** Sao lưu database ra file (an toàn khi đang chạy). */
export function backupTo(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) fs.unlinkSync(file);
  db.prepare('VACUUM INTO ?').run(file);
  return file;
}

export function stamp() {
  return nowVN();
}
