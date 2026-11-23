# Giai đoạn 3. Cài đặt server

> **Mục tiêu:** server Ubuntu có Docker, đọc được code trên GitHub, có sẵn thư mục `~/apps/quanly-don` với file `.env`.  
> **Làm khi nào:** một lần, sau Giai đoạn 2.  
> **Thời gian:** khoảng 20 phút.

## 1. Cài Docker và Git (nếu chưa có)
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER     # để chạy docker không cần sudo. Đăng xuất rồi đăng nhập lại
sudo apt install -y git
```

## 2. Cho server đọc được repo GitHub (repo riêng tư)
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

## 3. Tạo thư mục ứng dụng
```bash
mkdir -p ~/apps/quanly-don && cd ~/apps/quanly-don
git clone github-quanly-don:is-buiquocdoanh/quanly-don.git src

cp src/deploy/deploy.sh src/deploy/docker-compose.yml src/deploy/backup-gdrive.sh .
cp src/deploy/.env.example .env
nano .env          # sửa ADMIN_PASSWORD, dán TUNNEL_TOKEN ở Giai đoạn 2

mkdir -p data && sudo chown -R 1000:1000 data   # container chạy bằng user id 1000
```

Cấu trúc sau khi cài:
```
~/apps/quanly-don/
├── deploy.sh             ← lệnh triển khai
├── backup-gdrive.sh      ← chép bản sao lưu lên Google Drive (Giai đoạn 6)
├── docker-compose.yml
├── .env                  ← mật khẩu, token (bí mật, không đưa lên git)
├── data/                 ← DATABASE + bản sao lưu hằng ngày (quan trọng nhất)
├── backups-deploy/       ← bản sao database tự chụp trước mỗi lần đổi phiên bản
├── deploy.log            ← lịch sử deploy
└── src/                  ← code lấy từ GitHub (deploy.sh tự cập nhật, đừng sửa tay)
```

---

← [Giai đoạn 2: Tên miền và Cloudflare](2-ten-mien-cloudflare.md) · [Mục lục](README.md) · [Giai đoạn 4: Phát hành và cập nhật phiên bản](4-phat-hanh-cap-nhat.md) →
