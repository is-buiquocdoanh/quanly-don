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
    env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, ADMIN_PASSWORD: 'test123' },
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
