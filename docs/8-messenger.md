# Giai đoạn 8. Messenger: kiểm tra trước khi làm chatbot

> **Mục tiêu:** biết chắc app Meta **trungsau_canxi** có **nhận** được tin của khách thật và **trả lời** được họ không, khi quyền `pages_messaging` mới ở mức *Standard access*.  
> **Làm khi nào:** trước khi làm chatbot tự trả lời.  
> **Thời gian:** khoảng 20 phút.

Web có sẵn một địa chỉ webhook **bản thử nghiệm**: chỉ lưu tin nhắn Meta gửi tới và cho bấm gửi **1 tin trả lời thử bằng tay**. Chưa có AI, chưa tự trả lời ai.

## 1. Lấy 3 mã từ Meta

Vào https://developers.facebook.com → **Ứng dụng của tôi** → **trungsau_canxi**.

| Mã | Lấy ở đâu |
|---|---|
| `META_VERIFY_TOKEN` | Tự đặt một chuỗi khó đoán, ví dụ chạy `openssl rand -hex 16` trên server |
| `META_APP_SECRET` | **Cài đặt ứng dụng → Thông tin cơ bản → Khóa bí mật của ứng dụng** → Hiển thị |
| `META_PAGE_TOKEN` | **Messenger → Cài đặt API Messenger** → mục *Mã truy cập*: chọn page → **Tạo mã** |

Thêm vào `~/apps/quanly-don/.env` trên server rồi khởi động lại web:
```bash
cd ~/apps/quanly-don
nano .env                      # thêm 3 dòng META_VERIFY_TOKEN=…, META_APP_SECRET=…, META_PAGE_TOKEN=…
docker compose up -d           # nạp lại .env
```
Vào web → **Cài đặt → Messenger (thử nghiệm)**: 3 mã phải hiện dấu ✓.

> Ba mã này là bí mật: không gửi qua chat, không đưa lên GitHub (`.env` đã được git bỏ qua).

## 2. Nối webhook với web

1. Meta → **Webhooks** → chọn **Page** ở cột trái.
2. **URL gọi lại**: `https://don.doanhwork.com/api/meta/webhook` (copy ở thẻ Messenger trong Cài đặt).
3. **Xác minh mã**: dán đúng `META_VERIFY_TOKEN` → **Xác minh và lưu**. Báo lỗi thì xem lại bước 1 (đã `docker compose up -d` chưa).
4. Kéo xuống danh sách trường, tìm **messages** → bật **Đăng ký**.
5. **Messenger → Cài đặt API Messenger** → mục *Webhooks*: ở dòng page, bấm **Thêm gói đăng ký** và tick **messages**.

## 3. Thử với chính bạn

Dùng tài khoản Facebook của bạn (admin của app) nhắn vào page. Vào web → **Cài đặt → Messenger** → **Tải lại**: phải thấy dòng *Khách nhắn* với nội dung vừa gửi. Bấm **Trả lời thử**, Messenger của bạn nhận được tin là chiều gửi cũng chạy.

## 4. Thử với khách thật (bước quyết định)

1. Nhờ một người **không có vai trò gì trong app** (người nhà, bạn bè) nhắn vào page.
2. **Tải lại** thẻ Messenger:
   - **Thấy tin của họ** → app nhận được tin khách thật. Bấm **Trả lời thử**:
     - Họ nhận được → **làm được chatbot ngay**, không cần xin Meta duyệt.
     - Báo lỗi → chụp lỗi gửi lại (thường là thiếu quyền, cần *Advanced access*).
   - **Không thấy gì** (trong khi tin của bạn ở bước 3 vẫn hiện) → app chỉ làm việc với người có vai trò. Thử chuyển app sang **Chính thức** (nút gạt cạnh *Chế độ ứng dụng* ở đầu trang Meta) rồi thử lại. Meta sẽ hỏi:
     - **URL chính sách quyền riêng tư**: `https://don.doanhwork.com/privacy.html`
     - **URL hướng dẫn xóa dữ liệu**: `https://don.doanhwork.com/privacy.html#xoa-du-lieu`

   Vẫn không thấy → cần xin quyền *Advanced access* cho `pages_messaging` (Xét duyệt ứng dụng → Quyền và tính năng).

## Ghi chú

- Meta chỉ cho trả lời trong **24 giờ** kể từ tin cuối của khách, nên bấm *Trả lời thử* sớm.
- Web chỉ giữ 500 sự kiện gần nhất; thẻ Messenger hiện 50 tin mới nhất.
- Mỗi request từ Meta được kiểm tra chữ ký bằng `META_APP_SECRET`; request giả mạo bị từ chối.
- Webhook cũ của n8n (`…ngrok-free.dev/…`) đã xóa, nên đổi sang URL mới không ảnh hưởng gì.

---

← [Giai đoạn 7: Vận hành hằng ngày và xử lý sự cố](7-van-hanh-su-co.md) · [Mục lục](README.md)
