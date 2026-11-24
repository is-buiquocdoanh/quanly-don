// Ảnh tải lên (ảnh sản phẩm, trang trại, bài viết): lưu ở DATA_DIR/uploads/<sha1>.<đuôi>, phục vụ ở /uploads/…
// Tên file = mã nội dung → cùng 1 ảnh tải 2 lần không tốn thêm chỗ, và cache được lâu.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR } from '../db.js';
import { bad } from '../util.js';

export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const MAX_BYTES = 5 * 1024 * 1024;

// nhận diện ảnh theo vài byte đầu, không tin đuôi file / loại do trình duyệt gửi
function sniff(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (buf.subarray(0, 6).toString('latin1') === 'GIF87a' || buf.subarray(0, 6).toString('latin1') === 'GIF89a') return 'gif';
  return null;
}

export const UPLOAD_MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

/** data: chuỗi base64 (có hoặc không có tiền tố data:image/...;base64,). Trả về { url, bytes }. */
export function saveUpload(data) {
  const b64 = String(data || '').replace(/^data:[^;,]*;base64,/, '');
  if (!b64) throw bad('Chưa chọn ảnh');
  const buf = Buffer.from(b64, 'base64');
  if (!buf.length) throw bad('Ảnh rỗng');
  if (buf.length > MAX_BYTES) throw bad('Ảnh quá lớn (tối đa 5 MB). Hãy thu nhỏ ảnh rồi tải lại.');
  const ext = sniff(buf);
  if (!ext) throw bad('Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF');
  const name = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 20) + '.' + ext;
  const file = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(file)) fs.writeFileSync(file, buf);
  return { url: '/uploads/' + name, bytes: buf.length };
}

/** Đường dẫn file thật cho /uploads/<tên>, hoặc null nếu tên lạ / không có. */
export function uploadFile(name) {
  if (!/^[0-9a-f]{20}\.(jpg|png|webp|gif)$/.test(name)) return null;
  const file = path.join(UPLOAD_DIR, name);
  return fs.existsSync(file) ? file : null;
}

export function listUploads(limit = 200) {
  return fs.readdirSync(UPLOAD_DIR).filter((f) => /^[0-9a-f]{20}\.(jpg|png|webp|gif)$/.test(f))
    .map((f) => ({ url: '/uploads/' + f, mtime: fs.statSync(path.join(UPLOAD_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime).slice(0, limit).map(({ url }) => url);
}
