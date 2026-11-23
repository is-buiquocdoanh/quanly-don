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
| 5 | Docker + docker-compose + Cloudflare Tunnel + hướng dẫn triển khai | ✅ `server/Dockerfile`, `server/docker-compose.yml`, `DEPLOY.md`. ⚠️ **CHƯA build thử image** (Docker Desktop trên máy nhà đang tắt) |
| 6 | Chạy thử end-to-end trên máy | ✅ API + giao diện (Edge headless). ⏳ Chưa thử extension thật trên Business Suite với web |
| 7 | **Triển khai lên server Ubuntu thật** | ⏳ **VIỆC TIẾP THEO**, làm theo `DEPLOY.md` |

### Để sau (giai đoạn 3)

- Nối **API Viettel Post**: tự tạo vận đơn, tự lấy trạng thái giao, đối soát COD. Cần token đối tác VTP.
- Quản lý **tồn kho** (nhập hàng, tự trừ khi gửi).
- Nhập dữ liệu cũ từ Google Sheets (CSV).

## Nhật ký

- **23/11/2026 (tối):** Sửa lỗi mã đơn trùng khi một ngày quá 999 đơn (`nextCode` so theo độ dài trước). Thêm `deploy/backup-gdrive.sh`: nén bản sao lưu mới nhất, đưa lên Google Drive bằng rclone mỗi tuần (cron 3:30 sáng Chủ nhật), giữ 365 ngày; hướng dẫn ở DEPLOY.md mục "Sao lưu lên Google Drive". ⏳ Chưa cài trên server thật (cần chạy `rclone config`). `npm test`: 11/11 qua. Đo dung lượng: khoảng 1,2 KB mỗi đơn, nên 100 đơn/ngày ≈ 45 MB/năm.

- **23/11/2026:** Thêm **lý do hoàn** (cột `orders.return_reason`, danh sách sửa ở Cài đặt → `return_reasons`, biểu đồ ở Tổng quan), **Sổ đỏ** (cờ `customers.flag = 'bom'` cũ, thêm `flagged_at`; API `POST /api/customers/blacklist`, `GET /api/customers/suspects`), tab **Khách quen** (`GET /api/customers?view=loyal`). Extension đổi câu cảnh báo thành "nằm trong SỔ ĐỎ". Database cũ tự thêm cột khi khởi động. README thêm lệnh chạy trên Windows. `npm test`: 10/10 qua; đã chạy thử giao diện bằng Edge headless, không lỗi JS.

- **22/11/2026:** Xong giai đoạn 1. Chốt kiến trúc giai đoạn 2. Đã kiểm tra Node 24 có `node:sqlite`. Bắt đầu viết server.
- **22/11/2026:** Xong backend và API, test tự động đều qua. Chạy thử trên máy: `cd server && ADMIN_PASSWORD=xxx npm start` → http://localhost:3000
- **22/11/2026 (tối):** Xong giao diện web, extension v2.0, Docker, DEPLOY.md. Đã chụp màn hình kiểm tra: Tổng quan, Đơn hàng, Tạo đơn (dán tin nhắn), Kho (máy tính + điện thoại), Khách hàng, Thu chi, Cài đặt. Không có lỗi JS. Kho bấm "Đã gửi" lưu đúng mã vận đơn và phí ship.

## ▶ Mai làm tiếp từ đây

1. Ở máy mới: chép thư mục dự án (hoặc `git clone`), cài Node ≥ 22.13, rồi chạy `cd server && npm test` để kiểm tra.
2. Build thử Docker: `cd server && docker compose build`.
3. Triển khai lên server Ubuntu theo `DEPLOY.md`: Cloudflare Tunnel → `.env` → `docker compose up -d --build`.
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
