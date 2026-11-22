# Triển khai web quản lý đơn lên server Ubuntu

Kết quả cuối cùng: web chạy ở `https://don.<tên-miền-của-bạn>`, kho dùng trên điện thoại, extension gửi đơn thẳng vào web.

Cần có: server Ubuntu đã cài Docker, một tên miền, và tài khoản Cloudflare (miễn phí).

---

## 1. Đưa tên miền về Cloudflare (bỏ qua nếu đã dùng Cloudflare)

1. Đăng ký hoặc đăng nhập https://dash.cloudflare.com, bấm **Add a domain**, nhập tên miền, chọn gói **Free**.
2. Cloudflare cho 2 **nameserver**. Vào trang quản lý tên miền nơi bạn mua (Mắt Bão, PA, Tenten, Namecheap…), đổi nameserver thành 2 địa chỉ đó.
3. Chờ khoảng 5 phút đến vài giờ, đến khi Cloudflare báo tên miền **Active**.

> Website hay email đang chạy trên tên miền vẫn giữ nguyên, vì Cloudflare tự chép các bản ghi DNS cũ sang. Bạn nên kiểm tra lại danh sách DNS sau khi chép.

## 2. Tạo Cloudflare Tunnel

1. Mở https://one.dash.cloudflare.com, vào **Networks → Tunnels → Create a tunnel**.
2. Chọn **Cloudflared**, đặt tên (ví dụ `quanly-don`) rồi bấm **Save**.
3. Ở bước cài đặt, chọn **Docker**. Trong lệnh hiện ra, **copy chuỗi dài sau chữ `--token`**. Đây là `TUNNEL_TOKEN`.
4. Bấm **Next**, sang tab **Public Hostname**:
   - Subdomain: `don`
   - Domain: tên miền của bạn
   - Service: Type **HTTP**, URL **`web:3000`**
5. Bấm **Save**.

## 3. Đưa code lên server

Cách 1: dùng git (nên dùng):
```bash
git clone <link-repo-riêng-tư> ~/quanly-don
cd ~/quanly-don/server
```

Cách 2: copy thư mục `server/` từ máy tính lên server bằng WinSCP, hoặc:
```bash
scp -r server user@IP-server:~/quanly-don/
```

## 4. Cấu hình và chạy

```bash
cd ~/quanly-don/server
cp .env.example .env
nano .env                  # sửa ADMIN_PASSWORD, dán TUNNEL_TOKEN
mkdir -p data && sudo chown -R 1000:1000 data   # container chạy bằng user id 1000
docker compose up -d --build
docker compose logs -f web # thấy "Web quản lý đơn chạy tại ..." là được, Ctrl+C để thoát
```

Kiểm tra:
- Trong mạng nhà: `http://<IP-server>:3000`
- Từ bất kỳ đâu: `https://don.<tên-miền>`

## 5. Thiết lập lần đầu trên web

1. Đăng nhập bằng `admin` và mật khẩu đã đặt trong `.env`. Sau đó vào **Cài đặt → Đổi mật khẩu**.
2. **Cài đặt → Cửa hàng**: nhập **giá vốn 1 hộp** để web tính lãi.
3. **Cài đặt → Tài khoản → Thêm tài khoản**: tạo tài khoản quyền **Kho** cho người gửi hàng.
4. **Cài đặt → Chrome extension → Tạo mã mới**: copy mã `ext_…`.

## 6. Nối extension với web

1. Mở `chrome://extensions`, tìm **Bắt đơn Mess**, bấm **↻ Tải lại** (để nhận bản 2.0).
2. Bấm **Chi tiết → Tùy chọn tiện ích**:
   - Địa chỉ web: `https://don.<tên-miền>`
   - Mã API: mã `ext_…` vừa copy
3. Bấm **Lưu & kiểm tra kết nối**, rồi **Cho phép** khi Chrome hỏi quyền. Phải thấy ✅.

## 7. Kho dùng trên điện thoại

- Mở `https://don.<tên-miền>` và đăng nhập tài khoản kho.
- Bấm **Thêm vào màn hình chính** (Chrome: menu ⋮; Safari: nút Chia sẻ) để có icon như app.
- Quy trình: tab **Chờ gửi** → copy thông tin sang app Viettel Post → nhập mã vận đơn và phí ship → **✓ Đã gửi**.

---

## Vận hành hằng ngày

| Việc | Lệnh (chạy trong `~/quanly-don/server`) |
|---|---|
| Xem log | `docker compose logs -f web` |
| Khởi động lại | `docker compose restart` |
| Cập nhật code mới | `git pull && docker compose up -d --build` |
| Tắt | `docker compose down` (dữ liệu vẫn còn trong `data/`) |

### Sao lưu

- Server tự sao lưu mỗi ngày vào `server/data/backups/don-YYYY-MM-DD.db` và giữ 30 bản.
- **Nên sao lưu thêm ra ngoài server** phòng khi hỏng ổ cứng. Có 2 cách:
  - Trên web: **Cài đặt → Tải bản sao lưu** (mỗi tuần một lần).
  - Hoặc copy thư mục `data/backups` sang Google Drive bằng `rclone`.
- **Khôi phục:** `docker compose down`, copy file backup đè lên `data/don.db`, xóa `data/don.db-wal` và `data/don.db-shm` nếu có, rồi `docker compose up -d`.

### Bảo mật

- Web có đăng nhập. Sai mật khẩu 8 lần liên tiếp sẽ bị khóa 10 phút.
- Nhân viên nghỉ việc: **Cài đặt → Tài khoản → Khóa**.
- Muốn thêm một lớp bảo vệ, có thể bật **Cloudflare Access**: chỉ email được cho phép mới mở được trang. Khi đó phải thêm quy tắc **Bypass** cho đường dẫn `/api/ext`, nếu không extension sẽ không gửi được đơn.
