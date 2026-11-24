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

/** POST: lưu từng sự kiện Messenger. Trả về số sự kiện đã lưu. */
export function saveEvents(body) {
  if (body?.object !== 'page') return 0;
  const ins = db.prepare('INSERT INTO meta_events(at, page_id, sender_id, kind, text, raw) VALUES (?, ?, ?, ?, ?, ?)');
  let n = 0;
  for (const entry of body.entry || []) {
    for (const m of entry.messaging || []) {
      const kind = m.message ? (m.message.is_echo ? 'echo' : 'message') : m.postback ? 'postback' : m.read ? 'read' : m.delivery ? 'delivery' : 'other';
      const text = m.message?.text || m.postback?.title || (m.message?.attachments ? `[${m.message.attachments.map((a) => a.type).join(', ')}]` : '');
      // tin echo (page tự gửi đi): người nhận mới là khách
      const who = kind === 'echo' ? m.recipient?.id : m.sender?.id;
      ins.run(nowVN(), String(entry.id || ''), String(who || ''), kind, str(text, 2000), JSON.stringify(m).slice(0, 4000));
      n++;
    }
  }
  if (n) db.prepare(`DELETE FROM meta_events WHERE id <= (SELECT id FROM meta_events ORDER BY id DESC LIMIT 1 OFFSET ${KEEP})`).run();
  return n;
}

export function listEvents(limit = 50) {
  return db.prepare("SELECT id, at, page_id, sender_id, kind, text FROM meta_events WHERE kind IN ('message', 'echo', 'postback') ORDER BY id DESC LIMIT ?")
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
