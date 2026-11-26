// Thống kê truy cập website (tự đếm, không dùng Google Analytics) + gửi sự kiện đặt hàng cho Facebook (Conversions API).
// - Trang web gửi "nhịp" nhỏ khi khách xem trang / bấm nút / bắt đầu điền form; đơn đặt thành công ghi phía server.
// - Không lưu IP. Mã khách là chuỗi ngẫu nhiên do trình duyệt tự tạo (hoặc băm IP+trình duyệt theo ngày nếu trình duyệt chặn).
// - Bot / máy quét không chạy JavaScript nên gần như không bị đếm; thêm lọc theo User-Agent cho chắc.
import crypto from 'node:crypto';
import { db } from '../db.js';
import { nowVN, todayVN, str, toInt, isDate, bad } from '../util.js';
import { getSite } from './content.js';

db.exec(`
CREATE TABLE IF NOT EXISTS site_hits (
  id         INTEGER PRIMARY KEY,
  at         TEXT NOT NULL,
  day        TEXT NOT NULL,
  type       TEXT NOT NULL,                -- view | click | form | order
  vid        TEXT NOT NULL DEFAULT '',     -- mã khách (trình duyệt)
  sid        TEXT NOT NULL DEFAULT '',     -- mã phiên (1 lần vào web)
  new_visitor INTEGER NOT NULL DEFAULT 0,  -- lần đầu thấy khách này
  path       TEXT NOT NULL DEFAULT '',
  label      TEXT NOT NULL DEFAULT '',     -- nút đã bấm
  source     TEXT NOT NULL DEFAULT '',     -- nguồn của phiên (Quảng cáo Facebook, Google, Trực tiếp…)
  ref        TEXT NOT NULL DEFAULT '',     -- tên miền trang dẫn tới
  campaign   TEXT NOT NULL DEFAULT '',     -- utm_campaign
  device     TEXT NOT NULL DEFAULT '',     -- Điện thoại | Máy tính bảng | Máy tính
  os         TEXT NOT NULL DEFAULT '',
  browser    TEXT NOT NULL DEFAULT '',
  order_code TEXT NOT NULL DEFAULT '',
  value      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_hits_day ON site_hits(day, type);
`);

const KEEP_DAYS = 400;
const TYPES = new Set(['view', 'click', 'form', 'order']);
const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|facebookexternalhit|facebookcatalog|preview|monitor|curl|wget|python|node-fetch|axios|go-http/i;

// ---------------------------------------------------------------- nhận diện thiết bị, trình duyệt
export function parseUA(ua = '') {
  const u = String(ua);
  const device = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(u) ? 'Máy tính bảng'
    : /Mobi|iPhone|iPod|Android|Windows Phone/i.test(u) ? 'Điện thoại' : 'Máy tính';
  const os = /iPhone|iPad|iPod/i.test(u) ? 'iOS' : /Android/i.test(u) ? 'Android' : /Windows/i.test(u) ? 'Windows'
    : /Mac OS X|Macintosh/i.test(u) ? 'macOS' : /CrOS/i.test(u) ? 'ChromeOS' : /Linux/i.test(u) ? 'Linux' : 'Khác';
  const browser = /FBAN|FBAV|FB_IAB|FBIOS|\[FB/i.test(u) ? 'Trong app Facebook'
    : /Instagram/i.test(u) ? 'Trong app Instagram'
    : /Zalo/i.test(u) ? 'Trong app Zalo'
    : /musical_ly|BytedanceWebview|TikTok/i.test(u) ? 'Trong app TikTok'
    : /coc_coc_browser/i.test(u) ? 'Cốc Cốc'
    : /Edg\//i.test(u) ? 'Edge'
    : /SamsungBrowser/i.test(u) ? 'Samsung Internet'
    : /OPR\/|Opera/i.test(u) ? 'Opera'
    : /Firefox|FxiOS/i.test(u) ? 'Firefox'
    : /CriOS|Chrome\//i.test(u) ? 'Chrome'
    : /Safari/i.test(u) ? 'Safari' : 'Khác';
  return { device, os, browser };
}

const hostOf = (r) => { try { return new URL(r).hostname.replace(/^www\.|^m\.|^l\.|^lm\./, ''); } catch { return ''; } };

/** Nguồn của phiên từ trang dẫn tới + tham số utm/fbclid trên đường dẫn đầu tiên. */
export function classifySource({ ref = '', us = '', um = '', fb = 0, g = 0, tt = 0 } = {}, ownHost = '') {
  const s = String(us).toLowerCase();
  const m = String(um).toLowerCase();
  const host = hostOf(ref);
  const paid = /paid|cpc|ppc|ads?$|^ad|cpm|sponsor/.test(m) || /_ads?$|^ads?_/.test(s);
  const fbish = /^(fb|facebook|ig|instagram|meta|an|msg|messenger)$/.test(s) || /facebook|instagram|messenger|fb\.|^fb$/.test(host);
  if (paid && (fbish || fb)) return 'Quảng cáo Facebook';
  if (g || (paid && (s === 'google' || /google/.test(host)))) return 'Quảng cáo Google';
  if (tt || (paid && (s === 'tiktok' || /tiktok/.test(host)))) return 'Quảng cáo TikTok';
  if (paid) return 'Quảng cáo khác';
  if (fbish || fb) return 'Facebook';
  if (s === 'zalo' || /zalo/.test(host)) return 'Zalo';
  if (s === 'tiktok' || /tiktok/.test(host)) return 'TikTok';
  if (s === 'google' || /google\./.test(host)) return 'Google';
  if (/youtube|youtu\.be/.test(host) || s === 'youtube') return 'YouTube';
  if (/bing|coccoc|yahoo|duckduckgo/.test(host)) return 'Tìm kiếm khác';
  if (s) return s.slice(0, 40);
  if (!host || (ownHost && host === ownHost.replace(/^www\./, ''))) return 'Trực tiếp';
  return host.slice(0, 60);
}

// ---------------------------------------------------------------- ghi nhịp
const ipHits = new Map();
function rateOk(ip) {
  const now = Date.now();
  const list = (ipHits.get(ip) || []).filter((t) => now - t < 10 * 60e3);
  if (list.length >= 300) return false;
  list.push(now);
  ipHits.set(ip, list);
  if (ipHits.size > 5000) for (const [k, v] of ipHits) if (!v.some((t) => now - t < 10 * 60e3)) ipHits.delete(k);
  return true;
}
const cleanId = (v) => String(v || '').replace(/[^\w-]/g, '').slice(0, 40);
const fallbackVid = (ip, ua) => 'h' + crypto.createHash('sha256').update(`${ip}|${ua}|${todayVN()}`).digest('hex').slice(0, 20);

const insHit = () => db.prepare(`INSERT INTO site_hits(at, day, type, vid, sid, new_visitor, path, label, source, ref, campaign, device, os, browser, order_code, value)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

/** Ghi 1 nhịp. t = { t: loại, p: đường dẫn, l: nhãn nút, v: mã khách, s: mã phiên, n: khách mới, r/us/um/uc/fb/g/tt: nguồn }.
 *  Trả về false nếu bỏ qua (bot, quá nhiều, dữ liệu lạ). */
export function recordHit(t = {}, { ip = '', ua = '', host = '', order = null } = {}) {
  const type = order ? 'order' : String(t.t || '');
  if (!TYPES.has(type) || (type === 'order' && !order)) return false;
  if (!ua || BOT_RE.test(ua)) return false;
  if (!order && !rateOk(String(ip || 'x'))) return false;
  const { device, os, browser } = parseUA(ua);
  const now = nowVN();
  const path = str(t.p, 200).split('#')[0] || '/';
  insHit().run(
    now, now.slice(0, 10), type,
    cleanId(t.v) || fallbackVid(ip, ua), cleanId(t.s), type === 'view' && Number(t.n) === 1 ? 1 : 0,
    path.startsWith('/') ? path : '/', str(t.l, 60),
    classifySource(t, host), hostOf(t.r).slice(0, 80), str(t.uc, 120),
    device, os, browser,
    order ? str(order.code, 40) : '', order ? toInt(order.total) : 0,
  );
  return true;
}

let lastPrune = '';
export function pruneHits() {
  const today = todayVN();
  if (lastPrune === today) return;
  lastPrune = today;
  const cut = todayVN(new Date(Date.now() - KEEP_DAYS * 864e5));
  db.prepare('DELETE FROM site_hits WHERE day < ?').run(cut);
}

// ---------------------------------------------------------------- báo cáo cho trang quản lý
export function siteStats(from, to) {
  if (!isDate(from) || !isDate(to) || from > to) throw bad('Khoảng ngày không hợp lệ');
  pruneHits();
  const W = 'day >= ? AND day <= ?';
  const a = [from, to];
  const one = (sql, ...x) => db.prepare(sql).get(...a, ...x);
  const all = (sql, ...x) => db.prepare(sql).all(...a, ...x);

  const tot = one(`SELECT
      SUM(type='view') AS views,
      COUNT(DISTINCT CASE WHEN type='view' THEN vid END) AS visitors,
      COUNT(DISTINCT CASE WHEN type='view' AND sid<>'' THEN sid END) AS sessions,
      SUM(type='view' AND new_visitor=1) AS new_visitors,
      SUM(type='click') AS clicks,
      COUNT(DISTINCT CASE WHEN type='form' THEN sid END) AS form_sessions,
      SUM(type='order') AS orders,
      COALESCE(SUM(CASE WHEN type='order' THEN value END), 0) AS revenue
    FROM site_hits WHERE ${W}`);
  for (const k of Object.keys(tot)) tot[k] = Number(tot[k]) || 0;
  // phiên chỉ xem đúng 1 trang rồi thoát
  tot.bounce_sessions = Number(one(`SELECT COUNT(*) AS n FROM (SELECT sid FROM site_hits WHERE ${W} AND sid<>'' GROUP BY sid HAVING SUM(type='view')=1 AND SUM(type<>'view')=0)`).n) || 0;
  // phiên đã xem trang có form đặt hàng
  tot.order_page_sessions = Number(one(`SELECT COUNT(DISTINCT sid) AS n FROM site_hits WHERE ${W} AND type='view' AND sid<>'' AND path IN ('/', '/dat-hang', '/san-pham')`).n) || 0;

  const byDay = all(`SELECT day,
      SUM(type='view') AS views,
      COUNT(DISTINCT CASE WHEN type='view' THEN vid END) AS visitors,
      SUM(type='click') AS clicks,
      SUM(type='order') AS orders
    FROM site_hits WHERE ${W} GROUP BY day ORDER BY day`);
  const map = new Map(byDay.map((d) => [d.day, d]));
  const days = [];
  for (let d = new Date(from + 'T00:00:00Z'); ; d = new Date(d.getTime() + 864e5)) {
    const k = d.toISOString().slice(0, 10);
    if (k > to || days.length > 400) break;
    const r = map.get(k) || {};
    days.push({ date: k, views: Number(r.views) || 0, visitors: Number(r.visitors) || 0, clicks: Number(r.clicks) || 0, orders: Number(r.orders) || 0 });
  }

  // nhóm theo 1 cột: khách, lượt xem, đơn
  const group = (col, limit = 12, extra = '') => all(`SELECT ${col} AS k,
      COUNT(DISTINCT CASE WHEN type='view' THEN vid END) AS visitors,
      SUM(type='view') AS views,
      SUM(type='order') AS orders,
      COALESCE(SUM(CASE WHEN type='order' THEN value END), 0) AS revenue
    FROM site_hits WHERE ${W} ${extra} GROUP BY ${col} ORDER BY visitors DESC, orders DESC LIMIT ${limit}`)
    .map((r) => ({ key: r.k || '(không rõ)', visitors: Number(r.visitors) || 0, views: Number(r.views) || 0, orders: Number(r.orders) || 0, revenue: Number(r.revenue) || 0 }));

  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, views: 0 }));
  for (const r of all(`SELECT CAST(substr(at, 12, 2) AS INTEGER) AS h, COUNT(*) AS n FROM site_hits WHERE ${W} AND type='view' GROUP BY h`)) {
    if (hours[r.h]) hours[r.h].views = Number(r.n) || 0;
  }

  return {
    from, to,
    totals: tot,
    by_day: days,
    by_hour: hours,
    sources: group('source'),
    devices: group('device', 5),
    os: group('os', 8),
    browsers: group('browser', 10),
    pages: all(`SELECT path AS k, SUM(type='view') AS views, COUNT(DISTINCT CASE WHEN type='view' THEN vid END) AS visitors
      FROM site_hits WHERE ${W} AND type='view' GROUP BY path ORDER BY views DESC LIMIT 15`).map((r) => ({ key: r.k, views: Number(r.views) || 0, visitors: Number(r.visitors) || 0 })),
    campaigns: group('campaign', 15, "AND campaign <> ''"),
    clicks: all(`SELECT label AS k, COUNT(*) AS n FROM site_hits WHERE ${W} AND type='click' GROUP BY label ORDER BY n DESC LIMIT 12`).map((r) => ({ key: r.k || 'Khác', clicks: Number(r.n) || 0 })),
    recent: db.prepare(`SELECT at, type, path, label, source, device, os, browser, campaign, order_code, value FROM site_hits
      WHERE type IN ('view','order','click') ORDER BY id DESC LIMIT 40`).all(),
    pixel: pixelStatus(),
  };
}

// ---------------------------------------------------------------- Facebook Pixel + Conversions API
const GRAPH = 'https://graph.facebook.com/v21.0';
const capiLast = { at: '', ok: null, error: '', event: '' };

export function pixelStatus() {
  const s = getSite();
  return { pixel_id: s.fb_pixel_id || '', capi: !!s.fb_capi_token, test_code: s.fb_test_code || '', last: { ...capiLast } };
}

const sha = (v) => crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex');

/** Gửi sự kiện Purchase phía server (Conversions API). Cùng event_id với Pixel trên trình duyệt → Facebook tự gộp, không đếm đôi.
 *  Không chặn đặt hàng: lỗi chỉ ghi lại để xem trong trang quản lý. */
export async function capiPurchase(order, { ip = '', ua = '', url = '', fbp = '', fbc = '' } = {}) {
  const s = getSite();
  if (!s.fb_pixel_id || !s.fb_capi_token || !order) return;
  const phone = String(order.phone || '').replace(/\D/g, '');
  const user = {
    ...(phone ? { ph: [sha('84' + phone.replace(/^0/, ''))] } : {}),
    country: [sha('vn')],
    ...(ip ? { client_ip_address: ip } : {}),
    ...(ua ? { client_user_agent: ua } : {}),
    ...(fbp ? { fbp: str(fbp, 200) } : {}),
    ...(fbc ? { fbc: str(fbc, 300) } : {}),
  };
  const body = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: order.code,
      action_source: 'website',
      ...(url ? { event_source_url: str(url, 500) } : {}),
      user_data: user,
      custom_data: { currency: 'VND', value: Number(order.total) || 0, num_items: Number(order.qty) || 1, content_name: str(order.product, 200), content_type: 'product' },
    }],
    ...(s.fb_test_code ? { test_event_code: s.fb_test_code } : {}),
  };
  capiLast.at = nowVN();
  capiLast.event = `Purchase ${order.code}`;
  try {
    const res = await fetch(`${GRAPH}/${encodeURIComponent(s.fb_pixel_id)}/events?access_token=${encodeURIComponent(s.fb_capi_token)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.error) throw new Error(j.error?.message || `HTTP ${res.status}`);
    capiLast.ok = true;
    capiLast.error = '';
  } catch (e) {
    capiLast.ok = false;
    capiLast.error = String(e?.message || e).slice(0, 300);
    console.error('[capi]', capiLast.error);
  }
}
