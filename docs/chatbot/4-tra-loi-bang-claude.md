# Bước 4. Trả lời bằng Claude

> **Trạng thái:** phần code **chưa làm**. Hiện web mới nhận và lưu tin; trả lời bằng tay qua nút *Trả lời thử*. Khi Bước 1–3 chạy được với khách thật thì báo để làm phần này.
>
> Việc của bạn bây giờ: chuẩn bị **mã Claude API** (4.2), chọn **model** (4.3) và gom **nội dung cho bot** (4.4).

## 4.1. Bot sẽ chạy thế nào

```
Tin khách đến webhook
  → web lấy lịch sử chat gần đây với khách đó + thông tin sản phẩm, bảng giá (Cài đặt → Giá theo số hộp)
  → gửi cho Claude API, nhận câu trả lời
  → gửi lại đúng người qua Graph API (/me/messages, dùng META_PAGE_TOKEN)
```

Những việc web sẽ tự lo:
- Chỉ trả lời trong **24 giờ** kể từ tin cuối của khách (luật của Meta).
- Khách đã có **đơn đang giao** thì không mời mua thêm, chỉ hỗ trợ.
- Khách gửi đủ **tên, SĐT, địa chỉ** thì tạo **đơn mới** trong web để bạn duyệt, như đơn từ extension (có kiểm tra trùng SĐT và Sổ đỏ).
- **Nhân viên vào trả lời** thì bot im với khách đó một thời gian.
- Nút **tắt bot** trong Cài đặt, phòng khi bot trả lời sai.

## 4.2. Lấy mã Claude API

1. Vào https://console.anthropic.com, đăng ký bằng email của shop.
2. **Billing** → nạp tiền (thẻ Visa/Mastercard). Nạp ít để thử trước, ví dụ 5–10 USD.
3. **Billing → Limits**: đặt **giới hạn chi tiêu mỗi tháng**, để không bao giờ bị trừ quá số tiền bạn muốn.
4. **API Keys → Create Key** → đặt tên `quanly-don` → copy mã (bắt đầu bằng `sk-ant-`). **Mã chỉ hiện một lần.**
5. Trên server thêm vào `.env` rồi `docker compose up -d`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

> Mã này tiêu tiền thật: giữ bí mật như mật khẩu ngân hàng. Lộ thì vào Console xóa mã đó, tạo mã mới.

## 4.3. Chọn model và chi phí

Claude tính tiền theo lượng chữ gửi vào và nhận về (*token*; tiếng Việt khoảng 1 token cho 2–4 ký tự). Giá cho mỗi 1 triệu token:

| Model | Gửi vào | Nhận về | Hợp với |
|---|---|---|---|
| **Claude Opus 5.5** (mặc định) | 4 USD | 20 USD | Tư vấn khéo nhất, ít trả lời sai |
| Claude Sonnet 5.5 | 2 USD | 10 USD | Cân bằng giá và chất lượng |
| Claude Haiku 5.5 | 0,10 USD | 0,50 USD | Rẻ nhất, hợp câu hỏi đơn giản, lặp lại |

**Ước tính thô**, giả sử mỗi lượt trả lời gửi vào khoảng 3.000 token (thông tin sản phẩm + lịch sử chat) và nhận về khoảng 500 token:

| Model | 1 lượt trả lời | 100 khách/ngày × 6 lượt (≈ 18.000 lượt/tháng) |
|---|---|---|
| Opus 5.5 | ≈ 0,022 USD | ≈ 400 USD/tháng |
| Sonnet 5.5 | ≈ 0,011 USD | ≈ 200 USD/tháng |
| Haiku 5.5 | ≈ 0,0006 USD | ≈ 10 USD/tháng |

Thực tế thường **thấp hơn** bảng trên: phần thông tin sản phẩm lặp lại ở mọi lượt được Claude lưu tạm (*prompt caching*) và tính giá rẻ hơn nhiều. Sau 1 tuần chạy thật, mục **Usage** trong Console cho số chính xác.

**Quyết định của bạn:** dùng model nào. Cách an toàn: chạy thử trên 1 Trang vài ngày, xem chất lượng trả lời và hóa đơn, rồi mới chốt. Đổi model chỉ là sửa 1 dòng cài đặt.

## 4.4. Chuẩn bị nội dung cho bot

Gửi cho mình (viết dần cũng được) để đưa vào hướng dẫn của bot:

- [ ] Cách xưng hô (*shop / em – anh chị*…) và giọng văn.
- [ ] 10–20 câu khách hay hỏi kèm câu bạn hay trả lời (copy từ Messenger cũ là tốt nhất).
- [ ] Những gì bot **không được** hứa: giảm giá, giao trong ngày, cam kết tỉ lệ nở…
- [ ] Khi nào bot phải chuyển cho người thật: khách phàn nàn, đòi hoàn tiền, hỏi sỉ số lượng lớn…

---

← [Bước 3: Đăng ký sự kiện](3-dang-ky-su-kien.md) · [Bước 5: Webhook im lặng](5-khi-webhook-im-lang.md) →
