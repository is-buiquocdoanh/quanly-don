# Chạy quảng cáo chuyển đổi cho website (khách đặt hàng trên doanhwork.com)

Mục tiêu: chạy quảng cáo Facebook để khách **đặt hàng ngay trên website**. Facebook cần biết lúc nào có đơn, để tự tìm thêm người giống người đã mua. Muốn vậy phải gắn **Meta Pixel** và (nên có) **Conversions API** vào website.

Web quản lý đơn đã làm sẵn phần kỹ thuật. Bạn chỉ cần lấy 2 mã trên Facebook rồi dán vào, theo các bước dưới đây.

---

## Bước 1. Tạo Pixel (Facebook gọi là "Tập dữ liệu")

1. Vào **business.facebook.com**, mở **Trình quản lý sự kiện** (Events Manager).
2. Bấm **Kết nối nguồn dữ liệu** (dấu +), chọn **Web**, đặt tên, ví dụ `Website trứng sâu`, rồi bấm **Tạo**.
3. Nếu Facebook hỏi cách cài, chọn **Tự cài đặt mã** hoặc bỏ qua. Không cần chép đoạn mã nào, web đã có sẵn.
4. Chép **ID tập dữ liệu / Pixel ID**. Đây là dãy 15–16 chữ số.

## Bước 2. Dán Pixel ID vào web quản lý đơn

**Website → Truy cập & quảng cáo**, kéo xuống ô **Quảng cáo chuyển đổi** → dán vào ô **Pixel ID** → **Lưu**.

Từ lúc này mọi trang của website gửi cho Facebook các sự kiện sau:

| Sự kiện | Khi nào |
|---|---|
| PageView | Khách mở bất kỳ trang nào |
| ViewContent | Khách mở trang có form đặt hàng |
| InitiateCheckout (Bắt đầu thanh toán) | Khách bắt đầu gõ vào form đặt hàng |
| Contact (Liên hệ) | Khách bấm Gọi / Zalo / Messenger |
| **Purchase (Mua hàng)** | Khách đặt hàng thành công, kèm số tiền đơn (VND) |

## Bước 3. Bật Conversions API (nên làm)

Pixel chạy trên trình duyệt nên dễ bị mất: iPhone chặn theo dõi, trình duyệt có chặn quảng cáo… Conversions API cho **máy chủ của bạn báo đơn thẳng cho Facebook**, nên Facebook nhận đủ đơn hơn. Facebook tự gộp 2 nguồn (cùng mã đơn), không đếm đôi.

1. Trình quản lý sự kiện → chọn Pixel vừa tạo → tab **Cài đặt**.
2. Tìm mục **Conversions API** → **Tạo mã truy cập** → chép mã (chuỗi rất dài).
3. Dán vào ô **Mã truy cập Conversions API** trên web → **Lưu**. Mã được giữ kín, không hiện trên website.

Máy chủ chỉ gửi cho Facebook: số tiền, số hũ, và **số điện thoại đã mã hóa một chiều** (Facebook dùng để khớp với tài khoản Facebook của khách, không đọc được số gốc). Không gửi tên, địa chỉ.

## Bước 4. Kiểm tra đã chạy chưa

1. Trình quản lý sự kiện → Pixel → tab **Kiểm tra sự kiện** (Test events) → chép **mã kiểm tra** (dạng `TEST12345`).
2. Dán vào ô **Mã thử sự kiện** trên web → **Lưu**.
3. Mở **doanhwork.com/dat-hang** trên điện thoại, đặt thử 1 đơn.
4. Trong tab Kiểm tra sự kiện phải thấy: PageView, ViewContent, InitiateCheckout, **Purchase** (cả "Trình duyệt" và "Máy chủ", ghi "Đã loại bỏ trùng lặp" là đúng).
5. Ở web quản lý, mục "Lần gửi gần nhất" phải ghi **✓ Facebook đã nhận**. Nếu ghi lỗi, đọc nội dung lỗi (thường là chép thiếu mã).
6. **Xóa mã thử** rồi Lưu. Nếu không xóa, đơn gửi từ máy chủ chỉ hiện trong mục Kiểm tra, không được tính cho quảng cáo. Sau đó hủy đơn thử trong trang Đơn hàng.

## Bước 5. Xác minh tên miền (1 lần)

Cài đặt doanh nghiệp (Business settings) → **An toàn thương hiệu → Tên miền** → **Thêm** `doanhwork.com` → chọn cách **Cập nhật bản ghi DNS TXT** → chép dòng TXT → vào Cloudflare → DNS của doanhwork.com → **Add record** loại TXT, Name `@`, dán nội dung → Save → quay lại Facebook bấm **Xác minh** (có thể phải đợi vài phút).

## Bước 6. Tạo chiến dịch

1. Trình quản lý quảng cáo → **Tạo** → mục tiêu **Doanh số** (Sales).
2. Nhóm quảng cáo:
   - **Vị trí chuyển đổi: Trang web**, chọn Pixel vừa tạo, **sự kiện chuyển đổi: Mua hàng** (Purchase).
   - Lúc mới chạy, website chưa có đơn nào thì Facebook học chậm. Nếu 1–2 tuần mà mỗi tuần chưa được khoảng 10–20 đơn từ web, có thể tạm chọn sự kiện **Bắt đầu thanh toán** (nhiều hơn, Facebook học nhanh hơn), sau đó đổi lại **Mua hàng**.
3. Quảng cáo:
   - **Link đích**: `https://doanhwork.com/dat-hang` (nút Chép có sẵn trên web).
   - **Tham số URL** (URL parameters, nằm dưới ô link): dán dòng có sẵn trên web:
     `utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}`
     Nhờ dòng này, trang **Truy cập** biết khách nào đến từ quảng cáo nào, chiến dịch nào ra đơn.
   - Nút kêu gọi: **Mua ngay** hoặc **Đặt hàng**.

## Xem kết quả

- **Trình quản lý quảng cáo**: số "Lượt mua trên trang web", chi phí mỗi lượt mua, ROAS (doanh thu ÷ tiền quảng cáo). Đơn có giá trị VND nên ROAS tính được.
- **Web quản lý → Website → Truy cập & quảng cáo**: khách truy cập, thiết bị, nguồn, chiến dịch, phễu (vào web → thấy form → điền form → đặt xong), giờ truy cập, 40 lượt gần nhất.
- **Đơn hàng**: lọc page **Website** để thấy đơn từ web, và có bao nhiêu đơn bị hoàn.

Lưu ý: Facebook tính "Mua hàng" ngay lúc khách đặt. Đơn COD bị hoàn sau đó Facebook vẫn tính là đã mua. Vì vậy số thật nên xem ở trang Tổng quan / Thu chi của web quản lý.

## Quyền riêng tư

Trang **Chính sách bảo mật** mặc định đã có đoạn "Thống kê truy cập và quảng cáo". Nếu trước đây bạn đã sửa trang chính sách này, vào Website → Chính sách → Chính sách bảo mật và tự thêm đoạn nói website dùng Meta Pixel để đo quảng cáo.
