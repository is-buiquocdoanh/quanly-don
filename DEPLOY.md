# Triển khai web quản lý đơn lên server

Kết quả cuối cùng: web chạy ở **`https://don.doanhwork.com`**. Kho dùng trên điện thoại, extension gửi đơn thẳng vào web. Mỗi lần cập nhật chỉ cần một lệnh, và có thể quay lại bản cũ ngay lập tức.

```
Trình duyệt / điện thoại / extension
        │  https://don.doanhwork.com
        ▼
   Cloudflare (HTTPS, chống tấn công)
        │  đường hầm mã hóa (Cloudflare Tunnel), server tự gọi ra ngoài
        ▼
   Server Ubuntu  ──  container "tunnel"  ──►  container "web" (cổng 3000)  ──►  data/don.db
```

Nhờ Tunnel, server **không cần IP tĩnh, không cần mở cổng modem**, và có thể là VPS hoặc máy đặt ở nhà.

Cần có: server Ubuntu đã cài Docker và Git, tên miền `doanhwork.com` (mua ở Vietnix), tài khoản Cloudflare (miễn phí).

---

## 1. Kết nối tên miền với Cloudflare

Bước này chỉ làm **một lần**.

### 1.1. Thêm tên miền vào Cloudflare
1. Vào https://dash.cloudflare.com, bấm **Add a domain**, nhập `doanhwork.com`, chọn gói **Free**.
2. Cloudflare sẽ tự quét các bản ghi DNS cũ. Bấm **Continue to activation**.
3. Cloudflare cấp 2 nameserver (của tài khoản này là `kenneth.ns.cloudflare.com` và `zita.ns.cloudflare.com`).

### 1.2. Đổi nameserver ở Vietnix
1. Đăng nhập Vietnix, mở tên miền **doanhwork.com** và chọn tab **Nameservers**. Không làm ở tab *Quản lý DNS*.
2. Chọn **Sử dụng Nameserver tuỳ chọn (Điền bên dưới)**.
3. Nameserver 1: `kenneth.ns.cloudflare.com`, Nameserver 2: `zita.ns.cloudflare.com`. Để trống ô 3 và 4.
4. Bấm **Thay đổi Nameservers**.
5. Quay lại Cloudflare, bấm **I updated my nameservers**. Chờ từ 15 phút đến vài giờ, đến khi có email báo **Active**.

> Từ lúc này **mọi bản ghi DNS đều quản lý trên Cloudflare**. Tab *Quản lý DNS* bên Vietnix không còn tác dụng.

Kiểm tra trên máy tính:
```bash
dig NS doanhwork.com +short     # phải ra kenneth.ns.cloudflare.com và zita.ns.cloudflare.com
```

### 1.3. Dọn bản ghi DNS trên Cloudflare
Vào **Cloudflare → doanhwork.com → DNS → Records**:
- Bản ghi `A doanhwork.com → 103.200.23.139` là IP trang chờ của Vietnix, **không phải server của bạn**. Cứ để đó hoặc xóa đi, web quản lý đơn không dùng bản ghi này.
- **Không** tự tạo bản ghi cho `don`. Ở bước 2, Tunnel sẽ tự tạo.

### 1.4. Cài đặt SSL
Vào **SSL/TLS**:
- **Overview**: chọn **Full**.
- **Edge Certificates**: bật **Always Use HTTPS**.

---

## 2. Tạo Cloudflare Tunnel

1. Mở https://one.dash.cloudflare.com, vào **Networks → Tunnels → Create a tunnel**.
2. Chọn **Cloudflared**, đặt tên `quanly-don`, rồi bấm **Save tunnel**.
3. Ở bước cài đặt, chọn **Docker**. Trong lệnh hiện ra, **copy chuỗi dài sau chữ `--token`**. Đây là `TUNNEL_TOKEN`, sẽ dán vào `.env` ở bước 3. *Không cần* chạy lệnh đó.
4. Bấm **Next**, sang mục **Public Hostname**:

   | Ô | Giá trị |
   |---|---|
   | Subdomain | `don` |
   | Domain | `doanhwork.com` |
   | Service Type | `HTTP` |
   | URL | `web:3000` |

5. Bấm **Save**. Cloudflare sẽ tự tạo bản ghi DNS `don.doanhwork.com` trỏ vào tunnel.

> **Muốn web chạy thẳng ở `doanhwork.com`, không có `don.`?** Để trống ô Subdomain. Trước khi lưu, hãy xóa bản ghi `A doanhwork.com` có sẵn ở mục 1.3, nếu không Cloudflare sẽ báo trùng. Khi đó, mọi chỗ ghi `don.doanhwork.com` trong tài liệu này đổi thành `doanhwork.com`.

Trạng thái tunnel sẽ chuyển sang **HEALTHY** sau khi bạn chạy server ở bước 4.

---

## 3. Cài đặt server

Bước này chỉ làm **một lần**.

### 3.1. Cài Docker và Git (nếu chưa có)
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER     # để chạy docker không cần sudo. Đăng xuất rồi đăng nhập lại
sudo apt install -y git
```

### 3.2. Cho server đọc được repo GitHub (repo riêng tư)
```bash
ssh-keygen -t ed25519 -f ~/.ssh/quanly-don -N "" -C "server-quanly-don"
cat ~/.ssh/quanly-don.pub
```
Copy dòng vừa hiện ra, vào **GitHub → repo quanly-don → Settings → Deploy keys → Add deploy key**, dán vào, **không** tick *Allow write access*. Sau đó:
```bash
cat >> ~/.ssh/config <<'EOF'
Host github-quanly-don
  HostName github.com
  User git
  IdentityFile ~/.ssh/quanly-don
EOF
```

### 3.3. Tạo thư mục ứng dụng
```bash
mkdir -p ~/apps/quanly-don && cd ~/apps/quanly-don
git clone github-quanly-don:is-buiquocdoanh/quanly-don.git src

cp src/deploy/deploy.sh src/deploy/docker-compose.yml .
cp src/deploy/.env.example .env
nano .env          # sửa ADMIN_PASSWORD, dán TUNNEL_TOKEN ở bước 2

mkdir -p data && sudo chown -R 1000:1000 data   # container chạy bằng user id 1000
```

Cấu trúc sau khi cài:
```
~/apps/quanly-don/
├── deploy.sh             ← lệnh triển khai
├── docker-compose.yml
├── .env                  ← mật khẩu, token (bí mật, không đưa lên git)
├── data/                 ← DATABASE + bản sao lưu hằng ngày (quan trọng nhất)
├── backups-deploy/       ← bản sao database tự chụp trước mỗi lần đổi phiên bản
├── deploy.log            ← lịch sử deploy
└── src/                  ← code lấy từ GitHub (deploy.sh tự cập nhật, đừng sửa tay)
```

---

## 4. Phát hành và triển khai phiên bản

### 4.1. Trên máy lập trình: đánh dấu một phiên bản
Khi code trên nhánh `main` đã ổn:
```bash
git tag v1.0.0
git push origin main v1.0.0
```
Đặt số phiên bản theo dạng `vLỚN.VỪA.NHỎ`: sửa lỗi thì tăng số cuối (`v1.0.1`), thêm tính năng thì tăng số giữa (`v1.1.0`).

### 4.2. Trên server: dùng `deploy.sh`
```bash
~/apps/quanly-don/deploy.sh --status    # web đang chạy bản nào, có khỏe không
~/apps/quanly-don/deploy.sh --list      # các phiên bản có trên GitHub + image đã build sẵn trên máy
~/apps/quanly-don/deploy.sh v1.0.0      # chạy bản v1.0.0 (lên bản mới hoặc QUAY LẠI bản cũ)
~/apps/quanly-don/deploy.sh             # (thử nhanh) bản mới nhất của nhánh main, chưa cần tag
~/apps/quanly-don/deploy.sh --clean     # xóa image cũ, giữ bản đang chạy + 5 bản mới nhất
```

Mỗi lần deploy, script làm các việc sau:
1. Lấy code đúng phiên bản từ GitHub và build thành image `quanly-don:<phiên bản>`. Lúc này web cũ vẫn chạy bình thường. Nếu image đã có sẵn thì bỏ qua bước này, nên **quay lại bản cũ chỉ mất vài giây**.
2. Dừng web, **chụp lại database** vào `backups-deploy/` (giữ 10 bản gần nhất).
3. Chạy bản mới và kiểm tra `/api/health`.
4. Nếu bản mới không chạy được, **tự quay lại bản trước** và in log lỗi ra.

Thời gian web tạm ngừng khi đổi phiên bản chỉ khoảng 2–5 giây.

### 4.3. Lần chạy đầu tiên
```bash
~/apps/quanly-don/deploy.sh v1.0.0     # hoặc ./deploy.sh nếu chưa có tag nào
~/apps/quanly-don/deploy.sh --status
```
Kiểm tra:
- Ngay trên server: `curl http://localhost:3010/api/health` (cổng `WEB_PORT` trong `.env`; atlasweb đã dùng 3000)
- Từ bất kỳ đâu: `https://don.doanhwork.com`. Ở Cloudflare Zero Trust, tunnel phải hiện **HEALTHY**.

> **Khi deploy.sh hoặc docker-compose.yml trong repo có thay đổi**, chép lại bản mới:
> `cd ~/apps/quanly-don && git -C src pull && cp src/deploy/deploy.sh src/deploy/docker-compose.yml .`

---

## 5. Thiết lập lần đầu trên web

1. Đăng nhập bằng `admin` và mật khẩu đã đặt trong `.env`, rồi vào **Cài đặt → Đổi mật khẩu**.
2. **Cài đặt → Cửa hàng**: nhập **giá vốn 1 hộp** để web tính lãi.
3. **Cài đặt → Tài khoản → Thêm tài khoản**: tạo tài khoản quyền **Kho** cho người gửi hàng.
4. **Cài đặt → Chrome extension → Tạo mã mới**: copy mã `ext_…`.

## 6. Nối extension với web

1. Mở `chrome://extensions`, tìm **Bắt đơn Mess**, bấm **↻ Tải lại**.
2. Bấm **Chi tiết → Tùy chọn tiện ích**:
   - Địa chỉ web: `https://don.doanhwork.com`
   - Mã API: mã `ext_…` vừa copy
3. Bấm **Lưu & kiểm tra kết nối**, rồi **Cho phép** khi Chrome hỏi quyền. Phải thấy ✅.

## 7. Kho dùng trên điện thoại

- Mở `https://don.doanhwork.com` và đăng nhập tài khoản kho.
- Bấm **Thêm vào màn hình chính** (Chrome: menu ⋮; Safari: nút Chia sẻ) để có icon như app.
- Quy trình: tab **Chờ gửi** → copy thông tin sang app Viettel Post → nhập mã vận đơn và phí ship → **✓ Đã gửi**.

---

## Vận hành hằng ngày

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

### Sao lưu

- Web tự sao lưu mỗi ngày vào `data/backups/don-YYYY-MM-DD.db` và giữ 30 bản.
- `deploy.sh` chụp thêm một bản vào `backups-deploy/` trước mỗi lần đổi phiên bản.
- **Nên sao lưu thêm ra ngoài server** phòng khi hỏng ổ cứng: trên web vào **Cài đặt → Tải bản sao lưu** mỗi tuần, hoặc dùng `rclone` copy `data/backups` lên Google Drive.
- **Khôi phục:** `docker compose down`, copy file backup đè lên `data/don.db`, xóa `data/don.db-wal` và `data/don.db-shm` nếu có, rồi `docker compose up -d`.

> **Quay lại bản cũ sau khi bản mới đã đổi cấu trúc database?** Code cũ có thể không đọc được database mới. Khi đó, khôi phục luôn database từ thư mục `backups-deploy/<thời-điểm>_truoc-<bản-mới>/`, theo cách khôi phục ở trên. Lưu ý: những đơn nhập sau thời điểm đó sẽ mất.

### Bảo mật

- Web có đăng nhập. Sai mật khẩu 8 lần liên tiếp sẽ bị khóa 10 phút.
- Nhân viên nghỉ việc: **Cài đặt → Tài khoản → Khóa**.
- Muốn thêm một lớp bảo vệ, có thể bật **Cloudflare Access**: chỉ email được cho phép mới mở được trang. Khi đó phải thêm quy tắc **Bypass** cho đường dẫn `/api/ext`, nếu không extension sẽ không gửi được đơn.

### Gặp sự cố

| Hiện tượng | Kiểm tra |
|---|---|
| `https://don.doanhwork.com` báo lỗi 1033 hoặc 502 | `./deploy.sh --status`: tunnel hoặc web đang không chạy. Xem `docker compose logs tunnel` (token sai?) |
| Tên miền không vào được, Cloudflare báo *Pending* | Nameserver ở Vietnix chưa đổi đúng (mục 1.2), kiểm tra bằng `dig NS doanhwork.com +short` |
| `deploy.sh` báo không lấy được code từ GitHub | Deploy key (mục 3.2), thử `ssh -T github-quanly-don` |
| Lỗi quyền ghi `data/` | `sudo chown -R 1000:1000 ~/apps/quanly-don/data` |

---

*Chạy thử trên máy lập trình (không cần Cloudflare): `cd server && cp .env.example .env && docker compose up -d --build`, rồi mở `http://localhost:3000`.*
