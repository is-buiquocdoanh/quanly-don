# Quản lý đơn trứng sâu canxi

Bôi đen tin nhắn chốt đơn trong **Meta Business Suite**, bấm **Ctrl+C** là đơn được lưu. Kho gửi hàng Viettel Post trên điện thoại. Chủ shop xem doanh thu, chi quảng cáo, lãi, COD và tỷ lệ hoàn.

```
extension/     Chrome extension: bắt đơn bằng Ctrl+C trên Business Suite
server/        Web quản lý (Node 24 + SQLite, chạy bằng Docker)
apps-script/   Bản cũ: lưu đơn vào Google Sheets (không cần nếu đã chạy web)
test/          node test/parser.test.js — kiểm tra bộ tách thông tin đơn
PROGRESS.md    Nhật ký tiến độ, đọc trước khi làm tiếp
DEPLOY.md      Hướng dẫn đưa web lên server Ubuntu + tên miền
```

## Web quản lý có gì

| Trang | Ai dùng | Chức năng |
|---|---|---|
| **Tổng quan** | Chủ shop | Đơn, doanh thu, chi quảng cáo, chi phí QC/đơn, lãi ước tính, tỷ lệ hoàn, COD chờ về; biểu đồ theo ngày; so sánh theo page |
| **Đơn hàng** | Chủ shop | Lọc, tìm, sửa đơn, báo trùng SĐT, đổi trạng thái hàng loạt, đánh dấu COD đã về, tạo đơn bằng cách dán tin nhắn |
| **Kho gửi hàng** | Kho + chủ shop | Thẻ đơn chờ gửi, nút copy từng ô sang app Viettel Post, nhập mã vận đơn và phí ship, chuyển Đã gửi / Đã giao / Hoàn, in danh sách |
| **Khách hàng** | Chủ shop | Lịch sử mua theo SĐT, đánh dấu VIP / **bom hàng** (cảnh báo khi khách đặt lại) |
| **Thu chi** | Chủ shop | Chi quảng cáo theo page, nhập hàng, ship, lương…; COD về và COD chờ về |
| **Cài đặt** | Chủ shop | Giá vốn, danh mục thu chi, tài khoản kho, mã API cho extension, tải bản sao lưu |

## Chạy thử trên máy tính (không cần Docker)

Cần Node.js 22.13 trở lên.

```bash
cd server
ADMIN_PASSWORD=123456 npm start     # mở http://localhost:3000, đăng nhập admin / 123456
npm test                            # chạy test API
```

Trên Windows PowerShell: `$env:ADMIN_PASSWORD='123456'; npm start`

Dữ liệu chạy thử nằm ở `server/data/`. Xóa thư mục này là làm lại từ đầu.

## Đưa lên server

Xem **[DEPLOY.md](DEPLOY.md)**.

## Cài extension

1. Mở `chrome://extensions` và bật **Chế độ dành cho nhà phát triển**.
2. Bấm **Tải tiện ích đã giải nén** và chọn thư mục `extension`.
3. Vào **Tùy chọn** của extension: nhập địa chỉ web và mã API (lấy ở web → Cài đặt → Tạo mã mới).

| Việc | Cách làm |
|---|---|
| Lưu đơn | Bôi đen tin chốt đơn → **Ctrl+C** → kiểm tra → **Enter** |
| Đoạn không có SĐT | Bôi đen → **Alt+S** |
| Đóng khung | **Esc** |
| Tạm tắt | Bỏ tích **Bắt Ctrl+C** trong popup |
