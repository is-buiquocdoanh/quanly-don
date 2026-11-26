// Nội dung website công khai: thông tin shop (lưu trong settings key "site") + bài viết blog (bảng posts).
import { db, tx, getSettings, setSetting, parsePriceTable } from '../db.js';
import { nowVN, str, toInt, bad, HttpError } from '../util.js';
import { slugify, plainText } from './markdown.js';
import { SEED_POSTS, EXTRA_SEED_POSTS } from './seed-posts.js';

export const POST_CATEGORIES = {
  'nuoi-sau': 'Kỹ thuật nuôi sâu',
  'chan-nuoi': 'Chăn nuôi & Thủy sản',
  'nong-nghiep': 'Nông nghiệp tuần hoàn',
  'kinh-nghiem': 'Kinh nghiệm thực tế',
};

db.exec(`
CREATE TABLE IF NOT EXISTS posts (
  id           INTEGER PRIMARY KEY,
  slug         TEXT UNIQUE NOT NULL,
  title        TEXT NOT NULL,
  summary      TEXT NOT NULL DEFAULT '',
  body         TEXT NOT NULL DEFAULT '',     -- markdown
  cover        TEXT NOT NULL DEFAULT '',     -- đường dẫn ảnh bìa (/uploads/…)
  category     TEXT NOT NULL DEFAULT 'nuoi-sau',
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_pub ON posts(status, published_at);
`);
{
  const cols = db.prepare('PRAGMA table_info(posts)').all().map((c) => c.name);
  if (!cols.includes('category')) db.exec("ALTER TABLE posts ADD COLUMN category TEXT NOT NULL DEFAULT 'nuoi-sau'");
}

// ---------------------------------------------------------------- Chính sách (bản nháp, chủ shop sửa trong web)
export const POLICIES = {
  'bao-mat': 'Chính sách bảo mật',
  'dieu-khoan': 'Điều khoản sử dụng',
  'giao-hang': 'Chính sách giao hàng',
  'doi-tra': 'Chính sách đổi trả',
  'xoa-du-lieu': 'Hướng dẫn xóa dữ liệu',
};

const DEFAULT_POLICIES = {
  'bao-mat': `Chính sách này áp dụng cho website {{domain}}, các fanpage và ứng dụng nhắn tin của {{brand}}.

## Thông tin chúng tôi thu thập
- Khi bạn đặt hàng: họ tên, số điện thoại, địa chỉ giao hàng, sản phẩm và số lượng, ghi chú.
- Khi bạn nhắn tin cho fanpage: nội dung tin nhắn và mã người gửi do Facebook cung cấp, để trả lời và tạo đơn.

## Chúng tôi dùng thông tin để làm gì
Chỉ để xác nhận, đóng gói, giao đơn hàng, chăm sóc khách và trả lời câu hỏi. **Không bán thông tin của bạn.** Đơn vị vận chuyển chỉ nhận tên, số điện thoại, địa chỉ để giao hàng.

## Thống kê truy cập và quảng cáo
- Website tự đếm lượt xem trang (loại thiết bị, trình duyệt, trang được xem, bạn đến từ đâu) để cải thiện website. Không lưu địa chỉ IP.
- Website dùng Meta Pixel, Conversions API và cookie của chính website (_fbp, _fbc) để đo hiệu quả quảng cáo. Khi bạn đặt hàng, Facebook nhận thông báo "có đơn hàng" kèm giá trị đơn, số hũ, cùng số điện thoại, họ và tên đã được mã hóa một chiều (Facebook không đọc được thông tin gốc), địa chỉ IP và loại trình duyệt. Không gửi địa chỉ giao hàng. Bạn có thể hạn chế bằng cách chặn cookie trong trình duyệt.

## Quyền truy cập Facebook / Google
- Ứng dụng nhắn tin chỉ đọc và trả lời tin nhắn gửi tới fanpage của cửa hàng.
- Ứng dụng sao lưu chỉ tạo và đọc các file sao lưu do chính nó tải lên Google Drive của cửa hàng (quyền drive.file), không xem hay sửa file nào khác.

## Lưu trữ
Dữ liệu nằm trên máy chủ riêng của cửa hàng, có sao lưu định kỳ. Bản sao lưu trên Google Drive được tự xóa sau 365 ngày.

## Quyền của bạn
Bạn có thể yêu cầu xem, sửa hoặc xóa thông tin của mình bất cứ lúc nào. Xem [Hướng dẫn xóa dữ liệu](/chinh-sach/xoa-du-lieu).`,

  'dieu-khoan': `Khi truy cập website {{domain}} hoặc đặt hàng của {{brand}}, bạn đồng ý với các điều khoản dưới đây.

## Đặt hàng
- Đơn hàng được xác nhận qua tin nhắn hoặc điện thoại trước khi gửi.
- Giá và khuyến mãi có thể thay đổi; giá áp dụng là giá tại thời điểm xác nhận đơn.

## Thanh toán
Thanh toán khi nhận hàng (COD) hoặc chuyển khoản theo hướng dẫn khi xác nhận đơn.

## Sử dụng sản phẩm
Làm theo hướng dẫn sử dụng và bảo quản ghi trên bao bì / trang sản phẩm.

## Nội dung website
Hình ảnh và bài viết thuộc về {{brand}}. Vui lòng ghi nguồn khi chia sẻ lại.

## Liên hệ
Mọi thắc mắc xin liên hệ qua [trang Liên hệ](/lien-he).`,

  'giao-hang': `## Phạm vi giao hàng
Giao toàn quốc qua đơn vị vận chuyển (Viettel Post).

## Thời gian
- Đơn xác nhận trước 16h: đóng hũ tươi và gửi trong ngày.
- Thời gian nhận hàng thường từ 1 đến 4 ngày tùy khu vực.

## Phí giao hàng
- **Đặt 1 hũ (35g):** 65.000đ + phí ship 30.000đ (tổng thanh toán 95.000đ).
- **Từ 2 hũ trở lên:** **MIỄN PHÍ GIAO HÀNG toàn quốc** (2 hũ 130k · 3 hũ 195k · 4 hũ 250k · 5 hũ 300k).

## Kiểm tra hàng
Bạn được kiểm tra hàng trước khi thanh toán (COD).`,

  'doi-tra': `## Trường hợp được đổi / hoàn tiền
- Hàng bị hư hỏng, móp vỡ do vận chuyển.
- Giao sai sản phẩm hoặc thiếu số lượng.

## Cách yêu cầu
Trong vòng 48 giờ sau khi nhận hàng, nhắn cho fanpage kèm **ảnh hoặc video** tình trạng hàng và mã đơn. Cửa hàng gửi lại hàng mới hoặc hoàn tiền sau khi xác nhận.

## Không áp dụng
Hàng đã sử dụng hoặc bảo quản không đúng hướng dẫn.`,

  'xoa-du-lieu': `Bạn có quyền yêu cầu xóa toàn bộ thông tin của mình (tin nhắn, thông tin đơn hàng) mà {{brand}} đang lưu.

## Cách yêu cầu
1. Nhắn cho fanpage nội dung **"Xóa dữ liệu của tôi"** kèm số điện thoại bạn đã dùng để đặt hàng.
2. Hoặc liên hệ qua [trang Liên hệ](/lien-he).

Cửa hàng xóa trong vòng **7 ngày** và nhắn lại xác nhận.

## Gỡ quyền ứng dụng trên Facebook
Vào Facebook → **Cài đặt và quyền riêng tư → Cài đặt → Ứng dụng và trang web**, chọn ứng dụng của cửa hàng → **Gỡ**.`,
};

// ---------------------------------------------------------------- Thông tin shop
// Sản phẩm: TRỨNG ruồi lính đen (trứng sâu canxi) để khách tự ấp nở, nuôi thành sâu canxi cho gà, vịt, chim, cá ăn.
export const SITE_DEFAULTS = {
  brand: 'Trứng Sâu Canxi',
  tagline: 'Trứng ruồi lính đen 35g/hũ — tự nuôi sâu canxi tại nhà',
  hero_text: 'Chỉ từ 1–2 hũ trứng chuẩn 35g, sau 2–3 tuần đã có nguồn sâu canxi giàu đạm, giàu canxi cho gà, vịt, chim, cá. Sâu ăn bã đậu, rau củ, cơm thừa — giảm tiền cám, xử lý rác hữu cơ. Miễn phí ship toàn quốc từ 2 hũ.',
  hero_image: '/img/hero-trung-35g.jpg',
  logo: '/img/logo.svg',
  phone: '',
  zalo: '',
  messenger: '',        // link m.me/<page>
  fanpage: '',
  tiktok: '',
  email: '',
  address: '',
  map_url: '',
  business_name: '',    // tên hộ kinh doanh trên giấy chứng nhận
  business_no: '',      // số giấy chứng nhận đăng ký hộ kinh doanh
  tax_code: '',
  products: [
    { name: 'Combo 2 hũ trứng sâu canxi (35g/hũ)', spec: 'Tổng 70g · Miễn phí ship toàn quốc', price: 130000, image: '/img/combo-2-hu-35g.jpg',
      desc: 'Lựa chọn phổ biến nhất! Tiết kiệm ngay 30.000đ phí ship so với mua 1 hũ lẻ. Phù hợp hộ nuôi gà, vịt, cá quy mô gia đình.' },
    { name: '1 hũ trứng sâu canxi 35g (Dùng thử)', spec: 'Hũ chuẩn 35g · Phí ship 30k (Tổng 95k)', price: 65000, image: '/img/hu-trung-35g.jpg',
      desc: 'Trứng tươi thu trong ngày, đóng hũ thoáng khí ghi rõ ngày nở trên nắp. Phù hợp nuôi thử làm quen kỹ thuật lần đầu.' },
    { name: 'Combo trại 3 – 5 hũ (35g/hũ)', spec: 'Miễn ship · 3 hũ 195k · 4 hũ 250k · 5 hũ 300k', price: 300000, image: '/img/combo-5-hu-35g.jpg',
      desc: 'Dành cho hộ nuôi nhiều hoặc nuôi gối đầu quanh tháng. Đặt 5 hũ chỉ còn 60.000đ/hũ — tiết kiệm 25.000đ và miễn phí ship.' },
  ],
  farm: `## Trang trại của chúng tôi
Chúng tôi nuôi đàn ruồi lính đen bố mẹ để lấy trứng, thu trứng hằng ngày rồi cân chuẩn **35g/hũ**, đóng hũ thoáng khí và gửi đi trong thời gian ngắn nhất để trứng đến tay khách vẫn tươi, nở đều.

![Ruồi lính đen trưởng thành đẻ trứng trên thanh gỗ](/img/ruoi-linh-den-de-trung.jpg)

## Từ ruồi bố mẹ đến hũ trứng 35g
1. **Ruồi đẻ trứng** vào các khe của thanh gỗ đặt trong chuồng nuôi.
2. **Thu trứng** mỗi ngày, gỡ nhẹ khỏi thanh gỗ để không làm dập trứng.
3. **Cân chuẩn 35g và đóng hũ** thoáng khí. Trên nắp ghi rõ khối lượng và ngày nở dự kiến.
4. **Đóng thùng, gửi đi** qua đơn vị vận chuyển toàn quốc (miễn ship từ 2 hũ), kèm hướng dẫn ấp nở.

![Trứng vừa thu trên khung gỗ](/img/thu-trung.jpg)

![Trứng được đóng hũ thoáng khí chuẩn bị giao đi](/img/combo-5-hu-35g.jpg)

![Sâu canxi béo mập cho đàn gà thả vườn](/img/ga-tha-vuon.jpg)

## Vì sao chọn trứng 35g của trại
- Trứng thu **trong ngày**, cân đủ **35g/hũ**, không để lưu kho.
- Mỗi hũ ghi **ngày nở**, khách biết chuẩn bị khay nuôi trước.
- Giá minh bạch: **65.000đ/hũ**, **miễn phí giao hàng từ 2 hũ**, hỗ trợ kỹ thuật 1-1 qua tin nhắn.`,
  usage: `## Cách ấp trứng
- Mở nắp, đặt hũ (hoặc rải trứng lên giấy) **phía trên** khay thức ăn ẩm như cám trộn nước, bã đậu, để sâu non nở ra tự rơi xuống ăn.
- Để nơi râm mát, thoáng, tránh nắng trực tiếp và kiến. Nhiệt độ ấm khoảng 25–30°C trứng nở nhanh và đều hơn.
- Trứng thường nở sau khoảng **2–4 ngày**, tùy nhiệt độ.

## Cách nuôi sâu
- Thức ăn: bã đậu, cám, rau củ quả hỏng, cơm thừa, bã bia… giữ **ẩm như bã đậu vắt**, không đọng nước.
- Sau khoảng **14–20 ngày** sâu đạt cỡ thu hoạch, màu kem, dài khoảng 1,5–2 cm.
- Thu sâu cho vật nuôi ăn tươi, hoặc phơi / sấy khô để dành.

## Bảo quản trứng
- Nhận hàng xong nên **ấp ngay** theo ngày nở ghi trên nắp.
- Không để hũ trong tủ lạnh, không phơi nắng, không đóng kín bằng túi ni lông.`,
  policies: DEFAULT_POLICIES,
};

// ---------------------------------------------------------------- Nội dung trang chủ (dựa trên tài liệu, có nguồn)
// Con số dinh dưỡng là KHOẢNG giá trị trong các nghiên cứu, tính trên chất khô, thay đổi theo thức ăn nuôi sâu và lúc thu hoạch.
export const HOME = {
  stats: [
    ['2–4 ngày', 'trứng nở thành sâu non'],
    ['14–20 ngày', 'nuôi tới cỡ thu hoạch'],
    ['35–47%', 'đạm (tính trên chất khô)'],
    ['3–5%', 'canxi — cao hơn khô đậu nhiều lần'],
  ],
  what: `**Sâu canxi** là tên gọi quen thuộc của **ấu trùng ruồi lính đen** (*Hermetia illucens*). Sâu ăn các phụ phẩm hữu cơ như bã đậu, rau củ hỏng, cám, cơm thừa và lớn rất nhanh. Cơ thể sâu tích nhiều **đạm, chất béo và canxi**, nên được dùng làm thức ăn tươi cho gia cầm, chim, cá.

Ruồi lính đen trưởng thành **không phải ruồi nhà**: thân đen dài như ong bắp cày nhỏ, gần như không ăn trong suốt vài ngày sống, chỉ giao phối và đẻ trứng, không bâu vào thức ăn của người.`,
  nutrition: [
    ['Đạm thô', '35–47%', 'Tương đương nhóm thức ăn giàu đạm như khô đậu, bột cá'],
    ['Chất béo', '30–42%', 'Nhiều axit lauric — loại béo đang được nghiên cứu về tác dụng tốt cho đường ruột'],
    ['Canxi', '3–5%', 'Cao hơn khô đậu nành nhiều lần; vì vậy mới có tên "sâu canxi"'],
    ['Phốt pho', 'khoảng 0,8–0,9%', 'Cùng canxi giúp xương, vỏ trứng'],
  ],
  animals: [
    { key: 'ga', name: 'Gà', text: 'Gà rất thích mổ sâu tươi. Bổ sung sâu giúp gà ăn khỏe, thêm đạm và canxi. Người nuôi thường thấy gà lớn nhanh, lông mượt, gà đẻ đều hơn. Nên thay **một phần** cám, không thay hoàn toàn.' },
    { key: 'vit', name: 'Vịt, ngan', text: 'Vịt, ngan ăn sâu tươi rất nhanh, nhất là vịt đẻ cần nhiều đạm và canxi. Có thể thả sâu vào máng nước hoặc trộn cùng thức ăn.' },
    { key: 'chim', name: 'Chim cảnh', text: 'Sâu canxi tươi hoặc sấy khô là món mồi giàu đạm cho chào mào, chích chòe, khướu… nhất là mùa thay lông, chim mái nuôi con. Cho ăn lượng nhỏ xen kẽ cám chim.' },
    { key: 'ca', name: 'Cá', text: 'Nhiều nghiên cứu cho thấy bột sâu ruồi lính đen có thể **thay một phần bột cá** trong thức ăn cá rô phi, cá trê mà cá vẫn lớn tốt. Với ao nhà, sâu tươi là mồi cá rất thích.' },
    { key: 'khac', name: 'Ếch, lươn, ba ba, heo', text: 'Các loài ăn tạp và ăn mồi sống đều tận dụng được sâu canxi như nguồn đạm tươi, giảm bớt cám công nghiệp.' },
  ],
  benefits: [
    ['Giảm tiền thức ăn', 'Sâu lớn lên từ bã đậu, rau củ, cơm thừa… những thứ vốn bỏ đi. Mỗi mẻ sâu thay được một phần cám mua ngoài.'],
    ['Xử lý rác hữu cơ', 'Sâu ăn và làm nhỏ rác hữu cơ rất nhanh, giảm mùi hôi và lượng rác phải đổ bỏ.'],
    ['Có thêm phân bón', 'Phần bã sâu thải ra (phân sâu) dùng ủ bón rau, cây ăn trái.'],
    ['Chủ động nguồn thức ăn sạch', 'Tự nuôi, biết rõ sâu ăn gì; luôn có thức ăn tươi cho đàn vật nuôi.'],
  ],
  steps: [
    ['Nhận trứng', 'Hũ trứng ghi ngày nở dự kiến. Chuẩn bị khay và thức ăn ẩm trước ngày nở.', '/img/trung-can-canh.jpg'],
    ['Ấp nở 2–4 ngày', 'Đặt trứng phía trên khay thức ăn ẩm, nơi râm mát. Sâu non nở ra tự rơi xuống ăn.', '/img/trung-dang-no.jpg'],
    ['Nuôi 14–20 ngày', 'Cho ăn bã đậu, cám, rau củ hỏng… giữ ẩm vừa phải. Sâu lớn rất nhanh.', '/img/sau-non-moi-no.jpg'],
    ['Thu sâu cho vật nuôi', 'Sàng lấy sâu cho gà, vịt, chim, cá ăn tươi hoặc sấy khô để dành. Bã còn lại ủ làm phân.', '/img/sau-canxi.jpg'],
  ],
  faqs: [
    ['Ruồi lính đen có gây hại hay mang bệnh như ruồi nhà không?', 'Không giống ruồi nhà. Ruồi lính đen trưởng thành gần như không ăn, không bâu vào thức ăn của người, chỉ sống vài ngày để giao phối và đẻ trứng. Vì vậy chúng được nuôi rộng rãi để xử lý rác hữu cơ và làm thức ăn chăn nuôi.'],
    ['Một hũ trứng nuôi được bao nhiêu sâu?', 'Tùy nhiệt độ, lượng thức ăn và cách nuôi. Tạp chí chăn nuôi aviNews ghi nhận lời kể của một hộ ở Khánh Hòa: nuôi 2 gam trứng, sau 15–20 ngày thu được 7–8 kg sâu. Khi nuôi lần đầu, cứ nuôi một hũ nhỏ để làm quen, shop hướng dẫn qua tin nhắn.'],
    ['Bao lâu thì trứng nở?', 'Thường khoảng 2–4 ngày, trời ấm (25–30°C) nở nhanh và đều hơn, trời lạnh nở chậm hơn. Ngày nở dự kiến ghi trên nắp hũ.'],
    ['Giao hàng xa có sợ trứng nở dọc đường không?', 'Shop tính ngày gửi theo ngày nở và khoảng cách giao. Nhận hàng xong bạn ấp ngay theo hướng dẫn. Nếu trứng nở sớm trong hũ, cứ đổ cả sâu non lẫn trứng vào khay thức ăn.'],
    ['Cho gà ăn sâu bao nhiêu là đủ?', 'Nên coi sâu là thức ăn bổ sung, thay một phần cám, không thay hoàn toàn. Bắt đầu với lượng nhỏ rồi tăng dần, quan sát đàn gà ăn và phân. Gà con nên cho sâu nhỏ hoặc sâu đã cắt.'],
    ['Nuôi sâu có hôi không?', 'Nếu giữ thức ăn ẩm vừa phải (như bã đậu vắt), không để đọng nước và không cho quá nhiều thức ăn một lúc thì mùi rất ít. Khay ướt quá, thiếu thông thoáng mới dễ bốc mùi.'],
  ],
  sources: [
    ['FAO Feedipedia — Black soldier fly larvae', 'https://feedipedia.review.fao.org/node/16388'],
    ['Thành phần dinh dưỡng bột ấu trùng ruồi lính đen (PMC)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6284222/'],
    ['Ruồi lính đen trong chăn nuôi gia cầm, tổng quan (PMC)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7728616/'],
    ['Thay bột cá bằng bột ấu trùng ruồi lính đen cho cá rô phi (PMC)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7830215/'],
    ['aviNews — Sâu canxi, thức ăn vàng giúp gà khỏe', 'https://avinews.com/vi/sau-canxi-thuc-an-vang-giup-ga-khoe-nong-dan-lai-lon/'],
  ],
};

export function getSite() {
  const saved = getSettings().site || {};
  const site = { ...SITE_DEFAULTS, ...saved };
  site.policies = { ...DEFAULT_POLICIES, ...(saved.policies || {}) };
  if (!Array.isArray(site.products) || !site.products.length) site.products = SITE_DEFAULTS.products;
  return site;
}

const TEXT_FIELDS = ['brand', 'tagline', 'hero_text', 'hero_image', 'logo', 'phone', 'zalo', 'messenger', 'fanpage', 'tiktok',
  'email', 'address', 'map_url', 'business_name', 'business_no', 'tax_code', 'fb_pixel_id', 'fb_capi_token', 'fb_test_code'];

// Chỉ lưu những mục chủ shop đã sửa (không chép cả nội dung mặc định), để sau này cập nhật nội dung mặc định
// trong code thì các mục chưa sửa tự nhận bản mới.
export function saveSite(input) {
  const cur = getSite();
  const saved = { ...(getSettings().site || {}) };
  const next = saved;
  for (const k of TEXT_FIELDS) if (k in input) next[k] = str(input[k], k === 'hero_text' ? 600 : 300);
  for (const k of ['farm', 'usage']) if (k in input) next[k] = str(input[k], 20000);
  if ('fb_pixel_id' in input) {
    next.fb_pixel_id = String(input.fb_pixel_id || '').replace(/\s/g, '');
    if (next.fb_pixel_id && !/^\d{8,20}$/.test(next.fb_pixel_id)) throw bad('Pixel ID là dãy số (15–16 số) lấy trong Trình quản lý sự kiện của Facebook');
  }
  if ('fb_capi_token' in input) next.fb_capi_token = String(input.fb_capi_token || '').replace(/\s/g, '').slice(0, 400);
  if ('fb_test_code' in input) next.fb_test_code = String(input.fb_test_code || '').replace(/[^\w]/g, '').slice(0, 40);
  if (Array.isArray(input.products)) {
    next.products = input.products.slice(0, 20).map((p) => ({
      name: str(p.name, 120), spec: str(p.spec, 120), price: toInt(p.price), image: str(p.image, 300), desc: str(p.desc, 1000),
    })).filter((p) => p.name);
    if (!next.products.length) throw bad('Cần ít nhất 1 sản phẩm');
  }
  if (input.policies && typeof input.policies === 'object') {
    next.policies = { ...(saved.policies || {}) };
    for (const k of Object.keys(POLICIES)) if (k in input.policies) next.policies[k] = str(input.policies[k], 20000);
  }
  // giá trị trùng mặc định thì không lưu
  for (const k of Object.keys(next)) {
    if (k !== 'policies' && JSON.stringify(next[k]) === JSON.stringify(SITE_DEFAULTS[k])) delete next[k];
  }
  for (const k of Object.keys(next.policies || {})) if (next.policies[k] === DEFAULT_POLICIES[k]) delete next.policies[k];
  if (!({ ...cur, ...next }).brand) throw bad('Thiếu tên thương hiệu');
  setSetting('site', next);
  return getSite();
}

// ---------------------------------------------------------------- Bảng giá công khai (đồng bộ từ Cài đặt)
export function getPriceTable() {
  return parsePriceTable(getSettings().price_table);
}

// ---------------------------------------------------------------- Bài viết
// Lần đầu website chạy: đăng sẵn các bài mẫu về nuôi sâu, chăn nuôi & nông nghiệp tuần hoàn.
function seedPosts() {
  const settings = getSettings();
  const now = nowVN();
  const ins = db.prepare(`INSERT OR IGNORE INTO posts(slug, title, summary, body, cover, category, status, published_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)`);
  if (!settings.posts_seeded) {
    if (!db.prepare('SELECT 1 FROM posts LIMIT 1').get()) {
      SEED_POSTS.forEach((p, i) => {
        const at = nowVN(new Date(Date.now() - (SEED_POSTS.length + EXTRA_SEED_POSTS.length - i) * 60e3));
        ins.run(p.slug, p.title, p.summary, p.body, p.cover, p.category || 'nuoi-sau', at, now, now);
      });
    }
    setSetting('posts_seeded', 1);
  }
  if (!settings.posts_seeded_v2) {
    // Cập nhật chủ đề cho 3 bài mẫu cũ nếu đang dùng mặc định
    for (const p of SEED_POSTS) {
      if (p.category && p.category !== 'nuoi-sau') {
        db.prepare("UPDATE posts SET category = ? WHERE slug = ? AND category = 'nuoi-sau'").run(p.category, p.slug);
      }
    }
    EXTRA_SEED_POSTS.forEach((p, i) => {
      const at = nowVN(new Date(Date.now() - (EXTRA_SEED_POSTS.length - i) * 60e3));
      ins.run(p.slug, p.title, p.summary, p.body, p.cover, p.category || 'nong-nghiep', at, now, now);
    });
    setSetting('posts_seeded_v2', 1);
  }
  if (!settings.posts_seeded_v3) {
    const coverMap = [
      ['cach-cho-ga-vit-chim-ca-an-sau-canxi', '/img/hu-trung-30g.jpg', '/img/ga-tha-vuon.jpg'],
      ['u-phan-sau-canxi-bon-rau-sach-va-cay-an-trai', '/img/thu-trung.jpg', '/img/vuon-rau-huu-co.jpg'],
      ['mo-hinh-nong-nghiep-tuan-hoan-xu-ly-rac-huu-co-bang-sau-canxi', '/img/ruoi-linh-den-de-trung.jpg', '/img/nong-nghiep-tuan-hoan.jpg'],
      ['kinh-nghiem-nuoi-sau-canxi-theo-mua-va-xu-ly-mui', '/img/u-trung-trong-hu.jpg', '/img/combo-5-hu-35g.jpg'],
    ];
    for (const [slug, oldC, newC] of coverMap) {
      db.prepare('UPDATE posts SET cover = ? WHERE slug = ? AND cover = ?').run(newC, slug, oldC);
    }
    setSetting('posts_seeded_v3', 1);
  }
}

const POST_COLS = 'id, slug, title, summary, cover, category, status, published_at, created_at, updated_at, length(body) AS body_len';

export function listPosts({ all = false, limit = 100, category = '', q = '' } = {}) {
  const where = [];
  const args = [];
  if (!all) where.push("status = 'published'");
  if (category && POST_CATEGORIES[category]) {
    where.push('category = ?');
    args.push(category);
  }
  if (q && String(q).trim()) {
    const s = '%' + String(q).trim() + '%';
    where.push('(title LIKE ? OR summary LIKE ? OR body LIKE ?)');
    args.push(s, s, s);
  }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  return db.prepare(`SELECT ${POST_COLS} FROM posts ${w}
    ORDER BY COALESCE(published_at, created_at) DESC LIMIT ?`).all(...args, Math.min(toInt(limit, 100), 500));
}

export function getPost(idOrSlug, { publishedOnly = false } = {}) {
  const p = typeof idOrSlug === 'number'
    ? db.prepare('SELECT * FROM posts WHERE id = ?').get(idOrSlug)
    : db.prepare('SELECT * FROM posts WHERE slug = ?').get(String(idOrSlug));
  if (!p || (publishedOnly && p.status !== 'published')) return null;
  return p;
}

function uniqueSlug(base, exceptId = 0) {
  let slug = base || 'bai-viet';
  for (let i = 2; db.prepare('SELECT 1 FROM posts WHERE slug = ? AND id <> ?').get(slug, exceptId); i++) slug = `${base}-${i}`;
  return slug;
}

export function savePost(id, input) {
  const now = nowVN();
  const cur = id ? getPost(id) : null;
  if (id && !cur) throw new HttpError(404, 'Không tìm thấy bài viết');
  const title = str(input.title ?? cur?.title, 200);
  if (!title) throw bad('Thiếu tiêu đề');
  const body = str(input.body ?? cur?.body ?? '', 100000);
  const status = (input.status ?? cur?.status) === 'published' ? 'published' : 'draft';
  const catIn = input.category ?? cur?.category ?? 'nuoi-sau';
  const category = POST_CATEGORIES[catIn] ? catIn : 'nuoi-sau';
  const slug = uniqueSlug(slugify(input.slug || cur?.slug || title), id || 0);
  const summary = str(input.summary ?? cur?.summary ?? '', 300) || plainText(body, 200);
  const cover = str(input.cover ?? cur?.cover ?? '', 300);
  const publishedAt = status === 'published' ? (cur?.published_at || now) : null;
  return tx(() => {
    if (cur) {
      db.prepare('UPDATE posts SET slug=?, title=?, summary=?, body=?, cover=?, category=?, status=?, published_at=?, updated_at=? WHERE id=?')
        .run(slug, title, summary, body, cover, category, status, publishedAt, now, id);
      return getPost(id);
    }
    const newId = Number(db.prepare(`INSERT INTO posts(slug, title, summary, body, cover, category, status, published_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(slug, title, summary, body, cover, category, status, publishedAt, now, now).lastInsertRowid);
    return getPost(newId);
  });
}

seedPosts();

export function deletePost(id) {
  if (!db.prepare('DELETE FROM posts WHERE id = ?').run(id).changes) throw new HttpError(404, 'Không tìm thấy bài viết');
}
