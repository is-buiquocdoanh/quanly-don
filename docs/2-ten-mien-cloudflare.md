# Giai đoạn 2. Tên miền và Cloudflare

> **Mục tiêu:** tên miền `doanhwork.com` chạy qua Cloudflare, có sẵn đường hầm (Tunnel) để đưa web ra `https://don.doanhwork.com`.  
> **Làm khi nào:** một lần, trước khi cài server.  
> **Thời gian:** khoảng 30 phút làm, cộng thời gian chờ nameserver (15 phút đến vài giờ).

## Toàn cảnh

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
- **Không** tự tạo bản ghi cho `don`. Ở phần 2 bên dưới, Tunnel sẽ tự tạo.

### 1.4. Cài đặt SSL
Vào **SSL/TLS**:
- **Overview**: chọn **Full**.
- **Edge Certificates**: bật **Always Use HTTPS**.

---

## 2. Tạo Cloudflare Tunnel

1. Mở https://one.dash.cloudflare.com, vào **Networks → Tunnels → Create a tunnel**.
2. Chọn **Cloudflared**, đặt tên `quanly-don`, rồi bấm **Save tunnel**.
3. Ở bước cài đặt, chọn **Docker**. Trong lệnh hiện ra, **copy chuỗi dài sau chữ `--token`**. Đây là `TUNNEL_TOKEN`, sẽ dán vào `.env` ở [Giai đoạn 3](3-cai-dat-server.md). *Không cần* chạy lệnh đó.
4. Bấm **Next**, sang mục **Public Hostname**:

   | Ô | Giá trị |
   |---|---|
   | Subdomain | `don` |
   | Domain | `doanhwork.com` |
   | Service Type | `HTTP` |
   | URL | `web:3000` |

5. Bấm **Save**. Cloudflare sẽ tự tạo bản ghi DNS `don.doanhwork.com` trỏ vào tunnel.

> **Muốn web chạy thẳng ở `doanhwork.com`, không có `don.`?** Để trống ô Subdomain. Trước khi lưu, hãy xóa bản ghi `A doanhwork.com` có sẵn ở mục 1.3, nếu không Cloudflare sẽ báo trùng. Khi đó, mọi chỗ ghi `don.doanhwork.com` trong các tài liệu đổi thành `doanhwork.com`.

Trạng thái tunnel sẽ chuyển sang **HEALTHY** sau khi bạn chạy web lần đầu ở [Giai đoạn 4](4-phat-hanh-cap-nhat.md).

---

← [Giai đoạn 1: Chạy thử trên máy tính](1-chay-thu-tren-may.md) · [Mục lục](README.md) · [Giai đoạn 3: Cài đặt server](3-cai-dat-server.md) →
