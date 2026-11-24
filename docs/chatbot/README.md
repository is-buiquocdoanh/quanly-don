# Chatbot Messenger: hướng dẫn từng bước

Làm lần lượt 5 bước, xong bước nào đánh dấu bước đó. Bước nào kẹt thì mở **[Bước 5: Webhook im lặng](5-khi-webhook-im-lang.md)**.

| # | Bước | Làm ở đâu | Xong |
|---|---|---|---|
| 1 | [Tạo app, thêm Messenger, lấy mã Trang](1-tao-app-lay-ma.md) | Meta for Developers + server | ☐ |
| 2 | [Cài webhook (URL + mã xác minh)](2-cai-webhook.md) | Meta for Developers | ☐ |
| 3 | [Đăng ký sự kiện cho đúng Trang](3-dang-ky-su-kien.md) | Meta for Developers | ☐ |
| 4 | [Trả lời bằng Claude](4-tra-loi-bang-claude.md) | Anthropic Console + server (code **chưa làm**) | ☐ |
| 5 | [Webhook im lặng: kiểm tra theo thứ tự](5-khi-webhook-im-lang.md) | Khi cần | — |

## Sơ đồ

```
Khách nhắn vào Trang
      │
      ▼
Meta (app trungsau_canxi) ──POST──►  https://don.doanhwork.com/api/meta/webhook   (bước 2, 3)
                                            │  web lưu tin, kiểm tra chữ ký
                                            ▼
                                     Claude API soạn câu trả lời                   (bước 4)
                                            │
      ◄────── Graph API /me/messages ───────┘   gửi lại đúng người, bằng mã Trang  (bước 1)
```

## 3 điều cần nhớ trước khi bắt đầu

1. **Không cần n8n.** Web quản lý đơn đã có sẵn địa chỉ nhận tin (`/api/meta/webhook`). Mỗi app Meta chỉ có **một** URL webhook: dùng web thì không trỏ sang n8n nữa, và ngược lại.
2. **Ba mã `META_*` phải lấy từ cùng một app.** Lỗi hay gặp nhất khi đổi app là đổi được 1–2 mã, còn sót mã của app cũ. Nên dùng app **trungsau_canxi** (đã từng nhận được tin thật), không tạo app mới nữa.
3. **Chưa cần xác minh doanh nghiệp để thử.** Thử trên Trang của mình, với tài khoản có vai trò trong app, là chạy được ngay. Chỉ khi muốn trả lời **mọi khách** (người không có vai trò trong app) mới cần chuyển app sang *Chính thức*, và có thể phải xin quyền nâng cao. Xem [Bước 3, mục 3.4](3-dang-ky-su-kien.md#34-khách-thật-có-nhận-được-không).

Những lỗi đã gặp thật khi cài cho shop: [Giai đoạn 8: Messenger](../8-messenger.md#gặp-lỗi-thì-xem-ở-đây).

---

← [Mục lục tài liệu](../README.md)
