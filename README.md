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
| **Kho gửi hàng** | Kho + chủ shop | Thẻ đơn chờ gửi, nút copy từng ô sang app Viettel Post, nhập mã vận đơn và phí ship, chuyển Đã gửi / Đã giao / Hoàn, in danh sách. Bấm **Bị hoàn** phải chọn **lý do hoàn** |
| **Khách hàng** | Chủ shop | 3 tab: **Tất cả** (lịch sử mua theo SĐT, đánh dấu VIP), **Khách quen** (mua nhiều, mua thường xuyên), **Sổ đỏ** (SĐT tạo đơn ảo / phá / bom hàng, có cảnh báo khi đặt lại). Chi tiết ở mục [Lý do hoàn, Sổ đỏ, Khách quen](#lý-do-hoàn-sổ-đỏ-khách-quen) |
| **Thu chi** | Chủ shop | Chi quảng cáo theo page, nhập hàng, ship, lương…; COD về và COD chờ về |
| **Chia đơn cho kho** | Chủ shop | Mỗi tài khoản quyền **Kho** (chủ shop tạo, đưa cho 1 bên có hàng) **chỉ thấy đơn được chia cho mình**: không thấy đơn, mã vận đơn, ghi chú của kho khác, không thấy fanpage, link chat, giá vốn. Chỉ có 1 tài khoản kho thì mọi đơn tự vào kho đó. Nhiều kho: công tắc "Đơn mới giao cho…" ở trang Đơn hàng / Cài đặt để đổi kho khi hết hàng, kèm chuyển luôn các đơn chờ gửi. Chia từng đơn / hàng loạt. Tổng quan có bảng theo kho |
| **Cài đặt** | Chủ shop | Giá vốn, danh mục thu chi, danh sách lý do hoàn, tài khoản kho, mã API cho extension, tải bản sao lưu |

## Quy trình làm việc

```
LAPTOP                                 GITHUB                        SERVER (~/apps/quanly-don)
sửa code, npm run dev thử   ──push──►  lưu code
git tag v1.1.0              ──push──►  lưu tag v1.1.0  ◄──git fetch── ./deploy.sh v1.1.0
                                                                     → lấy code đúng bản v1.1.0
                                                                     → build image quanly-don:v1.1.0
                                                                     → thay container → web bản mới
```

### 1. Sửa và chạy thử trên laptop (không cần Docker)

Cần Node.js 24 (file `server/.nvmrc`).

**Windows (PowerShell)**

```powershell
cd d:\01_Tools\Vscode\quanly-don\server
npm install                        # lần đầu, hoặc khi package.json đổi
$env:ADMIN_PASSWORD = "123456"
npm run dev                        # mở http://localhost:3000, đăng nhập admin / 123456
npm test                           # chạy test API (mở terminal khác)
```

- Báo lỗi *"running scripts is disabled on this system"*: chạy 1 lần `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` (gõ `Y`), đóng rồi mở lại terminal. Máy công ty bị khóa chính sách này thì gõ `npm.cmd` thay cho `npm` (ví dụ `npm.cmd run dev`).
- Kiểu viết `ADMIN_PASSWORD=123456 npm run dev` chỉ chạy trên Linux / macOS / Git Bash, PowerShell không hiểu.
- `nvm use` của nvm-windows không đọc `.nvmrc`; gõ `nvm use 24` hoặc bỏ qua nếu `node -v` đã là v24.

**Linux / macOS / Git Bash**

```bash
cd server
nvm use                              # chuyển sang Node 24 (lần đầu: nvm install)
npm install                          # lần đầu
ADMIN_PASSWORD=123456 npm run dev    # mở http://localhost:3000, đăng nhập admin / 123456
npm test                             # chạy test API
```

- Sửa **`public/`** (giao diện: HTML, CSS, JS): lưu file rồi tải lại trang (F5) là thấy.
- Sửa **`src/`** (backend): server tự khởi động lại, rồi tải lại trang.
- Không muốn đặt `ADMIN_PASSWORD` mỗi lần: tạo file `server/.env` chứa `ADMIN_PASSWORD=123456`. `npm run dev` tự đọc file này (cả Windows lẫn Linux), và git bỏ qua nó.
- Dữ liệu chạy thử nằm ở `server/data/`. Xóa thư mục này là làm lại từ đầu. Mật khẩu admin chỉ được tạo ở lần chạy đầu, khi `data/` còn trống.
- Xem giao diện điện thoại: Chrome → F12 → Ctrl+Shift+M.

### 2. Phát hành và triển khai

```bash
git add -A && git commit -m "…" && git push      # lưu code
git tag v1.1.0 && git push origin v1.1.0          # đánh dấu phiên bản
```
Trên server: `~/apps/quanly-don/deploy.sh v1.1.0`. Bản mới lỗi thì `deploy.sh v1.0.1` để quay lại. Chi tiết ở [DEPLOY.md](DEPLOY.md).

## Lý do hoàn, Sổ đỏ, Khách quen

**Lý do hoàn.** Khi kho hoặc chủ shop bấm **Bị hoàn** (trang Kho, chi tiết đơn, hay đổi trạng thái hàng loạt), web hỏi lý do: chọn trong danh sách hoặc gõ lý do khác. Lý do hiện ở danh sách đơn, thẻ đơn của kho và lịch sử khách. Trang **Tổng quan** có biểu đồ **Lý do hoàn** theo khoảng ngày đang xem. Hoàn tác (đổi lại về Đã gửi) thì lý do cũ tự xóa.

- Sửa danh sách lý do ở **Cài đặt → Lý do hoàn**. Lý do **đứng đầu** được hiểu là *khách cố tình phá* (mặc định "Đơn ảo / cố tình phá"): chọn lý do này thì ô **Đưa SĐT vào Sổ đỏ** tự được tick (chỉ chủ shop thấy ô này, kho thì không).

**Sổ đỏ** (Khách hàng → tab Sổ đỏ). Danh sách SĐT từng tạo đơn ảo, phá hoặc bom hàng. Đặt đơn bằng SĐT trong sổ đỏ thì form tạo đơn, chi tiết đơn và extension đều hiện cảnh báo đỏ; danh sách đơn có nhãn **Sổ đỏ** cạnh tên khách.

- Đưa vào sổ đỏ bằng 1 trong 4 cách: tick ô khi báo hoàn; nút **+ Thêm SĐT vào Sổ đỏ** (dùng được cả với SĐT chưa từng đặt đơn); nút **Vào sổ đỏ** ở mục **Nghi vấn**; hoặc mở 1 khách → Đánh dấu → *Sổ đỏ*.
- Mục **Nghi vấn** gợi ý khách chưa vào sổ đỏ nhưng: có đơn hoàn vì lý do *cố tình phá*, hoặc hoàn từ 2 đơn mà chưa nhận đơn nào, hoặc hoàn từ 3 đơn và hoàn nhiều hơn nhận.
- Gỡ khỏi sổ đỏ: mở khách → Đánh dấu → *—* → Lưu. Cờ "bom hàng" cũ chính là sổ đỏ, không mất dữ liệu.

**Khách quen** (Khách hàng → tab Khách quen). Khách có từ 2 đơn **đã giao**, xếp theo số đơn rồi tổng tiền. Cột **Chu kỳ** là số ngày trung bình giữa 2 lần mua; khách đã quá chu kỳ khoảng 30% mà chưa đặt lại thì hiện chữ đỏ **quá chu kỳ**, nên nhắn chăm sóc. Khách trong sổ đỏ không hiện ở đây.

## Đưa lên server

Xem **[DEPLOY.md](DEPLOY.md)**.

## Đọc địa chỉ tự động (miễn phí)

Extension và form tạo đơn trên web tự đọc địa chỉ bằng danh sách xã/phường, quận/huyện, tỉnh thật của Việt Nam (cả 63 tỉnh cũ lẫn 34 tỉnh sau sáp nhập 7/2025), không cần AI, không tốn phí:

- Thêm dấu, mở rộng viết tắt: `kp3 p tan hiep tp bien hoa dong nai` → Khu Phố 3, Phường Tân Hiệp, Thành phố Biên Hòa, Tỉnh Đồng Nai
- Khách không ghi tỉnh → tự điền theo quận/huyện (`p5 q3` → TP Hồ Chí Minh) và báo lại
- Gõ sai tên xã → chọn xã gần nhất trong đúng huyện và báo để kiểm tra
- Thêm dấu cho họ, tên đệm và tên phổ biến; tên có nhiều cách viết dấu thì giữ nguyên và nhắc sửa
- Báo thiếu số nhà / thôn, xã / phường, SĐT, số lượng, tiền

Cập nhật danh sách khi có thay đổi địa giới: `node tools/build-vn-admin.mjs` (ghi vào `extension/` và `server/public/`).

## AI đọc đơn (tùy chọn, tốn phí)

Server gọi Claude để đọc cả những đoạn chat quá lộn xộn mà bộ đọc thường chịu. Mặc định tắt; bật ở trang Tùy chọn của extension. Khóa API chỉ nằm trên server.

1. Tạo khóa ở https://platform.claude.com → API Keys.
2. Thêm vào `.env` của server (`~/apps/quanly-don/.env` hoặc `server/.env` khi chạy dev): `ANTHROPIC_API_KEY=sk-ant-...`
3. Khởi động lại web (`./deploy.sh <phiên bản>` hoặc `docker compose up -d`). Extension → Tùy chọn → **Lưu & kiểm tra kết nối** sẽ báo "AI đọc đơn: đã bật".

Mặc định dùng model `claude-opus-5-5` (ước tính khoảng 200–300 đồng mỗi đơn). Muốn rẻ hơn nhiều (khoảng 10 đồng mỗi đơn, đọc kém hơn một chút với tin khó): thêm `AI_MODEL=claude-haiku-5-5`. Không có khóa hoặc AI lỗi thì extension tự dùng bộ lọc thường như trước.

## Cài extension

1. Mở `chrome://extensions` và bật **Chế độ dành cho nhà phát triển**.
2. Bấm **Tải tiện ích đã giải nén** và chọn thư mục `extension`.
3. Vào **Tùy chọn** của extension: nhập địa chỉ web và mã API (lấy ở web → Cài đặt → Tạo mã mới).
4. Ghim icon extension lên thanh công cụ (biểu tượng 🧩 → 📌). Bấm icon để mở **bảng đơn hàng bên cạnh**: bảng luôn mở khi làm việc trên Facebook, tự cập nhật khi lưu đơn.

Đã cài bản cũ: sau khi cập nhật code, vào `chrome://extensions` bấm ⟳ (Tải lại) trên extension rồi F5 trang Facebook.

| Việc | Cách làm |
|---|---|
| Lưu đơn | Bôi đen tin chốt đơn → **Ctrl+C** → kiểm tra → **Enter** |
| AI đọc đơn | Tự chạy khi mở khung (vài giây): thêm dấu, mở rộng viết tắt (x → Xã, h → Huyện…), tách tên / SĐT / địa chỉ / số lượng / tiền từ tin lộn xộn, báo thông tin còn thiếu. Ô bạn đã sửa thì AI không ghi đè. Tắt ở trang Tùy chọn của extension |
| Đoạn không có SĐT | Bôi đen → **Alt+S** (phím mở khung) |
| Page tự điền | Web → Cài đặt → **Các page Facebook**: nhập tên các page **giống hệt tên trên Facebook**. Extension nhận page đang mở theo tên page hiện trên màn hình Business Suite; không nhận ra thì chọn 1 lần ở **Page đang mở** trong bảng bên cạnh (nhớ theo mã page và theo tab) |
| Phím tắt riêng | Tùy chọn của extension → **Phím tắt**: đặt phím mở khung và phím lưu đơn, ví dụ cùng là **1**: bôi đen → **1** → **1**. Phím đơn chỉ có tác dụng khi không gõ trong ô chat / ô nhập. Đơn trùng SĐT phải nhấn phím lưu thêm 1 lần |
| Đóng khung | **Esc** |
| Đổi chỗ khung lưu đơn | Kéo thanh tiêu đề khung, lần sau mở đúng chỗ đó |
| Bật / tắt bắt đơn | Công tắc trong bảng bên cạnh hoặc trang Tùy chọn, phím tắt **Alt+Shift+B**. Khi tắt, icon hiện chữ **TẮT** |
