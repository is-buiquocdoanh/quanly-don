# Bước 3. Đăng ký sự kiện cho đúng Trang

> **Kết quả cần có:** nhắn vào Trang thì web hiện dòng **Khách nhắn**, và bấm **Trả lời thử** thì Messenger nhận được tin.

Phải bật ở **hai chỗ** (3.1 và 3.2). Thiếu chỗ nào là webhook im lặng.

## 3.1. Bật sự kiện cho app

Ngay dưới ô URL webhook (Bước 2.3) có danh sách **trường**. Bật **Đăng ký** cho:

- `messages`: khách gửi tin.
- `messaging_postbacks`: khách bấm nút (nút "Bắt đầu", nút trong tin).

## 3.2. Đăng ký webhook cho Trang

**Cài đặt API Messenger → 2. Tạo mã truy cập** → dòng của Trang → **Thêm đăng ký** (hoặc *Thêm gói đăng ký*) → tick:

- `messages`
- `messaging_postbacks`
- `message_echoes` (không bắt buộc: để web thấy cả tin nhân viên trả lời, sau này bot biết khi nào người thật đã vào trả lời)

→ **Confirm**.

Kiểm tra lại: web → mục **Messenger** → **Kiểm tra page đăng ký nhận tin**. Phải thấy app của bạn kèm các trường vừa tick. Nút này báo lỗi `#200 ... pages_manage_metadata` thì bỏ qua được (xem bảng lỗi ở [Giai đoạn 8](../8-messenger.md#gặp-lỗi-thì-xem-ở-đây)).

> Trang đang nối với **Pancake / Botcake / ManyChat**: app kia giữ quyền trả lời chính, app của bạn chỉ nhận tin dạng *standby*. Gỡ app kia trước, cách gỡ ở [Giai đoạn 8](../8-messenger.md#gỡ-pancake-hoặc-công-cụ-inbox-cũ-khỏi-page).

## 3.3. Thử với chính bạn

Dùng tài khoản Facebook **có vai trò trong app** (admin) nhắn vào Trang → web → mục **Messenger** → **Tải lại**:

- Thấy dòng **Khách nhắn** kèm nội dung → chiều nhận chạy.
- Bấm **Trả lời thử** → Messenger của bạn nhận tin → chiều gửi chạy.

## 3.4. Khách thật có nhận được không

Nhờ một người **không có vai trò gì trong app** (người nhà, bạn bè) nhắn vào Trang rồi **Tải lại**:

| Thấy gì | Làm gì |
|---|---|
| Thấy tin, **Trả lời thử** tới được họ | Xong, sang Bước 4 |
| Thấy tin, **Trả lời thử** báo lỗi quyền | Cần quyền nâng cao (*Advanced access*) cho `pages_messaging` |
| **Không thấy tin** (tin của bạn ở 3.3 vẫn hiện) | App đang ở chế độ *Phát triển*: chỉ người có vai trò mới được nhận. Chuyển app sang **Chính thức** |

Khi chuyển sang **Chính thức**, Meta hỏi 2 link (web đã có sẵn):
- **URL chính sách quyền riêng tư**: `https://don.doanhwork.com/privacy.html`
- **URL hướng dẫn xóa dữ liệu**: `https://don.doanhwork.com/privacy.html#xoa-du-lieu`

Chuyển rồi mà vẫn không thấy tin khách thật → **Xét duyệt ứng dụng → Quyền và tính năng** → xin *Advanced access* cho `pages_messaging`. Lúc này Meta mới đòi **xác minh doanh nghiệp** (hộ kinh doanh dùng được) và video quay màn hình chatbot đang chạy. Nên làm Bước 4 trước để có cái mà quay.

---

← [Bước 2: Cài webhook](2-cai-webhook.md) · [Bước 4: Trả lời bằng Claude](4-tra-loi-bang-claude.md) →
