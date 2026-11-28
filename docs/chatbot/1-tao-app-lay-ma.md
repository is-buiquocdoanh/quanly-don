# Bước 1. Tạo app, thêm Messenger, lấy mã Trang

> **Kết quả cần có:** 3 mã `META_VERIFY_TOKEN`, `META_APP_SECRET`, `META_PAGE_TOKEN` (cùng một app) đã nhập trên web (mục Messenger), và web hiện 3 dấu ✓.

## 1.1. Chọn app

Vào https://developers.facebook.com → **Ứng dụng của tôi**.

- **Đã có app `trungsau_canxi`** → dùng app này, bỏ qua 1.2.
- Chưa có app nào → làm 1.2.

> App mới tạo có giao diện khác app cũ (Meta chia theo *trường hợp sử dụng*). Tên nút khác nhưng các mục bên dưới đều có, chỉ nằm ở chỗ khác.

## 1.2. Tạo app mới (chỉ khi chưa có)

1. **Tạo ứng dụng** → đặt tên → chọn trường hợp sử dụng **Tương tác với khách hàng trên Messenger from Meta**.
2. Chọn Business portfolio của shop (nếu có) → **Tạo ứng dụng**.
3. Vào trường hợp sử dụng vừa chọn → **Tùy chỉnh**: đây là nơi có *Cài đặt API Messenger* (webhook, mã truy cập).

App cũ (giao diện cũ): **Thêm sản phẩm** → **Messenger** → **Thiết lập**.

## 1.3. Lấy 3 mã

| Mã | Lấy ở đâu | Dùng để |
|---|---|---|
| `META_VERIFY_TOKEN` | **Tự đặt**. Một chuỗi chữ + số khó đoán, khoảng 20–30 ký tự | Dán lại ở Bước 2 |
| `META_APP_SECRET` | **Cài đặt ứng dụng → Thông tin cơ bản → Khóa bí mật của ứng dụng** → *Hiển thị* | Web kiểm tra tin đến đúng là của Meta |
| `META_PAGE_TOKEN` | **Cài đặt API Messenger → 2. Tạo mã truy cập** → kết nối Trang → dòng của Trang → **Tạo mã** | Gửi tin trả lời (*Page access token*) |

Khi bấm **Tạo mã**, Facebook mở cửa sổ hỏi quyền: chọn **đúng Trang** muốn chạy chatbot và bật hết quyền được hỏi.

> Shop có 4 Trang nhưng hiện web chỉ giữ **một mã Trang**. Chọn Trang đông khách nhất để thử trước.

## 1.4. Kiểm tra mã Trang (1 phút)

Dán mã vào https://developers.facebook.com/tools/debug/accesstoken/ → **Gỡ lỗi**. Phải thấy:

- **App ID** = app đang dùng (không phải app khác).
- **Loại** = `Page`, đúng tên/ID Trang đã chọn.
- **Phạm vi** có `pages_messaging`.
- **Hết hạn** = *Không bao giờ* là tốt nhất. Nếu có ngày hết hạn, ghi lại để tạo mã mới trước ngày đó.

## 1.5. Nhập mã trên web

Vào web → mục **Messenger** → **Nhập / đổi mã Meta** → dán 3 mã → **Lưu mã**. Có hiệu lực ngay, không cần SSH hay khởi động lại. Mỗi ô để trống khi lưu thì giữ nguyên mã đang dùng.

Sau khi lưu, trong thẻ Messenger:
- 3 mã hiện **✓**.
- Dòng *"Mã page đang dùng là của…"* hiện đúng tên Trang. Nếu báo **khóa bí mật không khớp app** thì `META_APP_SECRET` và `META_PAGE_TOKEN` đang thuộc 2 app khác nhau: lấy lại cả hai từ cùng một app.

> Các mã này là bí mật: không gửi qua chat, không chụp màn hình gửi đi, web chỉ hiện 4 ký tự cuối của mỗi mã.

---

← [Tổng quan](README.md) · [Bước 2: Cài webhook](2-cai-webhook.md) →
