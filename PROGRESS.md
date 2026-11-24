# NHẬT KÝ TIẾN ĐỘ — Hệ thống quản lý đơn trứng sâu canxi

> Đọc file này đầu tiên khi tiếp tục ở máy khác.
> Nói với Claude: **"Đọc PROGRESS.md rồi làm tiếp"**.

## Bối cảnh

- Bán trứng sâu canxi qua nhiều Facebook Page, tin nhắn đọc trên **Meta Business Suite**.
- **Chủ shop** lên đơn từ tin nhắn. **Kho** là người gửi hàng qua **Viettel Post**.
- Server riêng: **Ubuntu, đã có Docker**. Dùng **tên miền có sẵn** qua **Cloudflare Tunnel**, nên không cần mở port.
- Mẫu tin nhắn chốt đơn: xem `test/parser.test.js` (case 1).

## Kiến trúc đã chốt

```
[Chrome extension]  --Ctrl+C-->  [Web server Node 24 + SQLite]  <--  Chủ shop (máy tính)
 (Business Suite)     /api/ext         (Docker trên Ubuntu)      <--  Kho (điện thoại)
                                              |
                                     Cloudflare Tunnel → https://don.<tên-miền>
```

- **Backend:** Node.js 24, dùng `node:sqlite` có sẵn; thư viện ngoài duy nhất là `@anthropic-ai/sdk` (AI đọc đơn), nên lần đầu cần `npm install`.
- **Frontend:** HTML + JS thuần (SPA, điều hướng bằng hash), dùng được trên điện thoại.
- **Dữ liệu:** `server/data/don.db`. Tự sao lưu mỗi ngày vào `server/data/backups/`, giữ 30 bản.
- **Quyền:** `admin` (chủ shop) làm được tất cả. `kho` chỉ thấy màn hình Kho: đổi trạng thái, nhập mã vận đơn, phí ship.
- **Trạng thái đơn:** `moi` (Chờ gửi) → `da_gui` (Đã gửi) → `da_giao` (Đã giao) / `hoan` (Hoàn) / `huy` (Hủy). COD đã về được đánh dấu riêng (`cod_received`).

## Giai đoạn 1 — Extension + Google Sheets ✅ XONG (22/11/2026)

- `extension/`: bắt Ctrl+C / Alt+S, tách thông tin đơn, khung xác nhận, báo trùng SĐT 7 ngày.
- `apps-script/Code.gs`: API lưu vào Google Sheets (bản tạm, sẽ bỏ khi web chạy).
- `test/parser.test.js`: chạy `node test/parser.test.js` → 3 mẫu đều đúng.

## Giai đoạn 2 — Web quản lý (đang làm, bắt đầu 22/11/2026)

| # | Việc | Trạng thái |
|---|---|---|
| 1 | Server: database, đăng nhập, phân quyền, sao lưu | ✅ `server/src/{server,db,util}.js` |
| 2 | API: đơn hàng, khách hàng, thu chi, báo cáo, cài đặt, `/api/ext` cho extension | ✅ `server/src/{routes,orders}.js`, test: `cd server && npm test` (6/6 qua) |
| 3 | Giao diện: Tổng quan, Đơn hàng, Kho, Khách hàng, Thu chi, Cài đặt | ✅ `server/public/{index.html,app.js,style.css,parser.js}`, đã chạy thử bằng Edge headless, không có lỗi JS |
| 4 | Sửa extension để gửi đơn vào web thay vì Google Sheets | ✅ v2.0: nhập địa chỉ web + mã API (vẫn dùng được link Apps Script), cảnh báo khách bom hàng |
| 5 | Docker + docker-compose + Cloudflare Tunnel + hướng dẫn triển khai | ✅ `server/Dockerfile`, `server/docker-compose.yml`, hướng dẫn trong `docs/`. ⚠️ **CHƯA build thử image** (Docker Desktop trên máy nhà đang tắt) |
| 6 | Chạy thử end-to-end trên máy | ✅ API + giao diện (Edge headless). ⏳ Chưa thử extension thật trên Business Suite với web |
| 7 | **Triển khai lên server Ubuntu thật** | ✅ Đã chạy ở https://don.doanhwork.com (hướng dẫn: `docs/2` → `docs/4`) |

### Để sau (giai đoạn 3)

- Nối **API Viettel Post**: tự tạo vận đơn, tự lấy trạng thái giao, đối soát COD. Cần token đối tác VTP.
- Quản lý **tồn kho** (nhập hàng, tự trừ khi gửi).
- Nhập dữ liệu cũ từ Google Sheets (CSV).

## Nhật ký

- **25/11/2026 (tối):** v1.6.0: tải extension .zip trên web (`src/extzip.js`, tự ghi zip; Dockerfile có stage `ext` lấy `extension/` nếu deploy.sh mới chép vào), mã API luôn hiện + Chép (1 mã dùng nhiều máy). Tiếp: **extension 2.6.0 gửi đơn trên Zalo Web** (`extension/zalo.js`, chạy ở chat.zalo.me, shadow DOM): khung "📦 Đơn báo kho" lấy `ext zalo_pending` (đơn Chờ gửi chưa báo Zalo 7 ngày, kèm `text` theo `orderText()` = orderLine), kiểm tra tên chat đang mở khớp "Nhóm kho", gõ bằng `execCommand('insertText')` (dự phòng: sự kiện paste), gửi bằng Enter giả lập (dự phòng: bấm nút "Gửi"/class send cạnh ô chat), ô chat còn chữ = lỗi → dừng; gửi xong từng đơn gọi `zalo_mark`. Chưa thử trên Zalo Web thật (chỉ trang giả lập: cả kiểu Enter và kiểu nút GỬI, đơn nhiều dòng, sai nhóm, ô chat có chữ dở). `npm test` 26/26.

- **25/11/2026 (tiếp):** Kho không dùng web, nhận đơn qua **nhóm Zalo** → thêm **gửi đơn qua Zalo** (mỗi đơn 1 tin). Tự gửi bằng **zca-js 2.2.0** (thư viện KHÔNG chính thức, ghim bản cố định; dùng **Zalo phụ** của chủ shop): `src/zalo.js` — đăng nhập QR (Cài đặt → Gửi đơn qua Zalo), phiên lưu `DATA_DIR/zalo-session.json` (mode 600, không vào database), chọn nhóm (settings `zalo_group_id/_name`, chỉ đổi qua `POST /api/zalo/group`), gửi xếp hàng cách nhau ≥2,5 giây, phiên chết thì đăng nhập lại 1 lần. API: `GET /api/zalo`, `POST /api/zalo/{login,logout,group,send,mark}`, `GET /api/zalo/groups` (admin). Cột mới `orders.zalo_sent_at` + lịch sử đơn "Gửi kho qua Zalo (…)", nhãn **Đã báo Zalo**. Trang Đơn hàng: nút **Gửi Zalo kho** (tiến độ, dừng, lỗi giữa chừng → chép lần lượt phần còn lại) và **Chép lần lượt** (dự phòng: quay lại tab web là tự chép đơn tiếp; điện thoại dùng nút Chia sẻ). Thẻ Messenger chuyển ra mục menu riêng **Messenger**. Tài liệu: `docs/chatbot/` (5 bước làm chatbot), `docs/tinh-nang.md` mục Gửi đơn qua Zalo. `npm test` 24/24; Edge headless: Cài đặt / Messenger / Đơn hàng không lỗi JS; đã thử tạo QR thật với Zalo (chưa thử đăng nhập + gửi tin thật: cần chủ shop quét QR).

- **25/11/2026:** Tổng tiền tự điền theo **bảng giá số hộp** (setting `price_table`, mặc định 1=95k, 2=130k, 3=195k, 4=250k, 5=300k; sửa ở Cài đặt). Extension 2.5.0 gọi action mới `prices` (server cũ không có → dùng giá mặc định; extension cũ không gọi → không ảnh hưởng). Quy tắc: tin nhắn đã ghi tiền thì giữ; tự gõ tổng tiền thì không ghi đè; số hộp ngoài bảng → để trống. Form Tạo đơn trên web cùng logic. Chỉ thêm setting + action, không đổi database cũ. `npm test` 23/23.

- **24/11/2026 (đêm) — dừng tại đây:** ⚠️ **Web quản lý đơn đã chạy thật: sửa code không được làm hỏng database / luồng hiện có** (chỉ thêm bảng / cột, không xóa, chạy `npm test` trước khi push). Sửa lỗi: lưu Cài đặt tách "Giao lâu, khách hủy" thành 2 lý do (đoạn sửa cũ bị mất) + test. Chủ shop báo **mỗi lần deploy phải nhập lại danh sách page** (Trứng sâu sấy canxi chất lượng cao, Trứng sâu canxi toàn quốc, Trứng sâu canxi chất lượng toàn quốc, Trứng sâu sấy canxi chất lượng cao toàn quốc): đã rà `deploy.sh` (không động database), Cài đặt lưu vào settings `fb_pages`, extension lưu chrome.storage → chưa tìm ra nguyên nhân, **chờ chủ shop kiểm tra** bằng lệnh `docker exec quanly-don node -e …` (xem tin nhắn cuối) trước và sau deploy. Messenger: app mới AI-chatbot chưa nhận được tin; đề nghị quay lại app trungsau_canxi (đã từng nhận tin thật của page 950788948115276), nối page mới vào app cũ, 3 mã META_* cùng 1 app.

- **24/11/2026 (tối):** Website **đã chạy thật** ở https://doanhwork.com (v1.3.0): xóa bản ghi A Vietnix, thêm route `doanhwork.com` + `www` vào tunnel quanly-don (giao diện Cloudflare mới: Routes → Add route → Published application). Đã kiểm tra: trang chủ 200, www → 301 về gốc, canonical / og:image dùng https, /api/* ở tên miền công khai trả 404. ⏳ Chủ shop cần: điền SĐT + link Messenger (chưa có thì không hiện nút liên hệ), kiểm tra các câu suy ra từ ảnh (thu trứng trong ngày, nắp ghi ngày nở, cỡ hũ 20–50g, sỉ & lẻ), **rotate token Tunnel** (token cũ từng lộ trên GitHub), đổi mật khẩu admin, chuyển repo sang Private.

- **24/11/2026 (chiều, tiếp):** Website: viết lại nội dung sau khi tra tài liệu (FAO Feedipedia, PMC, aviNews). Sửa hiểu sai: sản phẩm là **trứng ruồi lính đen để khách tự ấp nở, nuôi thành sâu canxi**, không phải thức ăn cho ăn trực tiếp. Trang chủ thêm số liệu, dinh dưỡng (khoảng giá trị, có nguồn), lợi ích theo vật nuôi, lợi ích tự nuôi, quy trình 4 bước, FAQ (+ JSON-LD FAQPage), nguồn. Logo SVG `site/img/logo.svg`; 12 ảnh chủ shop chọn lọc, thu nhỏ vào `site/img/`. 3 bài mẫu tự đăng 1 lần (`seed-posts.js`, cờ `posts_seeded`). Markdown hỗ trợ bảng. `saveSite` chỉ lưu mục đã sửa. `npm test`: 21/21.

- **24/11/2026 (chiều):** Bắt đầu **website giới thiệu** ở `doanhwork.com` (khung, chờ mẫu giao diện từ chủ shop). Cùng server: `server.js` chọn theo tên miền (`SITE_HOSTS`, mặc định doanhwork.com / www / site.localhost); www → 301 về tên miền gốc; tên miền công khai không có API quản lý. Code: `src/site/{render,content,markdown,uploads}.js`, CSS `site/site.css` (Dockerfile thêm `COPY site`). Trang: /, /san-pham, /trang-trai, /blog, /blog/:slug, /lien-he, /chinh-sach/{bao-mat,dieu-khoan,giao-hang,doi-tra,xoa-du-lieu}, sitemap.xml, robots.txt, /dang-nhap → don. Nội dung lưu settings key `site` + bảng `posts`; ảnh ở `data/uploads/<sha1>.<đuôi>` (kiểm tra byte đầu, ≤5 MB). Web quản lý thêm mục **Website** (Thông tin shop, Sản phẩm, Bài viết, Chính sách; tải ảnh tự thu nhỏ; xem trước markdown). `npm test`: 20/20; chạy thử Edge headless (máy tính + điện thoại) không lỗi JS. Hướng dẫn: `docs/9-website.md`. ⏳ Chờ: mẫu giao diện + nội dung thật từ chủ shop; nối Cloudflare cho tên miền gốc; giai đoạn 3 = form đặt hàng trên website.

- **24/11/2026 (trưa):** Webhook Messenger chạy: nhận được tin thật của page 950788948115276 (2 người khác nhau), nút Thử nghiệm OK. Page **Trứng sâu canxi toàn quốc** (1210722178801106) chưa về tin vì trước dùng **Pancake** (app nhận tin chính) → đang gỡ qua `facebook.com/settings/?tab=business_tools` (chỉ thấy khi mở bằng tài khoản cá nhân quản lý page). Mã page thiếu `pages_manage_metadata` nên nút kiểm tra đăng ký báo #200. Các lỗi đã gặp + cách sửa: `docs/8-messenger.md` mục "Gặp lỗi thì xem ở đây".

- **24/11/2026:** Sửa lỗi giao diện cũ sau deploy: Cloudflare đặt Browser Cache TTL 4 giờ cho .js/.css. `serveStatic` giờ trả index.html (no-cache) với `?v=<sha1 10 ký tự>` cho mọi file .js/.css nên đổi file là trình duyệt tải bản mới. `npm test`: 14/14.

- **24/11/2026 (tối):** Bắt đầu hướng chatbot Messenger (mức 2: tự trả lời). App Meta có sẵn: **trungsau_canxi** (loại Kinh doanh, đang ở chế độ Phát triển, `pages_messaging` = Standard access, đã gọi khoảng 10,7K lần qua n8n + ngrok trước đây; webhook cũ đã xóa). Thêm **webhook thử nghiệm** `src/meta.js`: `GET/POST /api/meta/webhook` (xác minh `META_VERIFY_TOKEN`, kiểm chữ ký `META_APP_SECRET`, lưu bảng `meta_events`), `GET /api/meta/events`, `POST /api/meta/test-reply` (cần `META_PAGE_TOKEN`), thẻ "Messenger (thử nghiệm)" trong Cài đặt. Trang privacy thêm mục Messenger + `#xoa-du-lieu`. Hướng dẫn: `docs/8-messenger.md`. ⏳ **Việc tiếp theo:** người dùng làm bước 4 của docs/8 (khách thật nhắn vào page) để biết có cần xin Advanced access không, rồi mới làm chatbot AI. Cần từ người dùng: bảng giá, câu hỏi thường gặp, cách xưng hô.
- **24/11/2026:** Nút Xóa tài khoản: chặn nếu tài khoản đã tự tạo đơn / thao tác đơn / nhập thu chi; nếu chỉ được chia đơn mà tạo chưa quá 24 giờ thì cho xóa, đơn trả về "Chưa chia" (sửa trường hợp tài khoản kho đầu tiên tạo nhầm tự ôm hết đơn).

- **24/11/2026:** Thêm nút **Xóa** tài khoản (`DELETE /api/users/:id`): chỉ xóa được tài khoản chưa có đơn (kho_id / created_by), thao tác (order_events) hay thu chi; có rồi thì báo lỗi, gợi ý Khóa. Không tự xóa mình. Xóa tài khoản kho đang nhận đơn mới thì `active_kho` về 0. `npm test`: 12/12.

- **24/11/2026:** Chia tài liệu thành thư mục `docs/` theo từng giai đoạn (mục lục: `docs/README.md`), bỏ `DEPLOY.md`. README gốc chỉ còn giới thiệu ngắn và link.

- **23/11/2026 (tối):** Sửa lỗi mã đơn trùng khi một ngày quá 999 đơn (`nextCode` so theo độ dài trước). Thêm `deploy/backup-gdrive.sh`: nén bản sao lưu mới nhất, đưa lên Google Drive bằng rclone mỗi tuần (cron 3:30 sáng Chủ nhật), giữ 365 ngày; hướng dẫn ở `docs/6-sao-luu.md`. ✅ 24/11/2026 đã cài trên server thật (Google Cloud project riêng, xác minh doanhwork.com, app ở chế độ In production), 2 bản đầu đã lên Drive. `npm test`: 11/11 qua. Đo dung lượng: khoảng 1,2 KB mỗi đơn, nên 100 đơn/ngày ≈ 45 MB/năm.

- **23/11/2026:** Thêm **lý do hoàn** (cột `orders.return_reason`, danh sách sửa ở Cài đặt → `return_reasons`, biểu đồ ở Tổng quan), **Sổ đỏ** (cờ `customers.flag = 'bom'` cũ, thêm `flagged_at`; API `POST /api/customers/blacklist`, `GET /api/customers/suspects`), tab **Khách quen** (`GET /api/customers?view=loyal`). Extension đổi câu cảnh báo thành "nằm trong SỔ ĐỎ". Database cũ tự thêm cột khi khởi động. README thêm lệnh chạy trên Windows. `npm test`: 10/10 qua; đã chạy thử giao diện bằng Edge headless, không lỗi JS.

- **22/11/2026:** Xong giai đoạn 1. Chốt kiến trúc giai đoạn 2. Đã kiểm tra Node 24 có `node:sqlite`. Bắt đầu viết server.
- **22/11/2026:** Xong backend và API, test tự động đều qua. Chạy thử trên máy: `cd server && ADMIN_PASSWORD=xxx npm start` → http://localhost:3000
- **22/11/2026 (tối):** Xong giao diện web, extension v2.0, Docker, DEPLOY.md. Đã chụp màn hình kiểm tra: Tổng quan, Đơn hàng, Tạo đơn (dán tin nhắn), Kho (máy tính + điện thoại), Khách hàng, Thu chi, Cài đặt. Không có lỗi JS. Kho bấm "Đã gửi" lưu đúng mã vận đơn và phí ship.

## ▶ Mai làm tiếp từ đây

1. Ở máy mới: chép thư mục dự án (hoặc `git clone`), cài Node ≥ 22.13, rồi chạy `cd server && npm test` để kiểm tra.
2. Build thử Docker: `cd server && docker compose build`.
3. Triển khai lên server Ubuntu theo `docs/` (giai đoạn 2 → 4): Cloudflare Tunnel → `.env` → `docker compose up -d --build`.
4. Tải lại extension trong Chrome, nhập địa chỉ web và mã API, rồi thử Ctrl+C trên Business Suite thật.
5. Ghi lại các lỗi hoặc mẫu tin nhắn bị tách sai để sửa.
6. Giai đoạn 3 (xem mục "Để sau"): API Viettel Post, tồn kho, nhập dữ liệu cũ từ Sheets.

## Ghi chú kỹ thuật (cho người code tiếp)

- **API** (xem `server/src/routes.js`): `/api/login`, `/api/bootstrap`, `/api/orders` (GET lọc: from, to, status, page, q, dup=1, cod=pending), `/api/orders/:id` (GET chi tiết, PATCH, DELETE), `/api/orders/bulk`, `/api/orders/check?phone=`, `/api/customers`, `/api/transactions`, `/api/report?from&to`, `/api/settings`, `/api/users`, `/api/me/api-token`, `/api/me/password`, `/api/backup` (tải file .db).
- **Lý do hoàn / sổ đỏ**: `updateOrder` chỉ nhận `return_reason` khi đơn đang / sẽ ở trạng thái `hoan`, rời trạng thái hoàn thì tự xóa. Lý do **đầu tiên** trong `return_reasons` = "cố tình phá" (dùng cho mục Nghi vấn và tự tick ô sổ đỏ). Danh sách đơn trả thêm `cflag` (cờ của khách), kho không thấy.
- **`/api/ext`**: giữ đúng định dạng của Apps Script cũ (`{action, token, ...}`, các action: ping, check, save, list), nên extension chỉ cần đổi link. `token` là mã API tạo trong web → Cài đặt.
- **Quyền kho** (`updateOrder` trong `orders.js`): chỉ sửa được `status` (moi/da_gui/da_giao/hoan), `tracking_code`, `ship_fee`, `kho_note`.
- **Lãi ước tính** = doanh thu (bỏ đơn hủy và hoàn) − giá vốn (SL × `cost_per_unit`) − phí ship − chi Quảng cáo − chi khác. **Không trừ** "Nhập hàng", vì giá vốn đã tính rồi.
- **Chống CSRF**: các request dùng cookie bắt buộc phải gửi `Content-Type: application/json`.
- **Thời gian** lưu dạng chuỗi giờ Việt Nam `YYYY-MM-DD HH:MM:SS`.
- **Lưu ý Windows**: `curl` trong Git Bash gửi tiếng Việt bị lỗi mã hóa. Hãy test bằng `npm test` (dùng fetch).
- **`server/public/parser.js`** là **bản sao** của `extension/parser.js`. Sửa bên nào thì copy sang bên kia.
- **Frontend**: mỗi trang là 1 hàm `VIEWS.<tên>(root)` trong `app.js`. Menu theo quyền nằm ở hằng `NAV`. Chi tiết đơn: `openOrder()`. Tạo đơn (có ô dán tin nhắn để tự điền): `orderForm()`.
