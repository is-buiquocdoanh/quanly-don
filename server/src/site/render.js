// Website công khai (doanhwork.com): trang chủ, sản phẩm, trang trại, blog, liên hệ, chính sách.
// Trang được dựng sẵn HTML ở server (Google đọc được, chia sẻ Facebook có ảnh + tiêu đề). Không cần JavaScript.
import { esc, markdown, plainText } from './markdown.js';
import { getSite, POLICIES, listPosts, getPost, HOME } from './content.js';

const fmtMoney = (n) => (Number(n) || 0).toLocaleString('vi-VN') + 'đ';
const fmtDate = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
const digits = (s) => String(s || '').replace(/\D/g, '');

function fill(text, site, domain) {
  return String(text || '').replace(/\{\{brand\}\}/g, site.brand).replace(/\{\{domain\}\}/g, domain);
}

// ---------------------------------------------------------------- liên hệ
function contacts(site) {
  const out = [];
  if (site.messenger) out.push({ key: 'messenger', label: 'Nhắn Messenger', href: site.messenger, primary: true });
  if (site.zalo || site.phone) out.push({ key: 'zalo', label: 'Chat Zalo', href: site.zalo && /^https?:/.test(site.zalo) ? site.zalo : `https://zalo.me/${digits(site.zalo || site.phone)}` });
  if (site.phone) out.push({ key: 'phone', label: `Gọi ${site.phone}`, href: `tel:${digits(site.phone)}` });
  return out;
}
const ext = (href) => (/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : '');
const ctaButtons = (site, cls = '') => contacts(site).map((c, i) =>
  `<a class="btn ${c.primary || (i === 0) ? 'btn-primary' : 'btn-ghost'} ${cls}" href="${esc(c.href)}"${ext(c.href)}>${esc(c.label)}</a>`).join('');

// ---------------------------------------------------------------- khung trang
const NAV = [['/san-pham', 'Sản phẩm'], ['/trang-trai', 'Trang trại'], ['/blog', 'Kinh nghiệm'], ['/lien-he', 'Liên hệ']];
const navLinks = (site, path) => NAV.map(([href, label]) =>
  `<a href="${href}"${path === href || path.startsWith(href + '/') ? ' aria-current="page"' : ''}>${label}</a>`).join('')
  + (contacts(site)[0] ? `<a class="btn btn-primary btn-sm" href="${esc(contacts(site)[0].href)}"${ext(contacts(site)[0].href)}>Đặt hàng</a>` : '');

function layout(ctx, { title, description, path, image, body, type = 'website', jsonLd = null, noindex = false }) {
  const { site, base, cssVer } = ctx;
  const fullTitle = title ? `${title} · ${site.brand}` : `${site.brand} · ${site.tagline}`;
  const desc = description || site.tagline;
  const img = image || site.hero_image || site.products.find((p) => p.image)?.image || site.logo || '';
  const abs = (u) => (u && u.startsWith('/') ? base + u : u);
  const org = {
    '@context': 'https://schema.org', '@type': 'Organization', name: site.brand, url: base,
    ...(site.logo ? { logo: abs(site.logo) } : {}),
    ...(site.phone ? { telephone: site.phone } : {}),
    sameAs: [site.fanpage, site.tiktok].filter(Boolean),
  };
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(base + path)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:site_name" content="${esc(site.brand)}">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title || site.brand)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(base + path)}">
<meta property="og:locale" content="vi_VN">
${img ? `<meta property="og:image" content="${esc(abs(img))}">` : ''}
<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">
<meta name="theme-color" content="#1f6f43">
<link rel="icon" href="${esc(site.logo || '/img/logo.svg')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="/site.css?v=${cssVer}">
<script type="application/ld+json">${JSON.stringify(jsonLd ? [org, jsonLd] : org).replace(/</g, '\\u003c')}</script>
</head>
<body>
<a class="skip" href="#main">Bỏ qua, tới nội dung</a>
<header class="top">
  <div class="wrap top-in">
    <a class="brand" href="/">${site.logo ? `<img src="${esc(site.logo)}" alt="" width="36" height="36">` : '<span class="brand-dot" aria-hidden="true"></span>'}<span>${esc(site.brand)}</span></a>
    <nav class="nav nav-desk" aria-label="Menu chính">${navLinks(site, path)}</nav>
    <details class="menu">
      <summary aria-label="Mở menu"><span></span><span></span><span></span></summary>
      <nav class="nav nav-mob" aria-label="Menu">${navLinks(site, path)}</nav>
    </details>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="foot">
  <div class="wrap foot-grid">
    <div>
      <p class="foot-brand">${esc(site.brand)}</p>
      <p>${esc(site.tagline)}</p>
      ${site.business_name ? `<p class="small">${esc(site.business_name)}${site.business_no ? `<br>Giấy CN ĐKHKD số ${esc(site.business_no)}` : ''}${site.tax_code ? `<br>MST: ${esc(site.tax_code)}` : ''}</p>` : ''}
    </div>
    <div>
      <p class="foot-h">Liên hệ</p>
      <ul class="plain">
        ${site.phone ? `<li><a href="tel:${digits(site.phone)}">${esc(site.phone)}</a></li>` : ''}
        ${site.email ? `<li><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></li>` : ''}
        ${site.address ? `<li>${esc(site.address)}</li>` : ''}
        ${site.fanpage ? `<li><a href="${esc(site.fanpage)}" target="_blank" rel="noopener">Fanpage Facebook</a></li>` : ''}
        ${site.tiktok ? `<li><a href="${esc(site.tiktok)}" target="_blank" rel="noopener">TikTok</a></li>` : ''}
      </ul>
    </div>
    <div>
      <p class="foot-h">Chính sách</p>
      <ul class="plain">${Object.entries(POLICIES).map(([k, t]) => `<li><a href="/chinh-sach/${k}">${t}</a></li>`).join('')}</ul>
    </div>
  </div>
  <div class="wrap foot-bottom"><span>© ${year} ${esc(site.brand)}</span><a href="/dang-nhap" rel="nofollow">Đăng nhập quản lý</a></div>
</footer>
</body>
</html>`;
}

const pageHead = (title, lead = '') => `<section class="page-head"><div class="wrap"><h1>${esc(title)}</h1>${lead ? `<p class="lead">${esc(lead)}</p>` : ''}</div></section>`;
const imgOr = (src, alt, cls = '', eager = false) => (src
  ? `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'}>`
  : `<div class="${cls} ph" aria-hidden="true"></div>`);

function productCard(p) {
  return `<article class="card product">
    ${imgOr(p.image, p.name, 'card-img')}
    <div class="card-body">
      <h3>${esc(p.name)}</h3>
      ${p.spec ? `<p class="muted">${esc(p.spec)}</p>` : ''}
      <p>${esc(p.desc)}</p>
      <p class="price">${p.price > 0 ? fmtMoney(p.price) : 'Giá: liên hệ'}</p>
    </div>
  </article>`;
}

function postCard(p) {
  return `<article class="card post">
    <a href="/blog/${esc(p.slug)}" class="card-link" aria-label="${esc(p.title)}"></a>
    ${imgOr(p.cover, p.title, 'card-img')}
    <div class="card-body">
      <p class="muted small">${fmtDate(p.published_at)}</p>
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.summary)}</p>
    </div>
  </article>`;
}

// ---------------------------------------------------------------- các trang
// biểu tượng nhỏ (SVG nét, 24×24) cho các mục
const ICON = {
  ga: '<path d="M7 20c-2.5-1.5-3.5-4.5-2.5-7.5C6 8 9 5.5 12.5 6c1-2 3-3 4.5-2.3-.3 1-.9 1.6-1.6 1.9 1.4.9 2.3 2.4 2.3 4.2 0 1-.3 2-.8 2.8l2.6 1.1-2.9.9C15.4 17.9 12.5 20 9.5 20z"/><circle cx="15.5" cy="8.5" r=".9" fill="currentColor"/><path d="M9 20v2M12 20v2"/>',
  vit: '<path d="M4 15c0 3 3.5 5 8 5s8-2 8-5c0-1.5-1-2.5-2.5-2.8l-5 .3c-1.7-.8-2.5-2.3-2.5-4 0-1.9 1.5-3.5 3.5-3.5S17 6.6 17 8.5"/><path d="M17 8.5l3 .7-3 1"/><circle cx="13.5" cy="7.5" r=".9" fill="currentColor"/><path d="M2 22c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1"/>',
  chim: '<path d="M3 13c3 0 5-1.5 6.5-4C11 6 13.5 4.5 16 4.5c2 0 3.5 1.2 4 3l1.5.5-1.5 1c0 4-3 8-8 9.5L9 21l.7-3C6 17.5 3.8 15.7 3 13z"/><circle cx="16.5" cy="7.3" r=".9" fill="currentColor"/><path d="M9 12.5c1.5 1 3.5 1.2 5.5.4"/>',
  ca: '<path d="M2.5 12c2.5-4 6.5-6 10.5-6 3.5 0 6 2 8 4.5-2 2.5-4.5 4.5-8 4.5-4 0-8-1-10.5-3z"/><path d="M2.5 12L1 8.5M2.5 12L1 15.5"/><circle cx="16.5" cy="10.5" r=".9" fill="currentColor"/><path d="M10 7.5c1 1.5 1 3.5 0 5"/>',
  khac: '<circle cx="7" cy="9" r="2"/><circle cx="12" cy="6.5" r="2"/><circle cx="17" cy="9" r="2"/><path d="M7.5 17.5c0-3 2-5.5 4.5-5.5s4.5 2.5 4.5 5.5c0 1.5-1 2.5-2.5 2.5-1 0-1.3-.6-2-.6s-1 .6-2 .6c-1.5 0-2.5-1-2.5-2.5z"/>',
  tien: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2 0 2.8 5 1.4 5 4.2 0 1.2-1 2.1-2.5 2.1-1.2 0-2.2-.6-2.6-1.6M12 6v1.5M12 16.5V18"/>',
  rac: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/><path d="M10 11c1 1.5 3 1.5 4 0M10 15c1 1.5 3 1.5 4 0"/>',
  phan: '<path d="M12 21v-8"/><path d="M12 13c0-4 3-7 7-7 0 4-3 7-7 7zM12 15c0-3-2.5-5.5-6-5.5 0 3 2.5 5.5 6 5.5z"/><path d="M5 21h14"/>',
  sach: '<path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
};
const icon = (k) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICON[k] || ''}</svg>`;
const BENEFIT_ICONS = ['tien', 'rac', 'phan', 'sach'];

const statsBand = () => `<section class="stats"><div class="wrap stats-in">${HOME.stats.map(([v, l]) => `<div class="stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div></section>`;

const nutritionTable = () => `<div class="nutri">
  <table><thead><tr><th>Thành phần</th><th>Hàm lượng*</th><th>Ý nghĩa</th></tr></thead><tbody>
  ${HOME.nutrition.map(([a, b, c]) => `<tr><th scope="row">${esc(a)}</th><td class="num">${esc(b)}</td><td class="mean">${esc(c)}</td></tr>`).join('')}
  </tbody></table>
  <p class="small muted">* Tính trên chất khô, là khoảng giá trị trong các nghiên cứu; thay đổi theo thức ăn nuôi sâu và thời điểm thu hoạch. Xem <a href="#nguon">nguồn tham khảo</a>.</p>
</div>`;

const animalsGrid = () => `<div class="animals">${HOME.animals.map((a) => `<article class="animal">
  <div class="animal-h">${icon(a.key)}<h3>${esc(a.name)}</h3></div>
  <div class="prose">${markdown(a.text)}</div></article>`).join('')}</div>`;

const stepsRow = () => `<ol class="steps">${HOME.steps.map(([t, d, img], i) => `<li class="step">
  <img src="${esc(img)}" alt="${esc(t)}" loading="lazy">
  <div class="step-body"><span class="step-no">${i + 1}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></div></li>`).join('')}</ol>`;

const faqList = () => `<div class="faq">${HOME.faqs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>`;

const sourcesList = () => `<section class="section sources" id="nguon"><div class="wrap narrow">
  <h2 class="h-sm">Nguồn tham khảo</h2>
  <ul class="plain small">${HOME.sources.map(([t, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul>
</div></section>`;

const FARM_PHOTOS = [
  ['/img/ruoi-linh-den-de-trung.jpg', 'Ruồi lính đen bố mẹ đẻ trứng'],
  ['/img/thu-trung.jpg', 'Thu trứng hằng ngày'],
  ['/img/u-trung-trong-hu.jpg', 'Đóng hũ, phủ bông thoáng khí'],
  ['/img/sau-canxi.jpg', 'Sâu canxi tới cỡ thu hoạch'],
];

function home(ctx) {
  const { site } = ctx;
  const posts = listPosts({ limit: 3 });
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: HOME.faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  return layout(ctx, {
    path: '/', description: site.hero_text || site.tagline, jsonLd: faqLd,
    body: `
<section class="hero">
  <div class="wrap hero-in">
    <div class="hero-text">
      <p class="eyebrow">Trứng ruồi lính đen · Sâu canxi</p>
      <h1>${esc(site.tagline)}</h1>
      <p class="lead">${esc(site.hero_text)}</p>
      <div class="actions">${ctaButtons(site)}<a class="btn btn-ghost" href="/blog/huong-dan-ap-trung-ruoi-linh-den-nuoi-sau-canxi-tai-nha">Xem cách nuôi</a></div>
    </div>
    ${imgOr(site.hero_image, 'Hũ trứng ruồi lính đen đóng gói tại trang trại', 'hero-img', true)}
  </div>
</section>
${statsBand()}

<section class="section">
  <div class="wrap two align-center">
    <div><p class="eyebrow">Tìm hiểu</p><h2>Sâu canxi là gì?</h2><div class="prose">${markdown(HOME.what)}</div></div>
    <img class="rounded shadow" src="/img/sau-canxi.jpg" alt="Sâu canxi (ấu trùng ruồi lính đen) trên xẻng" loading="lazy">
  </div>
</section>

<section class="section alt">
  <div class="wrap">
    <div class="center-h"><p class="eyebrow">Dinh dưỡng</p><h2>Vì sao gọi là "sâu canxi"?</h2>
      <p class="lead">Sâu ruồi lính đen tích nhiều đạm, chất béo và đặc biệt là canxi — những thứ vật nuôi cần để lớn nhanh, xương chắc, đẻ đều.</p></div>
    ${nutritionTable()}
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="center-h"><p class="eyebrow">Bổ dưỡng cho vật nuôi</p><h2>Gà, vịt, chim, cá đều thích sâu canxi</h2></div>
    ${animalsGrid()}
  </div>
</section>

<section class="section alt">
  <div class="wrap">
    <div class="center-h"><p class="eyebrow">Tự nuôi tại nhà</p><h2>Lợi ích khi tự nuôi sâu canxi</h2></div>
    <div class="benefits">${HOME.benefits.map(([t, d], i) => `<div class="benefit">${icon(BENEFIT_ICONS[i])}<h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join('')}</div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="center-h"><p class="eyebrow">Đơn giản, dễ làm</p><h2>Từ hũ trứng đến mẻ sâu đầu tiên</h2></div>
    ${stepsRow()}
    <p class="center" style="margin-top:20px"><a href="/blog/huong-dan-ap-trung-ruoi-linh-den-nuoi-sau-canxi-tai-nha">Xem hướng dẫn chi tiết →</a></p>
  </div>
</section>

<section class="section alt">
  <div class="wrap">
    <div class="section-h"><h2>Sản phẩm</h2><a href="/san-pham">Xem chi tiết →</a></div>
    <div class="grid">${site.products.map(productCard).join('')}</div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-h"><h2>Trang trại của chúng tôi</h2><a href="/trang-trai">Xem thêm →</a></div>
    <div class="gallery">${FARM_PHOTOS.map(([src, cap]) => `<figure><img src="${src}" alt="${esc(cap)}" loading="lazy"><figcaption>${esc(cap)}</figcaption></figure>`).join('')}</div>
  </div>
</section>

<section class="section alt">
  <div class="wrap narrow"><h2 class="center">Câu hỏi thường gặp</h2>${faqList()}</div>
</section>

${posts.length ? `<section class="section">
  <div class="wrap">
    <div class="section-h"><h2>Kinh nghiệm chăn nuôi</h2><a href="/blog">Tất cả bài viết →</a></div>
    <div class="grid">${posts.map(postCard).join('')}</div>
  </div>
</section>` : ''}

<section class="section cta">
  <div class="wrap cta-in"><h2>Bắt đầu nuôi sâu canxi?</h2><p>Nhắn cho shop để được tư vấn chọn hũ trứng phù hợp với đàn vật nuôi của bạn.</p><div class="actions">${ctaButtons(site) || '<a class="btn btn-primary" href="/lien-he">Liên hệ</a>'}</div></div>
</section>
${sourcesList()}`,
  });
}

function products(ctx) {
  const { site } = ctx;
  const p0 = site.products[0];
  return layout(ctx, {
    title: 'Sản phẩm', path: '/san-pham', description: plainText(p0.desc || site.tagline), image: p0.image,
    jsonLd: {
      '@context': 'https://schema.org', '@type': 'Product', name: p0.name, description: p0.desc,
      ...(p0.image ? { image: ctx.base + p0.image } : {}), brand: { '@type': 'Brand', name: site.brand },
      ...(p0.price > 0 ? { offers: { '@type': 'Offer', price: p0.price, priceCurrency: 'VND', availability: 'https://schema.org/InStock' } } : {}),
    },
    body: `${pageHead('Trứng ruồi lính đen giống', 'Trứng tươi thu trong ngày, đóng hũ ghi ngày nở — để bạn tự nuôi sâu canxi tại nhà.')}
<section class="section"><div class="wrap">
  <div class="grid">${site.products.map(productCard).join('')}</div>
  <div class="actions center" style="margin-top:24px">${ctaButtons(site)}</div>
</div></section>
<section class="section alt"><div class="wrap two">
  <div class="prose">${markdown(site.usage)}</div>
  <div>${stepsRow().replace('class="steps"', 'class="steps steps-col"')}</div>
</div></section>
<section class="section"><div class="wrap narrow"><h2 class="center">Câu hỏi thường gặp</h2>${faqList()}</div></section>`,
  });
}

function farm(ctx) {
  const { site } = ctx;
  return layout(ctx, {
    title: 'Trang trại', path: '/trang-trai', description: plainText(site.farm), image: '/img/ruoi-linh-den-de-trung.jpg',
    body: `${pageHead('Trang trại của chúng tôi', 'Nuôi ruồi lính đen bố mẹ, thu trứng mỗi ngày, đóng hũ và giao đi toàn quốc.')}
<section class="section"><div class="wrap prose narrow farm">${markdown(site.farm)}</div></section>
<section class="section cta"><div class="wrap cta-in"><h2>Muốn ghé thăm hoặc đặt trứng?</h2><div class="actions">${ctaButtons(site) || '<a class="btn btn-primary" href="/lien-he">Liên hệ</a>'}</div></div></section>`,
  });
}

function blogList(ctx) {
  const posts = listPosts({ limit: 100 });
  return layout(ctx, {
    title: 'Kinh nghiệm chăn nuôi', path: '/blog', description: `Bài viết chia sẻ kinh nghiệm nuôi sâu, dùng trứng sâu canxi từ ${ctx.site.brand}.`,
    body: `${pageHead('Kinh nghiệm chăn nuôi', 'Chia sẻ cách nuôi sâu, dùng trứng sâu cho gà, chim và kinh nghiệm từ trang trại.')}
<section class="section"><div class="wrap">${posts.length ? `<div class="grid">${posts.map(postCard).join('')}</div>` : '<p class="muted center">Bài viết đang được chuẩn bị.</p>'}</div></section>`,
  });
}

function blogPost(ctx, slug) {
  const p = getPost(slug, { publishedOnly: true });
  if (!p) return null;
  return layout(ctx, {
    title: p.title, path: `/blog/${p.slug}`, description: p.summary, image: p.cover, type: 'article',
    jsonLd: {
      '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: p.summary,
      datePublished: (p.published_at || '').replace(' ', 'T') + '+07:00', dateModified: p.updated_at.replace(' ', 'T') + '+07:00',
      ...(p.cover ? { image: ctx.base + p.cover } : {}), author: { '@type': 'Organization', name: ctx.site.brand },
    },
    body: `<article class="section"><div class="wrap narrow">
  <p class="muted small"><a href="/blog">← Kinh nghiệm chăn nuôi</a> · ${fmtDate(p.published_at)}</p>
  <h1 class="post-title">${esc(p.title)}</h1>
  ${p.cover ? `<img class="post-cover" src="${esc(p.cover)}" alt="${esc(p.title)}">` : ''}
  <div class="prose">${markdown(p.body)}</div>
  <div class="cta-box"><p><strong>Cần trứng sâu canxi cho đàn gà?</strong> Nhắn cho shop để được tư vấn.</p><div class="actions">${ctaButtons(ctx.site)}</div></div>
</div></article>`,
  });
}

function contact(ctx) {
  const { site } = ctx;
  const rows = [
    site.phone && ['Điện thoại', `<a href="tel:${digits(site.phone)}">${esc(site.phone)}</a>`],
    (site.zalo || site.phone) && ['Zalo', `<a href="${esc(contacts(site).find((c) => c.key === 'zalo')?.href || '')}" target="_blank" rel="noopener">${esc(site.zalo && !/^https?:/.test(site.zalo) ? site.zalo : site.phone || 'Chat Zalo')}</a>`],
    site.messenger && ['Messenger', `<a href="${esc(site.messenger)}" target="_blank" rel="noopener">Nhắn tin fanpage</a>`],
    site.email && ['Email', `<a href="mailto:${esc(site.email)}">${esc(site.email)}</a>`],
    site.address && ['Địa chỉ', `${esc(site.address)}${site.map_url ? ` · <a href="${esc(site.map_url)}" target="_blank" rel="noopener">Xem bản đồ</a>` : ''}`],
    site.fanpage && ['Fanpage', `<a href="${esc(site.fanpage)}" target="_blank" rel="noopener">${esc(site.fanpage.replace(/^https?:\/\/(www\.)?/, ''))}</a>`],
    site.tiktok && ['TikTok', `<a href="${esc(site.tiktok)}" target="_blank" rel="noopener">${esc(site.tiktok.replace(/^https?:\/\/(www\.)?/, ''))}</a>`],
  ].filter(Boolean);
  return layout(ctx, {
    title: 'Liên hệ', path: '/lien-he', description: `Liên hệ đặt hàng ${site.brand}.`,
    body: `${pageHead('Liên hệ', 'Đặt hàng, hỏi giá hoặc tư vấn cách dùng.')}
<section class="section"><div class="wrap narrow">
  ${rows.length ? `<dl class="info">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` : '<p class="muted">Thông tin liên hệ đang được cập nhật.</p>'}
  ${site.business_name ? `<h2 class="h-sm">Thông tin kinh doanh</h2><dl class="info"><div><dt>Tên</dt><dd>${esc(site.business_name)}</dd></div>${site.business_no ? `<div><dt>Giấy CN ĐKHKD</dt><dd>${esc(site.business_no)}</dd></div>` : ''}${site.tax_code ? `<div><dt>Mã số thuế</dt><dd>${esc(site.tax_code)}</dd></div>` : ''}</dl>` : ''}
  <div class="actions" style="margin-top:24px">${ctaButtons(site)}</div>
</div></section>`,
  });
}

function policyIndex(ctx) {
  return layout(ctx, {
    title: 'Chính sách', path: '/chinh-sach',
    body: `${pageHead('Chính sách')}<section class="section"><div class="wrap narrow"><ul class="link-list">${Object.entries(POLICIES).map(([k, t]) => `<li><a href="/chinh-sach/${k}">${t}</a></li>`).join('')}</ul></div></section>`,
  });
}

function policy(ctx, key) {
  if (!POLICIES[key]) return null;
  const md = fill(ctx.site.policies[key], ctx.site, ctx.domain);
  return layout(ctx, {
    title: POLICIES[key], path: `/chinh-sach/${key}`, description: plainText(md),
    body: `${pageHead(POLICIES[key])}<section class="section"><div class="wrap prose narrow">${markdown(md)}
      <p class="muted small" style="margin-top:32px">Các chính sách khác: ${Object.entries(POLICIES).filter(([k]) => k !== key).map(([k, t]) => `<a href="/chinh-sach/${k}">${t}</a>`).join(' · ')}</p></div></section>`,
  });
}

function notFound(ctx) {
  return layout(ctx, {
    title: 'Không tìm thấy trang', path: '/404', noindex: true,
    body: `${pageHead('Không tìm thấy trang', 'Trang bạn tìm không có hoặc đã được chuyển đi.')}<section class="section"><div class="wrap center"><a class="btn btn-primary" href="/">Về trang chủ</a></div></section>`,
  });
}

function sitemap(ctx) {
  const urls = ['/', '/san-pham', '/trang-trai', '/blog', '/lien-he', ...Object.keys(POLICIES).map((k) => `/chinh-sach/${k}`)]
    .map((u) => ({ loc: ctx.base + u }));
  for (const p of listPosts({ limit: 500 })) urls.push({ loc: `${ctx.base}/blog/${p.slug}`, lastmod: (p.updated_at || '').slice(0, 10) });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>`;
}

// ---------------------------------------------------------------- bộ định tuyến
/**
 * Trả về { status, type, body, headers } cho 1 request GET vào website công khai.
 * opts: { host, proto, adminUrl, cssVer }
 */
export function renderSite(pathname, opts) {
  const domain = opts.host;
  const ctx = { site: getSite(), base: `${opts.proto}://${opts.host}`, domain, cssVer: opts.cssVer };
  const html = (body, status = 200) => ({ status, type: 'text/html; charset=utf-8', body, headers: { 'Cache-Control': 'no-cache' } });
  const redirect = (to, status = 301) => ({ status, headers: { Location: to }, body: '' });
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  if (p === '/') return html(home(ctx));
  if (p === '/san-pham') return html(products(ctx));
  if (p === '/trang-trai') return html(farm(ctx));
  if (p === '/blog') return html(blogList(ctx));
  if (p.startsWith('/blog/')) { const r = blogPost(ctx, decodeURIComponent(p.slice(6))); return r ? html(r) : html(notFound(ctx), 404); }
  if (p === '/lien-he') return html(contact(ctx));
  if (p === '/chinh-sach') return html(policyIndex(ctx));
  if (p.startsWith('/chinh-sach/')) { const r = policy(ctx, p.slice(12)); return r ? html(r) : html(notFound(ctx), 404); }
  if (p === '/dang-nhap') return redirect(opts.adminUrl, 302);
  if (p === '/privacy.html' || p === '/privacy') return redirect('/chinh-sach/bao-mat');
  if (p === '/robots.txt') return { status: 200, type: 'text/plain; charset=utf-8', body: `User-agent: *\nAllow: /\nDisallow: /dang-nhap\nSitemap: ${ctx.base}/sitemap.xml\n` };
  if (p === '/sitemap.xml') return { status: 200, type: 'application/xml; charset=utf-8', body: sitemap(ctx) };
  return html(notFound(ctx), 404);
}
