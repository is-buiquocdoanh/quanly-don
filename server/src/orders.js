import { db, tx, getSettings } from './db.js';
import { nowVN, todayVN, daysAgoVN, normalizePhone, toInt, str, bad, HttpError, isDate } from './util.js';
import { khoIdOrNull, khoName, activeKho, listKho } from './kho.js';

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

// Tài khoản kho chỉ thấy / sửa đơn chủ shop chia cho chính mình.
export const isKho = (user) => !!user && user.role !== 'admin';
const khoScope = (user) => (isKho(user) ? user.id : null);
function canSee(o, user) {
  const sc = khoScope(user);
  if (sc && o.kho_id !== sc) throw new HttpError(404, 'Không tìm thấy đơn');
}
// Bỏ những gì kho không cần biết: fanpage, link chat, người tạo, mã đơn trùng thuộc bên khác.
const KHO_HIDDEN = ['page', 'link', 'created_by', 'customer_id', 'cod_received', 'cod_at', 'cflag'];
export function forKho(rows, user) {
  if (!isKho(user)) return rows;
  const list = Array.isArray(rows) ? rows : [rows];
  const sc = khoScope(user);
  const codes = [...new Set(list.flatMap((o) => (o.dup_codes ? o.dup_codes.split(/,\s*/) : [])))];
  let visible = new Set(codes);
  if (sc && codes.length) {
    visible = new Set(db.prepare(`SELECT code FROM orders WHERE kho_id = ? AND code IN (${codes.map(() => '?').join(',')})`).all(sc, ...codes).map((r) => r.code));
  }
  const out = list.map((o) => {
    const c = { ...o };
    for (const k of KHO_HIDDEN) delete c[k];
    c.dup_codes = o.dup_codes ? o.dup_codes.split(/,\s*/).filter((x) => visible.has(x)).join(', ') : '';
    return c;
  });
  return Array.isArray(rows) ? out : out[0];
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
  const sup = input.kho_id !== undefined ? khoIdOrNull(input.kho_id) : activeKho();

  return tx(() => {
    const dups = findDups(phone);
    const code = nextCode();
    const now = nowVN();
    const customerId = upsertCustomer(phone, o.name, o.address);
    const id = Number(db.prepare(`
      INSERT INTO orders(code, created_at, customer_id, name, phone, address, product, qty, total, ship_fee,
                         note, page, link, dup_codes, created_by, updated_at, kho_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      code, now, customerId, o.name, phone, o.address, o.product, o.qty, o.total, o.ship_fee,
      o.note, o.page, o.link, dups.map((d) => d.code).join(', '), user?.id ?? null, now, sup,
    ).lastInsertRowid);
    if (sup) addEvent(id, user?.id, `Giao cho ${khoName(sup)}`);
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
  canSee(o, user);
  const isAdmin = user.role === 'admin';
  const allowed = isAdmin
    ? ['name', 'phone', 'address', 'product', 'qty', 'total', 'ship_fee', 'note', 'kho_note', 'page', 'status', 'return_reason', 'tracking_code', 'cod_received', 'kho_id']
    : ['status', 'return_reason', 'tracking_code', 'ship_fee', 'kho_note'];
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
    if (k === 'kho_id') {
      const w = khoIdOrNull(input[k]);
      if (w === o.kho_id) continue;
      sets.kho_id = w;
      // đơn chưa gửi chuyển sang bên khác: xóa thông tin bên cũ đã nhập để bên mới không thấy
      if ((sets.status || o.status) === 'moi') {
        if (!('tracking_code' in input)) sets.tracking_code = '';
        if (!('kho_note' in input)) sets.kho_note = '';
        if (!('ship_fee' in input)) sets.ship_fee = 0;
      }
      changes.push(w ? `Giao cho ${khoName(w)}` : 'Bỏ chia kho');
      continue;
    }
    if (k === 'return_reason') {
      // lý do hoàn chỉ có nghĩa khi đơn đang / sẽ ở trạng thái Hoàn
      if ((sets.status || o.status) !== 'hoan' || v === o.return_reason) continue;
      sets.return_reason = v;
      changes.push(v ? `Lý do hoàn: ${v}` : 'Bỏ lý do hoàn');
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
  // rời trạng thái Hoàn (hoàn tác, sửa nhầm) thì xóa lý do hoàn cũ
  if (sets.status && sets.status !== 'hoan' && o.return_reason) sets.return_reason = '';
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

export function listOrders(q = {}, user = null) {
  const where = [];
  const args = [];
  const scope = khoScope(user);
  if (scope) { where.push('kho_id = ?'); args.push(scope); }
  else if (q.kho === 'none') where.push('kho_id IS NULL');
  else if (toInt(q.kho)) { where.push('kho_id = ?'); args.push(toInt(q.kho)); }
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
  if (q.reason) { where.push('return_reason = ?'); args.push(String(q.reason)); }
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
  const rows = db.prepare(`SELECT orders.*, (SELECT flag FROM customers c WHERE c.id = orders.customer_id) AS cflag
    FROM orders ${w} ORDER BY created_at ${order} LIMIT ? OFFSET ?`).all(...args, limit, offset);
  const sum = db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(qty),0) qty, COALESCE(SUM(total),0) total FROM orders ${w}`).get(...args);
  return { orders: forKho(rows, user), count: sum.n, qty: sum.qty, total: sum.total };
}

export function orderDetail(id, user = null) {
  const o = getOrder(id);
  canSee(o, user);
  let events = db.prepare(`SELECT e.at, e.action, COALESCE(u.display_name, u.username, '') AS user, u.role, e.user_id AS uid
    FROM order_events e LEFT JOIN users u ON u.id = e.user_id WHERE order_id = ? ORDER BY e.id`).all(id);
  if (isKho(user)) {
    // kho chỉ thấy thao tác của bên mình; thao tác của chủ shop hiện là "Shop"; ẩn việc giao/chuyển nhà cung cấp
    const sc = khoScope(user);
    events = events
      .filter((e) => !/^(Giao cho|Bỏ giao)/.test(e.action) && !(e.role === 'kho' && e.uid !== sc))
      .map((e) => ({ at: e.at, user: e.role === 'admin' ? 'Shop' : e.user, action: e.action.replace(/^Tạo đơn \(trùng .*\)$/, 'Tạo đơn').split('; ').filter((x) => !/^(Giao cho|Bỏ giao)/.test(x)).join('; ') }))
      .filter((e) => e.action);
    return { order: forKho(o, user), events, history: [], customer: null };
  }
  events = events.map(({ role, uid, ...e }) => e);
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

const CUS_STATS = `
    SELECT c.*, COUNT(o.id) AS orders,
      COALESCE(SUM(o.status = 'da_giao'), 0) AS delivered,
      COALESCE(SUM(CASE WHEN o.status = 'da_giao' THEN o.total END), 0) AS spent,
      COALESCE(SUM(CASE WHEN o.status = 'da_giao' THEN o.qty END), 0) AS boxes,
      COALESCE(SUM(o.status = 'hoan'), 0) AS returns,
      COALESCE(SUM(o.status = 'hoan' AND o.return_reason = ?), 0) AS fake_returns,
      MIN(CASE WHEN o.status = 'da_giao' THEN o.created_at END) AS first_buy,
      MAX(CASE WHEN o.status = 'da_giao' THEN o.created_at END) AS last_buy,
      MAX(o.created_at) AS last_order
    FROM customers c LEFT JOIN orders o ON o.customer_id = c.id`;
// lý do hoàn đầu tiên trong Cài đặt = "đơn ảo / cố tình phá"
const fakeReason = () => (getSettings().return_reasons || [])[0] || '';

/**
 * view: ''      = tất cả, mới đặt gần nhất trước
 *       'loyal' = khách quen: từ 2 đơn đã giao, mua nhiều nhất trước
 *       'red'   = sổ đỏ (flag = 'bom'), mới thêm trước
 */
export function listCustomers(q = {}) {
  const args = [fakeReason()];
  const where = [];
  if (q.q) {
    const s = '%' + String(q.q).trim() + '%';
    where.push('(c.name LIKE ? OR c.phone LIKE ? OR c.address LIKE ?)');
    args.push(s, s, s);
  }
  if (q.view === 'red') where.push("c.flag = 'bom'");
  else if (q.flag) { where.push('c.flag = ?'); args.push(String(q.flag)); }
  if (q.view === 'loyal') where.push("c.flag <> 'bom'");
  const having = q.view === 'loyal' ? `HAVING delivered >= ${Math.max(2, toInt(q.min, 2))}` : '';
  const order = q.view === 'loyal' ? 'delivered DESC, spent DESC'
    : q.view === 'red' ? 'c.flagged_at DESC, last_order DESC' : 'last_order DESC';
  const rows = db.prepare(`${CUS_STATS} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    GROUP BY c.id ${having} ORDER BY ${order} LIMIT ?`).all(...args, Math.min(toInt(q.limit, 300), 2000));
  if (q.view === 'loyal') {
    // chu kỳ mua lại trung bình và số ngày từ lần mua cuối: biết khách nào đến hạn / lâu rồi chưa mua lại
    const today = Date.parse(todayVN());
    for (const c of rows) {
      const first = Date.parse(c.first_buy.slice(0, 10));
      const last = Date.parse(c.last_buy.slice(0, 10));
      c.cycle_days = Math.round((last - first) / 864e5 / (c.delivered - 1));
      c.since_days = Math.round((today - Date.parse(c.last_order.slice(0, 10))) / 864e5);
    }
  }
  return rows;
}

/** Khách nghi vấn: chưa vào sổ đỏ nhưng có đơn hoàn vì "cố tình phá", hoặc hoàn nhiều mà gần như không nhận đơn nào. */
export function suspectCustomers() {
  return db.prepare(`${CUS_STATS} WHERE c.flag <> 'bom' GROUP BY c.id
    HAVING fake_returns >= 1 OR (returns >= 2 AND delivered = 0) OR (returns >= 3 AND returns > delivered)
    ORDER BY fake_returns DESC, returns DESC, last_order DESC LIMIT 100`).all(fakeReason());
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
  const flaggedAt = flag === 'bom' ? (c.flag === 'bom' && c.flagged_at ? c.flagged_at : nowVN()) : null;
  db.prepare('UPDATE customers SET name = ?, address = ?, note = ?, flag = ?, flagged_at = ? WHERE id = ?').run(
    'name' in input ? str(input.name, 120) : c.name,
    'address' in input ? str(input.address, 500) : c.address,
    'note' in input ? str(input.note, 1000) : c.note,
    flag, flaggedAt, id);
  return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
}

/** Đưa 1 SĐT vào sổ đỏ (kể cả SĐT chưa từng đặt đơn). Lý do được nối thêm vào ghi chú cũ. */
export function blacklistPhone(input) {
  const phone = normalizePhone(input.phone);
  if (phone.length !== 10) throw bad('SĐT phải có 10 số');
  const reason = str(input.note, 500);
  return tx(() => {
    const id = upsertCustomer(phone, str(input.name, 120), '');
    const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    const note = reason && !c.note.includes(reason) ? (c.note ? c.note + '\n' : '') + reason : c.note;
    return updateCustomer(id, { flag: 'bom', note });
  });
}

// ---------------------------------------------------------------- Báo cáo

// Tách tỉnh/thành từ địa chỉ: lấy đoạn cuối sau dấu phẩy, bỏ tiền tố "tỉnh", "TP"…
function provinceOf(address) {
  const parts = String(address || '').split(/[,\-–]/).map((x) => x.trim()).filter(Boolean);
  let p = parts[parts.length - 1] || '';
  p = p.replace(/^(tỉnh|tinh|thành phố|thanh pho|tp\.?|t\.p\.?)\s+/i, '').replace(/\.$/, '').trim();
  if (!p || p.length > 30 || /\d/.test(p)) return 'Không rõ';
  if (/^(hn|ha noi|hà nội)$/i.test(p)) return 'Hà Nội';
  if (/^(hcm|tphcm|sài gòn|sai gon|hồ chí minh|ho chi minh)$/i.test(p)) return 'TP Hồ Chí Minh';
  return p.charAt(0).toUpperCase() + p.slice(1);
}

export function report(from, to, { compare = true } = {}) {
  if (!isDate(from) || !isDate(to)) throw bad('Khoảng ngày không hợp lệ');
  const s = getSettings();
  const cost = Number(s.cost_per_unit) || 0;
  const orders = db.prepare(`SELECT substr(created_at, 1, 10) AS d, CAST(substr(created_at, 12, 2) AS INTEGER) AS h,
    status, qty, total, ship_fee, page, address, return_reason, COALESCE(kho_id, 0) AS wh
    FROM orders WHERE created_at BETWEEN ? AND ?`).all(from + ' 00:00:00', to + ' 23:59:59');
  const txs = db.prepare('SELECT date, type, category, amount, page FROM transactions WHERE date BETWEEN ? AND ?').all(from, to);

  const r = {
    from, to, orders: 0, qty: 0, revenue: 0, delivered: 0, cogs: 0, ship: 0, ads: 0, import: 0,
    other_chi: 0, other_thu: 0, cancelled: 0, by_status: {}, chi_by_cat: {}, by_return_reason: {},
  };
  const days = {};
  const pages = {};
  const blankDay = (d) => ({ date: d, orders: 0, qty: 0, revenue: 0, ads: 0, cogs: 0, ship: 0, other: 0, profit: 0 });
  const day = (d) => (days[d] ??= blankDay(d));
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0 }));
  const provinces = {};
  const qtyBuckets = { 1: 0, 2: 0, 3: 0, 4: 0, '5+': 0 };
  const whs = {};
  const wh = (id) => (whs[id] ??= { id, orders: 0, qty: 0, revenue: 0, shipped: 0, returns: 0, waiting: 0 });
  const pg = (p) => (pages[p || '(không rõ)'] ??= { page: p || '(không rõ)', orders: 0, qty: 0, revenue: 0, ads: 0, returns: 0, delivered: 0 });

  for (const o of orders) {
    r.by_status[o.status] = (r.by_status[o.status] || 0) + 1;
    if (o.status === 'huy') { r.cancelled++; continue; }
    r.orders++;
    r.ship += o.ship_fee;
    const D = day(o.d);
    const P = pg(o.page);
    D.orders++; P.orders++;
    D.ship += o.ship_fee;
    const WH = wh(o.wh);
    WH.orders++;
    if (o.status === 'da_gui' || o.status === 'da_giao') WH.shipped++;
    if (o.status === 'hoan') WH.returns++;
    else { WH.qty += o.qty; WH.revenue += o.total; }
    if (o.h >= 0 && o.h < 24) hours[o.h].orders++;
    const pv = provinceOf(o.address);
    const PV = (provinces[pv] ??= { province: pv, orders: 0, revenue: 0, returns: 0 });
    PV.orders++;
    qtyBuckets[o.qty >= 5 ? '5+' : Math.max(1, o.qty)]++;
    if (o.status === 'hoan') {
      P.returns++; PV.returns++;
      const why = o.return_reason || 'Chưa ghi lý do';
      r.by_return_reason[why] = (r.by_return_reason[why] || 0) + 1;
      continue;
    }
    r.qty += o.qty; r.revenue += o.total; r.cogs += o.qty * cost;
    D.qty += o.qty; D.revenue += o.total; D.cogs += o.qty * cost;
    PV.revenue += o.total;
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
    else { r.other_chi += t.amount; day(t.date).other += t.amount; }
  }
  for (const t of txs) if (t.type === 'thu') day(t.date).other -= t.amount;
  const done = (r.by_status.da_giao || 0) + (r.by_status.hoan || 0);
  r.return_rate = done ? (r.by_status.hoan || 0) / done : 0;
  r.cost_per_order = r.orders ? Math.round(r.ads / r.orders) : 0;
  r.profit = r.revenue - r.cogs - r.ship - r.ads - r.other_chi + r.other_thu;
  r.cost_per_unit = cost;

  // fill các ngày trống để biểu đồ liền mạch
  const list = [];
  for (let d = new Date(from + 'T00:00:00Z'); d <= new Date(to + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    const k = d.toISOString().slice(0, 10);
    const D = days[k] || blankDay(k);
    D.profit = D.revenue - D.cogs - D.ship - D.ads - D.other;
    list.push(D);
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

  r.by_hour = hours;
  const sups = listKho();
  if (sups.length) {
    for (const x of db.prepare(`SELECT COALESCE(kho_id, 0) w, COUNT(*) n FROM orders WHERE status = 'moi' GROUP BY 1`).all()) wh(x.w).waiting = x.n;
    for (const u of sups) if (u.active) wh(u.id);
    r.by_kho = Object.values(whs)
      .map((x) => ({ ...x, name: x.id ? (sups.find((u) => u.id === x.id)?.name || khoName(x.id)) : 'Chưa chia' }))
      .filter((x) => x.id || x.orders || x.waiting)
      .sort((a, b) => (a.id === 0) - (b.id === 0) || b.orders - a.orders);
  } else r.by_kho = [];
  r.by_qty = Object.entries(qtyBuckets).map(([k, n]) => ({ qty: k, orders: n }));
  const pvList = Object.values(provinces).sort((a, b) => b.orders - a.orders);
  r.by_province = pvList.length > 8
    ? [...pvList.slice(0, 7), pvList.slice(7).reduce((a, x) => ({ ...a, orders: a.orders + x.orders, revenue: a.revenue + x.revenue, returns: a.returns + x.returns }),
      { province: `Tỉnh khác (${pvList.length - 7})`, orders: 0, revenue: 0, returns: 0 })]
    : pvList;
  r.roas = r.ads ? r.revenue / r.ads : 0;
  r.aov = r.orders ? Math.round(r.revenue / Math.max(1, r.orders - (r.by_status.hoan || 0))) : 0;

  // kỳ trước cùng độ dài, để so sánh tăng/giảm
  if (compare) {
    const n = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
    const shift = (d, k) => new Date(Date.parse(d) + k * 864e5).toISOString().slice(0, 10);
    const p = report(shift(from, -n), shift(from, -1), { compare: false });
    r.prev = { from: p.from, to: p.to, orders: p.orders, qty: p.qty, revenue: p.revenue, ads: p.ads, profit: p.profit,
      return_rate: p.return_rate, cost_per_order: p.cost_per_order, roas: p.roas, aov: p.aov };
  }
  return r;
}

export function listPages() {
  // page khai báo trong Cài đặt đứng trước, sau đó các page đã dùng trong đơn / thu chi
  const used = db.prepare(`SELECT page FROM orders WHERE page <> '' UNION SELECT page FROM transactions WHERE page <> '' ORDER BY 1`)
    .all().map((r) => r.page);
  return [...new Set([...(getSettings().fb_pages || []), ...used])];
}
