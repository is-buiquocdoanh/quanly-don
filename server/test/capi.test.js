// Dữ liệu gửi Facebook Conversions API (không gọi mạng)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'don-capi-'));
const { buildPurchase, phone84, splitNameVN, cookieOf, parseUA, classifySource } = await import('../src/site/stats.js');
const sha = (v) => crypto.createHash('sha256').update(v, 'utf8').digest('hex');

test('chuẩn hóa SĐT, tên, cookie', () => {
  assert.equal(phone84('0343 920 003'), '84343920003');
  assert.equal(phone84('+84343920003'), '84343920003');
  assert.equal(phone84(''), '');
  assert.deepEqual(splitNameVN('  Nguyễn Văn Nông '), { fn: 'nông', ln: 'nguyễn' });
  assert.deepEqual(splitNameVN('Doanh.'), { fn: 'doanh' });
  assert.equal(cookieOf('a=1; _fbp=fb.1.1700000000000.123; _fbc=fb.1.1700000000000.IwAR_Xy', '_fbc'), 'fb.1.1700000000000.IwAR_Xy');
  assert.equal(cookieOf('', '_fbp'), '');
});

test('Purchase: event_id = mã đơn, đủ khóa so khớp, bỏ khóa trống / sai', () => {
  const order = { code: 'DH261126-012', phone: '0343920003', name: 'Bùi Quốc Doanh', qty: 2, total: 130000, product: 'Hũ 35g' };
  const p = buildPurchase(order, { ip: '113.1.2.3', ua: 'Mozilla/5.0', url: 'https://doanhwork.com/dat-hang', fbp: 'fb.1.1795673000000.1234567890', fbc: 'fb.1.1795673100000.IwAR2xYz' });
  const e = p.data[0];
  assert.equal(e.event_name, 'Purchase');
  assert.equal(e.event_id, 'DH261126-012');
  assert.equal(e.action_source, 'website');
  assert.ok(e.event_time < 1e11); // giây, không phải mili giây
  const u = e.user_data;
  assert.deepEqual(u.ph, [sha('84343920003')]);
  assert.deepEqual(u.external_id, [sha('84343920003')]);
  assert.deepEqual(u.fn, [sha('doanh')]);
  assert.deepEqual(u.ln, [sha('bùi')]);
  assert.deepEqual(u.country, [sha('vn')]);
  assert.equal(u.client_ip_address, '113.1.2.3');
  assert.equal(u.fbp, 'fb.1.1795673000000.1234567890'); // không băm
  assert.equal(u.fbc, 'fb.1.1795673100000.IwAR2xYz');   // giữ nguyên hoa/thường
  assert.deepEqual(e.custom_data.contents, [{ id: 'hu-35g', quantity: 2, item_price: 65000 }]);
  assert.equal(e.custom_data.value, 130000);
  assert.equal(e.custom_data.order_id, 'DH261126-012');
  assert.equal('test_event_code' in p, false);

  const p2 = buildPurchase(order, { fbp: '', fbc: 'rác', testCode: 'TEST42167' });
  assert.equal('fbp' in p2.data[0].user_data, false);
  assert.equal('fbc' in p2.data[0].user_data, false);
  assert.equal('client_ip_address' in p2.data[0].user_data, false);
  assert.equal(p2.test_event_code, 'TEST42167');
});

test('nhận diện thiết bị và nguồn', () => {
  assert.equal(parseUA('Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36').device, 'Điện thoại');
  assert.equal(parseUA('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)').device, 'Máy tính bảng');
  assert.equal(parseUA('Mozilla/5.0 (Windows NT 10.0) Chrome/130 coc_coc_browser/120').browser, 'Cốc Cốc');
  assert.equal(classifySource({ us: 'facebook', um: 'paid' }), 'Quảng cáo Facebook');
  assert.equal(classifySource({ r: 'https://l.facebook.com/', fb: 1 }), 'Facebook');
  assert.equal(classifySource({ r: 'https://www.google.com/' }), 'Google');
  assert.equal(classifySource({ r: 'https://doanhwork.com/blog' }, 'doanhwork.com'), 'Trực tiếp');
  assert.equal(classifySource({}), 'Trực tiếp');
});
