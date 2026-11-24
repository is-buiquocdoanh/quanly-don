# Giai đoạn 9. Website giới thiệu (doanhwork.com)

> **Mục tiêu:** có website công khai giới thiệu sản phẩm, trang trại, blog kinh nghiệm và các chính sách, để khách xem, Google tìm thấy, Facebook / TikTok duyệt app. Nút "Đăng nhập quản lý" ở cuối trang dẫn sang web quản lý đơn.  
> **Làm khi nào:** sau khi web quản lý đã chạy (Giai đoạn 4).  
> **Thời gian:** khoảng 15 phút cài, còn lại là viết nội dung.

```
https://doanhwork.com        ← website công khai (cùng server, cùng container với web quản lý)
https://www.doanhwork.com    ← tự chuyển về doanhwork.com
https://don.doanhwork.com    ← web quản lý đơn (như cũ)
```

Server nhìn **tên miền** để biết trả trang nào. Ở tên miền công khai không có API quản lý nào (gọi `/api/...` chỉ ra trang "Không tìm thấy").

## 1. Các trang có sẵn

| Đường dẫn | Nội dung | Sửa ở đâu (web quản lý → **Website**) |
|---|---|---|
| `/` | Trang chủ: khẩu hiệu, nút Messenger / Zalo / Gọi, sản phẩm, cách dùng, bài viết mới | Thông tin shop, Sản phẩm |
| `/san-pham` | Sản phẩm, giá, cách dùng và bảo quản | Sản phẩm, Thông tin shop |
| `/trang-trai` | Câu chuyện và hình ảnh trang trại | Thông tin shop |
| `/blog`, `/blog/<bài>` | Kinh nghiệm chăn nuôi | Bài viết |
| `/lien-he` | SĐT, Zalo, Messenger, địa chỉ, thông tin hộ kinh doanh | Thông tin shop |
| `/chinh-sach/bao-mat` · `dieu-khoan` · `giao-hang` · `doi-tra` · `xoa-du-lieu` | Các chính sách (có **bản nháp sẵn**, cần đọc lại và sửa cho đúng) | Chính sách |
| `/sitemap.xml`, `/robots.txt` | Cho Google | Tự tạo |
| `/dang-nhap` | Chuyển sang web quản lý | — |

Giao diện hiện là **bản khung**; sẽ đổi theo mẫu chủ shop gửi (chỉ sửa `server/site/site.css` và `server/src/site/render.js`).

## 2. Chạy thử trên máy

`npm run dev` như Giai đoạn 1, rồi mở **http://site.localhost:3000** (Chrome / Edge tự hiểu `*.localhost`). Web quản lý vẫn ở http://localhost:3000.

## 3. Nối tên miền gốc trên Cloudflare (làm 1 lần, trên trình duyệt)

1. **Cloudflare → doanhwork.com → DNS → Records**: xóa bản ghi `A doanhwork.com` (IP trang chờ của Vietnix) và `CNAME www` nếu có. **Giữ nguyên** bản ghi TXT `google-site-verification=…`.
2. **Zero Trust → Networks → Tunnels → quanly-don → Public Hostname → Add a public hostname**:

   | Subdomain | Domain | Service |
   |---|---|---|
   | *(để trống)* | `doanhwork.com` | HTTP → `web:3000` |
   | `www` | `doanhwork.com` | HTTP → `web:3000` |

3. Đợi 1–2 phút rồi mở https://doanhwork.com.

Không cần sửa `.env`: server mặc định coi `doanhwork.com`, `www.doanhwork.com` là website công khai. Đổi tên miền khác thì đặt `SITE_HOSTS=ten-mien.vn,www.ten-mien.vn` trong `.env`.

## 4. Viết nội dung

Vào web quản lý → **Website**:

- **Thông tin shop:** tên, khẩu hiệu, ảnh trang chủ, logo, SĐT / Zalo / link Messenger (`https://m.me/<tên-page>`), fanpage, TikTok, địa chỉ, thông tin hộ kinh doanh, nội dung trang Trang trại, cách dùng.
- **Sản phẩm:** tên, quy cách, giá (để 0 thì hiện "Giá: liên hệ"), ảnh, mô tả.
- **Bài viết:** *Viết bài mới* → tiêu đề, ảnh bìa, nội dung → **Lưu nháp** (chưa ai thấy) hoặc **Đăng bài**. Nút **Chèn ảnh** tải ảnh lên và chèn vào chỗ con trỏ; **Xem trước** để xem bài trông thế nào.
- **Chính sách:** chọn từng chính sách, sửa, Lưu.

Cách viết nội dung (Markdown):

```
## Tiêu đề mục
Đoạn văn. Dòng trống để sang đoạn mới.

- gạch đầu dòng
1. đánh số

**chữ đậm**, *chữ nghiêng*, [chữ có link](https://...)
> trích dẫn / mẹo
```

Ảnh tải lên được tự thu nhỏ (cạnh dài tối đa 1600px), lưu ở `data/uploads/` trên server (nằm trong thư mục dữ liệu, giữ qua các lần deploy).

## 5. Dùng khi nộp duyệt app (Facebook, TikTok, Google)

| Ô cần điền | Link |
|---|---|
| Website / Trang chủ | `https://doanhwork.com` |
| Chính sách quyền riêng tư | `https://doanhwork.com/chinh-sach/bao-mat` |
| Điều khoản dịch vụ | `https://doanhwork.com/chinh-sach/dieu-khoan` |
| Hướng dẫn xóa dữ liệu | `https://doanhwork.com/chinh-sach/xoa-du-lieu` |

Trước khi nộp: điền đủ **Liên hệ** và **thông tin hộ kinh doanh**, đọc lại các chính sách. Link cũ `https://don.doanhwork.com/privacy.html` (đã khai báo cho Google) vẫn chạy.

## 6. Sắp làm

- Đổi giao diện theo mẫu chủ shop gửi.
- Form **đặt hàng trên website** (đơn vào thẳng trang Kho, kiểm tra trùng SĐT / Sổ đỏ, chống spam).

---

← [Giai đoạn 8: Messenger](8-messenger.md) · [Mục lục](README.md)
