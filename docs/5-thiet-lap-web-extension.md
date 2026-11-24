# Giai đoạn 5. Thiết lập web, extension, điện thoại

> **Mục tiêu:** chủ shop đăng nhập web, extension gửi được đơn từ Business Suite vào web, kho dùng được trên điện thoại.  
> **Làm khi nào:** một lần, sau khi web đã chạy ở Giai đoạn 4.  
> **Thời gian:** khoảng 20 phút.

## 1. Thiết lập lần đầu trên web

1. Đăng nhập bằng `admin` và mật khẩu đã đặt trong `.env`, rồi vào **Cài đặt → Đổi mật khẩu**.
2. **Cài đặt → Cửa hàng**: nhập **giá vốn 1 hộp** để web tính lãi.
3. **Cài đặt → Tài khoản → Thêm tài khoản**: tạo tài khoản quyền **Kho** cho người gửi hàng. Tạo nhầm thì bấm **Xóa** ở dòng tài khoản đó rồi tạo lại.
4. **Cài đặt → Chrome extension → Tạo mã mới**: copy mã `ext_…`.

## 2. Cài extension vào Chrome

1. Mở `chrome://extensions` và bật **Chế độ dành cho nhà phát triển**.
2. Bấm **Tải tiện ích đã giải nén** và chọn thư mục `extension`.
3. Ghim icon extension lên thanh công cụ (biểu tượng 🧩 → 📌). Bấm icon để mở **bảng đơn hàng bên cạnh**: bảng luôn mở khi làm việc trên Facebook, tự cập nhật khi lưu đơn.

Cập nhật extension sau này: lấy code mới về máy (`git pull`), vào `chrome://extensions` bấm ⟳ (Tải lại) trên extension rồi F5 trang Facebook.

## 3. Nối extension với web

1. Ở `chrome://extensions`, tìm **Bắt đơn Mess**, bấm **Chi tiết → Tùy chọn tiện ích**:
   - Địa chỉ web: `https://don.doanhwork.com`
   - Mã API: mã `ext_…` đã copy ở mục 1
2. Bấm **Lưu & kiểm tra kết nối**, rồi **Cho phép** khi Chrome hỏi quyền. Phải thấy ✅.

## 4. Dùng extension hằng ngày

| Việc | Cách làm |
|---|---|
| Lưu đơn | Bôi đen tin chốt đơn → **Ctrl+C** → kiểm tra → **Enter** |
| Tổng tiền tự điền | Có **số lượng** mà tin nhắn không ghi tiền (hoặc bạn gõ / đổi số lượng) → tổng tiền tự lấy theo **web → Cài đặt → Giá theo số hộp** (mặc định 1 hộp 95k, 2 hộp 130k, 3 hộp 195k, 4 hộp 250k, 5 hộp 300k). Tin nhắn đã ghi tiền thì giữ nguyên; tự gõ ô tổng tiền thì không bị ghi đè; số hộp ngoài bảng giá thì ô tổng tiền để trống (vàng) để tự điền. Form *Tạo đơn* trên web cũng vậy. Cần extension **2.5.0** trở lên |
| AI đọc đơn | Tự chạy khi mở khung (vài giây): thêm dấu, mở rộng viết tắt (x → Xã, h → Huyện…), tách tên / SĐT / địa chỉ / số lượng / tiền từ tin lộn xộn, báo thông tin còn thiếu. Ô bạn đã sửa thì AI không ghi đè. Tắt ở trang Tùy chọn của extension |
| Đoạn không có SĐT | Bôi đen → **Alt+S** (phím mở khung) |
| Page tự điền | Web → Cài đặt → **Các page Facebook**: nhập tên các page **giống hệt tên trên Facebook**. Extension nhận page đang mở theo tên page hiện trên màn hình Business Suite; không nhận ra thì chọn 1 lần ở **Page đang mở** trong bảng bên cạnh (nhớ theo mã page và theo tab) |
| Phím tắt riêng | Tùy chọn của extension → **Phím tắt**: đặt phím mở khung và phím lưu đơn, ví dụ cùng là **1**: bôi đen → **1** → **1**. Phím đơn chỉ có tác dụng khi không gõ trong ô chat / ô nhập. Đơn trùng SĐT phải nhấn phím lưu thêm 1 lần |
| Đóng khung | **Esc** |
| Đổi chỗ khung lưu đơn | Kéo thanh tiêu đề khung, lần sau mở đúng chỗ đó |
| Bật / tắt bắt đơn | Công tắc trong bảng bên cạnh hoặc trang Tùy chọn, phím tắt **Alt+Shift+B**. Khi tắt, icon hiện chữ **TẮT** |

## 5. AI đọc đơn (tùy chọn, tốn phí)

Server gọi Claude để đọc cả những đoạn chat quá lộn xộn mà bộ đọc thường chịu. Mặc định tắt; bật ở trang Tùy chọn của extension. Khóa API chỉ nằm trên server.

1. Tạo khóa ở https://platform.claude.com → API Keys.
2. Thêm vào `.env` của server (`~/apps/quanly-don/.env` hoặc `server/.env` khi chạy dev): `ANTHROPIC_API_KEY=sk-ant-...`
3. Khởi động lại web (`./deploy.sh <phiên bản>` hoặc `docker compose up -d`). Extension → Tùy chọn → **Lưu & kiểm tra kết nối** sẽ báo "AI đọc đơn: đã bật".

Mặc định dùng model `claude-opus-5-5` (ước tính khoảng 200–300 đồng mỗi đơn). Muốn rẻ hơn nhiều (khoảng 10 đồng mỗi đơn, đọc kém hơn một chút với tin khó): thêm `AI_MODEL=claude-haiku-5-5`. Không có khóa hoặc AI lỗi thì extension tự dùng bộ lọc thường như trước.

## 6. Kho dùng trên điện thoại

- Mở `https://don.doanhwork.com` và đăng nhập tài khoản kho.
- Bấm **Thêm vào màn hình chính** (Chrome: menu ⋮; Safari: nút Chia sẻ) để có icon như app.
- Quy trình: tab **Chờ gửi** → copy thông tin sang app Viettel Post → nhập mã vận đơn và phí ship → **✓ Đã gửi**.

---

← [Giai đoạn 4: Phát hành và cập nhật phiên bản](4-phat-hanh-cap-nhat.md) · [Mục lục](README.md) · [Giai đoạn 6: Sao lưu (server + Google Drive)](6-sao-luu.md) →
