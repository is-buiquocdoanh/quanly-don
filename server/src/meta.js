// Messenger webhook — BẢN THỬ NGHIỆM: chỉ nhận + lưu tin nhắn Meta gửi tới, và gửi được 1 tin trả lời thử bằng tay.
// Mục đích: kiểm tra app Meta (Standard access) có nhận / trả lời được KHÁCH THẬT không, trước khi làm chatbot.
//
// Cấu hình trong .env của server:
//   META_VERIFY_TOKEN  chuỗi tự đặt, dán giống hệt vào ô "Xác minh mã" ở Meta → Webhooks
//   META_APP_SECRET    Meta → Cài đặt ứng dụng → Thông tin cơ bản → Khóa bí mật của ứng dụng (để kiểm tra chữ ký)
//   META_PAGE_TOKEN    mã truy cập của page (Messenger → Cài đặt API → Tạo mã), để gửi tin trả lời thử
import crypto from 'node:crypto';
import { db } from './db.js';
import { nowVN, str, bad, HttpError } from './util.js';

db.exec(`
CREATE TABLE IF NOT EXISTS meta_events (
  id        INTEGER PRIMARY KEY,
  at        TEXT NOT NULL,
  page_id   TEXT NOT NULL DEFAULT '',
  sender_id TEXT NOT NULL DEFAULT '',
  kind      TEXT NOT NULL DEFAULT '',     -- message | echo | postback | read | delivery | other
  text      TEXT NOT NULL DEFAULT '',
  raw       TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_meta_events_at ON meta_events(id DESC);
`);

const env = (k) => (process.env[k] || '').trim();
const GRAPH = 'https://graph.facebook.com/v21.0';
const KEEP = 500; // chỉ giữ 500 sự kiện gần nhất

export function metaStatus() {
  return {
    verify_token: !!env('META_VERIFY_TOKEN'),
    app_secret: !!env('META_APP_SECRET'),
    page_token: !!env('META_PAGE_TOKEN'),
  };
}

// Mã page (META_PAGE_TOKEN) là của page nào: mã người nhắn chỉ dùng được với ĐÚNG page họ nhắn vào.
let tokenPageCache = null;
export async function tokenPage() {
  const token = env('META_PAGE_TOKEN');
  if (!token) return null;
  if (tokenPageCache?.token === token && Date.now() - tokenPageCache.at < 10 * 60e3) return tokenPageCache.page;
  let page;
  try {
    const res = await fetch(`${GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(8000) });
    const r = await res.json().catch(() => ({}));
    page = r.id ? { id: String(r.id), name: r.name || '' } : { error: r.error?.message || `HTTP ${res.status}` };
  } catch (e) {
    page = { error: e.message };
  }
  tokenPageCache = { token, at: Date.now(), page };
  return page;
}

async function graph(method, pathAndQuery, token) {
  const sep = pathAndQuery.includes('?') ? '&' : '?';
  const res = await fetch(`${GRAPH}/${pathAndQuery}${sep}access_token=${encodeURIComponent(token)}`, { method, signal: AbortSignal.timeout(10000) });
  const r = await res.json().catch(() => ({}));
  if (!res.ok || r.error) {
    const e = r.error || {};
    throw bad(`Meta từ chối: ${e.message || res.status}${e.code ? ` (mã ${e.code}${e.error_subcode ? '/' + e.error_subcode : ''})` : ''}`);
  }
  return r;
}

const WANT_FIELDS = ['messages', 'messaging_postbacks', 'message_echoes', 'standby'];

/** Page (của META_PAGE_TOKEN) đang đăng ký những app nào, nhận những trường nào. */
export async function pageSubscriptions() {
  const token = env('META_PAGE_TOKEN');
  if (!token) throw bad('Server chưa đặt META_PAGE_TOKEN');
  const [r, app] = await Promise.all([graph('GET', 'me/subscribed_apps', token), graph('GET', 'app?fields=id,name', token).catch(() => ({}))]);
  return {
    app: { id: String(app.id || ''), name: app.name || '' },  // app của mã page = app này
    want: WANT_FIELDS,
    apps: (r.data || []).map((a) => ({ id: String(a.id || ''), name: a.name || '', fields: a.subscribed_fields || [] })),
  };
}

/** Đăng ký page nhận tin cho app (giống bấm "Thêm đăng ký" trên Meta). */
export async function subscribePage() {
  const token = env('META_PAGE_TOKEN');
  if (!token) throw bad('Server chưa đặt META_PAGE_TOKEN');
  await graph('POST', `me/subscribed_apps?subscribed_fields=${WANT_FIELDS.join(',')}`, token);
  return pageSubscriptions();
}

/** Các page đang gửi tin về (theo sự kiện đã nhận), để so với page của mã. */
export function seenPages() {
  return db.prepare("SELECT page_id, COUNT(*) n, MAX(at) last FROM meta_events WHERE page_id <> '' AND kind IN ('message', 'echo', 'postback', 'standby') GROUP BY page_id ORDER BY last DESC").all();
}

/** GET: Meta gọi 1 lần khi bấm "Xác minh và lưu" → trả lại hub.challenge nếu đúng mã. */
export function verifyWebhook(query) {
  const token = env('META_VERIFY_TOKEN');
  if (!token) throw new HttpError(503, 'Server chưa đặt META_VERIFY_TOKEN');
  if (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === token) return String(query['hub.challenge'] || '');
  throw new HttpError(403, 'Sai mã xác minh');
}

/** Kiểm tra chữ ký X-Hub-Signature-256 = HMAC-SHA256(raw body, app secret). */
export function checkSignature(raw, header) {
  const secret = env('META_APP_SECRET');
  if (!secret) throw new HttpError(503, 'Server chưa đặt META_APP_SECRET');
  const want = 'sha256=' + crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
  const got = String(header || '');
  if (got.length !== want.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    throw new HttpError(401, 'Sai chữ ký');
  }
}

/** Ghi lại 1 lần Meta gọi tới mà không lưu được tin (sai chữ ký, dạng lạ…) để xem trên web, biết hỏng ở đâu. */
export function logProblem(kind, text, raw = '') {
  db.prepare('INSERT INTO meta_events(at, kind, text, raw) VALUES (?, ?, ?, ?)').run(nowVN(), kind, str(text, 500), String(raw).slice(0, 4000));
  console.log(`[messenger] ${kind}: ${text}`);
  prune();
}
const prune = () => db.prepare(`DELETE FROM meta_events WHERE id <= (SELECT id FROM meta_events ORDER BY id DESC LIMIT 1 OFFSET ${KEEP})`).run();

/** POST: lưu từng sự kiện Messenger. Trả về số sự kiện đã lưu. */
export function saveEvents(body) {
  if (body?.object !== 'page') {
    logProblem('other', `Không phải sự kiện của page (object = ${body?.object ?? 'trống'})`, JSON.stringify(body));
    return 0;
  }
  const ins = db.prepare('INSERT INTO meta_events(at, page_id, sender_id, kind, text, raw) VALUES (?, ?, ?, ?, ?, ?)');
  let n = 0;
  for (const entry of body.entry || []) {
    // tin thật đến ở entry.messaging; nút "Thử nghiệm" của Meta gửi dạng entry.changes[{ field: 'messages', value }]
    // entry.standby: một app/công cụ khác (Pancake, inbox của page…) đang giữ quyền chính, app này chỉ được xem
    const list = [
      ...(entry.messaging || []),
      ...(entry.standby || []).map((m) => ({ ...m, standby: true })),
      ...(entry.changes || []).filter((c) => c.field === 'messages' && c.value).map((c) => ({ ...c.value, test: true })),
    ];
    for (const m of list) {
      const kind = m.test ? 'test' : m.standby && m.message && !m.message.is_echo ? 'standby' : m.message ? (m.message.is_echo ? 'echo' : 'message') : m.postback ? 'postback' : m.read ? 'read' : m.delivery ? 'delivery' : 'other';
      const text = m.message?.text || m.postback?.title || (m.message?.attachments ? `[${m.message.attachments.map((a) => a.type).join(', ')}]` : '');
      // tin echo (page tự gửi đi): người nhận mới là khách
      const who = kind === 'echo' ? m.recipient?.id : m.sender?.id;
      ins.run(nowVN(), String(entry.id || ''), String(who || ''), kind, str(text, 2000), JSON.stringify(m).slice(0, 4000));
      n++;
    }
  }
  if (!n) logProblem('other', 'Meta gọi tới nhưng không có tin nhắn nào trong đó', JSON.stringify(body));
  prune();
  return n;
}

export function listEvents(limit = 50) {
  return db.prepare("SELECT id, at, page_id, sender_id, kind, text FROM meta_events WHERE kind IN ('message', 'echo', 'postback', 'standby', 'test', 'rejected', 'other') ORDER BY id DESC LIMIT ?")
    .all(Math.min(Number(limit) || 50, 200));
}

/** Gửi 1 tin trả lời thử tới người đã nhắn (trong 24 giờ kể từ tin cuối của họ). */
export async function sendTest(senderId, text) {
  const token = env('META_PAGE_TOKEN');
  if (!token) throw bad('Server chưa đặt META_PAGE_TOKEN');
  if (!/^\d{5,30}$/.test(String(senderId || ''))) throw bad('Người nhận không hợp lệ');
  const res = await fetch(`${GRAPH}/me/messages?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: String(senderId) }, messaging_type: 'RESPONSE', message: { text: str(text, 1000) } }),
  });
  const r = await res.json().catch(() => ({}));
  if (!res.ok || r.error) {
    const e = r.error || {};
    throw bad(`Meta từ chối: ${e.message || res.status}${e.code ? ` (mã ${e.code}${e.error_subcode ? '/' + e.error_subcode : ''})` : ''}`);
  }
  return { message_id: r.message_id };
}
