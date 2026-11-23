// Chạy: node test/parser.test.js
const assert = require('assert');
const P = require('../extension/parser.js');

const cases = [
  {
    text: `Cảm ơn anh Nguyễn Văn Bằng đã tin tưởng đặt hàng bên em ạ. ❤️
Em xin xác nhận lại đơn hàng của mình:
📦 Sản phẩm: 02 hộp trứng sâu canxi Ruồi Lính Đen (35g/hộp)
💰 Tổng thanh toán: 130.000đ (Miễn phí ship)
📍 Thông tin nhận hàng: Nguyễn Văn Bằng, SĐT 0333806016, Xóm Trung Hậu, xã Thuần Trung, tỉnh Nghệ An, đơn 02 hộp 130K
🚚 Anh vui lòng để ý điện thoại trong khoảng 4–6 ngày tới để đơn vị vận chuyển liên hệ giao hàng. Được kiểm tra hàng trước khi thanh toán ạ.
Cảm ơn anh đã tin tưởng và ủng hộ shop. Chúc anh nhiều sức khỏe và nuôi sâu thật thành công! ✨`,
    expect: {
      name: 'Nguyễn Văn Bằng', phone: '0333806016',
      address: 'Xóm Trung Hậu, xã Thuần Trung, tỉnh Nghệ An',
      product: '02 hộp trứng sâu canxi Ruồi Lính Đen (35g/hộp)', qty: 2, total: 130000, note: 'Freeship',
    },
  },
  {
    // chỉ bôi đen dòng thông tin
    text: '📍 Thông tin nhận hàng: Trần Thị Lan, SĐT 0912 345 678, thôn 3, xã Hòa Bình, huyện Krông Pắc, tỉnh Đắk Lắk, đơn 03 hộp 190K',
    expect: { name: 'Trần Thị Lan', phone: '0912345678', address: 'thôn 3, xã Hòa Bình, huyện Krông Pắc, tỉnh Đắk Lắk', qty: 3, total: 190000 },
  },
  {
    // khách tự nhắn kiểu nhiều dòng
    text: `Tên: Lê Văn Tú
Sđt: +84 987.654.321
Địa chỉ: 12 ngõ 5 đường Láng, phường Láng Thượng, quận Đống Đa, Hà Nội
Lấy 1 hộp`,
    expect: { name: 'Lê Văn Tú', phone: '0987654321', address: '12 ngõ 5 đường Láng, phường Láng Thượng, quận Đống Đa, Hà Nội', qty: 1 },
  },
];

let fail = 0;
for (const [i, c] of cases.entries()) {
  const got = P.parse(c.text);
  for (const [k, v] of Object.entries(c.expect)) {
    try { assert.deepStrictEqual(got[k], v); }
    catch { fail++; console.log(`✗ case ${i + 1} ${k}: got ${JSON.stringify(got[k])}, want ${JSON.stringify(v)}`); }
  }
}
// ---- có danh sách địa giới (vnaddr.js): tin không dấu, viết tắt, thiếu tỉnh, gõ sai tên xã
globalThis.VnAddr = require('../extension/vnaddr.js');
VnAddr.load(require('../extension/vn-admin.json'));
const smart = [
  {
    text: 'chi oi lay e 2 hop nhe\nnguyen thi hoa 0912 345 678\nthon 3 x yen phu h y yen nam dinh\ngoi truoc khi giao, 2 hop 260k',
    expect: { name: 'Nguyễn Thị Hoa', phone: '0912345678', address: 'Thôn 3, Xã Yên Phúc, Huyện Ý Yên, Tỉnh Nam Định', qty: 2, total: 260000, product: '' },
    warn: /gần nhất là Xã Yên Phúc/,
  },
  {
    text: 'tran van hung 0987654321 so 12 ngo 5 lang thuong dong da ha noi lay 1 hop',
    expect: { name: 'Trần Văn Hùng', address: 'Số 12 Ngõ 5, Phường Láng Thượng, Quận Đống Đa, Thành phố Hà Nội', qty: 1 },
  },
  {
    text: 'Gửi về: Phạm Minh Đức - 0333 806 016 - ấp Tân Hòa, xã Tân Phú, Châu Thành, Đồng Tháp. Lấy 3 hộp tổng 360k',
    expect: { name: 'Phạm Minh Đức', address: 'Ấp Tân Hòa, Xã Tân Phú, Huyện Châu Thành, Tỉnh Đồng Tháp', qty: 3, total: 360000 },
  },
  {
    text: 'e ten la lan, sdt 0905123456 , dia chi kp3 p tan hiep tp bien hoa dong nai',
    expect: { name: 'Lan', address: 'Khu Phố 3, Phường Tân Hiệp, Thành phố Biên Hòa, Tỉnh Đồng Nai' },
  },
  {
    text: '0916012577\nle thi thu\nxom 4 nghia hung nghia dan nghe an\n2h',
    expect: { name: 'Lê Thị Thu', address: 'Xóm 4, Xã Nghĩa Hưng, Huyện Nghĩa Đàn, Tỉnh Nghệ An', qty: 2 },
  },
  {
    text: 'Địa chỉ: 45/3 Lê Lợi, P. Bến Thành, Q.1, TP.HCM. Người nhận Hoàng Lan 0901234567. Tổng 130.000đ',
    expect: { name: 'Hoàng Lan', address: '45/3 Lê Lợi, Phường Bến Thành, Quận 1, Thành phố Hồ Chí Minh', total: 130000 },
  },
  {
    // thiếu tỉnh: tự điền theo quận
    text: 'Ngô Bảo Ngọc 0938111222 p5 q3',
    expect: { name: 'Ngô Bảo Ngọc', address: 'Phường 5, Quận 3, Thành phố Hồ Chí Minh' },
    warn: /không ghi tỉnh/,
  },
  {
    // địa chỉ mới sau sáp nhập (không có huyện)
    text: 'Trần Thị Lan 0912345678 thôn Đoài, xã Kim Sơn, Ninh Bình',
    expect: { address: 'Thôn Đoài, Xã Kim Sơn, Tỉnh Ninh Bình' },
  },
];
for (const [i, c] of smart.entries()) {
  const got = P.parse(c.text);
  for (const [k, v] of Object.entries(c.expect)) {
    try { assert.deepStrictEqual(got[k], v); }
    catch { fail++; console.log(`✗ smart ${i + 1} ${k}: got ${JSON.stringify(got[k])}, want ${JSON.stringify(v)}`); }
  }
  if (c.warn && !got.hints.warnings.some((w) => c.warn.test(w))) { fail++; console.log(`✗ smart ${i + 1} thiếu cảnh báo ${c.warn}: ${JSON.stringify(got.hints.warnings)}`); }
}
// extension và web dùng chung 2 file này — phải giống hệt nhau
const fs = require('fs');
for (const f of ['parser.js', 'vnaddr.js', 'vn-admin.json']) {
  const a = fs.readFileSync(__dirname + '/../extension/' + f, 'utf8'), b = fs.readFileSync(__dirname + '/../server/public/' + f, 'utf8');
  if (a !== b) { fail++; console.log(`✗ extension/${f} khác server/public/${f} — chép lại cho giống`); }
}
console.log(fail ? `${fail} lỗi` : `✓ ${cases.length + smart.length} mẫu đều đúng`);
process.exit(fail ? 1 : 0);
