// Đọc đơn bằng AI (Claude): tách tên, SĐT, địa chỉ (thêm dấu, mở rộng viết tắt), số lượng, tổng tiền
// từ đoạn chat lộn xộn — không dấu, viết tắt, thiếu thông tin, lẫn tin nhắn của shop.
// Khóa API chỉ nằm trên server (biến môi trường ANTHROPIC_API_KEY), extension không giữ khóa.
import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
const MAX_CHARS = 6000;

let client = null;
export const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY;

const MISSING = ['name', 'phone', 'address_detail', 'ward', 'district', 'province', 'qty', 'total'];

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'phone', 'phone_raw', 'address', 'province', 'qty', 'total', 'product', 'note', 'missing', 'warnings', 'confidence'],
  properties: {
    name: { type: 'string', description: 'Tên người nhận, viết hoa chữ cái đầu, có dấu. "" nếu không có.' },
    phone: { type: 'string', description: 'SĐT người nhận đã chuẩn hóa: đúng 10 chữ số bắt đầu bằng 0 (đổi +84/84 thành 0, bỏ dấu cách/chấm). "" nếu không tìm được SĐT hợp lệ.' },
    phone_raw: { type: 'string', description: 'SĐT đúng như khách viết (kể cả khi sai/thiếu số). "" nếu không có.' },
    address: { type: 'string', description: 'Địa chỉ giao hàng đầy đủ, tiếng Việt có dấu, viết tắt đã mở rộng, thứ tự: số nhà/đường/thôn/xóm, xã/phường, quận/huyện (nếu khách ghi), tỉnh/thành phố. "" nếu không có.' },
    province: { type: 'string', description: 'Tỉnh/thành phố trong địa chỉ, có dấu. "" nếu không xác định được.' },
    qty: { type: 'integer', description: 'Số hộp khách đặt. 0 nếu không nói.' },
    total: { type: 'integer', description: 'Tổng tiền khách phải trả (VND, số nguyên, ví dụ 260000). 0 nếu không có thông tin giá.' },
    product: { type: 'string', description: 'Sản phẩm / loại nếu khách hoặc shop ghi rõ khác sản phẩm mặc định. "" nếu là sản phẩm mặc định.' },
    note: { type: 'string', description: 'Ghi chú giao hàng ngắn gọn (giờ nhận, gọi trước, cho xem hàng, người nhận khác...). "" nếu không có.' },
    missing: { type: 'array', items: { type: 'string', enum: MISSING }, description: 'Các thông tin còn thiếu để gửi được hàng.' },
    warnings: { type: 'array', items: { type: 'string' }, description: 'Cảnh báo ngắn bằng tiếng Việt cho người lưu đơn: chỗ mơ hồ, mâu thuẫn, chỗ đã đoán. Rỗng nếu không có.' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Mức chắc chắn chung về tên + SĐT + địa chỉ.' },
  },
};

function systemPrompt(defaultProduct) {
  return `Bạn là nhân viên nhập đơn cho một shop bán hàng online ở Việt Nam. Sản phẩm mặc định: ${defaultProduct || 'trứng sâu canxi (bán theo hộp)'}.
Người dùng dán một đoạn chat Messenger giữa shop và khách (có thể chỉ tin của khách, có thể lẫn tin của shop, có thể có nhiều tin). Hãy trích thông tin đơn hàng để gửi hàng.

Cách đọc:
- Khách thường viết không dấu, viết tắt, sai chính tả, xuống dòng lung tung. Hãy thêm dấu tiếng Việt đúng và mở rộng viết tắt: "x", "xa" → "Xã"; "p", "f", "phg" → "Phường"; "h", "hyen" → "Huyện"; "q" → "Quận"; "tp" → "Thành phố"; "tx" → "Thị xã"; "tt" → "Thị trấn"; "t", "tinh" → "Tỉnh"; "hn" → "Hà Nội"; "hcm", "sg", "sài gòn" → "TP Hồ Chí Minh"; "đn" tùy ngữ cảnh (Đà Nẵng / Đồng Nai)...
- Giữ đúng đơn vị hành chính khách ghi (kể cả tên huyện/tỉnh cũ trước sáp nhập). KHÔNG tự đổi sang tên mới, KHÔNG bịa thêm xã/huyện/tỉnh mà khách không ghi. Chỉ điền tỉnh khi chắc chắn từ ngữ cảnh (ví dụ tên huyện duy nhất của một tỉnh); khi đoán, ghi vào warnings.
- Nếu shop đã nhắn tin tóm tắt / chốt đơn (ví dụ "em chốt đơn: ... tổng 260k"), ưu tiên thông tin đã chốt mới nhất.
- Tiền: "130k", "130 nghìn", "130.000", "1tr2" (= 1.200.000). Nếu chỉ có đơn giá và số lượng thì nhân ra tổng. Có phí ship cộng thêm thì cộng vào tổng và ghi vào note. Không có thông tin giá thì total = 0, KHÔNG tự đặt giá.
- Số lượng: "2h", "2 hop", "2 hộp", "lấy 2" → 2. Không nói thì 0.
- SĐT Việt Nam di động có 10 số bắt đầu bằng 0. Thiếu/thừa số thì phone = "" và ghi cảnh báo, phone_raw giữ nguyên. Có 2 SĐT thì lấy SĐT người nhận, ghi số còn lại vào note.
- Bỏ qua lời chào, câu hỏi, tin quảng cáo của shop. Không suy diễn thông tin không có trong đoạn chat.
- warnings: chỉ ghi điều người lưu đơn cần kiểm tra lại, mỗi ý ngắn gọn.`;
}

/**
 * Đọc đơn từ đoạn chat. Trả về { order: {...}, model } hoặc ném lỗi có message tiếng Việt.
 */
export async function aiParse(text, { defaultProduct = '' } = {}) {
  if (!aiEnabled()) throw new Error('Chưa bật AI: thêm ANTHROPIC_API_KEY vào file .env của server');
  text = String(text || '').trim();
  if (!text) throw new Error('Đoạn chat trống');
  if (text.length > MAX_CHARS) throw new Error(`Đoạn bôi đen quá dài (${text.length} ký tự) — chỉ bôi đen phần tin nhắn có thông tin đơn`);
  client ||= new Anthropic({ timeout: 45_000, maxRetries: 1 });

  let res;
  try {
    res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      // từ chối nhầm vì bộ lọc an toàn → server tự chạy lại bằng model dự phòng
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: systemPrompt(defaultProduct),
      messages: [{ role: 'user', content: `Đoạn chat:\n<<<\n${text}\n>>>` }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('Khóa ANTHROPIC_API_KEY trên server không đúng');
    if (e instanceof Anthropic.RateLimitError) throw new Error('AI đang quá tải, thử lại sau ít giây');
    if (e instanceof Anthropic.APIConnectionError) throw new Error('Server không kết nối được AI (mạng)');
    if (e instanceof Anthropic.APIError) throw new Error(`AI lỗi (${e.status ?? '?'}): ${e.message}`);
    throw e;
  }
  if (res.stop_reason === 'refusal') throw new Error('AI từ chối đọc đoạn này');
  if (res.stop_reason === 'max_tokens') throw new Error('AI trả lời bị cắt ngang, thử bôi đen ít hơn');
  const block = res.content.find((b) => b.type === 'text');
  let out;
  try { out = JSON.parse(block?.text || ''); } catch { throw new Error('AI trả về dữ liệu hỏng'); }

  const phone = String(out.phone || '').replace(/\D/g, '');
  return {
    model: res.model,
    order: {
      name: String(out.name || '').trim(),
      phone: /^0\d{9}$/.test(phone) ? phone : '',
      phone_raw: String(out.phone_raw || ''),
      address: String(out.address || '').trim(),
      province: String(out.province || '').trim(),
      qty: Math.max(0, Math.round(Number(out.qty) || 0)),
      total: Math.max(0, Math.round(Number(out.total) || 0)),
      product: String(out.product || '').trim(),
      note: String(out.note || '').trim(),
      missing: (Array.isArray(out.missing) ? out.missing : []).filter((x) => MISSING.includes(x)),
      warnings: (Array.isArray(out.warnings) ? out.warnings : []).map(String).filter(Boolean).slice(0, 6),
      confidence: ['high', 'medium', 'low'].includes(out.confidence) ? out.confidence : 'medium',
    },
  };
}
