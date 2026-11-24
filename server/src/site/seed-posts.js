// 3 bài viết mẫu, tự đăng 1 lần khi website chạy lần đầu (bảng posts còn trống). Chủ shop sửa / gỡ trong web quản lý.
// Nội dung dựa trên tài liệu có nguồn ở cuối mỗi bài; con số là khoảng giá trị, không phải cam kết.

const SOURCES = `## Tài liệu tham khảo
- [FAO Feedipedia — Black soldier fly larvae](https://feedipedia.review.fao.org/node/16388)
- [Thành phần dinh dưỡng bột ấu trùng ruồi lính đen (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6284222/)
- [Ruồi lính đen trong chăn nuôi gia cầm, bài tổng quan (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7728616/)
- [Thay bột cá bằng bột ấu trùng ruồi lính đen cho cá rô phi (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7830215/)
- [aviNews — Sâu canxi, "thức ăn vàng" giúp gà khỏe](https://avinews.com/vi/sau-canxi-thuc-an-vang-giup-ga-khoe-nong-dan-lai-lon/)`;

export const SEED_POSTS = [
  {
    slug: 'sau-canxi-la-gi-dinh-duong-va-loi-ich',
    title: 'Sâu canxi là gì? Dinh dưỡng và lợi ích cho gà, vịt, chim, cá',
    cover: '/img/sau-canxi.jpg',
    summary: 'Sâu canxi là ấu trùng ruồi lính đen: giàu đạm, chất béo và canxi, lớn nhanh nhờ ăn phụ phẩm hữu cơ. Bài này tổng hợp dinh dưỡng và lợi ích theo các nghiên cứu.',
    body: `**Sâu canxi** là tên gọi phổ biến ở Việt Nam của **ấu trùng ruồi lính đen** (*Hermetia illucens*). Sâu ăn các phụ phẩm hữu cơ như bã đậu, cám, rau củ hỏng, cơm thừa và lớn rất nhanh: từ lúc nở tới cỡ thu hoạch chỉ khoảng 2–3 tuần.

![Sâu canxi trưởng thành, màu kem, dài khoảng 1,5–2 cm](/img/sau-canxi.jpg)

## Ruồi lính đen khác ruồi nhà thế nào?
Ruồi lính đen trưởng thành có thân đen, dài, trông giống ong bắp cày nhỏ. Chúng **gần như không ăn** trong vài ngày sống ngắn ngủi, chỉ giao phối và đẻ trứng, nên không bâu vào thức ăn của người như ruồi nhà. Giai đoạn ăn nhiều nhất là giai đoạn **ấu trùng** — chính là sâu canxi.

## Sâu canxi bổ dưỡng thế nào?
Theo các nghiên cứu tổng hợp (tính trên chất khô, thay đổi theo thức ăn nuôi sâu và lúc thu hoạch):

- **Đạm thô:** khoảng 35–47%, tương đương nhóm thức ăn giàu đạm như khô đậu, bột cá.
- **Chất béo:** khoảng 30–42%, trong đó nhiều **axit lauric** — loại béo đang được nghiên cứu về tác dụng tốt cho đường ruột.
- **Canxi:** khoảng 3–5%, cao hơn khô đậu nành nhiều lần — vì vậy mới gọi là "sâu canxi".
- **Phốt pho:** khoảng 0,8–0,9%.

## Lợi ích cho từng loại vật nuôi
- **Gà:** nguồn đạm và canxi tươi, gà rất thích mổ. Người nuôi thường thấy gà ăn khỏe, lông mượt, gà đẻ đều. Các nghiên cứu trên gà đẻ cho kết quả khác nhau về độ dày vỏ trứng, nên hãy coi sâu là **thức ăn bổ sung**.
- **Vịt, ngan:** ăn sâu tươi rất nhanh, nhất là vịt đẻ cần nhiều đạm.
- **Chim cảnh:** sâu tươi hoặc sấy khô là mồi giàu đạm, hợp mùa thay lông, chim mái nuôi con. Cho lượng nhỏ, xen kẽ cám chim.
- **Cá:** nghiên cứu trên cá rô phi, cá trê cho thấy bột sâu ruồi lính đen có thể **thay một phần bột cá** mà cá vẫn lớn tốt.

## Lợi ích khi tự nuôi sâu
1. **Giảm tiền thức ăn** nhờ tận dụng phụ phẩm vốn bỏ đi.
2. **Xử lý rác hữu cơ**, giảm mùi và lượng rác.
3. **Có thêm phân bón** từ bã sâu.
4. **Chủ động** nguồn thức ăn tươi, biết rõ sâu ăn gì.

> Lưu ý: sâu canxi là thức ăn bổ sung. Hãy thay **một phần** khẩu phần và tăng dần, không thay hoàn toàn cám cho vật nuôi.

${SOURCES}`,
  },
  {
    slug: 'huong-dan-ap-trung-ruoi-linh-den-nuoi-sau-canxi-tai-nha',
    title: 'Hướng dẫn ấp trứng ruồi lính đen và nuôi sâu canxi tại nhà',
    cover: '/img/trung-dang-no.jpg',
    summary: 'Từ một hũ trứng đến mẻ sâu đầu tiên: chuẩn bị khay, ấp trứng 2–4 ngày, nuôi 14–20 ngày, thu sâu cho vật nuôi và những lỗi hay gặp.',
    body: `Nuôi sâu canxi không khó. Chỉ cần một chỗ râm mát, vài cái khay và nguồn phụ phẩm như bã đậu, cám, rau củ hỏng. Dưới đây là cách làm cho người mới bắt đầu.

## 1. Chuẩn bị trước ngày trứng nở
- **Khay nuôi:** thau, thùng xốp, khay nhựa hoặc ô xây gạch, có thành cao để sâu không bò ra.
- **Thức ăn ban đầu:** cám trộn nước hoặc bã đậu, độ ẩm **như bã đậu vắt** (bóp chặt không chảy nước).
- **Chỗ đặt:** râm mát, thoáng gió, tránh nắng trực tiếp, mưa tạt và kiến.

![Trứng ruồi lính đen cận cảnh](/img/trung-can-canh.jpg)

## 2. Ấp trứng (khoảng 2–4 ngày)
- Đặt hũ trứng đã mở nắp, hoặc rải trứng lên miếng giấy, **phía trên** khay thức ăn ẩm. Sâu non nở ra sẽ tự rơi xuống ăn.
- Trời ấm khoảng 25–30°C trứng nở nhanh và đều; trời lạnh nở chậm hơn.
- Ngày nở dự kiến ghi trên nắp hũ — hãy chuẩn bị khay từ trước ngày đó.

![Trứng đang nở trong hũ, sâu non li ti màu trắng](/img/trung-dang-no.jpg)

## 3. Nuôi sâu (khoảng 14–20 ngày)
- **Tuần đầu** sâu còn nhỏ, cho thức ăn mịn (cám, bã đậu).
- **Từ tuần thứ hai** sâu ăn rất khỏe, có thể cho thêm rau củ quả hỏng băm nhỏ, cơm thừa, bã bia.
- Cho ăn **vừa đủ**, hết mới thêm; giữ khay ẩm nhưng **không đọng nước**.
- Khi sâu dài khoảng 1,5–2 cm, màu kem là có thể thu hoạch.

![Sâu non mới nở, vài ngày tuổi](/img/sau-non-moi-no.jpg)

## 4. Thu sâu cho vật nuôi
- Dùng rây hoặc sàng lỗ to để tách sâu khỏi bã.
- Cho ăn **tươi**, hoặc rửa sạch, chần qua rồi phơi / sấy khô để dành.
- Phần bã còn lại (phân sâu) ủ thêm vài tuần rồi bón cây.

## Lỗi hay gặp
| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Khay bốc mùi hôi | Ướt quá, cho quá nhiều thức ăn | Trộn thêm cám khô, bớt thức ăn, để thoáng |
| Sâu bò ra ngoài | Khay quá ướt hoặc quá nóng | Giảm ẩm, chuyển chỗ râm mát |
| Trứng nở ít | Phơi nắng, để khô, để quá lâu mới ấp | Ấp ngay khi nhận, đặt trên thức ăn ẩm |
| Có kiến | Khay sát đất, không có rào | Kê khay cao, kê chân khay vào bát nước |

Cần hỗ trợ khi nuôi lần đầu? [Nhắn cho shop](/lien-he) để được hướng dẫn.

${SOURCES}`,
  },
  {
    slug: 'cach-cho-ga-vit-chim-ca-an-sau-canxi',
    title: 'Cách cho gà, vịt, chim, cá ăn sâu canxi đúng cách',
    cover: '/img/hu-trung-30g.jpg',
    summary: 'Sâu canxi là thức ăn bổ sung giàu đạm và canxi. Cách cho từng loại vật nuôi ăn, nên cho bao nhiêu và những điều cần tránh.',
    body: `Sâu canxi giàu đạm, chất béo và canxi, nên rất hợp làm **thức ăn bổ sung**. Điều quan trọng là cho ăn đúng cách để vật nuôi khỏe mà không bị thừa béo.

## Nguyên tắc chung
- Coi sâu là **thức ăn bổ sung**: thay **một phần** cám, không thay hoàn toàn.
- **Bắt đầu ít rồi tăng dần** trong vài ngày, quan sát vật nuôi ăn và phân.
- Sâu có nhiều chất béo — cho quá nhiều dễ làm vật nuôi béo, giảm ăn cám.
- Dùng sâu **tươi, sạch**; sâu khô thì bảo quản nơi khô ráo, đậy kín.

## Gà
- Gà thả vườn, gà đẻ: rải sâu tươi vào buổi sáng hoặc trộn với cám.
- Gà con: cho sâu nhỏ hoặc sâu cắt khúc, lượng ít.
- Gà đẻ cần canxi cho vỏ trứng — sâu là nguồn bổ sung tốt, nhưng vẫn nên có cám gà đẻ đủ chất.

## Vịt, ngan
- Thả sâu vào máng nước hoặc trộn với thức ăn — vịt ăn rất nhanh.
- Vịt đẻ cần nhiều đạm, có thể cho sâu đều đặn mỗi ngày với lượng vừa phải.

## Chim cảnh (chào mào, chích chòe, khướu…)
- Cho vài con sâu tươi mỗi ngày hoặc vài lần mỗi tuần, xen kẽ cám chim.
- Mùa thay lông, chim mái nuôi con có thể cho thường xuyên hơn.
- Sâu khô cần ngâm mềm trước khi cho chim nhỏ ăn.

## Cá
- Ao nhà: thả sâu tươi vào giờ cho ăn, cá rô phi, cá trê, cá chép rất thích.
- Cá cảnh (koi, la hán…): cho lượng nhỏ, vớt phần thừa để không bẩn nước.
- Nghiên cứu cho thấy bột sâu ruồi lính đen có thể thay **một phần** bột cá trong thức ăn cá mà cá vẫn lớn tốt.

> Mỗi đàn, mỗi giống một khác. Nếu vật nuôi có dấu hiệu bất thường (bỏ ăn, đi phân lỏng), hãy giảm lượng sâu và hỏi ý kiến người có chuyên môn thú y.

${SOURCES}`,
  },
];
