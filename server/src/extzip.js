// Đóng gói thư mục Chrome extension thành file .zip để tải từ web (Cài đặt → Extension).
// Không dùng thư viện ngoài: tự ghi định dạng zip (nén deflate bằng zlib có sẵn của Node).
//
// Thư mục extension nằm ở:
//   - máy lập trình: <repo>/extension (cạnh thư mục server/)
//   - Docker: /app/extension (deploy.sh chép vào lúc build; deploy.sh cũ không chép → web báo chưa có)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CANDIDATES = [process.env.EXT_DIR, path.resolve(HERE, '../extension'), path.resolve(HERE, '../../extension')].filter(Boolean);

export function extDir() {
  return CANDIDATES.find((d) => fs.existsSync(path.join(d, 'manifest.json'))) || null;
}

/** { version, name } của extension có sẵn trên server, hoặc null. */
export function extInfo() {
  const dir = extDir();
  if (!dir) return null;
  try {
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    return { version: String(m.version || ''), name: String(m.name || '') };
  } catch { return null; }
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(full, base));
    else if (e.isFile()) out.push({ full, rel: path.relative(base, full).split(path.sep).join('/') });
  }
  return out;
}

// giờ DOS cho mục trong zip
function dosTime(d) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

let cache = null; // { key, buf }

/** Buffer file zip; các file nằm trong thư mục con "quanly-don-extension/" để giải nén ra 1 thư mục gọn. */
export function extZip() {
  const dir = extDir();
  if (!dir) return null;
  const files = listFiles(dir);
  const key = files.map((f) => { const s = fs.statSync(f.full); return `${f.rel}:${s.size}:${s.mtimeMs}`; }).join('|');
  if (cache?.key === key) return cache.buf;

  const root = 'quanly-don-extension/';
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const f of files) {
    const data = fs.readFileSync(f.full);
    const comp = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = comp.length < data.length;
    const body = useDeflate ? comp : data;
    const name = Buffer.from(root + f.rel, 'utf8');
    const crc = zlib.crc32(data);
    const { time, date } = dosTime(fs.statSync(f.full).mtime);
    const method = useDeflate ? 8 : 0;

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); // cờ: tên file UTF-8
    lh.writeUInt16LE(method, 8); lh.writeUInt16LE(time, 10); lh.writeUInt16LE(date, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, name, body);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(method, 10); ch.writeUInt16LE(time, 12); ch.writeUInt16LE(date, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(name.length, 28); // extra, comment, disk, attrs = 0
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, name);
    offset += lh.length + name.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  const buf = Buffer.concat([...locals, cd, end]);
  cache = { key, buf };
  return buf;
}
