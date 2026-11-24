// Nội dung website công khai: thông tin shop (lưu trong settings key "site") + bài viết blog (bảng posts).
import { db, tx, getSettings, setSetting } from '../db.js';
import { nowVN, str, toInt, bad, HttpError } from '../util.js';
import { slugify, plainText } from './markdown.js';

db.exec(`
CREATE TABLE IF NOT EXISTS posts (
  id           INTEGER PRIMARY KEY,
  slug         TEXT UNIQUE NOT NULL,
  title        TEXT NOT NULL,
  summary      TEXT NOT NULL DEFAULT '',
  body         TEXT NOT NULL DEFAULT '',     -- markdown
  cover        TEXT NOT NULL DEFAULT '',     -- đường dẫn ảnh bìa (/uploads/…)
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_pub ON posts(status, published_at);
`);

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
Chỉ để xác nhận, đóng gói, giao đơn hàng, chăm sóc khách và trả lời câu hỏi. **Không bán, không chia sẻ cho bên thứ ba**, không dùng cho quảng cáo. Đơn vị vận chuyển chỉ nhận tên, số điện thoại, địa chỉ để giao hàng.

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
- Đơn xác nhận trước 16h: gửi trong ngày.
- Thời gian nhận hàng thường từ 1 đến 4 ngày tùy khu vực.

## Phí giao hàng
Theo bảng giá của đơn vị vận chuyển, báo rõ khi xác nhận đơn.

## Kiểm tra hàng
Bạn được kiểm tra hàng trước khi thanh toán.`,

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
export const SITE_DEFAULTS = {
  brand: 'Trứng Sâu Canxi',
  tagline: 'Trứng sâu Ruồi Lính Đen giàu canxi, đạm tự nhiên cho gà, chim, cá',
  hero_text: 'Nuôi tại trang trại của gia đình, đóng hộp sạch, giao toàn quốc. Bổ sung canxi và đạm tự nhiên giúp gà khỏe, đẻ đều, vỏ trứng chắc.',
  hero_image: '',
  logo: '',
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
    { name: 'Trứng sâu canxi Ruồi Lính Đen', spec: 'Hộp 35g', price: 0, image: '',
      desc: 'Trứng ruồi lính đen giàu đạm và canxi, dùng trộn thức ăn hoặc cho ăn trực tiếp.' },
  ],
  farm: `## Câu chuyện trang trại
[Viết vài dòng: trang trại ở đâu, bắt đầu từ khi nào, vì sao nuôi sâu Ruồi Lính Đen.]

## Quy trình nuôi
[Nuôi bằng gì, thu hoạch và đóng hộp thế nào, giữ vệ sinh ra sao.]

## Hình ảnh
[Chèn ảnh trang trại trong mục Website → Thông tin shop.]`,
  usage: `## Cách dùng
- Cho ăn trực tiếp hoặc trộn với cám, rau.
- Gà đẻ: [liều lượng] mỗi con mỗi ngày.

## Bảo quản
- Nơi khô ráo, thoáng mát, tránh ánh nắng.
- Đậy kín sau khi mở hộp.`,
  policies: DEFAULT_POLICIES,
};

export function getSite() {
  const saved = getSettings().site || {};
  const site = { ...SITE_DEFAULTS, ...saved };
  site.policies = { ...DEFAULT_POLICIES, ...(saved.policies || {}) };
  if (!Array.isArray(site.products) || !site.products.length) site.products = SITE_DEFAULTS.products;
  return site;
}

const TEXT_FIELDS = ['brand', 'tagline', 'hero_text', 'hero_image', 'logo', 'phone', 'zalo', 'messenger', 'fanpage', 'tiktok',
  'email', 'address', 'map_url', 'business_name', 'business_no', 'tax_code'];

export function saveSite(input) {
  const cur = getSite();
  const next = { ...cur };
  for (const k of TEXT_FIELDS) if (k in input) next[k] = str(input[k], k === 'hero_text' ? 600 : 300);
  for (const k of ['farm', 'usage']) if (k in input) next[k] = str(input[k], 20000);
  if (Array.isArray(input.products)) {
    next.products = input.products.slice(0, 20).map((p) => ({
      name: str(p.name, 120), spec: str(p.spec, 120), price: toInt(p.price), image: str(p.image, 300), desc: str(p.desc, 1000),
    })).filter((p) => p.name);
    if (!next.products.length) throw bad('Cần ít nhất 1 sản phẩm');
  }
  if (input.policies && typeof input.policies === 'object') {
    next.policies = { ...cur.policies };
    for (const k of Object.keys(POLICIES)) if (k in input.policies) next.policies[k] = str(input.policies[k], 20000);
  }
  if (!next.brand) throw bad('Thiếu tên thương hiệu');
  setSetting('site', next);
  return getSite();
}

// ---------------------------------------------------------------- Bài viết
const POST_COLS = 'id, slug, title, summary, cover, status, published_at, created_at, updated_at';

export function listPosts({ all = false, limit = 100 } = {}) {
  return db.prepare(`SELECT ${POST_COLS} FROM posts ${all ? '' : "WHERE status = 'published'"}
    ORDER BY COALESCE(published_at, created_at) DESC LIMIT ?`).all(Math.min(toInt(limit, 100), 500));
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
  const slug = uniqueSlug(slugify(input.slug || cur?.slug || title), id || 0);
  const summary = str(input.summary ?? cur?.summary ?? '', 300) || plainText(body, 200);
  const cover = str(input.cover ?? cur?.cover ?? '', 300);
  const publishedAt = status === 'published' ? (cur?.published_at || now) : null;
  return tx(() => {
    if (cur) {
      db.prepare('UPDATE posts SET slug=?, title=?, summary=?, body=?, cover=?, status=?, published_at=?, updated_at=? WHERE id=?')
        .run(slug, title, summary, body, cover, status, publishedAt, now, id);
      return getPost(id);
    }
    const newId = Number(db.prepare(`INSERT INTO posts(slug, title, summary, body, cover, status, published_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(slug, title, summary, body, cover, status, publishedAt, now, now).lastInsertRowid);
    return getPost(newId);
  });
}

export function deletePost(id) {
  if (!db.prepare('DELETE FROM posts WHERE id = ?').run(id).changes) throw new HttpError(404, 'Không tìm thấy bài viết');
}
