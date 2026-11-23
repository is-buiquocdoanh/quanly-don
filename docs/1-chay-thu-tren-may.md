# Giai đoạn 1. Chạy thử trên máy tính

> **Mục tiêu:** chạy web trên laptop để sửa code và thử tính năng mới, không cần Docker hay server.  
> **Làm khi nào:** mỗi khi sửa code.  
> **Thời gian:** lần đầu khoảng 10 phút.

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

---

[Mục lục](README.md) · [Giai đoạn 2: Tên miền và Cloudflare](2-ten-mien-cloudflare.md) →
