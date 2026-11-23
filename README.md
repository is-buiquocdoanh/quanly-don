# Quản lý đơn trứng sâu canxi

Bôi đen tin nhắn chốt đơn trong **Meta Business Suite**, bấm **Ctrl+C** là đơn được lưu. Kho gửi hàng Viettel Post trên điện thoại. Chủ shop xem doanh thu, chi quảng cáo, lãi, COD và tỷ lệ hoàn.

```
extension/     Chrome extension: bắt đơn bằng Ctrl+C trên Business Suite
server/        Web quản lý (Node 24 + SQLite, chạy bằng Docker)
deploy/        Script cho server: deploy.sh (triển khai), backup-gdrive.sh (sao lưu Google Drive)
docs/          Tài liệu, chia theo từng giai đoạn
apps-script/   Bản cũ: lưu đơn vào Google Sheets (không cần nếu đã chạy web)
test/          node test/parser.test.js — kiểm tra bộ tách thông tin đơn
PROGRESS.md    Nhật ký tiến độ, đọc trước khi làm tiếp
```

## Bắt đầu từ đâu

Mở **[docs/README.md](docs/README.md)** và làm lần lượt:

1. [Chạy thử trên máy tính](docs/1-chay-thu-tren-may.md)
2. [Tên miền và Cloudflare](docs/2-ten-mien-cloudflare.md)
3. [Cài đặt server](docs/3-cai-dat-server.md)
4. [Phát hành và cập nhật phiên bản](docs/4-phat-hanh-cap-nhat.md)
5. [Thiết lập web, extension, điện thoại](docs/5-thiet-lap-web-extension.md)
6. [Sao lưu (server + Google Drive)](docs/6-sao-luu.md)
7. [Vận hành hằng ngày và xử lý sự cố](docs/7-van-hanh-su-co.md)

Muốn biết web làm được gì: [Tính năng của web](docs/tinh-nang.md).

## Lệnh hay dùng nhất

```powershell
# Windows, chạy thử trên máy (chi tiết: Giai đoạn 1)
cd server; npm install; $env:ADMIN_PASSWORD = "123456"; npm run dev
```
```bash
# Phát hành bản mới (chi tiết: Giai đoạn 4)
git tag v1.2.0 && git push origin main v1.2.0
# rồi trên server:
~/apps/quanly-don/deploy.sh v1.2.0
```
