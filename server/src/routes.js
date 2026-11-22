import { db, getSettings, setSetting, SETTING_DEFAULTS, tx } from './db.js';
import {
  nowVN, todayVN, normalizePhone, toInt, str, bad, HttpError, isDate,
  hashPassword, verifyPassword, randomToken,
} from './util.js';
import {
  STATUS, createOrder, updateOrder, bulkUpdate, listOrders, orderDetail, deleteOrder, findDups,
  getCustomerByPhone, listCustomers, customerDetail, updateCustomer, report, listPages,
} from './orders.js';

const SESSION_DAYS = 30;
const routes = [];
const add = (method, pattern, auth, handler) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
  routes.push({ method, re, keys, auth, handler });
};
export function match(method, pathname) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = pathname.match(r.re);
    if (m) return { ...r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

// ---------------------------------------------------------------- Phiên đăng nhập

export function userFromSession(token) {
  if (!token) return null;
  const u = db.prepare(`SELECT u.id, u.username, u.display_name, u.role, u.active FROM sessions s
    JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?`).get(token, Date.now());
  return u && u.active ? u : null;
}
function userFromApiToken(token) {
  if (!token) return null;
  const u = db.prepare('SELECT id, username, display_name, role, active FROM users WHERE api_token = ?').get(String(token));
  return u && u.active ? u : null;
}
const publicUser = (u) => ({ id: u.id, username: u.username, display_name: u.display_name, role: u.role });

const loginFails = new Map(); // ip -> {n, until}
function checkRate(ip) {
  const f = loginFails.get(ip);
  if (f && f.until > Date.now()) throw new HttpError(429, 'Sai mật khẩu quá nhiều lần, thử lại sau 10 phút');
}
function failLogin(ip) {
  const f = loginFails.get(ip) || { n: 0, until: 0 };
  f.n++;
  if (f.n >= 8) { f.until = Date.now() + 10 * 60e3; f.n = 0; }
  loginFails.set(ip, f);
}

add('POST', '/api/login', 'none', ({ body, ip, setCookie }) => {
  checkRate(ip);
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(str(body.username, 60).toLowerCase());
  if (!u || !u.active || !verifyPassword(body.password, u.password_hash)) {
    failLogin(ip);
    throw new HttpError(401, 'Sai tên đăng nhập hoặc mật khẩu');
  }
  loginFails.delete(ip);
  const token = randomToken(32);
  db.prepare('INSERT INTO sessions(token, user_id, expires_at) VALUES (?, ?, ?)').run(token, u.id, Date.now() + SESSION_DAYS * 864e5);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  setCookie(token, SESSION_DAYS * 86400);
  return { user: publicUser(u) };
});

add('GET', '/api/health', 'none', () => ({ time: nowVN() }));

add('POST', '/api/logout', 'none', ({ sid, setCookie }) => {
  if (sid) db.prepare('DELETE FROM sessions WHERE token = ?').run(sid);
  setCookie('', 0);
  return { ok: true };
});

add('GET', '/api/bootstrap', 'any', ({ user }) => ({
  user: publicUser(user),
  settings: getSettings(),
  pages: user.role === 'admin' ? listPages() : [],
  statuses: STATUS,
  today: todayVN(),
}));

add('POST', '/api/me/password', 'any', ({ user, body }) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  if (!verifyPassword(body.old_password, u.password_hash)) throw bad('Mật khẩu cũ không đúng');
  if (String(body.new_password || '').length < 6) throw bad('Mật khẩu mới tối thiểu 6 ký tự');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(body.new_password), user.id);
  return { ok: true };
});

// ---------------------------------------------------------------- Đơn hàng

add('GET', '/api/orders', 'any', ({ query }) => listOrders(query));
add('GET', '/api/orders/check', 'admin', ({ query }) => ({
  matches: findDups(query.phone, query.exclude ? toInt(query.exclude) : null),
  customer: getCustomerByPhone(query.phone),
}));
add('GET', '/api/orders/:id', 'any', ({ params }) => orderDetail(toInt(params.id)));
add('POST', '/api/orders', 'admin', ({ body, user }) => createOrder(body, user));
add('PATCH', '/api/orders/:id', 'any', ({ params, body, user }) => ({ order: updateOrder(toInt(params.id), body, user) }));
add('DELETE', '/api/orders/:id', 'admin', ({ params, user }) => (deleteOrder(toInt(params.id), user), { ok: true }));
add('POST', '/api/orders/bulk', 'any', ({ body, user }) => {
  const changes = {};
  if (body.status) changes.status = body.status;
  if ('cod_received' in body) {
    if (user.role !== 'admin') throw new HttpError(403, 'Không có quyền');
    changes.cod_received = body.cod_received;
  }
  return { updated: bulkUpdate(body.ids, changes, user) };
});

// ---------------------------------------------------------------- Khách hàng

add('GET', '/api/customers', 'admin', ({ query }) => ({ customers: listCustomers(query) }));
add('GET', '/api/customers/:id', 'admin', ({ params }) => customerDetail(toInt(params.id)));
add('PATCH', '/api/customers/:id', 'admin', ({ params, body }) => ({ customer: updateCustomer(toInt(params.id), body) }));

// ---------------------------------------------------------------- Thu chi

function txInput(b) {
  const t = {
    date: isDate(b.date) ? b.date : todayVN(),
    type: b.type === 'thu' ? 'thu' : 'chi',
    category: str(b.category, 60) || 'Khác',
    amount: toInt(b.amount),
    page: str(b.page, 120),
    note: str(b.note, 500),
  };
  if (t.amount <= 0) throw bad('Số tiền phải lớn hơn 0');
  return t;
}
add('GET', '/api/transactions', 'admin', ({ query }) => {
  const from = isDate(query.from) ? query.from : '0000-00-00';
  const to = isDate(query.to) ? query.to : '9999-99-99';
  const rows = db.prepare(`SELECT t.*, COALESCE(u.display_name, u.username, '') AS user FROM transactions t
    LEFT JOIN users u ON u.id = t.created_by WHERE date BETWEEN ? AND ? ORDER BY date DESC, t.id DESC LIMIT 2000`).all(from, to);
  return { transactions: rows };
});
add('POST', '/api/transactions', 'admin', ({ body, user }) => {
  const t = txInput(body);
  const id = db.prepare(`INSERT INTO transactions(date, type, category, amount, page, note, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(t.date, t.type, t.category, t.amount, t.page, t.note, user.id, nowVN()).lastInsertRowid;
  return { transaction: db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) };
});
add('PATCH', '/api/transactions/:id', 'admin', ({ params, body }) => {
  const t = txInput(body);
  const r = db.prepare('UPDATE transactions SET date=?, type=?, category=?, amount=?, page=?, note=? WHERE id=?')
    .run(t.date, t.type, t.category, t.amount, t.page, t.note, toInt(params.id));
  if (!r.changes) throw new HttpError(404, 'Không tìm thấy');
  return { ok: true };
});
add('DELETE', '/api/transactions/:id', 'admin', ({ params }) => {
  db.prepare('DELETE FROM transactions WHERE id = ?').run(toInt(params.id));
  return { ok: true };
});

// ---------------------------------------------------------------- Báo cáo

add('GET', '/api/report', 'admin', ({ query }) => report(query.from, query.to));

// ---------------------------------------------------------------- Cài đặt + tài khoản

add('PUT', '/api/settings', 'admin', ({ body }) => {
  for (const k of Object.keys(SETTING_DEFAULTS)) {
    if (!(k in body)) continue;
    let v = body[k];
    if (Array.isArray(SETTING_DEFAULTS[k])) {
      v = (Array.isArray(v) ? v : String(v).split(/[\n,]/)).map((x) => str(x, 60)).filter(Boolean);
    } else if (typeof SETTING_DEFAULTS[k] === 'number') v = toInt(v);
    else v = str(v, 300);
    setSetting(k, v);
  }
  return { settings: getSettings() };
});

add('GET', '/api/users', 'admin', () => ({
  users: db.prepare('SELECT id, username, display_name, role, active, created_at, api_token IS NOT NULL AS has_token FROM users ORDER BY id').all(),
}));
add('POST', '/api/users', 'admin', ({ body }) => {
  const username = str(body.username, 60).toLowerCase();
  if (!/^[a-z0-9_.-]{3,}$/.test(username)) throw bad('Tên đăng nhập: tối thiểu 3 ký tự, chỉ chữ thường không dấu, số, . _ -');
  if (String(body.password || '').length < 6) throw bad('Mật khẩu tối thiểu 6 ký tự');
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) throw bad('Tên đăng nhập đã tồn tại');
  const role = body.role === 'admin' ? 'admin' : 'kho';
  db.prepare('INSERT INTO users(username, display_name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(username, str(body.display_name, 60) || username, hashPassword(body.password), role, nowVN());
  return { ok: true };
});
add('PATCH', '/api/users/:id', 'admin', ({ params, body, user }) => {
  const id = toInt(params.id);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!u) throw new HttpError(404, 'Không tìm thấy tài khoản');
  return tx(() => {
    if ('display_name' in body) db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(str(body.display_name, 60), id);
    if ('role' in body || 'active' in body) {
      if (id === user.id) throw bad('Không thể tự đổi quyền / khóa chính mình');
      if ('role' in body) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(body.role === 'admin' ? 'admin' : 'kho', id);
      if ('active' in body) {
        db.prepare('UPDATE users SET active = ? WHERE id = ?').run(body.active ? 1 : 0, id);
        if (!body.active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
      }
    }
    if (body.password) {
      if (String(body.password).length < 6) throw bad('Mật khẩu tối thiểu 6 ký tự');
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(body.password), id);
      db.prepare('DELETE FROM sessions WHERE user_id = ? ').run(id);
    }
    return { ok: true };
  });
});

/** Tạo mã API mới cho extension (của chính tài khoản đang đăng nhập). */
add('POST', '/api/me/api-token', 'admin', ({ user }) => {
  const token = 'ext_' + randomToken(24);
  db.prepare('UPDATE users SET api_token = ? WHERE id = ?').run(token, user.id);
  return { token };
});

// ---------------------------------------------------------------- API cho Chrome extension

const fmtTime = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)} ${s.slice(11, 16)}` : '');
const extOrder = (o) => ({
  id: o.code, time: fmtTime(o.created_at), name: o.name, phone: o.phone, address: o.address,
  product: o.product, qty: o.qty, total: o.total, note: o.note, page: o.page,
  status: STATUS[o.status] || o.status, dup: o.dup_codes,
});

add('POST', '/api/ext', 'none', ({ body, baseUrl }) => {
  const user = userFromApiToken(body.token);
  if (!user || user.role !== 'admin') throw new HttpError(401, 'Sai mã API — vào web → Cài đặt → tạo mã API cho extension');
  switch (body.action) {
    case 'ping':
      return { ok: true, sheetUrl: baseUrl, webUrl: baseUrl, user: user.display_name || user.username };
    case 'check': {
      const c = getCustomerByPhone(body.order?.phone);
      return { ok: true, matches: findDups(body.order?.phone).map(extOrder), customer: c && { flag: c.flag, note: c.note } };
    }
    case 'save': {
      const { order, dups } = createOrder(body.order || {}, user);
      return { ok: true, id: order.code, dups: dups.map(extOrder) };
    }
    case 'list': {
      const days = Math.max(1, Math.min(toInt(body.days, 1), 31));
      const from = todayVN(new Date(Date.now() - (days - 1) * 864e5));
      return { ok: true, orders: listOrders({ from, sort: 'asc', limit: 2000 }).orders.map(extOrder), sheetUrl: baseUrl, webUrl: baseUrl };
    }
    default:
      throw bad('Không rõ thao tác: ' + body.action);
  }
});
