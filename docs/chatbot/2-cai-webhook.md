# Bước 2. Cài webhook

> **Kết quả cần có:** Meta báo đã lưu webhook, và web ghi dòng *"Meta xác minh URL webhook: thành công"*.

## 2.1. Hai điều kiện của Meta

| Điều kiện | Ở shop |
|---|---|
| URL phải là **https** | Đã đạt: `https://don.doanhwork.com` có chứng chỉ của Cloudflare |
| **Mã xác minh** ở Meta giống hệt mã trên server | Do bạn dán, xem 2.3 |

## 2.2. Thử URL trước khi dán vào Meta

Trên server chạy lệnh sau. Lệnh tự đọc mã xác minh trong container, không cần gõ mã:
```bash
curl -s "https://don.doanhwork.com/api/meta/webhook?hub.mode=subscribe&hub.challenge=12345&hub.verify_token=$(docker exec quanly-don printenv META_VERIFY_TOKEN)"; echo
```

| Kết quả | Nghĩa là |
|---|---|
| `12345` | URL và mã đều đúng, sang 2.3 |
| `Sai mã xác minh` | Mã trong container khác `.env`: chạy lại `docker compose up -d` |
| `Server chưa đặt META_VERIFY_TOKEN` | Chưa thêm mã vào `.env` (Bước 1.5) |
| Lỗi kết nối / trang lỗi Cloudflare | Web hoặc Tunnel đang tắt: xem [Giai đoạn 7](../7-van-hanh-su-co.md) |

## 2.3. Dán vào Meta

1. App → **Cài đặt API Messenger** → **1. Định cấu hình webhooks** (app cũ: menu trái **Webhooks** → chọn **Page**).
2. **URL gọi lại**: `https://don.doanhwork.com/api/meta/webhook` (copy ở mục **Messenger** của web cho khỏi gõ sai).
3. **Xác minh mã**: dán đúng `META_VERIFY_TOKEN`.
4. Bấm **Xác minh và lưu**.

Thành công thì web → mục **Messenger** → **Tải lại** hiện dòng *Meta xác minh URL webhook: thành công*.

Meta báo *"Không thể xác thực URL gọi lại hoặc mã xác minh"* → làm lại 2.2. Nếu 2.2 ra `12345` mà Meta vẫn báo lỗi thì chuỗi dán vào Meta bị thừa dấu cách hoặc thiếu ký tự: copy lại.

---

← [Bước 1: Tạo app, lấy mã](1-tao-app-lay-ma.md) · [Bước 3: Đăng ký sự kiện](3-dang-ky-su-kien.md) →
