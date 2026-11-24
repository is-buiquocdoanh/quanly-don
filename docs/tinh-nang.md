# Tính năng của web

Tra cứu: mỗi trang trên web làm được gì, dành cho ai. Cài đặt thì xem các giai đoạn trong [Mục lục](README.md).

## Các trang trên web

| Trang | Ai dùng | Chức năng |
|---|---|---|
| **Tổng quan** | Chủ shop | Đơn, doanh thu, chi quảng cáo, chi phí QC/đơn, lãi ước tính, tỷ lệ hoàn, COD chờ về; biểu đồ theo ngày; so sánh theo page |
| **Đơn hàng** | Chủ shop | Lọc, tìm, sửa đơn, báo trùng SĐT, đổi trạng thái hàng loạt, đánh dấu COD đã về, tạo đơn bằng cách dán tin nhắn |
| **Kho gửi hàng** | Kho + chủ shop | Thẻ đơn chờ gửi, nút copy từng ô sang app Viettel Post, nhập mã vận đơn và phí ship, chuyển Đã gửi / Đã giao / Hoàn, in danh sách. Bấm **Bị hoàn** phải chọn **lý do hoàn** |
| **Khách hàng** | Chủ shop | 3 tab: **Tất cả** (lịch sử mua theo SĐT, đánh dấu VIP), **Khách quen** (mua nhiều, mua thường xuyên), **Sổ đỏ** (SĐT tạo đơn ảo / phá / bom hàng, có cảnh báo khi đặt lại). Chi tiết ở mục [bên dưới](#lý-do-hoàn-sổ-đỏ-khách-quen) |
| **Thu chi** | Chủ shop | Chi quảng cáo theo page, nhập hàng, ship, lương…; COD về và COD chờ về |
| **Chia đơn cho kho** | Chủ shop | Mỗi tài khoản quyền **Kho** (chủ shop tạo, đưa cho 1 bên có hàng) **chỉ thấy đơn được chia cho mình**: không thấy đơn, mã vận đơn, ghi chú của kho khác, không thấy fanpage, link chat, giá vốn. Chỉ có 1 tài khoản kho thì mọi đơn tự vào kho đó. Nhiều kho: công tắc "Đơn mới giao cho…" ở trang Đơn hàng / Cài đặt để đổi kho khi hết hàng, kèm chuyển luôn các đơn chờ gửi. Chia từng đơn / hàng loạt. Tổng quan có bảng theo kho |
| **Cài đặt** | Chủ shop | Giá vốn, danh mục thu chi, danh sách lý do hoàn, tài khoản kho (tạo, đặt lại mật khẩu, khóa, xóa tài khoản tạo nhầm), mã API cho extension, tải bản sao lưu |

## Lý do hoàn, Sổ đỏ, Khách quen

**Lý do hoàn.** Khi kho hoặc chủ shop bấm **Bị hoàn** (trang Kho, chi tiết đơn, hay đổi trạng thái hàng loạt), web hỏi lý do: chọn trong danh sách hoặc gõ lý do khác. Lý do hiện ở danh sách đơn, thẻ đơn của kho và lịch sử khách. Trang **Tổng quan** có biểu đồ **Lý do hoàn** theo khoảng ngày đang xem. Hoàn tác (đổi lại về Đã gửi) thì lý do cũ tự xóa.

- Sửa danh sách lý do ở **Cài đặt → Lý do hoàn**. Lý do **đứng đầu** được hiểu là *khách cố tình phá* (mặc định "Đơn ảo / cố tình phá"): chọn lý do này thì ô **Đưa SĐT vào Sổ đỏ** tự được tick (chỉ chủ shop thấy ô này, kho thì không).

**Sổ đỏ** (Khách hàng → tab Sổ đỏ). Danh sách SĐT từng tạo đơn ảo, phá hoặc bom hàng. Đặt đơn bằng SĐT trong sổ đỏ thì form tạo đơn, chi tiết đơn và extension đều hiện cảnh báo đỏ; danh sách đơn có nhãn **Sổ đỏ** cạnh tên khách.

- Đưa vào sổ đỏ bằng 1 trong 4 cách: tick ô khi báo hoàn; nút **+ Thêm SĐT vào Sổ đỏ** (dùng được cả với SĐT chưa từng đặt đơn); nút **Vào sổ đỏ** ở mục **Nghi vấn**; hoặc mở 1 khách → Đánh dấu → *Sổ đỏ*.
- Mục **Nghi vấn** gợi ý khách chưa vào sổ đỏ nhưng: có đơn hoàn vì lý do *cố tình phá*, hoặc hoàn từ 2 đơn mà chưa nhận đơn nào, hoặc hoàn từ 3 đơn và hoàn nhiều hơn nhận.
- Gỡ khỏi sổ đỏ: mở khách → Đánh dấu → *—* → Lưu. Cờ "bom hàng" cũ chính là sổ đỏ, không mất dữ liệu.

**Khách quen** (Khách hàng → tab Khách quen). Khách có từ 2 đơn **đã giao**, xếp theo số đơn rồi tổng tiền. Cột **Chu kỳ** là số ngày trung bình giữa 2 lần mua; khách đã quá chu kỳ khoảng 30% mà chưa đặt lại thì hiện chữ đỏ **quá chu kỳ**, nên nhắn chăm sóc. Khách trong sổ đỏ không hiện ở đây.

## Đọc địa chỉ tự động (miễn phí)

Extension và form tạo đơn trên web tự đọc địa chỉ bằng danh sách xã/phường, quận/huyện, tỉnh thật của Việt Nam (cả 63 tỉnh cũ lẫn 34 tỉnh sau sáp nhập 7/2025), không cần AI, không tốn phí:

- Thêm dấu, mở rộng viết tắt: `kp3 p tan hiep tp bien hoa dong nai` → Khu Phố 3, Phường Tân Hiệp, Thành phố Biên Hòa, Tỉnh Đồng Nai
- Khách không ghi tỉnh → tự điền theo quận/huyện (`p5 q3` → TP Hồ Chí Minh) và báo lại
- Gõ sai tên xã → chọn xã gần nhất trong đúng huyện và báo để kiểm tra
- Thêm dấu cho họ, tên đệm và tên phổ biến; tên có nhiều cách viết dấu thì giữ nguyên và nhắc sửa
- Báo thiếu số nhà / thôn, xã / phường, SĐT, số lượng, tiền

Cập nhật danh sách khi có thay đổi địa giới: `node tools/build-vn-admin.mjs` (ghi vào `extension/` và `server/public/`).

AI đọc đơn (tùy chọn): xem [Giai đoạn 5, mục 5](5-thiet-lap-web-extension.md#5-ai-đọc-đơn-tùy-chọn-tốn-phí).

---

[Mục lục](README.md)
