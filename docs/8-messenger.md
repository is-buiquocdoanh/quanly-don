# Giai đoạn 8. Messenger: kiểm tra trước khi làm chatbot

> **Mục tiêu:** biết chắc app Meta **trungsau_canxi** có **nhận** được tin của khách thật và **trả lời** được họ không, khi quyền `pages_messaging` mới ở mức *Standard access*.  
> **Làm khi nào:** trước khi làm chatbot tự trả lời.  
> **Thời gian:** khoảng 20 phút.

> **Hướng dẫn từng bước mới (gọn hơn, theo thứ tự làm):** [chatbot/](chatbot/README.md). File này giữ lại làm nhật ký và bảng lỗi đã gặp.

Web có sẵn một địa chỉ webhook **bản thử nghiệm**: chỉ lưu tin nhắn Meta gửi tới và cho bấm gửi **1 tin trả lời thử bằng tay**. Chưa có AI, chưa tự trả lời ai.

## 1. Lấy 3 mã từ Meta

Vào https://developers.facebook.com → **Ứng dụng của tôi** → **trungsau_canxi**.

| Mã | Lấy ở đâu |
|---|---|
| `META_VERIFY_TOKEN` | Tự đặt một chuỗi khó đoán (chữ + số, khoảng 20–30 ký tự) |
| `META_APP_SECRET` | **Cài đặt ứng dụng → Thông tin cơ bản → Khóa bí mật của ứng dụng** → Hiển thị |
| `META_PAGE_TOKEN` | **Messenger → Cài đặt API Messenger** → mục *Mã truy cập*: chọn page → **Tạo mã** |

Vào web → mục **Messenger** → **Nhập / đổi mã Meta** → dán 3 mã → **Lưu mã**. Có hiệu lực ngay, không cần SSH hay khởi động lại. 3 mã phải hiện dấu ✓. Mã chỉ nhập trên web, không đặt trong `.env`.

> Ba mã này là bí mật: không gửi qua chat, không chụp màn hình gửi đi.

## 2. Nối webhook với web

1. Meta → **Webhooks** → chọn **Page** ở cột trái.
2. **URL gọi lại**: `https://don.doanhwork.com/api/meta/webhook` (copy ở mục **Messenger** của web).
3. **Xác minh mã**: dán đúng `META_VERIFY_TOKEN` → **Xác minh và lưu**. Báo lỗi thì xem lại bước 1 (đã bấm **Lưu mã** chưa).
4. Kéo xuống danh sách trường, tìm **messages** → bật **Đăng ký**.
5. **Messenger → Cài đặt API Messenger** → mục *Webhooks*: ở dòng page, bấm **Thêm gói đăng ký** và tick **messages**.

## 3. Thử với chính bạn

Dùng tài khoản Facebook của bạn (admin của app) nhắn vào page. Vào web → mục **Messenger** → **Tải lại**: phải thấy dòng *Khách nhắn* với nội dung vừa gửi. Bấm **Trả lời thử**, Messenger của bạn nhận được tin là chiều gửi cũng chạy.

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

## Gặp lỗi thì xem ở đây

Những lỗi đã gặp thật khi cài cho page của shop (24/11/2026):

| Hiện tượng | Nguyên nhân | Cách sửa |
|---|---|---|
| Meta báo *"Không thể xác thực URL gọi lại hoặc mã xác minh"* | `META_VERIFY_TOKEN` trên server khác chuỗi dán ở Meta | Web → Messenger → **Nhập / đổi mã Meta**: dán lại đúng chuỗi đó vào ô `META_VERIFY_TOKEN` → Lưu mã, rồi bấm Xác minh lại ở Meta |
| Bấm **Thử nghiệm** thì web hiện *Tin mẫu*, nhưng nhắn thật vào page thì không thấy gì | Page **chưa đăng ký** nhận tin cho app, hoặc page đang bị **app khác giữ quyền chính** (ở shop này là **Pancake** dùng trước đây) | Gỡ Pancake (xem bên dưới), rồi Meta → Messenger → Cài đặt API Messenger → **2. Tạo mã truy cập** → dòng page → **Thêm đăng ký** → tick `messages`, `messaging_postbacks`, `message_echoes` → **Confirm** |
| Web hiện dòng **⚠ Bị từ chối** | `META_APP_SECRET` sai | Copy lại *Khóa bí mật của ứng dụng* (Cài đặt ứng dụng → Thông tin cơ bản) vào ô `META_APP_SECRET` trên web (Messenger → Nhập / đổi mã Meta) → Lưu mã |
| Web hiện **Khách nhắn (standby)** | Một app khác (Pancake, Botcake, ManyChat…) đang là **ứng dụng nhận tin chính** của page; app này chỉ được xem | Gỡ app kia, hoặc Business Suite → Cài đặt → Hộp thư / Nhắn tin nâng cao → *Ứng dụng nhận tin chính* = **trungsau_canxi** |
| **Trả lời thử** báo *(#100) Không tìm thấy người dùng phù hợp (2018001)* | Mã người nhắn là **theo từng page**: người đó nhắn vào page A, còn `META_PAGE_TOKEN` là mã của page B | Thẻ Messenger có cột **Page** và dòng *"Mã page đang dùng là của…"*: đặt `META_PAGE_TOKEN` của đúng page có tin |
| Nút **Kiểm tra page đăng ký nhận tin** báo *(#200) Requires pages_manage_metadata* | Mã page thiếu quyền `pages_manage_metadata` | Xét duyệt ứng dụng → Quyền và tính năng → thêm `pages_manage_metadata` (Standard access) → **tạo lại** mã page → thay `META_PAGE_TOKEN`. Nút này chỉ để tiện kiểm tra, không bắt buộc |
| Deploy xong mà web vẫn giao diện cũ | Cloudflare cho trình duyệt giữ file .js/.css 4 giờ | Từ bản v1.2.1 web tự chống cache. Bản cũ hơn: Ctrl+F5 |

### Gỡ Pancake (hoặc công cụ inbox cũ) khỏi page

Mục **Tích hợp doanh nghiệp** chỉ hiện khi mở bằng **tài khoản Facebook cá nhân đang quản lý các page**, không hiện khi đang chuyển sang chế độ page:

```
https://www.facebook.com/settings/?tab=business_tools
```

Tìm **Pancake** (và **Botcake** nếu có) → **Gỡ**. Ngắt luôn page bên trong Pancake (trang chủ Pancake → page → Cài đặt → hủy kết nối / xóa trang) cho sạch. Gỡ xong nhắn thử lại vào page rồi bấm **Tải lại** trên web.

> Nếu nhân viên còn trả lời khách bằng Pancake thì đừng gỡ: chỉ một app được quyền trả lời chính, chatbot và Pancake phải chia việc.

## Ghi chú

- Meta chỉ cho trả lời trong **24 giờ** kể từ tin cuối của khách, nên bấm *Trả lời thử* sớm.
- Web chỉ giữ 500 sự kiện gần nhất; thẻ Messenger hiện 50 tin mới nhất.
- Mỗi request từ Meta được kiểm tra chữ ký bằng `META_APP_SECRET`; request giả mạo bị từ chối.
- Webhook cũ của n8n (`…ngrok-free.dev/…`) đã xóa, nên đổi sang URL mới không ảnh hưởng gì.

---

← [Giai đoạn 7: Vận hành hằng ngày và xử lý sự cố](7-van-hanh-su-co.md) · [Mục lục](README.md) · [Giai đoạn 9: Website](9-website.md) →
