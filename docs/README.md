# Tài liệu

Làm lần lượt từ trên xuống. Mỗi giai đoạn là một file ngắn, xong giai đoạn nào thì sang giai đoạn sau. Cuối mỗi file có link sang giai đoạn tiếp theo.

| # | Giai đoạn | Khi nào |
|---|---|---|
| 1 | [Chạy thử trên máy tính](1-chay-thu-tren-may.md) | Mỗi khi sửa code |
| 2 | [Tên miền và Cloudflare](2-ten-mien-cloudflare.md) | Một lần |
| 3 | [Cài đặt server](3-cai-dat-server.md) | Một lần |
| 4 | [Phát hành và cập nhật phiên bản](4-phat-hanh-cap-nhat.md) | Lần đầu, rồi mỗi khi có bản mới |
| 5 | [Thiết lập web, extension, điện thoại](5-thiet-lap-web-extension.md) | Một lần |
| 6 | [Sao lưu (server + Google Drive)](6-sao-luu.md) | Một lần (Google Drive) |
| 7 | [Vận hành hằng ngày và xử lý sự cố](7-van-hanh-su-co.md) | Khi cần tra cứu |
| 8 | [Messenger: kiểm tra trước khi làm chatbot](8-messenger.md) | Trước khi làm chatbot |
| 9 | [Website giới thiệu (doanhwork.com)](9-website.md) | Một lần, rồi viết bài dần |

Chatbot Messenger (làm sau giai đoạn 8): [**chatbot/**](chatbot/README.md): 5 bước từ tạo app Meta, cài webhook, đăng ký sự kiện, trả lời bằng Claude, đến cách kiểm tra khi webhook im lặng.

Tra cứu thêm:

- [Tính năng của web](tinh-nang.md): mỗi trang làm được gì, lý do hoàn, Sổ đỏ, Khách quen, đọc địa chỉ tự động.
- [PROGRESS.md](../PROGRESS.md): nhật ký tiến độ và ghi chú kỹ thuật (đọc trước khi code tiếp).

```
Máy tính (1)  ──git push──►  GitHub  ◄──deploy.sh (4)──  Server Ubuntu (3)  ◄──Tunnel──  Cloudflare + tên miền (2)
                                                              │
                                    web, extension, điện thoại (5) · sao lưu (6) · vận hành (7)
```
