// Chạy: cd server && npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'don-test-'));
let proc;

function client() {
  let cookie = '';
  return async (method, url, body) => {
    const res = await fetch(BASE + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    return res.json();
  };
}
const admin = client();
const kho = client();
const ext = (body) => fetch(BASE + '/api/ext', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) }).then((r) => r.json());

before(async () => {
  proc = spawn(process.execPath, ['src/server.js'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: { ...process.env, ANTHROPIC_API_KEY: '', PORT: String(PORT), DATA_DIR: DATA, ADMIN_PASSWORD: 'test123', META_VERIFY_TOKEN: 'verify-abc', META_APP_SECRET: 'secret-xyz', META_PAGE_TOKEN: '' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try { await fetch(BASE + '/api/bootstrap'); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('Server không khởi động được');
});
after(async () => {
  const exited = new Promise((r) => proc.once('exit', r));
  proc.kill();
  await exited;
  try { fs.rmSync(DATA, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* Windows có thể còn giữ file */ }
});

let token;
test('đăng nhập + tạo mã API', async () => {
  assert.equal((await admin('POST', '/api/login', { username: 'admin', password: 'sai' })).ok, false);
  assert.equal((await admin('POST', '/api/login', { username: 'admin', password: 'test123' })).user.role, 'admin');
  token = (await admin('POST', '/api/me/api-token')).token;
  assert.match(token, /^ext_/);
});

test('extension lưu đơn + báo trùng', async () => {
  const order = { name: 'Nguyễn Văn Bằng', phone: '0333806016', address: 'Xóm Trung Hậu, xã Thuần Trung, tỉnh Nghệ An', qty: 2, total: 130000, page: 'Page A' };
  const r1 = await ext({ action: 'save', token, order });
  assert.equal(r1.ok, true);
  assert.match(r1.id, /^DH\d{6}-001$/);
  const chk = await ext({ action: 'check', token, order: { phone: '+84 333 806 016' } });
  assert.equal(chk.matches.length, 1);
  assert.equal(chk.matches[0].name, 'Nguyễn Văn Bằng');
  const r2 = await ext({ action: 'save', token, order: { ...order, qty: 1, total: 75000, page: 'Page B' } });
  assert.equal(r2.dups.length, 1);
  assert.equal((await ext({ action: 'save', token: 'sai', order })).ok, false);
});

test('kho: chỉ được gửi hàng, không được hủy / xem báo cáo', async () => {
  assert.equal((await admin('POST', '/api/users', { username: 'kho', password: 'kho123', role: 'kho' })).ok, true);
  await kho('POST', '/api/login', { username: 'kho', password: 'kho123' });
  const r = await kho('PATCH', '/api/orders/1', { status: 'da_gui', tracking_code: 'VTP123', ship_fee: 25000, total: 1 });
  assert.equal(r.order.status, 'da_gui');
  assert.equal(r.order.tracking_code, 'VTP123');
  assert.equal(r.order.total, 130000, 'kho không được sửa tiền');
  assert.equal((await kho('PATCH', '/api/orders/2', { status: 'huy' })).ok, false);
  assert.equal((await kho('GET', '/api/report?from=2026-01-01&to=2026-12-31')).ok, false);
});

test('cập nhật hàng loạt + COD + báo cáo + quảng cáo', async () => {
  assert.equal((await admin('POST', '/api/orders/bulk', { ids: [1], status: 'da_giao' })).updated, 1);
  assert.equal((await admin('POST', '/api/orders/bulk', { ids: [1], cod_received: true })).updated, 1);
  await admin('POST', '/api/transactions', { type: 'chi', category: 'Quảng cáo', amount: '50.000', page: 'Page A' });
  await admin('PUT', '/api/settings', { cost_per_unit: 20000 });
  const { today } = await admin('GET', '/api/bootstrap');
  const r = await admin('GET', `/api/report?from=${today}&to=${today}`);
  assert.equal(r.orders, 2);
  assert.equal(r.revenue, 205000);
  assert.equal(r.ads, 50000);
  assert.equal(r.cogs, 60000);
  assert.equal(r.profit, 205000 - 60000 - 25000 - 50000);
  assert.equal(r.cod_in.amount, 130000);
  assert.equal(r.by_page.find((p) => p.page === 'Page A').ads, 50000);
});

test('tìm kiếm + khách hàng + lịch sử', async () => {
  assert.equal((await admin('GET', '/api/orders?q=806016')).count, 2);
  assert.equal((await admin('GET', '/api/orders?dup=1')).count, 2);
  const c = await admin('GET', '/api/customers');
  assert.equal(c.customers.length, 1);
  assert.equal(c.customers[0].orders, 2);
  const d = await admin('GET', '/api/orders/1');
  assert.ok(d.events.length >= 3);
  assert.equal(d.history.length, 1);
});

test('chống CSRF: form post bị chặn', async () => {
  const r = await fetch(BASE + '/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'a=1' });
  assert.equal(r.status, 415);
});

test('chia đơn cho 2 tài khoản kho: mỗi kho chỉ thấy đơn của mình, không biết kho kia', async () => {
  await admin('POST', '/api/users', { username: 'bena', password: 'abc123', role: 'kho', display_name: 'Kho A' });
  await admin('POST', '/api/users', { username: 'benb', password: 'abc123', role: 'kho', display_name: 'Kho B' });
  const { khos } = await admin('GET', '/api/kho');
  const A = khos.find((k) => k.username === 'bena');
  const B = khos.find((k) => k.username === 'benb');
  const OLD = khos.find((k) => k.username === 'kho');
  assert.equal(A.name, 'Kho A');
  const ka = client(), kb = client();
  await ka('POST', '/api/login', { username: 'bena', password: 'abc123' });
  await kb('POST', '/api/login', { username: 'benb', password: 'abc123' });

  // đang chia đơn mới cho Kho A
  await admin('PUT', '/api/settings', { active_kho: A.id, cost_per_unit: 45000 });
  const mk = (phone) => admin('POST', '/api/orders', { name: 'Khách', phone, address: 'Hà Nội', qty: 1, total: 100000, page: 'Page bí mật', link: 'https://m.me/abc' });
  const o1 = (await mk('0913000001')).order;
  const o2 = (await mk('0913000001')).order; // trùng SĐT với o1
  assert.equal(o1.kho_id, A.id);

  // kho không nhận giá vốn / danh mục thu chi / danh sách kho khác
  const bs = await ka('GET', '/api/bootstrap');
  assert.equal(bs.settings.cost_per_unit, undefined);
  assert.equal(bs.settings.shop_name !== undefined, true);
  assert.deepEqual(bs.khos, []);
  assert.equal((await ka('GET', '/api/kho')).ok, false);

  // Kho A thấy đơn, không thấy fanpage / link chat; Kho B và kho cũ không thấy
  const la = await ka('GET', '/api/orders?status=moi');
  assert.deepEqual(la.orders.map((o) => o.id).sort(), [o1.id, o2.id].sort());
  assert.equal(la.orders[0].page, undefined);
  assert.equal(la.orders[0].link, undefined);
  assert.equal((await kb('GET', '/api/orders?status=moi')).orders.length, 0);
  assert.equal((await kho('GET', '/api/orders?status=moi')).orders.some((o) => o.id === o1.id), false);
  // kho không lọc lách sang kho khác bằng tham số
  assert.equal((await kb('GET', `/api/orders?kho=${A.id}`)).orders.length, 0);

  // Kho A nhập mã vận đơn + ghi chú, rồi hết hàng → chủ shop chuyển đơn chờ gửi sang Kho B
  await ka('PATCH', '/api/orders/' + o1.id, { tracking_code: 'VTP-A-1', kho_note: 'kho A ghi' });
  await admin('PUT', '/api/settings', { active_kho: B.id });
  assert.equal((await admin('POST', '/api/kho/move', { from: A.id, to: B.id })).updated, 2);
  const o3 = (await mk('0913000003')).order;
  assert.equal(o3.kho_id, B.id);

  assert.equal((await ka('GET', '/api/orders?status=moi')).orders.length, 0);          // Kho A không còn thấy
  assert.equal((await ka('GET', '/api/orders/' + o1.id)).ok, false);
  assert.equal((await ka('PATCH', '/api/orders/' + o1.id, { status: 'da_gui' })).ok, false);
  const lb = (await kb('GET', '/api/orders?status=moi')).orders;
  assert.equal(lb.length, 3);
  const b1 = lb.find((o) => o.id === o1.id);
  assert.equal(b1.tracking_code, '');                                                   // thông tin Kho A đã xóa
  assert.equal(b1.kho_note, '');

  // chi tiết đơn ở Kho B: không thấy việc chia cho Kho A, không thấy thao tác của Kho A, không có lịch sử khách
  const d = await kb('GET', '/api/orders/' + o1.id);
  const log = JSON.stringify(d.events);
  assert.ok(!log.includes('Kho A') && !log.includes('bena') && !log.includes('VTP-A-1') && !log.includes('Giao cho'));
  assert.deepEqual(d.history, []);
  assert.equal(d.customer, null);
  assert.equal(d.order.page, undefined);

  // mã đơn trùng: chỉ hiện nếu đơn kia cũng thuộc kho mình
  await admin('POST', '/api/orders/bulk', { ids: [o2.id], kho_id: A.id });
  assert.equal((await kb('GET', '/api/orders/' + o1.id)).order.dup_codes, '');
  assert.ok((await admin('GET', '/api/orders/' + o1.id)).order.dup_codes.includes(o2.code));

  // kho không tự chuyển đơn
  await kb('PATCH', '/api/orders/' + o1.id, { kho_id: A.id });
  assert.equal((await admin('GET', '/api/orders/' + o1.id)).order.kho_id, B.id);
  assert.equal((await kb('POST', '/api/orders/bulk', { ids: [o1.id], kho_id: A.id })).ok, false);
  assert.equal((await kb('POST', '/api/kho/move', { from: B.id, to: A.id })).ok, false);

  // Kho B gửi xong → bấm Đã gửi
  assert.equal((await kb('PATCH', '/api/orders/' + o1.id, { status: 'da_gui' })).order.status, 'da_gui');

  const { today } = await admin('GET', '/api/bootstrap');
  const rep = await admin('GET', `/api/report?from=${today}&to=${today}`);
  assert.ok(rep.by_kho.find((x) => x.id === B.id).waiting >= 1);
  assert.ok(OLD);
});

test('AI đọc đơn: server chưa có khóa AI → extension dùng bộ lọc thường, không lỗi', async () => {
  const tok = (await admin('POST', '/api/me/api-token')).token;
  const ping = await ext({ action: 'ping', token: tok });
  assert.equal(ping.ai, false);
  const r = await ext({ action: 'parse', token: tok, text: 'nguyen van a 0912345678 ha noi' });
  assert.equal(r.ok, true);
  assert.equal(r.ai, false);
  assert.match(r.error, /Chưa bật AI/);
});


test('page Facebook: khai báo trong Cài đặt, extension lấy được danh sách', async () => {
  await admin('PUT', '/api/settings', { fb_pages: 'Trứng Sâu Miền Bắc\nTrứng Sâu Miền Nam, Chi Nhánh 2\nGà Đẻ Khỏe\nSâu Canxi Sỉ' });
  const tok = (await admin('POST', '/api/me/api-token')).token;
  const r = await ext({ action: 'pages', token: tok });
  assert.deepEqual(r.pages.slice(0, 4), ['Trứng Sâu Miền Bắc', 'Trứng Sâu Miền Nam, Chi Nhánh 2', 'Gà Đẻ Khỏe', 'Sâu Canxi Sỉ']);
});

test('lý do hoàn + sổ đỏ + khách quen', async () => {
  const mk = async (phone, name) => (await admin('POST', '/api/orders', { name, phone, address: 'Xã A, Huyện B, Hà Nội', qty: 1, total: 100000 })).order;
  // khách quen: 3 đơn đã giao
  for (let i = 0; i < 3; i++) {
    const o = await mk('0911000111', 'Khách Quen');
    await admin('PATCH', '/api/orders/' + o.id, { status: 'da_giao' });
  }
  // khách phá: đơn bị hoàn vì lý do đầu tiên (cố tình phá)
  const { settings } = await admin('GET', '/api/bootstrap');
  const fake = settings.return_reasons[0];
  const bad = await mk('0922000222', 'Khách Phá');
  await admin('PATCH', '/api/orders/' + bad.id, { status: 'da_gui' });
  let r = await admin('PATCH', '/api/orders/' + bad.id, { status: 'hoan', return_reason: fake });
  assert.equal(r.order.return_reason, fake);
  // hoàn tác về Đã gửi thì xóa lý do, hoàn lại thì ghi lại
  r = await admin('PATCH', '/api/orders/' + bad.id, { status: 'da_gui' });
  assert.equal(r.order.return_reason, '');
  r = await admin('POST', '/api/orders/bulk', { ids: [bad.id], status: 'hoan', return_reason: fake });
  assert.equal(r.updated, 1);
  assert.equal((await admin('GET', `/api/orders?reason=${encodeURIComponent(fake)}`)).count, 1);
  // lý do hoàn không ghi được khi đơn không ở trạng thái Hoàn
  const other = await mk('0933000333', 'Ai Đó');
  assert.equal((await admin('PATCH', '/api/orders/' + other.id, { return_reason: 'x' })).order.return_reason, '');

  const { today } = await admin('GET', '/api/bootstrap');
  const rep = await admin('GET', `/api/report?from=${today}&to=${today}`);
  assert.equal(rep.by_return_reason[fake], 1);

  // nghi vấn → đưa vào sổ đỏ
  const sus = (await admin('GET', '/api/customers/suspects')).customers;
  const s = sus.find((c) => c.phone === '0922000222');
  assert.ok(s, 'khách phá phải nằm trong danh sách nghi vấn');
  assert.equal((await admin('PATCH', '/api/customers/' + s.id, { flag: 'bom' })).customer.flag, 'bom');
  assert.ok(!(await admin('GET', '/api/customers/suspects')).customers.some((c) => c.id === s.id));

  // thêm SĐT chưa từng đặt vào sổ đỏ
  const add = await admin('POST', '/api/customers/blacklist', { phone: '0944 000 444', note: 'Tạo đơn ảo bằng nhiều SĐT' });
  assert.equal(add.customer.flag, 'bom');
  assert.ok(add.customer.flagged_at);
  const red = (await admin('GET', '/api/customers?view=red')).customers.map((c) => c.phone);
  assert.ok(red.includes('0922000222') && red.includes('0944000444'));

  // extension và danh sách đơn đều báo sổ đỏ
  const tok = (await admin('POST', '/api/me/api-token')).token;
  assert.equal((await ext({ action: 'check', token: tok, order: { phone: '0944000444' } })).customer.flag, 'bom');
  assert.equal((await admin('GET', '/api/orders?q=0922000222')).orders[0].cflag, 'bom');

  // khách quen
  const loyal = (await admin('GET', '/api/customers?view=loyal')).customers;
  const q = loyal.find((c) => c.phone === '0911000111');
  assert.equal(q.delivered, 3);
  assert.equal(q.spent, 300000);
  assert.ok(!loyal.some((c) => c.flag === 'bom'));
});

test('mã đơn: quá 999 đơn một ngày vẫn không trùng', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const first = (await admin('POST', '/api/orders', { name: 'A', phone: '0955000555', address: 'Hà Nội', qty: 1, total: 1 })).order.code;
  const prefix = first.slice(0, first.lastIndexOf('-') + 1);
  // giả lập đã có đơn thứ 999 trong ngày
  const db = new DatabaseSync(path.join(DATA, 'don.db'));
  db.exec('PRAGMA busy_timeout = 5000');
  db.prepare(`INSERT INTO orders(code, created_at, phone, updated_at) VALUES (?, datetime('now'), '0955000555', datetime('now'))`).run(prefix + '999');
  db.close();
  const a = (await admin('POST', '/api/orders', { name: 'A', phone: '0955000555', address: 'Hà Nội', qty: 1, total: 1 })).order;
  const b = (await admin('POST', '/api/orders', { name: 'A', phone: '0955000555', address: 'Hà Nội', qty: 1, total: 1 })).order;
  assert.equal(a.code, prefix + '1000');
  assert.equal(b.code, prefix + '1001');
});

test('xóa tài khoản: chỉ xóa được tài khoản tạo nhầm, chưa có dữ liệu', async () => {
  const users = async () => (await admin('GET', '/api/users')).users;
  assert.equal((await admin('POST', '/api/users', { username: 'kho.nham', password: 'abc123', role: 'kho' })).ok, true);
  const nham = (await users()).find((u) => u.username === 'kho.nham');
  // tạo nhầm, chưa có gì → xóa được, đăng nhập không được nữa
  assert.equal((await admin('DELETE', '/api/users/' + nham.id)).ok, true);
  assert.ok(!(await users()).some((u) => u.id === nham.id));
  const c = client();
  assert.equal((await c('POST', '/api/login', { username: 'kho.nham', password: 'abc123' })).ok, false);
  // tạo lại cùng tên đăng nhập được
  assert.equal((await admin('POST', '/api/users', { username: 'kho.nham', password: 'abc123', role: 'kho' })).ok, true);
  // tài khoản kho đã có đơn → không xóa được, gợi ý Khóa
  const khoUser = (await users()).find((u) => u.username === 'kho');
  const r = await admin('DELETE', '/api/users/' + khoUser.id);
  assert.equal(r.ok, false);
  assert.match(r.error, /Khóa/);
  // không tự xóa chính mình
  const me = (await users()).find((u) => u.username === 'admin');
  assert.equal((await admin('DELETE', '/api/users/' + me.id)).ok, false);
  // kho không gọi được API xóa
  const k2 = (await users()).find((u) => u.username === 'kho.nham');
  assert.equal((await kho('DELETE', '/api/users/' + k2.id)).ok, false);
});

test('Messenger webhook: xác minh, kiểm chữ ký, lưu tin', async () => {
  const { createHmac } = await import('node:crypto');
  const W = BASE + '/api/meta/webhook';
  // Meta xác minh URL
  let r = await fetch(W + '?hub.mode=subscribe&hub.verify_token=verify-abc&hub.challenge=12345');
  assert.equal(r.status, 200);
  assert.equal(await r.text(), '12345');
  assert.equal((await fetch(W + '?hub.mode=subscribe&hub.verify_token=sai&hub.challenge=1')).status, 403);
  // tin nhắn có chữ ký đúng → lưu
  const body = JSON.stringify({ object: 'page', entry: [{ id: '111', time: 1, messaging: [
    { sender: { id: '900001' }, recipient: { id: '111' }, timestamp: 1, message: { mid: 'm1', text: 'Shop ơi còn trứng không' } },
    { sender: { id: '111' }, recipient: { id: '900001' }, timestamp: 2, message: { mid: 'm2', text: 'Dạ còn ạ', is_echo: true } },
  ] }] });
  const sig = 'sha256=' + createHmac('sha256', 'secret-xyz').update(body).digest('hex');
  r = await fetch(W, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sig }, body });
  assert.equal(r.status, 200);
  // chữ ký sai → từ chối, không lưu
  r = await fetch(W, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': 'sha256=' + '0'.repeat(64) }, body });
  assert.equal(r.status, 401);
  const ev = await admin('GET', '/api/meta/events');
  assert.equal(ev.events[0].kind, 'rejected', 'lần sai chữ ký được ghi lại để xem lý do');
  const msgs = ev.events.filter((e) => e.kind === 'message' || e.kind === 'echo');
  assert.deepEqual(msgs.map((e) => [e.kind, e.sender_id]), [['echo', '900001'], ['message', '900001']]);
  assert.equal(msgs[1].text, 'Shop ơi còn trứng không');
  assert.deepEqual(ev.status, { verify_token: true, app_secret: true, page_token: false });
  assert.match(ev.webhook_url, /\/api\/meta\/webhook$/);
  // chưa có mã page → gửi thử báo lỗi rõ ràng; kho không xem được
  assert.match((await admin('POST', '/api/meta/test-reply', { sender_id: '900001' })).error, /META_PAGE_TOKEN/);
  assert.equal((await kho('GET', '/api/meta/events')).ok, false);
});

test('giao diện: index.html gọi file kèm ?v=<mã nội dung> để không dính cache cũ sau khi deploy', async () => {
  const r = await fetch(BASE + '/');
  assert.equal(r.headers.get('cache-control'), 'no-cache');
  const html = await r.text();
  const m = html.match(/src="\/app\.js\?v=([0-9a-f]{10})"/);
  assert.ok(m, 'app.js phải có ?v=');
  assert.match(html, /href="\/style\.css\?v=[0-9a-f]{10}"/);
  // mã = 10 ký tự đầu sha1 của nội dung file
  const { createHash } = await import('node:crypto');
  const want = createHash('sha1').update(fs.readFileSync(path.resolve(import.meta.dirname, '../public/app.js'))).digest('hex').slice(0, 10);
  assert.equal(m[1], want);
  const js = await fetch(BASE + '/app.js?v=' + m[1]);
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type'), /javascript/);
  // đường dẫn lạ vẫn trả về trang chủ (đã gắn ?v=)
  assert.match(await (await fetch(BASE + '/khong-co')).text(), /app\.js\?v=/);
});

test('Messenger webhook: tin mẫu của nút "Thử nghiệm" và lần bị từ chối đều hiện trên web', async () => {
  const { createHmac } = await import('node:crypto');
  const W = BASE + '/api/meta/webhook';
  const sign = (b) => 'sha256=' + createHmac('sha256', 'secret-xyz').update(b).digest('hex');
  // dạng Meta gửi khi bấm "Thử nghiệm" ở trường messages
  const sample = JSON.stringify({ object: 'page', entry: [{ id: '0', time: 1, changes: [{ field: 'messages', value: { sender: { id: '12334' }, recipient: { id: '23245' }, timestamp: '1527459824', message: { mid: 'test_message_id', text: 'test_message' } } }] }] });
  assert.equal((await fetch(W, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sign(sample) }, body: sample })).status, 200);
  // sai khóa bí mật → bị từ chối nhưng có ghi lại lý do
  assert.equal((await fetch(W, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': 'sha256=' + 'a'.repeat(64) }, body: sample })).status, 401);
  const ev = (await admin('GET', '/api/meta/events')).events;
  assert.equal(ev[0].kind, 'rejected');
  assert.match(ev[0].text, /META_APP_SECRET/);
  assert.equal(ev[1].kind, 'test');
  assert.equal(ev[1].text, 'test_message');
});

test('Messenger webhook: tin standby (app khác giữ quyền chính) vẫn hiện, kiểm tra đăng ký báo thiếu mã page', async () => {
  const { createHmac } = await import('node:crypto');
  const body = JSON.stringify({ object: 'page', entry: [{ id: '222', time: 1, standby: [
    { sender: { id: '700007' }, recipient: { id: '222' }, timestamp: 1, message: { mid: 's1', text: 'Còn hàng không shop' } },
  ] }] });
  const sig = 'sha256=' + createHmac('sha256', 'secret-xyz').update(body).digest('hex');
  assert.equal((await fetch(BASE + '/api/meta/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sig }, body })).status, 200);
  const ev = (await admin('GET', '/api/meta/events')).events;
  assert.deepEqual([ev[0].kind, ev[0].sender_id, ev[0].page_id, ev[0].text], ['standby', '700007', '222', 'Còn hàng không shop']);
  assert.match((await admin('GET', '/api/meta/subscriptions')).error, /META_PAGE_TOKEN/);
  assert.match((await admin('POST', '/api/meta/subscribe')).error, /META_PAGE_TOKEN/);
});

// ---------------------------------------------------------------- website công khai
import http from 'node:http';
function siteGet(p, host = 'site.localhost') {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path: p, headers: { Host: host, 'X-Forwarded-Proto': 'https' } }, (res) => {
      let b = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (b += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: b }));
    }).on('error', reject);
  });
}

test('website: các trang công khai, www → tên miền gốc, không lộ API quản lý', async () => {
  for (const p of ['/', '/san-pham', '/trang-trai', '/blog', '/lien-he', '/chinh-sach', '/chinh-sach/bao-mat', '/chinh-sach/xoa-du-lieu']) {
    const r = await siteGet(p);
    assert.equal(r.status, 200, p);
    assert.match(r.body, /<link rel="canonical" href="https:\/\/site\.localhost/, p);
  }
  assert.equal((await siteGet('/khong-co')).status, 404);
  assert.equal((await siteGet('/chinh-sach/khong-co')).status, 404);
  const www = await siteGet('/blog', 'www.doanhwork.com');
  assert.equal(www.status, 301);
  assert.equal(www.headers.location, 'https://doanhwork.com/blog');
  assert.equal((await siteGet('/privacy.html')).headers.location, '/chinh-sach/bao-mat');
  assert.equal((await siteGet('/dang-nhap')).status, 302);
  // API quản lý không chạy ở tên miền công khai
  const api = await siteGet('/api/orders');
  assert.equal(api.status, 404);
  assert.doesNotMatch(api.body, /"orders"/);
  assert.match((await siteGet('/robots.txt')).body, /Sitemap: https:\/\/site\.localhost\/sitemap\.xml/);
  assert.match((await siteGet('/sitemap.xml')).body, /<loc>https:\/\/site\.localhost\/chinh-sach\/bao-mat<\/loc>/);
  // chính sách thay {{brand}} / {{domain}}
  const pol = (await siteGet('/chinh-sach/bao-mat')).body;
  assert.doesNotMatch(pol, /\{\{/);
  assert.match(pol, /site\.localhost/);
});

test('website: sửa thông tin shop, sản phẩm, chính sách; kho không sửa được', async () => {
  const r = await admin('PUT', '/api/site', {
    brand: 'Trại Sâu Xanh', phone: '0912 345 678', messenger: 'https://m.me/traisauxanh',
    products: [{ name: 'Trứng sâu 35g', spec: 'Hộp 35g', price: 65000, desc: 'Giàu canxi' }],
    policies: { 'doi-tra': '## Đổi trả\nTrong **48 giờ**.' },
  });
  assert.equal(r.site.brand, 'Trại Sâu Xanh');
  const home = (await siteGet('/')).body;
  assert.match(home, /Trại Sâu Xanh/);
  assert.match(home, /href="https:\/\/m\.me\/traisauxanh"/);
  assert.match(home, /href="tel:0912345678"/);
  assert.match(home, /65\.000đ/);
  assert.match((await siteGet('/chinh-sach/doi-tra')).body, /<strong>48 giờ<\/strong>/);
  assert.match((await admin('PUT', '/api/site', { products: [] })).error, /ít nhất 1 sản phẩm/);
  assert.equal((await kho('PUT', '/api/site', { brand: 'Kho đổi tên' })).ok, false);
  assert.equal((await admin('GET', '/api/site')).site.brand, 'Trại Sâu Xanh');
});

test('website: bài viết nháp không hiện, đăng rồi mới hiện; chống chèn mã', async () => {
  const d = await admin('POST', '/api/posts', { title: 'Cách cho gà ăn trứng sâu', body: '## Bước 1\nTrộn với cám.\n\n<script>alert(1)</script>\n\n[xấu](javascript:alert(1))' });
  assert.equal(d.post.slug, 'cach-cho-ga-an-trung-sau');
  assert.equal(d.post.status, 'draft');
  assert.equal((await siteGet('/blog/cach-cho-ga-an-trung-sau')).status, 404, 'nháp không ai xem được');
  const p = await admin('PATCH', '/api/posts/' + d.post.id, { status: 'published' });
  assert.ok(p.post.published_at);
  const page = await siteGet('/blog/cach-cho-ga-an-trung-sau');
  assert.equal(page.status, 200);
  assert.match(page.body, /<h3>Bước 1<\/h3>/);
  assert.doesNotMatch(page.body, /<script>alert/);
  assert.doesNotMatch(page.body, /href="javascript:/);
  assert.match(page.body, /"@type":"BlogPosting"/);
  assert.match((await siteGet('/blog')).body, /Cách cho gà ăn trứng sâu/);
  assert.match((await siteGet('/sitemap.xml')).body, /blog\/cach-cho-ga-an-trung-sau/);
  // trùng tiêu đề → đường dẫn tự thêm số
  assert.equal((await admin('POST', '/api/posts', { title: 'Cách cho gà ăn trứng sâu' })).post.slug, 'cach-cho-ga-an-trung-sau-2');
  assert.equal((await kho('POST', '/api/posts', { title: 'x' })).ok, false);
  assert.equal((await admin('DELETE', '/api/posts/' + d.post.id)).ok, true);
  assert.equal((await siteGet('/blog/cach-cho-ga-an-trung-sau')).status, 404);
});

test('website: tải ảnh chỉ nhận ảnh thật, phục vụ ở cả 2 tên miền', async () => {
  // PNG 1x1
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const up = await admin('POST', '/api/uploads', { data: 'data:image/png;base64,' + png });
  assert.match(up.url, /^\/uploads\/[0-9a-f]{20}\.png$/);
  assert.equal((await admin('POST', '/api/uploads', { data: Buffer.from('<?php echo 1; ?>').toString('base64') })).ok, false, 'file giả ảnh bị từ chối');
  const a = await fetch(BASE + up.url);
  assert.equal(a.status, 200);
  assert.equal(a.headers.get('content-type'), 'image/png');
  assert.equal((await siteGet(up.url)).status, 200);
  assert.equal((await siteGet('/uploads/../don.db')).status, 404);
  assert.equal((await kho('POST', '/api/uploads', { data: png })).ok, false);
});

test('website: chỉ lưu mục đã sửa, mục chưa sửa vẫn theo nội dung mặc định', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  await admin('PUT', '/api/site', { tagline: 'Khẩu hiệu riêng' });
  const db = new DatabaseSync(path.join(DATA, 'don.db'), { readOnly: true });
  const saved = JSON.parse(db.prepare("SELECT value FROM settings WHERE key = 'site'").get().value);
  db.close();
  assert.equal(saved.tagline, 'Khẩu hiệu riêng');
  assert.equal(saved.usage, undefined, 'không chép nội dung mặc định vào database');
  assert.equal(saved.farm, undefined);
  const site = (await admin('GET', '/api/site')).site;
  assert.match(site.usage, /Cách ấp trứng/);
  // bài mẫu đã đăng sẵn
  assert.match((await siteGet('/blog/huong-dan-ap-trung-ruoi-linh-den-nuoi-sau-canxi-tai-nha')).body, /<table>/);
});

test('cài đặt: lý do hoàn có dấu phẩy không bị tách đôi; page Facebook giữ nguyên sau khi lưu cài đặt khác', async () => {
  await admin('PUT', '/api/settings', { return_reasons: 'Đơn ảo / cố tình phá\nGiao lâu, khách hủy', fb_pages: 'Page A\nPage B, chi nhánh 2' });
  await admin('PUT', '/api/settings', { shop_name: 'Shop khác' }); // lưu cài đặt khác không được xóa danh sách page
  const s = (await admin('GET', '/api/bootstrap')).settings;
  assert.deepEqual(s.return_reasons, ['Đơn ảo / cố tình phá', 'Giao lâu, khách hủy']);
  assert.deepEqual(s.fb_pages, ['Page A', 'Page B, chi nhánh 2']);
});

test('giá theo số hộp: mặc định, sửa trong Cài đặt, extension lấy được; bảng sai thì báo lỗi', async () => {
  const tok = (await admin('POST', '/api/me/api-token')).token;
  // mặc định
  let r = await ext({ action: 'prices', token: tok });
  assert.deepEqual(r.prices, { 1: 95000, 2: 130000, 3: 195000, 4: 250000, 5: 300000 });
  // sửa: nhiều kiểu viết
  await admin('PUT', '/api/settings', { price_table: '1 = 99k\n2: 135.000\n3 hộp 200k\n10 = 550000' });
  r = await ext({ action: 'prices', token: tok });
  assert.deepEqual(r.prices, { 1: 99000, 2: 135000, 3: 200000, 10: 550000 });
  assert.equal((await admin('PUT', '/api/settings', { price_table: 'linh tinh' })).ok, false);
  // kho cũng nhận được bảng giá (form tạo đơn), sai mã API thì không
  assert.match((await kho('GET', '/api/bootstrap')).settings.price_table, /10 = 550000/);
  assert.equal((await ext({ action: 'prices', token: 'sai' })).ok, false);
  await admin('PUT', '/api/settings', { price_table: '1 = 95000\n2 = 130000\n3 = 195000\n4 = 250000\n5 = 300000' });
});

test('Zalo: chưa đăng nhập thì báo rõ, chép lần lượt đánh dấu đã báo kho, kho không gọi được, cài đặt chung không đổi được nhóm', async () => {
  const st = await admin('GET', '/api/zalo');
  assert.equal(st.status, 'off');
  assert.equal(st.group, null);
  const o = (await admin('POST', '/api/orders', { name: 'Khách Zalo', phone: '0912000111', address: 'Hà Nội', qty: 2, total: 130000 })).order;
  // chưa chọn nhóm → không gửi, đơn chưa bị đánh dấu
  const send = await admin('POST', '/api/zalo/send', { id: o.id, text: 'Khách Zalo | 0912000111' });
  assert.equal(send.ok, false);
  assert.match(send.error, /Chưa chọn nhóm/);
  assert.equal((await admin('GET', '/api/orders/' + o.id)).order.zalo_sent_at, null);
  // chép lần lượt → đánh dấu + ghi lịch sử
  assert.equal((await admin('POST', '/api/zalo/mark', { ids: [o.id, 999999] })).updated, 1);
  const d = await admin('GET', '/api/orders/' + o.id);
  assert.ok(d.order.zalo_sent_at);
  assert.ok(d.events.some((e) => /Gửi kho qua Zalo \(chép lần lượt\)/.test(e.action)));
  // tài khoản kho không dùng được
  assert.equal((await kho('GET', '/api/zalo')).ok, false);
  assert.equal((await kho('POST', '/api/zalo/mark', { ids: [o.id] })).ok, false);
  // nhóm chỉ đổi qua /api/zalo/group (có kiểm tra), PUT /api/settings bỏ qua
  await admin('PUT', '/api/settings', { zalo_group_id: '123', zalo_group_name: 'Giả' });
  assert.equal((await admin('GET', '/api/zalo')).group, null);
  // giãn cách: khoảng ngẫu nhiên, mặc định 3–5 giây, giới hạn 2–60, nhập ngược thì tự đổi chỗ
  const gap = async () => (await admin('GET', '/api/zalo')).gap;
  assert.deepEqual(await gap(), { min: 3, max: 5 });
  await admin('PUT', '/api/settings', { zalo_gap_min: 4, zalo_gap_max: 9 });
  assert.deepEqual(await gap(), { min: 4, max: 9 });
  await admin('PUT', '/api/settings', { zalo_gap_min: 1, zalo_gap_max: 999 });
  assert.deepEqual(await gap(), { min: 2, max: 60 });
  await admin('PUT', '/api/settings', { zalo_gap_min: 8, zalo_gap_max: 4 });
  assert.deepEqual(await gap(), { min: 4, max: 8 });
  await admin('PUT', '/api/settings', { zalo_gap_min: 20 }); // chỉ sửa "từ" mà lớn hơn "đến" hiện tại
  assert.deepEqual(await gap(), { min: 8, max: 20 });
  // chưa đăng nhập mà xem nhóm → báo đăng nhập
  assert.match((await admin('GET', '/api/zalo/groups')).error, /Chưa đăng nhập Zalo/);
});

test('extension: tải file .zip (chỉ chủ shop), mã API hiện lại được để dán nhiều máy', async () => {
  // mã API: GET trả đúng mã đang dùng, dùng được cho extension; tạo mã mới thì mã cũ hết hiệu lực
  const t1 = (await admin('POST', '/api/me/api-token')).token;
  const g = await admin('GET', '/api/me/api-token');
  assert.equal(g.token, t1);
  assert.match(g.extension.version, /^\d+\.\d+/);
  assert.equal((await ext({ action: 'ping', token: g.token })).ok, true);
  const t2 = (await admin('POST', '/api/me/api-token')).token;
  assert.equal((await admin('GET', '/api/me/api-token')).token, t2);
  assert.equal((await ext({ action: 'ping', token: t1 })).ok, false);
  assert.equal((await kho('GET', '/api/me/api-token')).ok, false);
  // tải zip: cần đăng nhập chủ shop
  assert.equal((await fetch(BASE + '/api/extension.zip')).status, 401);
  const login = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'test123' }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const r = await fetch(BASE + '/api/extension.zip', { headers: { Cookie: cookie } });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-disposition'), /quanly-don-extension-\d/);
  const buf = Buffer.from(await r.arrayBuffer());
  assert.equal(buf.readUInt32LE(0), 0x04034b50); // "PK.."
  assert.ok(buf.includes(Buffer.from('quanly-don-extension/manifest.json')));
  assert.equal(buf.readUInt32LE(buf.length - 22), 0x06054b50); // có mục lục cuối file
});

test('Zalo Web (extension): lấy đơn Chờ gửi chưa báo kho kèm nội dung tin, đánh dấu từng đơn', async () => {
  const tok = (await admin('GET', '/api/me/api-token')).token;
  await admin('PUT', '/api/settings', { copy_sep: 'pipe', copy_labels: 0, zalo_gap_min: 3, zalo_gap_max: 5 });
  const a = (await admin('POST', '/api/orders', { name: 'Zalo Web A', phone: '0915000111', address: 'Xã A, Tỉnh B', qty: 2, total: 130000 })).order;
  const b = (await admin('POST', '/api/orders', { name: 'Zalo Web B', phone: '0915000222', address: 'Xã C, Tỉnh D', qty: 1, total: 95000 })).order;
  let r = await ext({ action: 'zalo_pending', token: tok });
  assert.equal(r.ok, true);
  assert.deepEqual(r.gap, { min: 3, max: 5 });
  const pa = r.orders.find((o) => o.id === a.id);
  assert.equal(pa.text, 'Zalo Web A | 0915000111 | Xã A, Tỉnh B | 2 hộp | 130.000đ');
  assert.ok(r.orders.findIndex((o) => o.id === a.id) < r.orders.findIndex((o) => o.id === b.id)); // đơn cũ trước
  // đánh dấu A → A biến khỏi danh sách, B còn
  assert.equal((await ext({ action: 'zalo_mark', token: tok, ids: [a.id] })).updated, 1);
  r = await ext({ action: 'zalo_pending', token: tok });
  assert.ok(!r.orders.some((o) => o.id === a.id));
  assert.ok(r.orders.some((o) => o.id === b.id));
  assert.ok((await admin('GET', '/api/orders/' + a.id)).events.some((e) => /Zalo Web/.test(e.action)));
  // đơn không còn Chờ gửi thì không hiện
  await admin('PATCH', '/api/orders/' + b.id, { status: 'huy' });
  assert.ok(!(await ext({ action: 'zalo_pending', token: tok })).orders.some((o) => o.id === b.id));
  // có ghi tên mục
  await admin('PUT', '/api/settings', { copy_labels: 1, copy_sep: 'newline' });
  const c = (await admin('POST', '/api/orders', { name: 'Zalo Web C', phone: '0915000333', address: 'Xã E', qty: 3, total: 195000 })).order;
  r = await ext({ action: 'zalo_pending', token: tok });
  assert.equal(r.orders.find((o) => o.id === c.id).text, 'Tên: Zalo Web C\nSĐT: 0915000333\nĐịa chỉ: Xã E\nSL: 3 hộp\nTổng tiền: 195.000đ');
  assert.equal((await ext({ action: 'zalo_pending', token: 'sai' })).ok, false);
  await admin('PUT', '/api/settings', { copy_labels: 0, copy_sep: 'pipe' });
});

test('Zalo: cài đặt "báo kho xong thì chuyển Đã gửi" (mặc định tắt), áp dụng cho chép lần lượt và Zalo Web', async () => {
  const tok = (await admin('GET', '/api/me/api-token')).token;
  const mk = async (n) => (await admin('POST', '/api/orders', { name: 'Auto ' + n, phone: '09160001' + (10 + n), address: 'Xã A', qty: 1, total: 95000 })).order;
  // mặc định tắt: chỉ gắn nhãn, vẫn Chờ gửi
  assert.equal((await admin('GET', '/api/bootstrap')).settings.zalo_auto_shipped, 0);
  const a = await mk(1);
  await admin('POST', '/api/zalo/mark', { ids: [a.id] });
  assert.equal((await admin('GET', '/api/orders/' + a.id)).order.status, 'moi');
  // bật: chép lần lượt + Zalo Web → Đã gửi, có giờ gửi + lịch sử
  await admin('PUT', '/api/settings', { zalo_auto_shipped: 1 });
  const b = await mk(2);
  const c = await mk(3);
  await admin('POST', '/api/zalo/mark', { ids: [b.id] });
  await ext({ action: 'zalo_mark', token: tok, ids: [c.id] });
  for (const o of [b, c]) {
    const d = await admin('GET', '/api/orders/' + o.id);
    assert.equal(d.order.status, 'da_gui');
    assert.ok(d.order.shipped_at);
    assert.ok(d.order.zalo_sent_at);
    assert.ok(d.events.some((e) => /Chờ gửi → Đã gửi/.test(e.action)));
  }
  // đơn đã Hủy thì không bị đổi
  const h = await mk(4);
  await admin('PATCH', '/api/orders/' + h.id, { status: 'huy' });
  await admin('POST', '/api/zalo/mark', { ids: [h.id] });
  assert.equal((await admin('GET', '/api/orders/' + h.id)).order.status, 'huy');
  await admin('PUT', '/api/settings', { zalo_auto_shipped: 0 });
});

test('Zalo: SĐT trong tin Zalo tách nhóm (tránh Zalo tự kèm danh thiếp), Chép thường giữ nguyên', async () => {
  const tok = (await admin('GET', '/api/me/api-token')).token;
  await admin('PUT', '/api/settings', { copy_sep: 'pipe', copy_labels: 0 });
  const o = (await admin('POST', '/api/orders', { name: 'Danh thiếp', phone: '0961251352', address: 'Xã A', qty: 1, total: 95000 })).order;
  const pick = async () => (await ext({ action: 'zalo_pending', token: tok })).orders.find((x) => x.id === o.id);
  // mặc định giữ nguyên
  assert.equal((await admin('GET', '/api/bootstrap')).settings.zalo_phone_format, 'raw');
  let p = await pick();
  assert.equal(p.text, 'Danh thiếp | 0961251352 | Xã A | 1 hộp | 95.000đ');
  assert.equal(p.key, '0961251352');
  await admin('PUT', '/api/settings', { zalo_phone_format: 'space' });
  p = await pick();
  assert.equal(p.text, 'Danh thiếp | 0961 251 352 | Xã A | 1 hộp | 95.000đ');
  assert.equal(p.key, '0961 251 352');
  await admin('PUT', '/api/settings', { zalo_phone_format: 'dot' });
  assert.equal((await pick()).text, 'Danh thiếp | 0961.251.352 | Xã A | 1 hộp | 95.000đ');
  await admin('PUT', '/api/settings', { zalo_phone_format: 'linh tinh' });
  assert.equal((await admin('GET', '/api/bootstrap')).settings.zalo_phone_format, 'raw');
});

test('Zalo: báo kho xong chuyển thẳng "Đã giao" (kho làm thủ công), có giờ gửi + giờ giao', async () => {
  const tok = (await admin('GET', '/api/me/api-token')).token;
  await admin('PUT', '/api/settings', { zalo_auto_shipped: 2 });
  assert.equal((await admin('GET', '/api/bootstrap')).settings.zalo_auto_shipped, 2);
  const o = (await admin('POST', '/api/orders', { name: 'Giao luôn', phone: '0917000111', address: 'Xã A', qty: 1, total: 95000 })).order;
  await ext({ action: 'zalo_mark', token: tok, ids: [o.id] });
  const d = await admin('GET', '/api/orders/' + o.id);
  assert.equal(d.order.status, 'da_giao');
  assert.ok(d.order.shipped_at && d.order.done_at);
  assert.ok(d.events.some((e) => /Chờ gửi → Đã giao/.test(e.action)));
  await admin('PUT', '/api/settings', { zalo_auto_shipped: 9 }); // giá trị lạ → tắt
  assert.equal((await admin('GET', '/api/bootstrap')).settings.zalo_auto_shipped, 0);
});

test('quảng cáo theo ngày: mỗi ô = tổng 1 ngày × 1 page, sửa ô thay bằng 1 khoản, 0 = xóa; báo cáo tính như cũ', async () => {
  await admin('PUT', '/api/settings', { fb_pages: 'Page QC 1\nPage QC 2' });
  const d1 = '2026-11-01';
  const d2 = '2026-11-02';
  // khoản QC nhập tay trước đây (2 khoản cùng ngày + page) vẫn được cộng vào ô
  await admin('POST', '/api/transactions', { date: d1, type: 'chi', category: 'Quảng cáo', amount: 100000, page: 'Page QC 1' });
  await admin('POST', '/api/transactions', { date: d1, type: 'chi', category: 'Quảng cáo', amount: 50000, page: 'Page QC 1' });
  let r = await admin('GET', `/api/ads?from=${d1}&to=${d2}`);
  assert.ok(r.pages.includes('Page QC 1') && r.pages.includes('Page QC 2'));
  assert.equal(r.cells.find((c) => c.date === d1 && c.page === 'Page QC 1').amount, 150000);
  // sửa ô → còn 1 khoản đúng số mới
  await admin('PUT', '/api/ads', { date: d1, page: 'Page QC 1', amount: 200000 });
  await admin('PUT', '/api/ads', { date: d2, page: 'Page QC 2', amount: 300000 });
  r = await admin('GET', `/api/ads?from=${d1}&to=${d2}`);
  const c1 = r.cells.find((c) => c.date === d1 && c.page === 'Page QC 1');
  assert.equal(c1.amount, 200000);
  assert.equal(c1.n, 1);
  // báo cáo: chi QC = 500k, theo page
  const rep = await admin('GET', `/api/report?from=${d1}&to=${d2}`);
  assert.equal(rep.ads, 500000);
  // 0 → xóa ô; khoản chi khác cùng ngày không bị đụng
  await admin('POST', '/api/transactions', { date: d1, type: 'chi', category: 'Nhập hàng', amount: 70000, page: 'Page QC 1' });
  await admin('PUT', '/api/ads', { date: d1, page: 'Page QC 1', amount: 0 });
  r = await admin('GET', `/api/ads?from=${d1}&to=${d2}`);
  assert.ok(!r.cells.some((c) => c.date === d1 && c.page === 'Page QC 1'));
  const tx = (await admin('GET', `/api/transactions?from=${d1}&to=${d1}`)).transactions;
  assert.ok(tx.some((t) => t.category === 'Nhập hàng' && t.amount === 70000));
  // ngày tương lai, ngày sai → lỗi; kho không dùng được
  assert.equal((await admin('PUT', '/api/ads', { date: '2099-01-01', page: 'Page QC 1', amount: 1000 })).ok, false);
  assert.equal((await admin('PUT', '/api/ads', { date: 'abc', page: 'Page QC 1', amount: 1000 })).ok, false);
  assert.equal((await kho('GET', `/api/ads?from=${d1}&to=${d2}`)).ok, false);
});

test('"Coi như xong": báo Zalo → Đã giao + đã có tiền; bị hoàn → trừ tiền; hoàn tác → có tiền lại', async () => {
  const tok = (await admin('GET', '/api/me/api-token')).token;
  await admin('PUT', '/api/settings', { zalo_auto_shipped: 2 });
  const repBefore = await admin('GET', `/api/report?from=2000-01-01&to=2099-12-31`);
  const o = (await admin('POST', '/api/orders', { name: 'Coi như xong', phone: '0918000111', address: 'Xã A', qty: 2, total: 130000 })).order;
  assert.equal((await admin('GET', `/api/report?from=2000-01-01&to=2099-12-31`)).revenue, repBefore.revenue + 130000);
  await ext({ action: 'zalo_mark', token: tok, ids: [o.id] });
  let d = (await admin('GET', '/api/orders/' + o.id)).order;
  assert.equal(d.status, 'da_giao');
  assert.equal(d.cod_received, 1);
  assert.ok(d.cod_at);
  // không treo ở COD chờ về
  const pend = await admin('GET', '/api/orders?cod=pending');
  assert.ok(!pend.orders.some((x) => x.id === o.id));
  // bị hoàn → bỏ COD, doanh thu giảm đúng 130k
  await admin('PATCH', '/api/orders/' + o.id, { status: 'hoan', return_reason: 'Khách từ chối nhận' });
  d = (await admin('GET', '/api/orders/' + o.id)).order;
  assert.equal(d.status, 'hoan');
  assert.equal(d.cod_received, 0);
  const repAfter = await admin('GET', `/api/report?from=2000-01-01&to=2099-12-31`);
  assert.equal(repAfter.revenue, repBefore.revenue); // đơn mới cộng 130k rồi hoàn trừ lại 130k
  // hoàn tác (về Đã giao) → có tiền lại
  await admin('PATCH', '/api/orders/' + o.id, { status: 'da_giao' });
  assert.equal((await admin('GET', '/api/orders/' + o.id)).order.cod_received, 1);
  // chế độ khác: chuyển Đã giao bằng tay không tự đánh dấu tiền
  await admin('PUT', '/api/settings', { zalo_auto_shipped: 0 });
  const o2 = (await admin('POST', '/api/orders', { name: 'Tay', phone: '0918000222', address: 'Xã A', qty: 1, total: 95000 })).order;
  await admin('PATCH', '/api/orders/' + o2.id, { status: 'da_giao' });
  assert.equal((await admin('GET', '/api/orders/' + o2.id)).order.cod_received, 0);
});
