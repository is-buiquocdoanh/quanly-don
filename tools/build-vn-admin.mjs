// Tạo file danh sách đơn vị hành chính Việt Nam (gọn) cho bộ đọc địa chỉ (vnaddr.js).
// Nguồn: https://provinces.open-api.vn — v1 = 63 tỉnh cũ (có quận/huyện), v2 = 34 tỉnh sau sáp nhập 7/2025.
// Chạy lại khi có thay đổi địa giới:  node tools/build-vn-admin.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = [path.join(ROOT, 'extension/vn-admin.json'), path.join(ROOT, 'server/public/vn-admin.json')];

// loại đơn vị → 1 ký tự
const TYPE = {
  'xã': 'x', 'phường': 'p', 'thị trấn': 't', 'đặc khu': 'k',
  'huyện': 'h', 'quận': 'q', 'thị xã': 's', 'thành phố': 'c',
  'tỉnh': 'T', 'thành phố trung ương': 'C',
};
const PREFIX = /^(Xã|Phường|Thị trấn|Đặc khu|Huyện|Quận|Thị xã|Thành phố|Tỉnh)\s+/u;

const unit = (u) => {
  const t = TYPE[u.division_type];
  if (!t) throw new Error('Không rõ loại: ' + u.division_type + ' ' + u.name);
  return t + u.name.normalize('NFC').replace(PREFIX, '');
};

async function get(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

const v1 = await get('https://provinces.open-api.vn/api/v1/?depth=3');
const v2 = await get('https://provinces.open-api.vn/api/v2/?depth=2');

const data = {
  src: 'provinces.open-api.vn ' + new Date().toISOString().slice(0, 10),
  o: v1.map((p) => [unit(p), p.districts.map((d) => [unit(d), d.wards.map(unit)])]),
  n: v2.map((p) => [unit(p), p.wards.map(unit)]),
};
const json = JSON.stringify(data);
for (const f of OUT) fs.writeFileSync(f, json);
console.log(`Đã ghi ${OUT.length} file, ${(json.length / 1024).toFixed(0)} KB:`,
  data.o.length, 'tỉnh cũ,', data.n.length, 'tỉnh mới');
