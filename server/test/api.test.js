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
  assert.equal(ev.events.length, 2);
  assert.deepEqual(ev.events.map((e) => [e.kind, e.sender_id]), [['echo', '900001'], ['message', '900001']]);
  assert.equal(ev.events[1].text, 'Shop ơi còn trứng không');
  assert.deepEqual(ev.status, { verify_token: true, app_secret: true, page_token: false });
  assert.match(ev.webhook_url, /\/api\/meta\/webhook$/);
  // chưa có mã page → gửi thử báo lỗi rõ ràng; kho không xem được
  assert.match((await admin('POST', '/api/meta/test-reply', { sender_id: '900001' })).error, /META_PAGE_TOKEN/);
  assert.equal((await kho('GET', '/api/meta/events')).ok, false);
});
