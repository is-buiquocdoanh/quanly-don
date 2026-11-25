# Tính năng của web

Tra cứu: mỗi trang trên web làm được gì, dành cho ai. Cài đặt thì xem các giai đoạn trong [Mục lục](README.md).

## Website giới thiệu

Website công khai ở doanhwork.com (sản phẩm, trang trại, blog, chính sách), sửa ở mục **Website** trong web quản lý. Xem [Giai đoạn 9](9-website.md).

## Các trang trên web

| Trang | Ai dùng | Chức năng |
|---|---|---|
| **Tổng quan** | Chủ shop | Đơn, doanh thu, chi quảng cáo, chi phí QC/đơn, lãi ước tính, tỷ lệ hoàn, COD chờ về; biểu đồ theo ngày; so sánh theo page |
| **Đơn hàng** | Chủ shop | Lọc, tìm, sửa đơn, báo trùng SĐT, đổi trạng thái hàng loạt, đánh dấu COD đã về, tạo đơn bằng cách dán tin nhắn |
| **Kho gửi hàng** | Kho + chủ shop | Thẻ đơn chờ gửi, nút copy từng ô sang app Viettel Post, nhập mã vận đơn và phí ship, chuyển Đã gửi / Đã giao / Hoàn, in danh sách. Bấm **Bị hoàn** phải chọn **lý do hoàn** |
| **Khách hàng** | Chủ shop | 3 tab: **Tất cả** (lịch sử mua theo SĐT, đánh dấu VIP), **Khách quen** (mua nhiều, mua thường xuyên), **Sổ đỏ** (SĐT tạo đơn ảo / phá / bom hàng, có cảnh báo khi đặt lại). Chi tiết ở mục [bên dưới](#lý-do-hoàn-sổ-đỏ-khách-quen) |
| **Thu chi** | Chủ shop | **Bảng chi quảng cáo theo ngày** (hàng = ngày, cột = page, gõ số là tự lưu, nút ⇣ chép số của ngày hôm trước), **giá vốn 1 hộp** (tính lãi), các khoản thu / chi khác (nhập hàng, ship, lương…); COD về và COD chờ về |
| **Chia đơn cho kho** | Chủ shop | Mỗi tài khoản quyền **Kho** (chủ shop tạo, đưa cho 1 bên có hàng) **chỉ thấy đơn được chia cho mình**: không thấy đơn, mã vận đơn, ghi chú của kho khác, không thấy fanpage, link chat, giá vốn. Chỉ có 1 tài khoản kho thì mọi đơn tự vào kho đó. Nhiều kho: công tắc "Đơn mới giao cho…" ở trang Đơn hàng / Cài đặt để đổi kho khi hết hàng, kèm chuyển luôn các đơn chờ gửi. Chia từng đơn / hàng loạt. Tổng quan có bảng theo kho |
| **Gửi đơn qua Zalo** | Chủ shop | Ở trang Đơn hàng: tick đơn → **Gửi Zalo kho** (web tự gửi mỗi đơn 1 tin vào nhóm kho) hoặc **Chép lần lượt** (dự phòng). Đơn đã báo kho có nhãn **Đã báo Zalo**. Chi tiết ở mục [bên dưới](#gửi-đơn-cho-kho-qua-zalo) |
| **Messenger** | Chủ shop | Tin khách nhắn vào page (webhook), nút trả lời thử, chẩn đoán mã page. Chuẩn bị cho chatbot: [docs/chatbot](chatbot/README.md) |
| **Cài đặt** | Chủ shop | Giá theo số hộp (tự điền tổng tiền ở extension / form tạo đơn), danh mục thu chi, danh sách lý do hoàn, đăng nhập Zalo phụ + chọn nhóm kho, tài khoản kho (tạo, đặt lại mật khẩu, khóa, xóa tài khoản tạo nhầm), mã API cho extension, tải bản sao lưu |

## Gửi đơn cho kho qua Zalo

Dùng khi kho không dùng web, chỉ nhận đơn qua Zalo. Mỗi đơn là **một tin riêng**, nội dung giống nút **Chép** (đổi cách ngăn cách ở Cài đặt → *Khi bấm "Chép" một đơn*).

**Cài một lần:**
1. Dùng **một số Zalo phụ**, không dùng Zalo chính đang chat với khách. Thêm Zalo phụ vào nhóm của kho.
2. Web → **Cài đặt → Gửi đơn qua Zalo** → **Đăng nhập Zalo bằng mã QR** → mở Zalo phụ trên điện thoại → quét mã → bấm **Đăng nhập**.
3. **Chọn nhóm nhận đơn** → chọn nhóm kho → **Lưu nhóm**.

**Hằng ngày:** trang **Đơn hàng** → tick các đơn → **Gửi Zalo kho**. Web gửi lần lượt, đơn cũ trước, mỗi tin cách nhau vài giây (20 đơn mất khoảng 1 phút). Gửi xong các đơn có nhãn **Đã báo Zalo**. Gửi lại đơn đã báo thì web hỏi trước.

**Không kèm danh thiếp:** Zalo thấy 10 số liền nhau là tự đính kèm danh thiếp vào tin. Cài đặt → Chép & gửi Zalo → **Số điện thoại trong tin Zalo** → chọn *Cách nhóm 0961 251 352* (hoặc *Dấu chấm 0961.251.352* nếu Zalo vẫn kèm danh thiếp) để chỉ gửi chữ. Chỉ áp dụng cho tin gửi Zalo; nút **Chép** thường vẫn giữ số liền.

**Báo kho xong thì đơn tự chuyển trạng thái** (mặc định giữ Chờ gửi): Cài đặt → Chép & gửi Zalo → **Báo kho xong thì đơn**: *Tự chuyển sang "Đã gửi"*, hoặc *Tự chuyển sang "Đã giao"* (kho làm thủ công, không cập nhật web; đơn tính vào COD chờ về ngay). Áp dụng cho cả 3 cách gửi bên dưới; đơn được ghi giờ gửi / giờ giao và lịch sử như khi bấm tay. Đơn không còn ở Chờ gửi (vd đã Hủy) thì không bị đổi.

**Gửi trên Zalo Web bằng extension** (không cần Zalo phụ, dùng Zalo đang đăng nhập ở trình duyệt). Cần extension **2.7.0** trở lên, tải ở Cài đặt → Extension & bảo mật.
1. Mở https://chat.zalo.me, bấm vào **nhóm kho**.
2. Bấm **icon extension** trên thanh Chrome → bảng bên cạnh, tab **Gửi Zalo** (đang ở Zalo Web thì tự mở tab này; sang Facebook tự về tab **Bắt đơn**): hiện các đơn **Chờ gửi chưa báo Zalo** trong 7 ngày gần nhất, đơn cũ trước, tick sẵn hết. Bỏ tick đơn nào không muốn gửi.
3. Lần đầu: gõ tên nhóm kho vào ô **Nhóm kho** (chỉ cần một phần tên). Từ đó extension tự kiểm tra, mở nhầm chat khác thì không gửi.
4. Bấm **Gửi N đơn vào chat đang mở**. Extension gõ từng đơn vào ô chat, nhấn gửi, chờ ngẫu nhiên theo khoảng giãn cách ở Cài đặt, rồi sang đơn tiếp. Gửi xong đơn nào, web đánh dấu **Đã báo Zalo** đơn đó ngay, nên bấm **Dừng** giữa chừng không bị gửi lặp.
5. Bảng bên cạnh tự đưa tab Zalo lên trước khi gửi; trong lúc gửi đừng gõ vào ô chat Zalo. Ô chat đang có chữ gõ dở thì extension không gửi, để không gửi lẫn.

Lần đầu nên chỉ tick **1 đơn** để thử. Zalo đổi giao diện mà extension không gõ / bấm gửi được thì bảng báo lỗi và dừng: gửi tay đơn đó, bấm **Chép thông tin lỗi** rồi gửi cho người sửa.

**Khi không tự gửi được** (Zalo phụ bị khóa, phiên hết hạn, Zalo đổi hệ thống): dùng **Chép lần lượt**.
- Máy tính: web chép sẵn đơn 1 → sang Zalo **Ctrl+V**, **Enter** → quay lại web (Alt+Tab) là đơn 2 đã được chép sẵn, cứ thế đến hết.
- Điện thoại: bấm **Chia sẻ** → Zalo → chọn nhóm kho → Gửi, rồi quay lại web bấm tiếp.

Gửi tự động hỏng giữa chừng thì web báo đã gửi được bao nhiêu đơn và có nút **Chép lần lượt** phần còn lại.

> Gửi tự động dùng thư viện **không chính thức** (zca-js), Zalo có thể khóa tài khoản phụ bất cứ lúc nào. Phiên đăng nhập lưu ở `data/zalo-session.json` trên server, không nằm trong database và bản sao lưu: mất thì quét QR lại. **Đăng xuất Zalo** trong Cài đặt sẽ xóa phiên này.

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
