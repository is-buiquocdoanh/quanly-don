# Giai đoạn 6. Sao lưu (server + Google Drive)

> **Mục tiêu:** dữ liệu được sao lưu mỗi ngày trên server và mỗi tuần lên Google Drive, biết cách khôi phục khi cần.  
> **Làm khi nào:** sau khi web đã chạy thật; phần Google Drive làm một lần.  
> **Thời gian:** khoảng 30 phút cho phần Google Drive.

## 1. Sao lưu trên server (tự động, không cần cài)

- Web tự sao lưu mỗi ngày vào `data/backups/don-YYYY-MM-DD.db` và giữ 30 bản.
- `deploy.sh` chụp thêm một bản vào `backups-deploy/` trước mỗi lần đổi phiên bản.
- **Nên sao lưu thêm ra ngoài server** phòng khi hỏng ổ cứng: cài [sao lưu lên Google Drive](#2-sao-lưu-lên-google-drive) ở dưới (tự động mỗi tuần), hoặc trên web vào **Cài đặt → Tải bản sao lưu** mỗi tuần.
- **Khôi phục:** `docker compose down`, copy file backup đè lên `data/don.db`, xóa `data/don.db-wal` và `data/don.db-shm` nếu có, rồi `docker compose up -d`.

> **Quay lại bản cũ sau khi bản mới đã đổi cấu trúc database?** Code cũ có thể không đọc được database mới. Khi đó, khôi phục luôn database từ thư mục `backups-deploy/<thời-điểm>_truoc-<bản-mới>/`, theo cách khôi phục ở trên. Lưu ý: những đơn nhập sau thời điểm đó sẽ mất.

## 2. Sao lưu lên Google Drive

Script `backup-gdrive.sh` **mỗi tuần một lần** (3:30 sáng Chủ nhật) lấy bản sao lưu mới nhất trong `data/backups/`, nén lại (nhỏ đi khoảng 10 lần) rồi đưa lên Google Drive. Bản trên Drive được giữ **365 ngày**, tức khoảng 52 bản. Với 100 đơn/ngày, cả năm chỉ tốn khoảng 150 MB Drive (gói miễn phí có 15 GB). Trong tuần, server vẫn tự sao lưu mỗi ngày như cũ, nên sự cố nhỏ thì khôi phục từ `data/backups/`; bản trên Drive dùng khi mất cả server (mất tối đa dữ liệu của 1 tuần).

### Bước 1. Cài rclone trên server
```bash
sudo -v ; curl https://rclone.org/install.sh | sudo bash
rclone version
```

### Bước 2. Tạo ứng dụng Google riêng cho rclone (làm 1 lần, trên trình duyệt)

rclone báo mã ứng dụng Google dùng chung của nó sẽ ngừng hoạt động trong năm 2026, nên phải tự tạo một mã riêng (miễn phí). Dùng **đúng tài khoản Google sẽ chứa bản sao lưu** cho mọi bước dưới đây.

1. https://console.cloud.google.com → chọn project ở góc trên → **New Project**, tên `quanly-don-backup` → **Create**, rồi chọn đúng project đó.
2. **APIs & Services → Library** → tìm **Google Drive API** → **Enable**.
3. **Google Auth Platform** (Nền tảng xác thực của Google) → **Get started**: App name `quanly-don-backup`, email hỗ trợ, Audience **External**, email liên hệ → **Create**.
4. **Xác minh tên miền** (Google bắt có trang chủ + chính sách bảo mật trên tên miền đã xác minh thì mới cho Publish):
   - https://search.google.com/search-console → **Thêm tài sản** → ô **Miền** → `doanhwork.com`.
   - Nút tự xác minh qua Cloudflare hay báo lỗi *401 Unauthorized*. Khi đó đổi **Hướng dẫn cho** sang *Bất kỳ nhà cung cấp DNS nào*, bấm **Sao chép** chuỗi `google-site-verification=…`, rồi vào Cloudflare → `doanhwork.com` → **DNS → Add record**: Type `TXT`, Name `@`, Content dán chuỗi → **Save** → quay lại bấm **Xác minh**.
   - **Không xóa** bản ghi TXT này, xóa là mất trạng thái đã xác minh.
5. **Branding** (Xây dựng thương hiệu):

   | Ô | Điền |
   |---|---|
   | Logo | **để trống** (có logo là Google bắt gửi hồ sơ xét duyệt) |
   | Trang chủ ứng dụng | `https://don.doanhwork.com` |
   | Chính sách bảo mật | `https://don.doanhwork.com/privacy.html` (trang có sẵn trong web, file `server/public/privacy.html`) |
   | Điều khoản sử dụng | để trống |
   | Các miền được ủy quyền | `doanhwork.com` |

   Bấm **Lưu**.
6. **Audience** (Khán giả) → **Xuất bản ứng dụng** (Publish app) → **Xác nhận**. Trạng thái phải là **In production / Đang sản xuất**. Để *Testing* thì Google thu hồi quyền sau 7 ngày và sao lưu hằng tuần sẽ hỏng.
7. **Clients** (Khách hàng) → **Create client** → loại **Desktop app**, tên `rclone` → **Create**. Copy **Client ID** và **Client secret**.

### Bước 3. Kết nối rclone với Google Drive

Server không có trình duyệt, nên phần đăng nhập Google làm trên máy Windows.

1. Trên **Windows**: tải rclone tại https://rclone.org/downloads/ (bản *Windows, Intel/AMD 64 Bit*), giải nén. Mở thư mục có `rclone.exe`, gõ `powershell` vào thanh địa chỉ rồi Enter để mở PowerShell ngay tại đó.
2. Trên **server**, chạy `rclone config` rồi trả lời lần lượt:

   | rclone hỏi | Gõ |
   |---|---|
   | `n) New remote` | `n` |
   | `name>` | `gdrive` |
   | `Storage>` | `drive` |
   | `Continue using the shared client_id anyway?` | `n` |
   | `client_id>` | dán Client ID ở bước 2.7 |
   | `client_secret>` | dán Client secret |
   | `scope>` | `drive.file` (rclone chỉ thấy file do chính nó tạo, không đụng được file khác trong Drive của bạn) |
   | `service_account_file>` | Enter |
   | `Edit advanced config?` | `n` |
   | `Use web browser to automatically authenticate?` | **`n`** |

3. rclone in ra một lệnh dạng `rclone authorize "drive" "eyJ..."`. Chạy lệnh đó trong PowerShell trên Windows, nhớ thêm `.\` ở đầu:
   ```powershell
   .\rclone.exe authorize "drive" "eyJ..."     # dán đúng chuỗi server in ra
   ```
   Trình duyệt mở trang Google: đăng nhập, gặp *"Google hasn't verified this app"* thì bấm **Advanced → Go to quanly-don-backup (unsafe) → Continue**. PowerShell in ra một chuỗi dài giữa `--->` và `<---End paste`: copy **toàn bộ chuỗi đó**, dán vào ô `config_token>` trên server. Chuỗi này là chìa khóa vào Drive, **đừng gửi cho ai**.
4. Câu `Configure this as a Shared Drive?` gõ `n`, rồi `y` để lưu và `q` để thoát.

### Bước 4. Chép script, chạy thử và hẹn giờ
```bash
cd ~/apps/quanly-don
git -C src pull && cp src/deploy/backup-gdrive.sh . && chmod +x backup-gdrive.sh
./backup-gdrive.sh --check          # phải thấy "OK: rclone kết nối được Google Drive"
./backup-gdrive.sh --all            # đưa lên mọi bản đang có trên server (lần đầu)
./backup-gdrive.sh --install-cron   # từ giờ tự chạy mỗi tuần, 3:30 sáng Chủ nhật
```
Mở Google Drive sẽ thấy thư mục **quanly-don-backup** chứa các file `don-YYYY-MM-DD.db.gz`.

### Dùng hằng ngày

| Việc | Lệnh (trong `~/apps/quanly-don`) |
|---|---|
| Xem các bản trên Drive | `./backup-gdrive.sh --list` |
| Xem lịch sử chạy tự động | `tail -n 20 backup-gdrive.log` |
| Đưa lên ngay bây giờ | `./backup-gdrive.sh` |
| Tải 1 bản về để khôi phục | `./backup-gdrive.sh --get 2026-11-23` → file nằm ở `restore/don-2026-11-23.db`, khôi phục theo cách ở mục trên |

Trên Windows cũng mở được file từ Drive: tải `.db.gz` về, giải nén bằng 7-Zip, rồi mở bằng [DB Browser for SQLite](https://sqlitebrowser.org/) nếu cần xem.

- Đổi số ngày giữ hoặc tên thư mục: thêm vào `.env` dòng `GDRIVE_KEEP_DAYS=730` hoặc `GDRIVE_REMOTE=gdrive:ten-thu-muc-khac`.
- Log báo lỗi `token expired` / `invalid_grant`: Google thu hồi quyền (đổi mật khẩu Google, gỡ quyền ứng dụng…). Chạy `rclone config reconnect gdrive:` trên server, trả lời `n` ở câu dùng trình duyệt, rồi làm lại bước 3.3.
- Log báo lỗi sau đúng 7 ngày: ứng dụng vẫn đang ở *Testing*, xem lại bước 2.6.

---

← [Giai đoạn 5: Thiết lập web, extension, điện thoại](5-thiet-lap-web-extension.md) · [Mục lục](README.md) · [Giai đoạn 7: Vận hành hằng ngày và xử lý sự cố](7-van-hanh-su-co.md) →
