// Tài khoản kho = 1 bên có hàng thật (nhà cung cấp). Chủ shop chia đơn cho từng tài khoản kho;
// mỗi tài khoản kho chỉ thấy đơn chia cho mình, không biết các tài khoản kho khác.
import { db, getSettings } from './db.js';
import { toInt, bad } from './util.js';

const label = (u) => u.display_name || u.username;

export function getKho(id) {
  return db.prepare(`SELECT id, username, display_name, active FROM users WHERE id = ? AND role = 'kho'`).get(toInt(id)) || null;
}

/** Danh sách tài khoản kho {id, name, username, active}; stats: thêm số đơn chờ gửi / đang gửi. */
export function listKho({ stats = false } = {}) {
  const rows = db.prepare(`SELECT id, username, display_name, active FROM users WHERE role = 'kho' ORDER BY active DESC, id`).all()
    .map((u) => ({ id: u.id, name: label(u), username: u.username, active: u.active }));
  if (!stats) return rows;
  const count = (st) => Object.fromEntries(db.prepare(`SELECT COALESCE(kho_id, 0) k, COUNT(*) n FROM orders WHERE status = ? GROUP BY 1`).all(st).map((r) => [r.k, r.n]));
  const waiting = count('moi');
  const shipped = count('da_gui');
  return {
    khos: rows.map((k) => ({ ...k, waiting: waiting[k.id] || 0, shipped: shipped[k.id] || 0 })),
    unassigned: waiting[0] || 0,
  };
}

/** id tài khoản kho hợp lệ, hoặc null nếu bỏ trống / 0. */
export function khoIdOrNull(v) {
  if (v === null || v === undefined || v === '' || Number(v) === 0) return null;
  const k = getKho(v);
  if (!k) throw bad('Tài khoản kho không tồn tại');
  return k.id;
}

export function khoName(id) {
  if (!id) return 'Chưa chia';
  const k = getKho(id);
  return k ? label(k) : `#${id}`;
}

/** Tài khoản kho nhận đơn mới: theo Cài đặt; nếu chưa chọn mà chỉ có đúng 1 tài khoản kho đang hoạt động thì giao cho tài khoản đó. */
export function activeKho() {
  const k = getKho(getSettings().active_kho);
  if (k && k.active) return k.id;
  const act = db.prepare(`SELECT id FROM users WHERE role = 'kho' AND active = 1 LIMIT 2`).all();
  return act.length === 1 ? act[0].id : null;
}

/** Khi chỉ có 1 tài khoản kho đang hoạt động: đơn chưa chia nào cũng giao cho tài khoản đó (để nâng cấp không mất đơn). */
export function adoptUnassigned() {
  const act = db.prepare(`SELECT id FROM users WHERE role = 'kho' AND active = 1 LIMIT 2`).all();
  if (act.length !== 1) return 0;
  return Number(db.prepare('UPDATE orders SET kho_id = ? WHERE kho_id IS NULL').run(act[0].id).changes);
}
