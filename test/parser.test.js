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
console.log(fail ? `${fail} lỗi` : `✓ ${cases.length} mẫu đều đúng`);
process.exit(fail ? 1 : 0);
