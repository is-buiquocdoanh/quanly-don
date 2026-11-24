# Bước 5. Webhook im lặng: kiểm tra theo thứ tự

Nhắn vào Trang mà web → **Cài đặt → Messenger** → **Tải lại** không thấy gì thì kiểm tra **lần lượt từ trên xuống**, dừng ở mục đầu tiên bị sai.

## 5.1. Meta có gọi tới server không?

Thẻ Messenger trên web ghi lại **mọi lần Meta gọi tới**, kể cả lần bị từ chối. Đây chính là "log webhook" để xem. Nhìn dòng mới nhất:

| Web hiện | Nghĩa là | Làm gì |
|---|---|---|
| **Không có dòng nào mới** | Meta không gọi tới server | Sang 5.2 |
| **⚠ Bị từ chối** | Meta có gọi, nhưng chữ ký sai: `META_APP_SECRET` không phải của app này | Lấy lại khóa bí mật ([Bước 1.3](1-tao-app-lay-ma.md#13-lấy-3-mã)), `docker compose up -d` |
| **Khách nhắn (standby)** | Meta có gọi, nhưng app khác (Pancake…) đang giữ quyền trả lời | Gỡ app kia ([Giai đoạn 8](../8-messenger.md#gỡ-pancake-hoặc-công-cụ-inbox-cũ-khỏi-page)) |
| **Khách nhắn** | Chiều nhận chạy đúng | Nếu lỗi ở lúc trả lời: sang 5.4 |

Mẹo: bấm **Thử nghiệm** cạnh trường `messages` ở trang Webhooks của Meta. Web hiện **Tin mẫu** nghĩa là URL và khóa bí mật đều đúng, lỗi chỉ còn ở chỗ đăng ký Trang (5.3).

## 5.2. URL có trả về đúng không?

Chạy lệnh ở [Bước 2.2](2-cai-webhook.md#22-thử-url-trước-khi-dán-vào-meta). Phải ra `12345`.

Xem thêm ở Meta: ô **URL gọi lại** đúng là `https://don.doanhwork.com/api/meta/webhook`, không còn link n8n hay ngrok cũ.

## 5.3. Đã đăng ký đúng Trang và đúng sự kiện chưa?

- Trường `messages` đã bật **Đăng ký** ([Bước 3.1](3-dang-ky-su-kien.md#31-bật-sự-kiện-cho-app)).
- Trang đã **Thêm đăng ký** với `messages` ([Bước 3.2](3-dang-ky-su-kien.md#32-đăng-ký-webhook-cho-trang)). Hay sai nhất: đăng ký cho Trang A nhưng nhắn thử vào Trang B.
- Người nhắn thử **có vai trò trong app**, hoặc app đã chuyển **Chính thức** ([Bước 3.4](3-dang-ky-su-kien.md#34-khách-thật-có-nhận-được-không)).

## 5.4. Mã Trang có đúng không?

Dán `META_PAGE_TOKEN` vào https://developers.facebook.com/tools/debug/accesstoken/ và đối chiếu như [Bước 1.4](1-tao-app-lay-ma.md#14-kiểm-tra-mã-trang-1-phút):

| Thấy | Sửa |
|---|---|
| App ID là app khác | Tạo lại mã Trang trong đúng app đang nhận webhook |
| Trang khác Trang khách nhắn vào | Tạo mã cho đúng Trang. Lỗi trả lời `#100 (2018001)` là do chỗ này |
| Mã hết hạn / không hợp lệ | Tạo mã mới, thay vào `.env`, `docker compose up -d` |
| Thiếu `pages_messaging` | Tạo lại mã, bật đủ quyền trong cửa sổ hỏi quyền |

## Vẫn kẹt?

Gửi mình **ảnh chụp thẻ Messenger trên web** (che các mã nếu có) và cho biết đang kẹt ở mục nào (5.1–5.4). Bảng đầy đủ các lỗi đã gặp: [Giai đoạn 8](../8-messenger.md#gặp-lỗi-thì-xem-ở-đây).

---

← [Bước 4: Trả lời bằng Claude](4-tra-loi-bang-claude.md) · [Tổng quan](README.md)
