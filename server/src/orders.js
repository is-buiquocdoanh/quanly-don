import { db, tx, getSettings } from './db.js';
import { nowVN, todayVN, daysAgoVN, normalizePhone, toInt, str, bad, HttpError, isDate } from './util.js';

export const STATUS = { moi: 'Chờ gửi', da_gui: 'Đã gửi', da_giao: 'Đã giao', hoan: 'Hoàn', huy: 'Hủy' };
const KHO_STATUSES = ['moi', 'da_gui', 'da_giao', 'hoan'];

function addEvent(orderId, userId, action) {
  db.prepare('INSERT INTO order_events(order_id, at, user_id, action) VALUES (?, ?, ?, ?)')
    .run(orderId, nowVN(), userId ?? null, action);
}

export function getOrder(id) {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!o) throw new HttpError(404, 'Không tìm thấy đơn');
  return o;
}

export function findDups(phone, excludeId = null) {
  phone = normalizePhone(phone);
  if (phone.length !== 10) return [];
  const days = Number(getSettings().dup_days) || 7;
  return db.prepare(`
    SELECT id, code, created_at, name, qty, total, status FROM orders
    WHERE phone = ? AND created_at >= ? AND id IS NOT ?
    ORDER BY created_at DESC`).all(phone, daysAgoVN(days), excludeId);
}

export function getCustomerByPhone(phone) {
  return db.prepare('SELECT * FROM customers WHERE phone = ?').get(normalizePhone(phone)) || null;
}

function nextCode() {
  const prefix = 'DH' + todayVN().slice(2).replace(/-/g, '') + '-';
  const last = db.prepare('SELECT code FROM orders WHERE code LIKE ? ORDER BY code DESC LIMIT 1').get(prefix + '%');
  const n = last ? parseInt(last.code.slice(prefix.length), 10) + 1 : 1;
  return prefix + String(n).padStart(3, '0');
}

function upsertCustomer(phone, name, address) {
  const c = getCustomerByPhone(phone);
  if (c) {
    db.prepare(`UPDATE customers SET name = CASE WHEN ? <> '' THEN ? ELSE name END,
                address = CASE WHEN ? <> '' THEN ? ELSE address END WHERE id = ?`)
      .run(name, name, address, address, c.id);
    return c.id;
  }
  return Number(db.prepare('INSERT INTO customers(phone, name, address, created_at) VALUES (?, ?, ?, ?)')
    .run(phone, name, address, nowVN()).lastInsertRowid);
}

export function createOrder(input, user) {
  const phone = normalizePhone(input.phone);
  if (phone.length !== 10) throw bad('SĐT phải có 10 số');
  const o = {
    name: str(input.name, 120),
    address: str(input.address, 500),
    product: str(input.product, 300) || getSettings().default_product,
    qty: toInt(input.qty),
    total: toInt(input.total),
    ship_fee: toInt(input.ship_fee),
    note: str(input.note, 500),
    page: str(input.page, 120),
    link: str(input.link, 1000),
  };
  if (!o.address) throw bad('Thiếu địa chỉ');

  return tx(() => {
    const dups = findDups(phone);
    const code = nextCode();
    const now = nowVN();
    const customerId = upsertCustomer(phone, o.name, o.address);
    const id = Number(db.prepare(`
      INSERT INTO orders(code, created_at, customer_id, name, phone, address, product, qty, total, ship_fee,
                         note, page, link, dup_codes, created_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      code, now, customerId, o.name, phone, o.address, o.product, o.qty, o.total, o.ship_fee,
      o.note, o.page, o.link, dups.map((d) => d.code).join(', '), user?.id ?? null, now,
    ).lastInsertRowid);
    for (const d of dups) {
      db.prepare(`UPDATE orders SET dup_codes = CASE WHEN dup_codes = '' THEN ? ELSE dup_codes || ', ' || ? END WHERE id = ?`)
        .run(code, code, d.id);
    }
    addEvent(id, user?.id, 'Tạo đơn' + (dups.length ? ` (trùng ${dups.map((d) => d.code).join(', ')})` : ''));
    return { order: getOrder(id), dups };
  });
}

function applyStatus(o, status, now) {
  const sets = { status };
  if (status === 'da_gui' && !o.shipped_at) sets.shipped_at = now;
  if (status === 'moi') sets.shipped_at = null;
  if (status === 'da_giao' || status === 'hoan') sets.done_at = now;
  if (status === 'moi' || status === 'da_gui') sets.done_at = null;
  return sets;
}

export function updateOrder(id, input, user, info = {}) {
  const o = getOrder(id);
  const isAdmin = user.role === 'admin';
  const allowed = isAdmin
    ? ['name', 'phone', 'address', 'product', 'qty', 'total', 'ship_fee', 'note', 'kho_note', 'page', 'status', 'tracking_code', 'cod_received']
    : ['status', 'tracking_code', 'ship_fee', 'kho_note'];
  const now = nowVN();
  let sets = {};
  const changes = [];

  for (const k of allowed) {
    if (!(k in input)) continue;
    let v = input[k];
    if (k === 'phone') {
      v = normalizePhone(v);
      if (v.length !== 10) throw bad('SĐT phải có 10 số');
    } else if (['qty', 'total', 'ship_fee'].includes(k)) v = toInt(v);
    else if (k === 'cod_received') v = v ? 1 : 0;
    else v = str(v, k === 'link' ? 1000 : 500);

    if (k === 'status') {
      if (!STATUS[v]) throw bad('Trạng thái không hợp lệ');
      if (!isAdmin && !KHO_STATUSES.includes(v)) throw new HttpError(403, 'Kho không được đổi sang trạng thái này');
      if (v === o.status) continue;
      sets = { ...sets, ...applyStatus(o, v, now) };
      changes.push(`${STATUS[o.status]} → ${STATUS[v]}`);
      continue;
    }
    if (k === 'cod_received') {
      if (v === o.cod_received) continue;
      sets.cod_received = v;
      sets.cod_at = v ? now : null;
      changes.push(v ? 'COD đã về' : 'Bỏ đánh dấu COD');
      continue;
    }
    if (v === o[k]) continue;
    sets[k] = v;
    const labels = { tracking_code: 'Mã vận đơn', ship_fee: 'Phí ship', kho_note: 'Ghi chú kho', total: 'Tổng tiền', qty: 'SL', phone: 'SĐT', address: 'Địa chỉ', name: 'Tên' };
    changes.push(labels[k] ? `${labels[k]}: ${v}` : `Sửa ${k}`);
  }
  if (!changes.length) return o;
  info.changed = true;

  sets.updated_at = now;
  return tx(() => {
    if (sets.phone) sets.customer_id = upsertCustomer(sets.phone, sets.name ?? o.name, sets.address ?? o.address);
    const keys = Object.keys(sets);
    db.prepare(`UPDATE orders SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => sets[k]), id);
    addEvent(id, user.id, changes.join('; '));
    return getOrder(id);
  });
}

export function bulkUpdate(ids, input, user) {
  if (!Array.isArray(ids) || !ids.length) throw bad('Chưa chọn đơn nào');
  if (ids.length > 500) throw bad('Tối đa 500 đơn mỗi lần');
  let n = 0;
  for (const id of ids) {
    const info = {};
    updateOrder(toInt(id), input, user, info);
    if (info.changed) n++;
  }
  return n;
}

export function listOrders(q = {}) {
  const where = [];
  const args = [];
  if (isDate(q.from)) { where.push('created_at >= ?'); args.push(q.from + ' 00:00:00'); }
  if (isDate(q.to)) { where.push('created_at <= ?'); args.push(q.to + ' 23:59:59'); }
  if (q.status) {
    const st = String(q.status).split(',').filter((s) => STATUS[s]);
    if (st.length) { where.push(`status IN (${st.map(() => '?').join(',')})`); args.push(...st); }
  }
  if (q.page) { where.push('page = ?'); args.push(String(q.page)); }
  if (q.dup === '1') where.push("dup_codes <> ''");
  if (q.cod === 'pending') where.push("status = 'da_giao' AND cod_received = 0");
  if (q.cod === 'done') where.push('cod_received = 1');
  if (q.q) {
    const s = '%' + String(q.q).trim() + '%';
    const p = normalizePhone(q.q);
    where.push('(code LIKE ? OR name LIKE ? OR phone LIKE ? OR address LIKE ? OR tracking_code LIKE ?)');
    args.push(s, s, p.length >= 3 && /^\d+$/.test(String(q.q).replace(/[\s.]/g, '')) ? '%' + p.replace(/^0/, '') + '%' : s, s, s);
  }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const limit = Math.min(toInt(q.limit, 300), 2000);
  const offset = toInt(q.offset, 0);
  const order = q.sort === 'asc' ? 'ASC' : 'DESC';
  const rows = db.prepare(`SELECT * FROM orders ${w} ORDER BY created_at ${order} LIMIT ? OFFSET ?`).all(...args, limit, offset);
  const sum = db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(qty),0) qty, COALESCE(SUM(total),0) total FROM orders ${w}`).get(...args);
  return { orders: rows, count: sum.n, qty: sum.qty, total: sum.total };
}

export function orderDetail(id) {
  const o = getOrder(id);
  const events = db.prepare(`SELECT e.at, e.action, COALESCE(u.display_name, u.username, '') AS user
    FROM order_events e LEFT JOIN users u ON u.id = e.user_id WHERE order_id = ? ORDER BY e.id`).all(id);
  const history = db.prepare(`SELECT id, code, created_at, qty, total, status FROM orders
    WHERE phone = ? AND id <> ? ORDER BY created_at DESC LIMIT 20`).all(o.phone, id);
  const customer = o.customer_id ? db.prepare('SELECT * FROM customers WHERE id = ?').get(o.customer_id) : null;
  return { order: o, events, history, customer };
}

export function deleteOrder(id, user) {
  if (user.role !== 'admin') throw new HttpError(403, 'Không có quyền');
  getOrder(id);
  db.prepare('DELETE FROM orders WHERE id = ?').run(id);
}

// ---------------------------------------------------------------- Khách hàng

export function listCustomers(q = {}) {
  const args = [];
  let w = '';
  if (q.q) {
    const s = '%' + String(q.q).trim() + '%';
    w = 'WHERE c.name LIKE ? OR c.phone LIKE ? OR c.address LIKE ?';
    args.push(s, s, s);
  }
  if (q.flag) { w += (w ? ' AND ' : 'WHERE ') + 'c.flag = ?'; args.push(String(q.flag)); }
  return db.prepare(`
    SELECT c.*, COUNT(o.id) AS orders,
      COALESCE(SUM(CASE WHEN o.status = 'da_giao' THEN o.total END), 0) AS spent,
      COALESCE(SUM(CASE WHEN o.status = 'hoan' THEN 1 END), 0) AS returns,
      MAX(o.created_at) AS last_order
    FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
    ${w} GROUP BY c.id ORDER BY last_order DESC LIMIT ?`).all(...args, Math.min(toInt(q.limit, 300), 2000));
}

export function customerDetail(id) {
  const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!c) throw new HttpError(404, 'Không tìm thấy khách');
  const orders = db.prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC').all(id);
  return { customer: c, orders };
}

export function updateCustomer(id, input) {
  const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!c) throw new HttpError(404, 'Không tìm thấy khách');
  const flag = ['', 'vip', 'bom'].includes(input.flag) ? input.flag : c.flag;
  db.prepare('UPDATE customers SET name = ?, address = ?, note = ?, flag = ? WHERE id = ?').run(
    'name' in input ? str(input.name, 120) : c.name,
    'address' in input ? str(input.address, 500) : c.address,
    'note' in input ? str(input.note, 1000) : c.note,
    flag, id);
  return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
}

// ---------------------------------------------------------------- Báo cáo

export function report(from, to) {
  if (!isDate(from) || !isDate(to)) throw bad('Khoảng ngày không hợp lệ');
  const s = getSettings();
  const cost = Number(s.cost_per_unit) || 0;
  const orders = db.prepare(`SELECT substr(created_at, 1, 10) AS d, status, qty, total, ship_fee, page
    FROM orders WHERE created_at BETWEEN ? AND ?`).all(from + ' 00:00:00', to + ' 23:59:59');
  const txs = db.prepare('SELECT date, type, category, amount, page FROM transactions WHERE date BETWEEN ? AND ?').all(from, to);

  const r = {
    from, to, orders: 0, qty: 0, revenue: 0, delivered: 0, cogs: 0, ship: 0, ads: 0, import: 0,
    other_chi: 0, other_thu: 0, cancelled: 0, by_status: {}, chi_by_cat: {},
  };
  const days = {};
  const pages = {};
  const day = (d) => (days[d] ??= { date: d, orders: 0, qty: 0, revenue: 0, ads: 0 });
  const pg = (p) => (pages[p || '(không rõ)'] ??= { page: p || '(không rõ)', orders: 0, qty: 0, revenue: 0, ads: 0, returns: 0, delivered: 0 });

  for (const o of orders) {
    r.by_status[o.status] = (r.by_status[o.status] || 0) + 1;
    if (o.status === 'huy') { r.cancelled++; continue; }
    r.orders++;
    r.ship += o.ship_fee;
    const D = day(o.d);
    const P = pg(o.page);
    D.orders++; P.orders++;
    if (o.status === 'hoan') { P.returns++; continue; }
    r.qty += o.qty; r.revenue += o.total; r.cogs += o.qty * cost;
    D.qty += o.qty; D.revenue += o.total;
    P.qty += o.qty; P.revenue += o.total;
    if (o.status === 'da_giao') { r.delivered += o.total; P.delivered++; }
  }
  for (const t of txs) {
    if (t.type === 'thu') { r.other_thu += t.amount; continue; }
    r.chi_by_cat[t.category] = (r.chi_by_cat[t.category] || 0) + t.amount;
    if (t.category === 'Quảng cáo') {
      r.ads += t.amount;
      day(t.date).ads += t.amount;
      pg(t.page).ads += t.amount;
    } else if (t.category === 'Nhập hàng') r.import += t.amount;
    else r.other_chi += t.amount;
  }
  const done = (r.by_status.da_giao || 0) + (r.by_status.hoan || 0);
  r.return_rate = done ? (r.by_status.hoan || 0) / done : 0;
  r.cost_per_order = r.orders ? Math.round(r.ads / r.orders) : 0;
  r.profit = r.revenue - r.cogs - r.ship - r.ads - r.other_chi + r.other_thu;
  r.cost_per_unit = cost;

  // fill các ngày trống để biểu đồ liền mạch
  const list = [];
  for (let d = new Date(from + 'T00:00:00Z'); d <= new Date(to + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    const k = d.toISOString().slice(0, 10);
    list.push(days[k] || { date: k, orders: 0, qty: 0, revenue: 0, ads: 0 });
    if (list.length > 400) break;
  }
  r.by_day = list;
  r.by_page = Object.values(pages).map((p) => ({ ...p, cpo: p.orders ? Math.round(p.ads / p.orders) : 0 }))
    .sort((a, b) => b.orders - a.orders);

  const cod = db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(total), 0) amt FROM orders WHERE status = 'da_giao' AND cod_received = 0`).get();
  r.cod_pending = { count: cod.n, amount: cod.amt };
  const codIn = db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(total), 0) amt FROM orders WHERE cod_received = 1 AND cod_at BETWEEN ? AND ?`)
    .get(from + ' 00:00:00', to + ' 23:59:59');
  r.cod_in = { count: codIn.n, amount: codIn.amt };
  r.waiting = db.prepare(`SELECT COUNT(*) n FROM orders WHERE status = 'moi'`).get().n;
  return r;
}

export function listPages() {
  return db.prepare(`SELECT page FROM orders WHERE page <> '' UNION SELECT page FROM transactions WHERE page <> '' ORDER BY 1`)
    .all().map((r) => r.page);
}
