# Giai đoạn 7. Vận hành hằng ngày và xử lý sự cố

> **Mục tiêu:** biết các lệnh dùng hằng ngày, giữ web an toàn, và tự xử lý các lỗi thường gặp.  
> **Làm khi nào:** khi cần tra cứu.  
> **Thời gian:** —

## 1. Lệnh thường dùng

| Việc | Lệnh (chạy trong `~/apps/quanly-don`) |
|---|---|
| Xem trạng thái | `./deploy.sh --status` |
| Cập nhật lên bản mới | `./deploy.sh v1.1.0` |
| Quay lại bản cũ | `./deploy.sh v1.0.0` |
| Xem log web | `docker compose logs -f web` |
| Xem log tunnel | `docker compose logs -f tunnel` |
| Khởi động lại | `docker compose restart` |
| Tắt | `docker compose down` (dữ liệu vẫn còn trong `data/`) |

Server khởi động lại thì web tự chạy lại, không cần làm gì.

## 2. Bảo mật

- Web có đăng nhập. Sai mật khẩu 8 lần liên tiếp sẽ bị khóa 10 phút.
- Nhân viên nghỉ việc: **Cài đặt → Tài khoản → Khóa**. Tài khoản bị khóa không đăng nhập được, nhưng lịch sử đơn vẫn giữ tên người đó.
- Tạo nhầm tài khoản (sai tên đăng nhập, sai quyền): **Cài đặt → Tài khoản → Xóa**, rồi tạo lại. Chỉ xóa được tài khoản **chưa có đơn, thao tác hay thu chi nào**; đã dùng rồi thì web báo lý do và chỉ cho Khóa.
- Muốn thêm một lớp bảo vệ, có thể bật **Cloudflare Access**: chỉ email được cho phép mới mở được trang. Khi đó phải thêm quy tắc **Bypass** cho đường dẫn `/api/ext`, nếu không extension sẽ không gửi được đơn.

## 3. Gặp sự cố

| Hiện tượng | Kiểm tra |
|---|---|
| `https://don.doanhwork.com` báo lỗi 1033 hoặc 502 | `./deploy.sh --status`: tunnel hoặc web đang không chạy. Xem `docker compose logs tunnel` (token sai?) |
| Tên miền không vào được, Cloudflare báo *Pending* | Nameserver ở Vietnix chưa đổi đúng ([Giai đoạn 2](2-ten-mien-cloudflare.md), mục 1.2), kiểm tra bằng `dig NS doanhwork.com +short` |
| `deploy.sh` báo không lấy được code từ GitHub | Deploy key ([Giai đoạn 3](3-cai-dat-server.md), mục 2), thử `ssh -T github-quanly-don` |
| Lỗi quyền ghi `data/` | `sudo chown -R 1000:1000 ~/apps/quanly-don/data` |
| Sao lưu Google Drive báo lỗi | [Giai đoạn 6](6-sao-luu.md), cuối mục 2 |

---

← [Giai đoạn 6: Sao lưu (server + Google Drive)](6-sao-luu.md) · [Mục lục](README.md) · [Giai đoạn 8: Messenger](8-messenger.md) →
