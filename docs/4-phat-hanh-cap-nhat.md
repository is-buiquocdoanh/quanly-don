# Giai đoạn 4. Phát hành và cập nhật phiên bản

> **Mục tiêu:** đưa code mới lên web thật bằng một lệnh, và quay lại bản cũ ngay khi bản mới có lỗi.  
> **Làm khi nào:** lần đầu sau Giai đoạn 3, rồi mỗi khi có bản mới.  
> **Thời gian:** vài phút mỗi lần.

## Toàn cảnh

```
LAPTOP                                 GITHUB                        SERVER (~/apps/quanly-don)
sửa code, npm run dev thử   ──push──►  lưu code
git tag v1.1.0              ──push──►  lưu tag v1.1.0  ◄──git fetch── ./deploy.sh v1.1.0
                                                                     → lấy code đúng bản v1.1.0
                                                                     → build image quanly-don:v1.1.0
                                                                     → thay container → web bản mới
```

## 1. Trên máy lập trình: đánh dấu một phiên bản
Khi code trên nhánh `main` đã ổn:
```bash
git add -A && git commit -m "…" && git push    # lưu code
git tag v1.1.0 && git push origin v1.1.0        # đánh dấu phiên bản
```
Đặt số phiên bản theo dạng `vLỚN.VỪA.NHỎ`: sửa lỗi thì tăng số cuối (`v1.0.1`), thêm tính năng thì tăng số giữa (`v1.1.0`).

## 2. Trên server: dùng `deploy.sh`
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

### Cập nhật chính file `deploy.sh`

`deploy.sh` trên server là bản chép ra lúc cài, **không tự cập nhật**. Khi có thay đổi ở `deploy/deploy.sh` (ví dụ từ v1.6.0: kèm file extension vào web để tải ở Cài đặt), lấy bản mới theo đúng phiên bản sắp deploy:
```bash
cd ~/apps/quanly-don
git -C src fetch --tags --force origin
git -C src show v1.6.0:deploy/deploy.sh > deploy.sh.new && mv deploy.sh.new deploy.sh && chmod +x deploy.sh
./deploy.sh v1.6.0
```
Ghi ra `deploy.sh.new` trước rồi mới đổi tên: nếu lệnh `git show` lỗi (vd tag chưa được push) thì `deploy.sh` cũ vẫn còn nguyên. Ghi thẳng `> deploy.sh` mà lỗi thì file bị **trống**; khi đó lấy lại bản đang chạy bằng `git -C src show <bản đang chạy>:deploy/deploy.sh > deploy.sh.new && mv deploy.sh.new deploy.sh && chmod +x deploy.sh`.
Quên bước này thì web vẫn chạy bình thường, chỉ thiếu nút tải extension (Cài đặt báo "chưa kèm file extension").

## 3. Lần chạy đầu tiên
```bash
~/apps/quanly-don/deploy.sh v1.0.0     # hoặc ./deploy.sh nếu chưa có tag nào
~/apps/quanly-don/deploy.sh --status
```
Kiểm tra:
- Ngay trên server: `curl http://localhost:3010/api/health` (cổng `WEB_PORT` trong `.env`; atlasweb đã dùng 3000)
- Từ bất kỳ đâu: `https://don.doanhwork.com`. Ở Cloudflare Zero Trust, tunnel phải hiện **HEALTHY**.

> **Khi deploy.sh hoặc docker-compose.yml trong repo có thay đổi**, chép lại bản mới:
> `cd ~/apps/quanly-don && git -C src pull && cp src/deploy/deploy.sh src/deploy/docker-compose.yml src/deploy/backup-gdrive.sh .`

---

← [Giai đoạn 3: Cài đặt server](3-cai-dat-server.md) · [Mục lục](README.md) · [Giai đoạn 5: Thiết lập web, extension, điện thoại](5-thiet-lap-web-extension.md) →
