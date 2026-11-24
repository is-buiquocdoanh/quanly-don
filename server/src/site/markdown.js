// Markdown → HTML tối giản cho blog và trang chính sách. Không thư viện ngoài.
// An toàn: mọi chữ đều được escape trước; chỉ link http(s) / mailto / tel / đường dẫn nội bộ được giữ.
//
// Hỗ trợ: # tiêu đề (##, ###), đoạn văn, **đậm**, *nghiêng*, `code`, [chữ](link), ![mô tả](ảnh),
// danh sách - / 1., > trích dẫn, --- đường kẻ, dòng trống tách đoạn.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function safeUrl(u) {
  const url = String(u || '').trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(url) || /^\/(?!\/)/.test(url) || url.startsWith('#')) return url;
  return '';
}

function inline(text) {
  // ảnh và link xử lý trên chữ gốc rồi escape từng phần, để không escape 2 lần
  const out = [];
  const re = /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    out.push(fmt(text.slice(last, m.index)));
    if (m[1] !== undefined && m[2] !== undefined && m[0].startsWith('!')) {
      const src = safeUrl(m[2]);
      out.push(src ? `<img src="${esc(src)}" alt="${esc(m[1])}" loading="lazy">` : esc(m[0]));
    } else {
      const href = safeUrl(m[4]);
      const ext = /^https?:\/\//i.test(href);
      out.push(href ? `<a href="${esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${fmt(m[3])}</a>` : fmt(m[3]));
    }
    last = re.lastIndex;
  }
  out.push(fmt(text.slice(last)));
  return out.join('');
}

function fmt(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
}

export function markdown(src) {
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let para = [];
  let list = null; // { tag, items }
  let quote = [];
  const flushPara = () => { if (para.length) { html.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const flushList = () => { if (list) { html.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; } };
  const flushQuote = () => { if (quote.length) { html.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`); quote = []; } };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };

  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flushAll(); continue; }
    if ((m = line.match(/^(#{1,3})\s+(.+)$/))) {
      flushAll();
      const lv = Math.min(m[1].length + 1, 4); // # → h2 (h1 dành cho tiêu đề trang)
      html.push(`<h${lv}>${inline(m[2])}</h${lv}>`);
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { flushAll(); html.push('<hr>'); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { flushPara(); flushList(); quote.push(m[1]); continue; }
    if ((m = line.match(/^\s*[-*+]\s+(.+)$/)) || (m = line.match(/^\s*\d+[.)]\s+(.+)$/))) {
      flushPara(); flushQuote();
      const tag = /^\s*\d/.test(line) ? 'ol' : 'ul';
      if (list && list.tag !== tag) flushList();
      list ??= { tag, items: [] };
      list.items.push(m[1]);
      continue;
    }
    flushList(); flushQuote();
    para.push(line.trim());
  }
  flushAll();
  return html.join('\n');
}

/** Chữ thuần (bỏ ký hiệu markdown) để làm mô tả ngắn / thẻ meta. */
export function plainText(src, max = 160) {
  const t = String(src || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)]|-{3,})\s*/gm, '') // ký hiệu đầu dòng; giữ "3-5g"
    .replace(/(\*\*|\*|`)/g, '')
    .replace(/([^.!?:\s])\n+/g, '$1. ')                         // xuống dòng → ngắt câu
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : t;
}

/** "Cách cho gà ăn trứng sâu" → "cach-cho-ga-an-trung-sau" */
export function slugify(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
