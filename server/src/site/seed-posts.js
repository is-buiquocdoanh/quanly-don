// Các bài viết mẫu về nuôi sâu canxi, chăn nuôi và nông nghiệp tuần hoàn.
// Tự đăng 1 lần khi website chạy lần đầu. Chủ shop có thể sửa / gỡ trong web quản lý → Website → Bài viết.
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
    category: 'chan-nuoi',
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
    category: 'nuoi-sau',
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

Cần hỗ trợ khi nuôi lần đầu? [Đặt trứng và nhận hướng dẫn kèm theo](/dat-hang) hoặc [nhắn cho shop](/lien-he).

${SOURCES}`,
  },
  {
    slug: 'cach-cho-ga-vit-chim-ca-an-sau-canxi',
    category: 'chan-nuoi',
    title: 'Cách cho gà, vịt, chim, cá ăn sâu canxi đúng cách',
    cover: '/img/ga-tha-vuon.jpg',
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

// Các bài mở rộng về nông nghiệp tuần hoàn, phân hữu cơ và kinh nghiệm thực tế theo mùa
export const EXTRA_SEED_POSTS = [
  {
    slug: 'u-phan-sau-canxi-bon-rau-sach-va-cay-an-trai',
    category: 'nong-nghiep',
    title: 'Cách ủ phân sâu canxi bón rau sạch, hoa kiểng và cây ăn trái',
    cover: '/img/vuon-rau-huu-co.jpg',
    summary: 'Sau mỗi mẻ thu sâu, phần bã thải (frass) là nguồn phân hữu cơ cực tốt cho đất. Hướng dẫn ủ hoai đúng kỹ thuật để cây hấp thu nhanh, không bị xót rễ.',
    body: `Nhiều bà con chỉ để ý tới con sâu cho gà, cá ăn mà quên mất một "kho báu" thứ hai sau mỗi lứa nuôi: **phân sâu canxi (frass)**. Đây là hỗn hợp phân ấu trùng, vỏ xác lột (giàu kitin) và phần hữu cơ đã được phân giải.

## Vì sao phân sâu canxi tốt cho đất và cây trồng?
- **Giàu hữu cơ và vi sinh có lợi:** giúp đất tơi xốp, giữ ẩm tốt hơn đất bón phân hóa học lâu ngày.
- **Chứa kitin tự nhiên:** từ lớp vỏ lột của sâu, giúp kích thích hệ vi sinh vật đối kháng nấm bệnh trong vùng rễ.
- **Tận dụng 100% phế phụ phẩm:** không bỏ phí bất cứ thứ gì trong chu trình nuôi sâu.

## Cách ủ phân sâu trước khi bón (rất quan trọng)
Phân sâu vừa sàng ra **vẫn còn tươi và có thể sinh nhiệt nhẹ**, nên không nên bón trực tiếp sát gốc cây non.

1. **Làm tơi và kiểm tra độ ẩm:** giữ phân ở mức ẩm vừa (nắm vào tơi, không rỉ nước). Nếu ướt, trộn thêm trấu hun, xơ dừa hoặc mùn cưa khô.
2. **Ủ đống có che phủ:** đánh đống hoặc cho vào bao/thùng có lỗ thoáng, có thể phun thêm chế phẩm vi sinh (Trichoderma hoặc EM) để phân hoai nhanh và khử mùi hoàn toàn.
3. **Đảo trộn sau 7–10 ngày:** ủ tổng cộng khoảng **2–4 tuần** cho đến khi phân tơi mịn, màu nâu sẫm, mùi đất ẩm dễ chịu và nguội hẳn là dùng được.

## Liều lượng bón tham khảo
| Loại cây trồng | Cách bón gợi ý | Thời điểm |
|---|---|---|
| Rau ăn lá, rau màu | Trộn 10–15% phân sâu đã ủ vào đất trồng | Bón lót trước khi gieo hoặc bón thúc nhẹ |
| Cây ăn trái (bưởi, cam, mít, sầu riêng) | Bón 1–3 kg/gốc tùy tuổi cây, rải quanh tán và lấp đất nhẹ | Sau thu hoạch hoặc đầu mùa mưa |
| Hoa kiểng, bonsai | Trộn 1 phần phân sâu ủ : 5 phần giá thể sạch | Định kỳ 30–45 ngày/lần |

> Mẹo nhỏ: nếu bạn nuôi sâu để làm vườn, hãy tránh cho sâu ăn đồ quá mặn (nước mắm, đồ kho mặn) để phân sâu không bị dư muối gây ảnh hưởng tới cây trồng.`,
  },
  {
    slug: 'mo-hinh-nong-nghiep-tuan-hoan-xu-ly-rac-huu-co-bang-sau-canxi',
    category: 'nong-nghiep',
    title: 'Nông nghiệp tuần hoàn: Biến phụ phẩm và rác hữu cơ thành nguồn đạm tại vườn',
    cover: '/img/nong-nghiep-tuan-hoan.jpg',
    summary: 'Kết hợp Vườn – Ao – Chuồng với khay nuôi sâu canxi giúp hộ nông dân giảm mạnh chi phí cám, giảm rác thải và tự chủ phân bón hữu cơ.',
    body: `Trong chăn nuôi quy mô hộ gia đình và trang trại vừa, **chi phí thức ăn thường chiếm 60–70% tổng chi phí**. Trong khi đó, xung quanh chúng ta lại có rất nhiều phụ phẩm giá rẻ hoặc miễn phí như bã đậu, bã bia, rau củ dạt ở chợ, trái cây rụng, cơm thừa.

Mô hình **nông nghiệp tuần hoàn gắn với sâu canxi** giải quyết đồng thời cả hai bài toán này.

## Chu trình khép kín Vườn – Chuồng – Ao – Sâu canxi
1. **Đầu vào (Phụ phẩm nông nghiệp):** gom bã đậu, rau quả hỏng, bã sắn, cám gạo hoặc phế phẩm nhà bếp (lọc bỏ túi ni lông, xương cứng, hóa chất tẩy rửa).
2. **Khâu chuyển hóa (Sâu canxi):** chỉ sau 14–20 ngày, đàn sâu chuyển hóa đống phụ phẩm đó thành sinh khối giàu đạm (35–47%) và canxi (3–5%).
3. **Đầu ra 1 — Thức ăn chăn nuôi:** sâu tươi cho gà thả vườn, vịt, ngan, cá ao, ếch ăn trực tiếp, giúp giảm rõ rệt tiền mua cám công nghiệp.
4. **Đầu ra 2 — Phân bón hữu cơ:** phân sâu được ủ hoai rồi quay ngược lại bón cho vườn rau, cỏ voi, cây ăn trái.

![Ruồi lính đen bố mẹ đẻ trứng đều trên các thanh gỗ tại trang trại](/img/ruoi-linh-den-de-trung.jpg)

## Bắt đầu mô hình này cần vốn bao nhiêu?
Bạn **không cần đầu tư nhà lưới lớn ngay từ đầu**. Cách tiết kiệm và ít rủi ro nhất là:
- **Bước 1:** Mua trứng giống về tự ấp nở (chỉ từ 1–2 hũ trứng 25g–30g) để làm quen cách phối trộn thức ăn và kiểm soát độ ẩm.
- **Bước 2:** Tận dụng thau nhựa, khay xi măng hoặc ô xây gạch sẵn có dưới mái hiên râm mát.
- **Bước 3:** Tính toán lượng phụ phẩm sẵn có quanh nhà để đặt trứng gối đầu mỗi tuần — lúc nào đàn gà, đàn cá cũng có sâu tươi ăn đều.

> Kinh nghiệm thực tế: Nuôi gối đầu 2–3 lứa lệch nhau 5–7 ngày giúp bạn thu hoạch sâu liên tục quanh tháng mà không bị dồn ứ thức ăn hay thiếu sâu giữa chừng.`,
  },
  {
    slug: 'kinh-nghiem-nuoi-sau-canxi-theo-mua-va-xu-ly-mui',
    category: 'kinh-nghiem',
    title: 'Kinh nghiệm nuôi sâu canxi mùa nóng, mùa lạnh và bí quyết giữ khay không mùi',
    cover: '/img/u-trung-trong-hu.jpg',
    summary: 'Thời tiết thay đổi ảnh hưởng trực tiếp tới tốc độ nở trứng và sức ăn của sâu. Tổng hợp kinh nghiệm xử lý thực tế ở cả miền Bắc lẫn miền Nam.',
    body: `Sâu canxi rất dễ tính, nhưng **nhiệt độ và độ ẩm** là hai yếu tố quyết định mẻ nuôi có đạt năng suất cao và sạch mùi hay không. Dưới đây là những kinh nghiệm thực tế đúc kết từ nhiều hộ nuôi ở cả ba miền.

## 1. Nuôi sâu vào mùa hè nắng nóng (> 35°C)
- **Vấn đề hay gặp:** Khay nuôi bí nóng làm sâu bỏ ăn, bò dạt lên thành khay để tìm chỗ mát; thức ăn nhanh lên men chua.
- **Cách khắc phục:**
  - Đặt khay ở nơi có mái che, thoáng gió tự nhiên; tránh mái tôn thấp hấp nhiệt trực tiếp.
  - Rải thức ăn **mỏng hơn bình thường** (lớp dày 4–6 cm thay vì đổ đống dày) để khay dễ tỏa nhiệt.
  - Nếu trời quá oi bức, có thể đặt quạt thông gió nhẹ hoặc xịt phun sương quanh nền (không xịt đẫm nước vào khay).

## 2. Nuôi sâu vào mùa đông, trời lạnh miền Bắc (< 20°C)
- **Vấn đề hay gặp:** Trứng nở chậm hơn (có thể kéo dài 4–6 ngày thay vì 2–3 ngày), sâu non ăn yếu và lâu lớn.
- **Cách khắc phục:**
  - Che chắn gió lùa xung quanh khu vực ấp trứng.
  - Khi ấp trứng, có thể đặt hũ trứng trong thùng xốp có hé nắp thoáng khí hoặc dùng bóng đèn sợi đốt công suất nhỏ sưởi ấm gián tiếp (giữ quanh 27–30°C, không để nóng quá gây khô trứng).
  - Dùng cám ấm ẩm làm lớp đệm cho sâu non 5 ngày đầu giúp tỷ lệ sống cao hơn nhiều.

## 3. Bí quyết 3 "KHÔNG" để nuôi sâu tại nhà không có mùi hôi
1. **Không để đọng nước:** Độ ẩm chuẩn là bóp mạnh tay thấy ẩm dính tay nhưng **không chảy nước thành giọt**. Nếu lỡ ướt, rắc ngay cám gạo khô, mùn cưa sạch hoặc bột ngô để hút ẩm.
2. **Không đổ thừa thức ăn:** Chỉ cho lượng thức ăn sâu ăn hết trong 1–2 ngày. Thức ăn thừa ứ lâu ngày mới sinh khí hôi và thu hút ruồi nhà.
3. **Không đậy kín mít:** Sâu cần oxy để thở và thoát hơi ẩm. Nên dùng lưới mùng phủ trên miệng khay nếu muốn chắn ruồi nhà hoặc thằn lằn, chuột.

![Hũ trứng đóng sẵn thoáng khí, ghi rõ ngày nở dự kiến](/img/u-trung-trong-hu.jpg)

Nếu trong quá trình ấp hoặc nuôi gặp tình huống lạ, bạn cứ chụp ảnh khay sâu gửi qua Zalo hoặc Messenger — trại sẽ xem trực tiếp và hướng dẫn cách chỉnh ngay.`,
  },
];
