process.env.TZ ||= 'Asia/Ho_Chi_Minh';

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, DATA_DIR, backupTo } from './db.js';
import { match, userFromSession } from './routes.js';
import { HttpError, hashPassword, randomToken, nowVN, todayVN } from './util.js';
import { verifyWebhook, checkSignature, saveEvents, logProblem } from './meta.js';

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const KEEP_BACKUPS = Number(process.env.KEEP_BACKUPS) || 30;

// ---------------------------------------------------------------- Tài khoản admin đầu tiên
if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
  const username = (process.env.ADMIN_USER || 'admin').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || randomToken(9);
  db.prepare('INSERT INTO users(username, display_name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(username, 'Chủ shop', hashPassword(password), 'admin', nowVN());
  console.log('==============================================');
  console.log(' Đã tạo tài khoản admin đầu tiên');
  console.log(`   Tên đăng nhập: ${username}`);
  console.log(`   Mật khẩu:      ${process.env.ADMIN_PASSWORD ? '(theo ADMIN_PASSWORD trong .env)' : password}`);
  console.log(' Hãy đổi mật khẩu sau khi đăng nhập.');
  console.log('==============================================');
}

// ---------------------------------------------------------------- Sao lưu tự động
function dailyBackup() {
  try {
    const file = path.join(BACKUP_DIR, `don-${todayVN()}.db`);
    if (!fs.existsSync(file)) {
      backupTo(file);
      console.log('Đã sao lưu:', file);
    }
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => /^don-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
    for (const f of files.slice(0, Math.max(0, files.length - KEEP_BACKUPS))) fs.unlinkSync(path.join(BACKUP_DIR, f));
  } catch (e) {
    console.error('Lỗi sao lưu:', e);
  }
}
dailyBackup();
setInterval(dailyBackup, 60 * 60e3).unref(); // kiểm tra mỗi giờ, mỗi ngày tạo 1 bản

// ---------------------------------------------------------------- HTTP
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function parseCookies(h) {
  const out = {};
  for (const part of String(h || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'Dữ liệu quá lớn')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res, status, obj, headers = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

// Cloudflare cho trình duyệt giữ file .js/.css tới 4 giờ, nên sau mỗi lần deploy có người vẫn chạy giao diện cũ.
// Cách chữa: index.html (không cache) gọi file kèm ?v=<mã nội dung>; file đổi → mã đổi → trình duyệt tải file mới.
const assetHash = new Map(); // tên file → { mtime, v }
function assetVersion(name) {
  const file = path.join(PUBLIC_DIR, name);
  let st;
  try { st = fs.statSync(file); } catch { return ''; }
  const c = assetHash.get(name);
  if (c && c.mtime === st.mtimeMs) return c.v;
  const v = crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 10);
  assetHash.set(name, { mtime: st.mtimeMs, v });
  return v;
}
function indexHtml() {
  return fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8')
    .replace(/(src|href)="\/([\w.-]+\.(?:js|css))"/g, (m, attr, name) => {
      const v = assetVersion(name);
      return v ? `${attr}="/${name}?v=${v}"` : m;
    });
}

function serveStatic(req, res, pathname) {
  let file = path.join(PUBLIC_DIR, path.normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, ''));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC_DIR, 'index.html');
  if (file === path.join(PUBLIC_DIR, 'index.html')) {
    res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(indexHtml());
    return;
  }
  const ext = path.extname(file);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    // khi dev (không phải production) luôn tải bản mới để sửa CSS/JS là thấy ngay
    'Cache-Control': ext === '.html' || process.env.NODE_ENV !== 'production' ? 'no-cache' : 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff',
  });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  // ghép chuỗi thay vì new URL(req.url, base): đường dẫn kiểu "//" hay "//abc" làm new URL ném lỗi và sập server
  let url;
  try { url = new URL('http://x' + (String(req.url || '').startsWith('/') ? req.url : '/' + (req.url || ''))); } catch { res.writeHead(400).end(); return; }
  const { pathname } = url;
  if (!pathname.startsWith('/api/')) return serveStatic(req, res, pathname);

  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const baseUrl = `${proto}://${host}`;
  const ip = req.headers['cf-connecting-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
  const sid = parseCookies(req.headers.cookie).sid;
  const extraHeaders = {};
  const setCookie = (val, maxAge) => {
    extraHeaders['Set-Cookie'] = `sid=${val}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${proto === 'https' ? '; Secure' : ''}`;
  };

  try {
    // Tải bản sao lưu (stream file, không phải JSON)
    if (req.method === 'GET' && pathname === '/api/backup') {
      const user = userFromSession(sid);
      if (!user || user.role !== 'admin') throw new HttpError(401, 'Cần đăng nhập admin');
      const file = backupTo(path.join(DATA_DIR, 'tmp', `download-${Date.now()}.db`));
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="don-${todayVN()}.db"`,
      });
      fs.createReadStream(file).pipe(res).on('close', () => fs.rm(file, () => {}));
      return;
    }

    // Webhook Messenger: Meta gọi trực tiếp (không có cookie), xác thực bằng mã xác minh / chữ ký
    if (pathname === '/api/meta/webhook') {
      if (req.method === 'GET') {
        const challenge = verifyWebhook(Object.fromEntries(url.searchParams));
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(challenge);
        return;
      }
      if (req.method !== 'POST') throw new HttpError(405, 'Chỉ nhận GET / POST');
      const raw = await readBody(req, 2e6);
      try {
        checkSignature(raw, req.headers['x-hub-signature-256']);
      } catch (e) {
        // ghi lại để chủ shop thấy trên web; chỉ ghi khi có header chữ ký (request của Meta), tránh rác từ người lạ
        if (req.headers['x-hub-signature-256']) logProblem('rejected', `Từ chối: ${e.message}. Kiểm tra META_APP_SECRET trên server có đúng "Khóa bí mật của ứng dụng" không.`);
        throw e;
      }
      let body;
      try { body = JSON.parse(raw); } catch { throw new HttpError(400, 'JSON không hợp lệ'); }
      saveEvents(body);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('EVENT_RECEIVED');
      return;
    }

    const route = match(req.method, pathname);
    if (!route) throw new HttpError(404, 'Không có API này');

    let body = {};
    if (req.method !== 'GET') {
      const isExt = pathname === '/api/ext';
      // Chống CSRF: request dùng cookie phải là JSON (form của trang khác không gửi được)
      if (!isExt && !String(req.headers['content-type'] || '').includes('application/json')) {
        throw new HttpError(415, 'Cần Content-Type: application/json');
      }
      const raw = await readBody(req);
      if (raw) {
        try { body = JSON.parse(raw); } catch { throw new HttpError(400, 'JSON không hợp lệ'); }
      }
    }

    let user = null;
    if (route.auth !== 'none') {
      user = userFromSession(sid);
      if (!user) throw new HttpError(401, 'Chưa đăng nhập');
      if (route.auth === 'admin' && user.role !== 'admin') throw new HttpError(403, 'Không có quyền');
    }

    const query = Object.fromEntries(url.searchParams);
    const result = await route.handler({ req, user, body, query, params: route.params, ip, sid, setCookie, baseUrl });
    send(res, 200, { ok: true, ...result }, extraHeaders);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error(e);
    send(res, status, { ok: false, error: status === 500 ? 'Lỗi máy chủ: ' + e.message : e.message }, extraHeaders);
  }
});

server.listen(PORT, () => console.log(`Web quản lý đơn chạy tại http://localhost:${PORT}  (dữ liệu: ${DATA_DIR})`));

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close();
    db.close();
    process.exit(0);
  });
}
