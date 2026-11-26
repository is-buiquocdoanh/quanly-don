// Xử lý đặt hàng công khai từ website (doanhwork.com):
// - Chống spam (honeypot + giới hạn tần suất theo IP + chặn bấm đúp trong 2 phút)
// - Kiểm tra Sổ đỏ (flag = 'bom') để tránh đơn phá
// - Tự tính giá chuẩn phía server (ưu tiên giá sản phẩm, nếu để 0 thì lấy theo bảng giá trong Cài đặt)
// - Lưu thẳng vào bảng orders (page = 'Website', tự giao cho kho đang hoạt động)
import { db, getSettings } from '../db.js';
import { createOrder, getCustomerByPhone } from '../orders.js';
import { normalizePhone, str, toInt, bad, HttpError, nowVN } from '../util.js';
import { getSite, getPriceTable } from './content.js';
import { recordHit, capiPurchase, cookieOf } from './stats.js';

const RATE_WINDOW_MS = 15 * 60e3;
const RATE_MAX = 6;
const ipHits = new Map();

function checkOrderRate(ip) {
  const key = String(ip || 'unknown');
  const now = Date.now();
  const list = (ipHits.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_MAX) {
    throw new HttpError(429, 'Bạn vừa gửi nhiều đơn liên tiếp. Vui lòng chờ vài phút hoặc gọi trực tiếp cho shop.');
  }
  list.push(now);
  ipHits.set(key, list);
  // dọn định kỳ tránh phình bộ nhớ
  if (ipHits.size > 2000) {
    for (const [k, v] of ipHits) {
      if (!v.some((t) => now - t < RATE_WINDOW_MS)) ipHits.delete(k);
    }
  }
}

/** Tính tiền phía server theo bảng giá combo hũ 35g (ưu tiên bảng giá trong Cài đặt: 1=95k, 2=130k, 3=195k, 4=250k, 5=300k). */
export function calcOrderTotal(site, productName, qty) {
  const q = Math.max(1, Math.min(100, toInt(qty, 1)));
  const table = getPriceTable();
  const tiers = Object.keys(table).map(Number).filter((n) => n > 0).sort((a, b) => a - b);
  if (tiers.length) {
    if (table[q]) return { total: table[q], unit: Math.round(table[q] / q), ship: q === 1 ? 30000 : 0, source: 'table' };
    let ref = tiers[0];
    for (const t of tiers) if (t <= q) ref = t;
    const total = Math.round(((table[ref] / ref) * q) / 1000) * 1000;
    return { total, unit: Math.round(total / q), ship: q === 1 ? 30000 : 0, source: 'table' };
  }
  const prod = (site.products || []).find((p) => p.name === productName) || null;
  if (prod && Number(prod.price) > 0) {
    return { total: Number(prod.price) * q, unit: Number(prod.price), ship: 0, source: 'product' };
  }
  return { total: 0, unit: 0, ship: 0, source: 'contact' };
}

export function createPublicOrder(input = {}, ip = '', meta = {}) {
  // Honeypot chống bot tự điền form
  if (str(input.website || input.company || '', 100)) {
    throw bad('Yêu cầu không hợp lệ');
  }
  const name = str(input.name, 120);
  if (name.length < 2) throw bad('Vui lòng nhập họ tên người nhận');
  const phone = normalizePhone(input.phone);
  if (!/^0\d{9}$/.test(phone)) throw bad('Số điện thoại chưa đúng (cần đủ 10 số, bắt đầu bằng 0)');
  const address = str(input.address, 500);
  if (address.length < 6) throw bad('Vui lòng nhập địa chỉ giao hàng cụ thể (thôn/số nhà, xã/phường, huyện/tỉnh)');
  const qty = toInt(input.qty, 1);
  if (qty < 1 || qty > 100) throw bad('Số lượng đặt từ 1 đến 100 hũ/hộp');

  // Kiểm tra Sổ đỏ trước khi đếm rate limit để chặn đơn phá
  const cust = getCustomerByPhone(phone);
  if (cust && cust.flag === 'bom') {
    throw bad('Số điện thoại này cần xác nhận trực tiếp. Vui lòng gọi điện hoặc nhắn Zalo/Messenger cho shop để đặt hàng.');
  }

  checkOrderRate(ip);

  // Chặn bấm đúp cùng SĐT + số lượng trong vòng 2 phút
  const twoMinAgo = nowVN(new Date(Date.now() - 2 * 60e3));
  const recent = db.prepare(`SELECT code, name, phone, address, product, qty, total, created_at
    FROM orders WHERE phone = ? AND page = 'Website' AND qty = ? AND created_at >= ? ORDER BY id DESC LIMIT 1`).get(phone, qty, twoMinAgo);
  if (recent) {
    return { order: recent, duplicate_recent: true };
  }

  const site = getSite();
  const reqProduct = str(input.product, 300);
  const matchedProd = (site.products || []).find((p) => p.name === reqProduct);
  const product = matchedProd ? matchedProd.name : (reqProduct || site.products[0]?.name || getSettings().default_product);
  const note = str(input.note, 500);
  const { total } = calcOrderTotal(site, product, qty);

  const { order } = createOrder({
    name,
    phone,
    address,
    product,
    qty,
    total,
    note,
    page: 'Website',
  }, null);

  // thống kê website (nguồn / thiết bị của đơn) + báo Facebook có đơn (nếu đã cài Pixel + Conversions API); lỗi không làm hỏng đơn
  const t = input._t && typeof input._t === 'object' ? input._t : {};
  try { recordHit(t, { ip, ua: meta.ua || '', host: meta.host || '', order }); } catch (e) { console.error('[stats]', e); }
  capiPurchase(order, { ip, ua: meta.ua, url: str(t.u, 500) || (meta.host ? `https://${meta.host}/dat-hang` : ''),
    fbp: str(input.fbp, 200) || cookieOf(meta.cookie, '_fbp'), fbc: str(input.fbc, 500) || cookieOf(meta.cookie, '_fbc') }).catch(() => {});

  return {
    order: {
      code: order.code,
      name: order.name,
      phone: order.phone,
      address: order.address,
      product: order.product,
      qty: order.qty,
      total: order.total,
      created_at: order.created_at,
    },
    duplicate_recent: false,
  };
}
