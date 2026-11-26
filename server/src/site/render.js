// Website công khai (doanhwork.com): bán hũ trứng sâu canxi chuẩn 35g theo combo, đặt đơn trực tiếp, kiến thức nuôi sâu & nông nghiệp.
import { esc, markdown, plainText } from './markdown.js';
import { getSite, getPriceTable, POLICIES, POST_CATEGORIES, listPosts, getPost, HOME } from './content.js';

const fmtMoney = (n) => (Number(n) || 0).toLocaleString('vi-VN') + 'đ';
const fmtDate = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
const digits = (s) => String(s || '').replace(/\D/g, '');
const readMins = (p) => Math.max(2, Math.round((Number(p.body_len) || String(p.body || '').length) / 1100));
const catLabel = (k) => POST_CATEGORIES[k] || POST_CATEGORIES['nuoi-sau'];

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

// ---------------------------------------------------------------- biểu tượng SVG nét
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
  truck: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7.5" cy="18" r="2"/><circle cx="17.5" cy="18" r="2"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.8-5.5"/>',
  bag: '<path d="M6 8h12l-1 12H7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  spark: '<path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
};
const icon = (k, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICON[k] || ''}</svg>`;
const BENEFIT_ICONS = ['tien', 'rac', 'phan', 'sach'];

// Danh sách combo hũ 35g theo bảng giá chuẩn của shop (1=95k gồm 65k+30k ship; 2+=miễn ship)
function getCombos(priceTable) {
  const t = priceTable || {};
  const p1Total = t[1] || 95000;
  const p2 = t[2] || 130000;
  const p3 = t[3] || 195000;
  const p4 = t[4] || 250000;
  const p5 = t[5] || 300000;
  const unitBase = p2 > 0 ? Math.round(p2 / 2) : 65000;
  const ship1 = Math.max(0, p1Total - unitBase);
  return [
    { qty: 1, grams: 35, goods: unitBase, ship: ship1, total: p1Total, save: 0, badge: 'Dùng thử', note: `65k + ${Math.round(ship1 / 1000)}k ship` },
    { qty: 2, grams: 70, goods: p2, ship: 0, total: p2, save: 0, badge: 'Bán chạy nhất', pop: true, freeship: true, note: 'Miễn phí ship' },
    { qty: 3, grams: 105, goods: p3, ship: 0, total: p3, save: 0, badge: 'Phổ biến', freeship: true, note: 'Miễn phí ship' },
    { qty: 4, grams: 140, goods: unitBase * 4, ship: 0, total: p4, save: Math.max(0, unitBase * 4 - p4), badge: 'Tiết kiệm', freeship: true, note: 'Giảm 10k + Freeship' },
    { qty: 5, grams: 175, goods: unitBase * 5, ship: 0, total: p5, save: Math.max(0, unitBase * 5 - p5), badge: 'Giá tốt nhất', best: true, freeship: true, note: 'Chỉ 60k/hũ + Freeship' },
  ];
}

// ---------------------------------------------------------------- khung trang
const NAV = [
  ['/san-pham', 'Bảng giá 35g'],
  ['/blog', 'Kiến thức & Nông nghiệp'],
  ['/trang-trai', 'Trang trại'],
  ['/lien-he', 'Liên hệ'],
];
const navLinks = (path) => NAV.map(([href, label]) =>
  `<a href="${href}"${path === href || path.startsWith(href + '/') ? ' aria-current="page"' : ''}>${label}</a>`).join('')
  + `<a class="btn btn-amber btn-sm btn-sheen" href="${path === '/' || path === '/san-pham' ? '#dat-hang' : '/dat-hang'}">${icon('bag', 'ic-xs')}<span>Đặt trứng ngay</span></a>`;

function mobileDock(site, path) {
  const orderHref = path === '/' || path === '/san-pham' || path === '/dat-hang' ? '#dat-hang' : '/dat-hang';
  const c = contacts(site)[0];
  return `<div class="mob-dock" data-mob-dock role="region" aria-label="Đặt hàng nhanh">
    ${c ? `<a class="btn btn-ghost mob-dock-sub" href="${esc(c.href)}"${ext(c.href)}>${esc(c.label)}</a>` : `<a class="btn btn-ghost mob-dock-sub" href="/blog">Cách nuôi</a>`}
    <a class="btn btn-amber btn-sheen mob-dock-main" href="${orderHref}">${icon('bag', 'ic-xs')}<span>Đặt ngay · Freeship 2 hũ</span></a>
  </div>`;
}

// Meta Pixel (chỉ chèn khi đã nhập Pixel ID trong trang quản lý → Website → Truy cập & quảng cáo)
function pixelScript(site) {
  const id = String(site.fb_pixel_id || '');
  if (!/^\d{8,20}$/.test(id)) return '';
  return `<meta name="qld-pixel" content="1">
<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('set','autoConfig',false,'${id}');fbq('init','${id}');fbq('track','PageView');</script>
<noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${id}&amp;ev=PageView&amp;noscript=1"></noscript>`;
}

function layout(ctx, { title, description, path, image, body, type = 'website', jsonLd = null, noindex = false }) {
  const { site, base, cssVer, jsVer } = ctx;
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
<meta name="theme-color" content="#0d3d24">
<link rel="icon" href="${esc(site.logo || '/img/logo.svg')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=Lora:ital,wght@0,600;0,700;1,600&display=swap">
<link rel="stylesheet" href="/site.css?v=${cssVer}">
<script type="application/ld+json">${JSON.stringify(jsonLd ? [org, jsonLd] : org).replace(/</g, '\\u003c')}</script>
${pixelScript(site)}
</head>
<body>
<div class="scroll-progress" data-scroll-progress aria-hidden="true"></div>
<a class="skip" href="#main">Bỏ qua, tới nội dung</a>
<div class="announce">
  <div class="wrap announce-in">
    <span><span class="dot-live" aria-hidden="true"></span><strong>Hũ chuẩn 35g</strong> · 65.000đ/hũ · <em class="ann-free">MIỄN PHÍ SHIP từ 2 hũ</em></span>
    <span class="announce-sep" aria-hidden="true">·</span>
    <span>Ship COD toàn quốc · Kiểm tra hàng trước khi trả tiền</span>
    ${site.phone ? `<a class="announce-tel" href="tel:${digits(site.phone)}">Gọi: ${esc(site.phone)}</a>` : ''}
  </div>
</div>
<header class="top">
  <div class="wrap top-in">
    <a class="brand" href="/">
      ${site.logo ? `<img src="${esc(site.logo)}" alt="" width="40" height="40">` : '<span class="brand-dot" aria-hidden="true"></span>'}
      <span class="brand-txt"><strong>${esc(site.brand)}</strong><small>Chuyên hũ trứng 35g · Giao toàn quốc</small></span>
    </a>
    <nav class="nav nav-desk" aria-label="Menu chính">${navLinks(path)}</nav>
    <details class="menu">
      <summary aria-label="Mở menu"><span></span><span></span><span></span></summary>
      <nav class="nav nav-mob" aria-label="Menu">${navLinks(path)}</nav>
    </details>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="foot">
  <div class="wrap foot-grid">
    <div>
      <div class="foot-head-brand">
        ${site.logo ? `<img src="${esc(site.logo)}" alt="" width="36" height="36">` : ''}
        <p class="foot-brand">${esc(site.brand)}</p>
      </div>
      <p class="foot-desc">${esc(site.tagline)}</p>
      ${site.business_name ? `<p class="small foot-biz">${esc(site.business_name)}${site.business_no ? `<br>Giấy CN ĐKHKD số ${esc(site.business_no)}` : ''}${site.tax_code ? `<br>MST: ${esc(site.tax_code)}` : ''}</p>` : ''}
    </div>
    <div>
      <p class="foot-h">Đặt hàng & Kiến thức</p>
      <ul class="plain">
        <li><a href="/dat-hang">Đặt hũ trứng 35g (Freeship từ 2 hũ)</a></li>
        <li><a href="/san-pham">Bảng giá Combo 1–5 hũ</a></li>
        <li><a href="/blog">Kiến thức nuôi sâu & Nông nghiệp</a></li>
        <li><a href="/trang-trai">Hình ảnh trang trại</a></li>
        <li><a href="/lien-he">Liên hệ & Hỗ trợ</a></li>
      </ul>
    </div>
    <div>
      <p class="foot-h">Liên hệ</p>
      <ul class="plain">
        ${site.phone ? `<li><a href="tel:${digits(site.phone)}">SĐT: ${esc(site.phone)}</a></li>` : ''}
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
  <div class="wrap foot-bottom"><span>© ${year} ${esc(site.brand)} · Chuyên trứng ruồi lính đen hũ 35g</span><a href="/dang-nhap" rel="nofollow">Đăng nhập quản lý</a></div>
</footer>
${mobileDock(site, path)}
<script src="/site.js?v=${jsVer}" defer></script>
</body>
</html>`;
}

const pageHead = (title, lead = '', eyebrow = '') => `<section class="page-head">
  <div class="wrap page-head-in">
    ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
    <h1>${esc(title)}</h1>
    ${lead ? `<p class="lead">${esc(lead)}</p>` : ''}
  </div>
</section>`;

const imgOr = (src, alt, cls = '', eager = false) => (src
  ? `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'}>`
  : `<div class="${cls} ph" aria-hidden="true"></div>`);

// ---------------------------------------------------------------- sản phẩm & combo 35g
const PRODUCT_BADGES = ['Bán chạy · Freeship', 'Dùng thử 35g', 'Tiết kiệm · Freeship'];
const PRODUCT_QTY = [2, 1, 5];

function productCard(p, i) {
  const badge = PRODUCT_BADGES[i] || 'Chuẩn 35g';
  const pickQty = PRODUCT_QTY[i] || 2;
  const priceHtml = Number(p.price) > 0
    ? `<p class="price">${fmtMoney(p.price)}</p>`
    : '<p class="price">Giá: liên hệ</p>';
  return `<article class="card product${i === 0 ? ' is-featured' : ''}" data-reveal style="--d:${i}">
    <div class="card-media">
      ${imgOr(p.image, p.name, 'card-img')}
      <span class="prod-badge${i === 0 ? ' prod-badge-hot' : ''}">${esc(badge)}</span>
    </div>
    <div class="card-body">
      <h3>${esc(p.name)}</h3>
      ${p.spec ? `<p class="prod-spec">${icon('check', 'ic-xs')}<span>${esc(p.spec)}</span></p>` : ''}
      <p class="prod-desc">${esc(p.desc)}</p>
      <div class="prod-foot">
        ${priceHtml}
        <a class="btn ${i === 0 ? 'btn-amber' : 'btn-primary'} btn-sm prod-buy" href="#dat-hang" data-pick-qty="${pickQty}">Chọn đặt →</a>
      </div>
    </div>
  </article>`;
}

function comboShowcaseGrid(priceTable) {
  const combos = getCombos(priceTable);
  return `<div class="combo-cards" data-reveal-group>
    ${combos.map((c, idx) => `<button type="button" class="ccard${c.pop ? ' is-pop' : ''}${c.best ? ' is-best' : ''}" data-pick-qty="${c.qty}" data-reveal style="--d:${idx}">
      <span class="ccard-top">
        <span class="ccard-tag">${esc(c.badge)}</span>
        ${c.freeship ? '<span class="ccard-ship is-free">MIỄN SHIP</span>' : '<span class="ccard-ship">+30k ship</span>'}
      </span>
      <strong class="ccard-title">${c.qty} Hũ 35g</strong>
      <span class="ccard-grams">Tổng ${c.grams}g trứng tươi</span>
      <span class="ccard-price">${fmtMoney(c.total)}</span>
      <span class="ccard-sub">${c.qty === 1 ? '65.000đ + 30.000đ ship' : `${fmtMoney(Math.round(c.total / c.qty))}/hũ · Giao miễn phí`}</span>
      ${c.save > 0 ? `<span class="ccard-save">Tiết kiệm ${fmtMoney(c.save)} + Freeship</span>` : (c.freeship ? '<span class="ccard-save is-mint">Tiết kiệm 30.000đ phí ship</span>' : '<span class="ccard-save is-muted">Đặt từ 2 hũ được Freeship</span>')}
      <span class="ccard-cta">Đặt gói này →</span>
    </button>`).join('')}
  </div>`;
}

function orderSection(ctx, { heading = 'Đặt hũ trứng 35g giao tận nhà', sub = 'Chỉ bán duy nhất hũ chuẩn 35g — đóng tươi trong ngày. Miễn phí giao hàng toàn quốc từ 2 hũ!' } = {}) {
  const { site, priceTable } = ctx;
  const combos = getCombos(priceTable);
  const defaultQty = 2;
  const defCombo = combos.find((c) => c.qty === defaultQty) || combos[0];
  const configJson = JSON.stringify({
    productName: 'Trứng sâu canxi Ruồi Lính Đen (Hũ 35g)',
    priceTable,
    unitBase: defCombo.goods / 2 || 65000,
    shipSingle: combos[0].ship || 30000,
  }).replace(/</g, '\\u003c');

  return `<section class="section order-sec" id="dat-hang">
  <div class="wrap order-grid" data-order-wrap>
    <div class="order-info" data-reveal>
      <p class="eyebrow">Đặt hàng trực tiếp từ trại · Hũ 35g</p>
      <h2>${esc(heading)}</h2>
      <p class="lead">${esc(sub)}</p>

      <div class="ship-banner">
        ${icon('gift', 'ic-sm')}
        <div>
          <strong>Chính sách giá & giao hàng minh bạch</strong>
          <span>1 hũ 35g: <b>65.000đ</b> + ship 30.000đ (95k) · Từ <b>2 hũ trở lên MIỄN PHÍ SHIP</b> toàn quốc!</span>
        </div>
      </div>

      <div class="combo-box">
        <div class="combo-h"><strong>Bảng giá Combo hũ 35g</strong><span>Bấm chọn nhanh</span></div>
        <div class="combo-list">
          ${combos.map((c) => `<button type="button" class="combo-row${c.pop ? ' is-pop' : ''}${c.qty === defaultQty ? ' is-active' : ''}" data-tier-qty="${c.qty}">
            <span class="combo-l">
              <b>${c.qty} hũ (${c.grams}g)</b>
              ${c.pop ? '<em class="tag-pop">Bán chạy nhất</em>' : ''}
              ${c.best ? '<em class="tag-best">Rẻ nhất · 60k/hũ</em>' : ''}
              ${c.freeship ? '<em class="tag-free">Freeship</em>' : '<small>65k + 30k ship</small>'}
            </span>
            <span class="combo-r">
              <strong>${fmtMoney(c.total)}</strong>
              ${c.save > 0 ? `<small class="combo-save">Giảm ${fmtMoney(c.save)} + Freeship</small>` : (c.freeship ? '<small class="combo-save is-green">Miễn phí ship</small>' : '<small class="muted">Tổng thanh toán</small>')}
            </span>
          </button>`).join('')}
        </div>
      </div>

      <ul class="guarantees">
        <li>${icon('spark', 'ic-sm')}<div><strong>Cân đủ 35g/hũ · Trứng thu trong ngày</strong><span>Đóng hũ thoáng khí, ghi rõ ngày nở dự kiến ngay trên nắp.</span></div></li>
        <li>${icon('truck', 'ic-sm')}<div><strong>Ship COD toàn quốc 1–4 ngày</strong><span>Kiểm tra hàng tận tay trước khi thanh toán. Đổi mới nếu móp vỡ.</span></div></li>
        <li>${icon('book', 'ic-sm')}<div><strong>Kèm hướng dẫn ấp nở chi tiết</strong><span>Hỗ trợ kỹ thuật 1-1 qua Zalo/Messenger cho người nuôi lần đầu.</span></div></li>
      </ul>
      ${contacts(site).length ? `<div class="order-alt"><span>Cần đặt trên 5 hũ giá sỉ hoặc tư vấn thêm?</span><div class="actions">${ctaButtons(site, 'btn-sm')}</div></div>` : ''}
    </div>

    <div class="order-card" data-reveal style="--d:1">
      <form class="order-form" data-order-form data-config="${esc(configJson)}" novalidate>
        <input type="hidden" name="product" value="Trứng sâu canxi Ruồi Lính Đen (Hũ 35g)">
        <div class="order-card-h">
          <div>
            <h3>Đặt hũ trứng 35g ngay</h3>
            <p class="small muted" style="margin:2px 0 0">Điền thông tin 30 giây — đơn vào thẳng kho đóng hàng</p>
          </div>
          <span class="badge-cod">COD · Kiểm hàng</span>
        </div>

        <div class="field">
          <span>1. Chọn gói Combo hũ 35g</span>
          <div class="pick-grid">
            ${combos.map((c) => `<button type="button" class="pick-opt${c.qty === defaultQty ? ' is-active' : ''}${c.pop ? ' is-pop' : ''}" data-qty-pick="${c.qty}">
              <span class="po-q">${c.qty} hũ${c.pop ? ' ★' : ''}</span>
              <strong class="po-p">${fmtMoney(c.total)}</strong>
              <span class="po-s${c.freeship ? ' is-free' : ''}">${c.freeship ? 'Freeship' : '+30k ship'}</span>
            </button>`).join('')}
          </div>
          <div class="qty-more">
            <span>Hoặc chọn số lượng khác:</span>
            <div class="qty-step">
              <button type="button" data-qty-dec aria-label="Giảm số lượng">−</button>
              <input type="number" name="qty" min="1" max="100" value="${defaultQty}" inputmode="numeric" aria-label="Số hũ 35g">
              <button type="button" data-qty-inc aria-label="Tăng số lượng">+</button>
            </div>
          </div>
        </div>

        <div class="freeship-nudge is-ok" data-freeship-bar>
          <span data-freeship-msg>✓ Đơn từ 2 hũ được <strong>MIỄN PHÍ SHIP</strong> toàn quốc!</span>
          <button type="button" class="btn-upgrade" data-upgrade-free hidden>Chọn 2 hũ Freeship</button>
        </div>

        <div class="field-row">
          <label class="field">
            <span>2. Họ tên người nhận <b>*</b></span>
            <input type="text" name="name" required placeholder="VD: Anh Hùng / Chị Lan" autocomplete="name">
          </label>
          <label class="field">
            <span>3. Số điện thoại <b>*</b></span>
            <input type="tel" name="phone" required placeholder="09xx xxx xxx" inputmode="tel" autocomplete="tel">
          </label>
        </div>

        <label class="field">
          <span>4. Địa chỉ nhận hàng <b>*</b></span>
          <input type="text" name="address" required placeholder="Số nhà / Thôn, Xã / Phường, Huyện, Tỉnh..." autocomplete="street-address">
        </label>

        <label class="field">
          <span>Ghi chú (không bắt buộc)</span>
          <textarea name="note" rows="2" placeholder="VD: Lần đầu nuôi gà thả vườn, gọi trước khi giao..."></textarea>
        </label>

        <!-- Honeypot chống spam -->
        <div class="hp-field" aria-hidden="true"><label>Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>

        <div class="order-summary">
          <div class="sum-row"><span>Quy cách</span><strong data-sum-spec>2 hũ × 35g (70g trứng tươi)</strong></div>
          <div class="sum-row"><span>Tiền hàng</span><strong data-sum-goods>${fmtMoney(defCombo.goods)}</strong></div>
          <div class="sum-row" data-sum-disc-row hidden><span>Ưu đãi combo</span><strong class="txt-green" data-sum-disc></strong></div>
          <div class="sum-row"><span>Phí giao hàng</span><strong data-sum-ship><span class="pill-free">MIỄN PHÍ</span></strong></div>
          <div class="sum-row sum-total">
            <span>Tổng thanh toán (COD)</span>
            <div class="sum-price-wrap">
              <strong data-sum-total>${fmtMoney(defCombo.total)}</strong>
              <span class="sum-save" data-sum-save hidden></span>
            </div>
          </div>
        </div>

        <p class="order-err" data-order-error role="alert" hidden></p>

        <button type="submit" class="btn btn-amber btn-block btn-sheen" data-order-submit>Xác nhận đặt hàng · Kiểm tra khi nhận</button>
        <p class="order-legal">Shop sẽ gọi/nhắn xác nhận trước khi gửi hàng. Xem <a href="/chinh-sach/giao-hang">chính sách giao hàng</a> & <a href="/chinh-sach/doi-tra">đổi trả</a>.</p>
      </form>

      <div class="order-done" data-order-done hidden>
        <div class="done-icon">${icon('check', 'ic-lg')}</div>
        <h3>Đặt hàng thành công!</h3>
        <p class="done-lead">Cảm ơn bạn đã đặt trứng tại <strong>${esc(site.brand)}</strong>. Trại đã nhận đơn và sẽ liên hệ xác nhận sớm nhất.</p>
        <div class="done-code">Mã đơn hàng: <strong data-done-code></strong></div>
        <dl class="done-list">
          <div><dt>Người nhận</dt><dd data-done-name></dd></div>
          <div><dt>Số điện thoại</dt><dd data-done-phone></dd></div>
          <div><dt>Địa chỉ</dt><dd data-done-address></dd></div>
          <div><dt>Đơn đặt</dt><dd data-done-product></dd></div>
          <div><dt>Tổng COD</dt><dd class="done-money" data-done-total></dd></div>
        </dl>
        <div class="actions center">
          <a class="btn btn-primary" href="/blog/huong-dan-ap-trung-ruoi-linh-den-nuoi-sau-canxi-tai-nha">Xem hướng dẫn ấp trứng</a>
          <button type="button" class="btn btn-ghost" data-order-again>Đặt thêm đơn khác</button>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------- thẻ bài viết
function postCard(p, { featured = false, idx = 0 } = {}) {
  const cat = p.category || 'nuoi-sau';
  return `<article class="card post${featured ? ' post-featured' : ''}" data-reveal style="--d:${idx}">
    <a href="/blog/${esc(p.slug)}" class="card-link" aria-label="${esc(p.title)}"></a>
    <div class="card-media">
      ${imgOr(p.cover, p.title, 'card-img')}
      <span class="cat-pill cat-${esc(cat)}">${esc(catLabel(cat))}</span>
    </div>
    <div class="card-body">
      <div class="post-meta">
        <span>${fmtDate(p.published_at)}</span>
        <span aria-hidden="true">·</span>
        <span>${readMins(p)} phút đọc</span>
      </div>
      <h3>${esc(p.title)}</h3>
      <p class="post-sum">${esc(p.summary)}</p>
      <span class="read-more">Đọc bài viết →</span>
    </div>
  </article>`;
}

// ---------------------------------------------------------------- các khối trang chủ
const NUTRI_BAR = [88, 76, 95, 48];
const nutritionTable = () => `<div class="nutri" data-reveal>
  <table><thead><tr><th>Thành phần</th><th>Hàm lượng*</th><th>Ý nghĩa với vật nuôi</th></tr></thead><tbody>
  ${HOME.nutrition.map(([a, b, c], i) => `<tr>
    <th scope="row">${esc(a)}</th>
    <td class="num">
      <span class="num-val">${esc(b)}</span>
      <span class="nutri-bar" aria-hidden="true"><i style="--w:${NUTRI_BAR[i] || 60}%"></i></span>
    </td>
    <td class="mean">${esc(c)}</td>
  </tr>`).join('')}
  </tbody></table>
  <p class="small muted">* Tính trên chất khô, là khoảng giá trị trong các nghiên cứu; thay đổi theo thức ăn nuôi sâu và thời điểm thu hoạch. Xem <a href="#nguon">nguồn tham khảo</a>.</p>
</div>`;

const animalsGrid = () => `<div class="animals">${HOME.animals.map((a, i) => `<article class="animal" data-reveal style="--d:${i}">
  <div class="animal-h">${icon(a.key)}<h3>${esc(a.name)}</h3></div>
  <div class="prose">${markdown(a.text)}</div></article>`).join('')}</div>`;

const STEP_TAGS = ['Ngày 0', 'Ngày 2–4', 'Ngày 14–20', 'Thu hoạch'];
const stepsRow = () => `<ol class="steps">${HOME.steps.map(([t, d, img], i) => `<li class="step" data-reveal style="--d:${i}">
  <div class="step-media">
    <img src="${esc(img)}" alt="${esc(t)}" loading="lazy">
    <span class="step-tag">${STEP_TAGS[i] || `Bước ${i + 1}`}</span>
  </div>
  <div class="step-body"><span class="step-no">${i + 1}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></div></li>`).join('')}</ol>`;

const faqList = () => `<div class="faq">${HOME.faqs.map(([q, a]) => `<details data-reveal><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>`;

const sourcesList = () => `<section class="section sources" id="nguon"><div class="wrap narrow">
  <h2 class="h-sm">Nguồn tài liệu tham khảo</h2>
  <ul class="plain small">${HOME.sources.map(([t, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul>
</div></section>`;

const FARM_PHOTOS = [
  ['/img/ruoi-linh-den-de-trung.jpg', 'Ruồi lính đen bố mẹ đẻ trứng trên thanh gỗ'],
  ['/img/thu-trung.jpg', 'Thu trứng tươi mỗi ngày, cân đủ 35g/hũ'],
  ['/img/ga-tha-vuon.jpg', 'Đàn gà thả vườn khỏe mạnh, lông bóng mượt'],
  ['/img/vuon-rau-huu-co.jpg', 'Vườn rau sạch xanh tốt nhờ phân sâu hữu cơ'],
];

// ---------------------------------------------------------------- các trang
function home(ctx) {
  const { site, priceTable } = ctx;
  const posts = listPosts({ limit: 3 });
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: HOME.faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  const ctas = ctaButtons(site, 'btn-hero-sub');
  return layout(ctx, {
    path: '/', description: site.hero_text || site.tagline, jsonLd: faqLd,
    body: `
<section class="hero">
  <div class="hero-orb hero-orb-1" aria-hidden="true"></div>
  <div class="hero-orb hero-orb-2" aria-hidden="true"></div>
  <div class="wrap hero-in">
    <div class="hero-text">
      <div class="hero-pill"><span class="dot-live" aria-hidden="true"></span>Chuyên hũ chuẩn 35g · Miễn phí ship từ 2 hũ</div>
      <h1>${esc(site.tagline)}</h1>
      <p class="hero-lead">${esc(site.hero_text)}</p>
      <div class="hero-deals">
        <a class="hdeal" href="#dat-hang" data-pick-qty="1"><span>1 hũ 35g</span><strong>65k + 30k ship</strong></a>
        <a class="hdeal is-hot" href="#dat-hang" data-pick-qty="2"><span>2 hũ · Freeship</span><strong>130.000đ</strong></a>
        <a class="hdeal" href="#dat-hang" data-pick-qty="5"><span>5 hũ · Freeship</span><strong>300.000đ</strong></a>
      </div>
      <div class="actions hero-actions">
        <a class="btn btn-amber btn-lg btn-sheen" href="#dat-hang">${icon('bag', 'ic-sm')}<span>Đặt trứng ngay</span></a>
        <a class="btn btn-hero-outline btn-lg" href="/blog/huong-dan-ap-trung-ruoi-linh-den-nuoi-sau-canxi-tai-nha">Cách ấp & nuôi</a>
      </div>
      ${ctas ? `<div class="hero-contacts"><span class="hero-c-lbl">Tư vấn nhanh:</span><div class="actions">${ctas}</div></div>` : ''}
      <ul class="hero-checks">
        <li>${icon('check', 'ic-xs')}<span>Cân đủ 35g/hũ</span></li>
        <li>${icon('check', 'ic-xs')}<span>Ghi rõ ngày nở</span></li>
        <li>${icon('check', 'ic-xs')}<span>Ship COD · Kiểm tra hàng</span></li>
      </ul>
    </div>
    <div class="hero-visual">
      <div class="hero-frame">
        ${imgOr(site.hero_image, 'Trứng ruồi lính đen 35g, sâu canxi và gà thả vườn', 'hero-img', true)}
        <div class="hero-float hero-float-top">
          <strong>Miễn ship từ 2 hũ (130k)</strong>
          <span>Hũ 35g thu tươi mỗi ngày</span>
        </div>
        <div class="hero-float hero-float-bot">
          <strong>35–47% Đạm · 3–5% Canxi</strong>
          <span>Gà, vịt, chim, cá lớn nhanh</span>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="stats-wrap">
  <div class="wrap">
    <div class="stats-cards" data-reveal>
      ${HOME.stats.map(([v, l]) => `<div class="stat-card"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}
    </div>
  </div>
</section>

<section class="section" id="bang-gia-combo">
  <div class="wrap">
    <div class="center-h" data-reveal>
      <p class="eyebrow">Bảng giá hũ chuẩn 35g</p>
      <h2>Chọn gói Combo — Từ 2 hũ miễn phí giao hàng</h2>
      <p class="lead">Chạm vào gói bạn muốn để điền sẵn đơn ngay bên dưới. Mua càng nhiều giá mỗi hũ càng tiết kiệm.</p>
    </div>
    ${comboShowcaseGrid(priceTable)}
    <div class="grid prod-grid" style="margin-top:28px">${site.products.map((p, i) => productCard(p, i)).join('')}</div>
  </div>
</section>

${orderSection(ctx)}

<section class="section alt">
  <div class="wrap two align-center">
    <div data-reveal>
      <p class="eyebrow">Tìm hiểu nhanh</p>
      <h2>Sâu canxi là gì?</h2>
      <div class="prose">${markdown(HOME.what)}</div>
      <div class="mini-callout">
        <strong>Không giống ruồi nhà:</strong> Ruồi lính đen trưởng thành hiền lành, không bâu thức ăn, chỉ sống vài ngày để đẻ trứng rồi kết thúc vòng đời.
      </div>
    </div>
    <div class="feature-photo" data-reveal style="--d:1">
      <img class="rounded shadow-lg" src="/img/sau-canxi.jpg" alt="Sâu canxi (ấu trùng ruồi lính đen) trên xẻng" loading="lazy">
      <span class="photo-cap">Sâu canxi 14–18 ngày tuổi, màu kem béo mập, giàu đạm và canxi</span>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="center-h" data-reveal>
      <p class="eyebrow">Giá trị dinh dưỡng</p>
      <h2>Vì sao gọi là "sâu canxi"?</h2>
      <p class="lead">Ấu trùng ruồi lính đen tích lũy hàm lượng đạm, axit lauric và canxi vượt trội — giúp đàn vật nuôi lớn nhanh, cứng cáp và đẻ đều.</p>
    </div>
    ${nutritionTable()}
  </div>
</section>

<section class="section alt">
  <div class="wrap">
    <div class="center-h" data-reveal>
      <p class="eyebrow">Ứng dụng chăn nuôi</p>
      <h2>Gà, vịt, chim, cá đều mê sâu canxi</h2>
      <p class="lead">Bổ sung sâu tươi giúp tăng sức đề kháng, giảm mùi phân chuồng và tiết kiệm đáng kể chi phí cám công nghiệp.</p>
    </div>
    ${animalsGrid()}
    <div class="livestock-banner" data-reveal>
      <img src="/img/ga-trong-tha-vuon.jpg" alt="Gà ta thả vườn khỏe mạnh, lông mượt" loading="lazy">
      <div class="lb-txt">
        <p class="eyebrow">Thực tế chăn nuôi</p>
        <h3>Gà ăn khỏe, lông mượt, tiết kiệm 30–50% tiền cám</h3>
        <p>Tận dụng bã đậu, cơm thừa, rau củ dạt để nuôi sâu canxi ngay góc vườn — biến đồ bỏ đi thành thức ăn giàu đạm và canxi cho cả đàn.</p>
        <a class="btn btn-amber btn-sm btn-sheen" href="#dat-hang" data-pick-qty="2">Đặt thử 2 hũ Freeship (130k) →</a>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="center-h" data-reveal>
      <p class="eyebrow">Nông nghiệp tuần hoàn</p>
      <h2>4 lợi ích lớn khi tự nuôi sâu canxi tại nhà</h2>
    </div>
    <div class="benefits">${HOME.benefits.map(([t, d], i) => `<div class="benefit" data-reveal style="--d:${i}"><div class="ben-ic">${icon(BENEFIT_ICONS[i])}</div><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join('')}</div>
  </div>
</section>

<section class="section alt">
  <div class="wrap">
    <div class="center-h" data-reveal>
      <p class="eyebrow">Quy trình 4 bước đơn giản</p>
      <h2>Từ hũ trứng 35g đến mẻ sâu đầu tiên</h2>
      <p class="lead">Không cần vốn lớn hay nhà lưới phức tạp — chỉ cần vài khay nhựa, chỗ râm mát và bã đậu, rau củ thừa quanh nhà.</p>
    </div>
    ${stepsRow()}
    <div class="center" style="margin-top:28px" data-reveal>
      <a class="btn btn-ghost" href="/blog/huong-dan-ap-trung-ruoi-linh-den-nuoi-sau-canxi-tai-nha">Đọc hướng dẫn ấp & nuôi chi tiết →</a>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-h" data-reveal>
      <div><p class="eyebrow">Hình ảnh thực tế</p><h2>Từ trang trại trứng đến vườn sạch & đàn gà khỏe</h2></div>
      <a class="more-link" href="/trang-trai">Xem thêm về trang trại →</a>
    </div>
    <div class="gallery">${FARM_PHOTOS.map(([src, cap], i) => `<figure data-reveal style="--d:${i}"><img src="${src}" alt="${esc(cap)}" loading="lazy"><figcaption>${esc(cap)}</figcaption></figure>`).join('')}</div>
  </div>
</section>

${posts.length ? `<section class="section alt">
  <div class="wrap">
    <div class="section-h" data-reveal>
      <div><p class="eyebrow">Chia sẻ kinh nghiệm</p><h2>Kiến thức nuôi sâu & Nông nghiệp</h2></div>
      <a class="more-link" href="/blog">Xem tất cả bài viết →</a>
    </div>
    <div class="grid">${posts.map((p, i) => postCard(p, { idx: i })).join('')}</div>
  </div>
</section>` : ''}

<section class="section">
  <div class="wrap narrow">
    <div class="center-h" data-reveal><p class="eyebrow">Giải đáp cho người mới</p><h2>Câu hỏi thường gặp</h2></div>
    ${faqList()}
  </div>
</section>

<section class="section cta">
  <div class="wrap cta-in" data-reveal>
    <p class="eyebrow cta-eye">Bắt đầu ngay hôm nay</p>
    <h2>Đặt 2 hũ 35g chỉ 130.000đ — Miễn phí ship tận nhà!</h2>
    <p>Trứng thu tươi trong ngày, ghi ngày nở rõ ràng, kèm hướng dẫn chi tiết và hỗ trợ kỹ thuật trọn lứa nuôi.</p>
    <div class="actions">
      <a class="btn btn-amber btn-lg btn-sheen" href="#dat-hang" data-pick-qty="2">Đặt ngay 2 hũ Freeship</a>
      ${ctaButtons(site) || '<a class="btn btn-hero-outline" href="/lien-he">Liên hệ tư vấn</a>'}
    </div>
  </div>
</section>
${sourcesList()}`,
  });
}

function products(ctx) {
  const { site, priceTable } = ctx;
  const p0 = site.products[0];
  return layout(ctx, {
    title: 'Bảng giá hũ 35g', path: '/san-pham', description: plainText(p0.desc || site.tagline), image: p0.image,
    jsonLd: {
      '@context': 'https://schema.org', '@type': 'Product', name: p0.name, description: p0.desc,
      ...(p0.image ? { image: ctx.base + p0.image } : {}), brand: { '@type': 'Brand', name: site.brand },
      ...(p0.price > 0 ? { offers: { '@type': 'Offer', price: p0.price, priceCurrency: 'VND', availability: 'https://schema.org/InStock' } } : {}),
    },
    body: `${pageHead('Trứng ruồi lính đen hũ 35g', 'Chuyên 1 quy cách chuẩn 35g/hũ — 1 hũ 65k + 30k ship · Từ 2 hũ miễn phí giao hàng toàn quốc.', 'Bảng giá Combo')}
<section class="section"><div class="wrap">
  ${comboShowcaseGrid(priceTable)}
  <div class="grid prod-grid" style="margin-top:28px">${site.products.map((p, i) => productCard(p, i)).join('')}</div>
</div></section>
${orderSection(ctx, { heading: 'Đặt mua hũ trứng 35g', sub: 'Chọn gói combo bên dưới — đơn vào thẳng trang trại để đóng gói gửi đi trong ngày.' })}
<section class="section alt"><div class="wrap two">
  <div class="prose" data-reveal>${markdown(site.usage)}</div>
  <div>${stepsRow().replace('class="steps"', 'class="steps steps-col"')}</div>
</div></section>
<section class="section"><div class="wrap narrow"><div class="center-h"><p class="eyebrow">Giải đáp</p><h2>Câu hỏi thường gặp</h2></div>${faqList()}</div></section>`,
  });
}

function orderPage(ctx) {
  return layout(ctx, {
    title: 'Đặt trứng sâu canxi 35g', path: '/dat-hang',
    description: `Đặt mua hũ trứng ruồi lính đen 35g trực tiếp từ ${ctx.site.brand}. 1 hũ 65k + 30k ship, từ 2 hũ miễn phí giao hàng toàn quốc.`,
    body: `${pageHead('Đặt trứng sâu canxi hũ 35g', '1 hũ 65.000đ + ship 30.000đ · Từ 2 hũ miễn phí ship toàn quốc (2 hũ 130k · 3 hũ 195k · 4 hũ 250k · 5 hũ 300k).', 'Đặt hàng nhanh')}
${orderSection(ctx, { heading: 'Chọn combo & điền địa chỉ nhận hàng', sub: 'Đơn xác nhận trước 16h được ưu tiên đóng hũ tươi gửi trong ngày. Kiểm tra hàng trước khi thanh toán COD.' })}
<section class="section alt"><div class="wrap narrow">
  <div class="center-h"><p class="eyebrow">An tâm đặt hàng</p><h2>Câu hỏi thường gặp khi đặt trứng</h2></div>
  ${faqList()}
</div></section>`,
  });
}

function farm(ctx) {
  const { site } = ctx;
  return layout(ctx, {
    title: 'Trang trại', path: '/trang-trai', description: plainText(site.farm), image: '/img/ruoi-linh-den-de-trung.jpg',
    body: `${pageHead('Trang trại của chúng tôi', 'Nuôi ruồi lính đen bố mẹ, thu trứng mỗi ngày, cân đủ 35g/hũ và giao đi toàn quốc.', 'Quy trình sản xuất')}
<section class="section"><div class="wrap prose narrow farm">${markdown(site.farm)}</div></section>
<section class="section cta"><div class="wrap cta-in">
  <h2>Muốn đặt trứng giống 35g trực tiếp từ trại?</h2>
  <p>Đặt trực tuyến trong 30 giây — miễn phí ship toàn quốc từ 2 hũ (130.000đ).</p>
  <div class="actions"><a class="btn btn-amber btn-lg btn-sheen" href="/dat-hang">Đặt trứng ngay</a>${ctaButtons(site) || '<a class="btn btn-hero-outline" href="/lien-he">Liên hệ</a>'}</div>
</div></section>`,
  });
}

function blogList(ctx) {
  const cat = POST_CATEGORIES[ctx.query?.cat] ? ctx.query.cat : '';
  const q = String(ctx.query?.q || '').trim().slice(0, 80);
  const posts = listPosts({ limit: 100, category: cat, q });
  const allPosts = listPosts({ limit: 500 });
  const counts = {};
  for (const p of allPosts) counts[p.category || 'nuoi-sau'] = (counts[p.category || 'nuoi-sau'] || 0) + 1;

  const filterBar = `<div class="blog-toolbar">
    <nav class="cat-tabs" aria-label="Chủ đề bài viết">
      <a class="cat-tab${!cat ? ' is-active' : ''}" href="/blog${q ? `?q=${encodeURIComponent(q)}` : ''}">Tất cả <span>${allPosts.length}</span></a>
      ${Object.entries(POST_CATEGORIES).map(([k, label]) =>
        `<a class="cat-tab${cat === k ? ' is-active' : ''}" href="/blog?cat=${k}${q ? `&q=${encodeURIComponent(q)}` : ''}">${esc(label)} <span>${counts[k] || 0}</span></a>`).join('')}
    </nav>
    <form class="blog-search" action="/blog" method="get" role="search">
      ${cat ? `<input type="hidden" name="cat" value="${esc(cat)}">` : ''}
      <input type="search" name="q" value="${esc(q)}" placeholder="Tìm bài viết (VD: ấp trứng, phân sâu, gà...)" aria-label="Tìm kiếm bài viết">
      <button type="submit" class="btn btn-primary btn-sm">Tìm</button>
    </form>
  </div>`;

  const showFeatured = !cat && !q && posts.length >= 2;
  const featured = showFeatured ? posts[0] : null;
  const rest = showFeatured ? posts.slice(1) : posts;

  return layout(ctx, {
    title: 'Kiến thức nuôi sâu & Nông nghiệp', path: '/blog',
    description: `Chia sẻ kinh nghiệm ấp trứng, kỹ thuật nuôi sâu canxi, chăn nuôi tiết kiệm và nông nghiệp tuần hoàn từ ${ctx.site.brand}.`,
    body: `${pageHead('Kiến thức nuôi sâu & Nông nghiệp', 'Tổng hợp hướng dẫn ấp trứng, kỹ thuật nuôi sâu canxi, cách cho vật nuôi ăn, ủ phân hữu cơ và kinh nghiệm thực tế từ nhà nông.', 'Thư viện kinh nghiệm')}
<section class="section">
  <div class="wrap">
    ${filterBar}
    ${q ? `<p class="muted small" style="margin-bottom:18px">Kết quả cho "<strong>${esc(q)}</strong>": ${posts.length} bài viết · <a href="/blog${cat ? `?cat=${cat}` : ''}">Xóa tìm kiếm</a></p>` : ''}
    ${featured ? `<div class="featured-wrap">${postCard(featured, { featured: true })}</div>` : ''}
    ${rest.length ? `<div class="grid">${rest.map((p, i) => postCard(p, { idx: i })).join('')}</div>`
      : (!featured ? '<div class="empty-box"><p>Chưa tìm thấy bài viết phù hợp với bộ lọc này.</p><a class="btn btn-ghost btn-sm" href="/blog">Xem tất cả bài viết</a></div>' : '')}
  </div>
</section>
<section class="section cta">
  <div class="wrap cta-in">
    <h2>Muốn áp dụng ngay tại vườn nhà mình?</h2>
    <p>Bắt đầu từ combo 2 hũ 35g chỉ 130.000đ (miễn phí ship) — vừa có sâu tươi cho vật nuôi, vừa có phân hữu cơ bón rau sạch.</p>
    <div class="actions"><a class="btn btn-amber btn-lg btn-sheen" href="/dat-hang">Đặt trứng sâu canxi</a>${ctaButtons(ctx.site)}</div>
  </div>
</section>`,
  });
}

function blogPost(ctx, slug) {
  const p = getPost(slug, { publishedOnly: true });
  if (!p) return null;
  const cat = p.category || 'nuoi-sau';
  const sameCat = listPosts({ limit: 5, category: cat }).filter((x) => x.slug !== p.slug);
  const others = sameCat.length < 3
    ? listPosts({ limit: 6 }).filter((x) => x.slug !== p.slug && !sameCat.some((s) => s.slug === x.slug))
    : [];
  const related = [...sameCat, ...others].slice(0, 3);

  return layout(ctx, {
    title: p.title, path: `/blog/${p.slug}`, description: p.summary, image: p.cover, type: 'article',
    jsonLd: {
      '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: p.summary,
      datePublished: (p.published_at || '').replace(' ', 'T') + '+07:00', dateModified: p.updated_at.replace(' ', 'T') + '+07:00',
      ...(p.cover ? { image: ctx.base + p.cover } : {}), author: { '@type': 'Organization', name: ctx.site.brand },
    },
    body: `<article class="section article-page">
  <div class="wrap narrow">
    <nav class="breadcrumb" aria-label="Đường dẫn">
      <a href="/">Trang chủ</a><span>/</span><a href="/blog">Kiến thức & Nông nghiệp</a><span>/</span><a href="/blog?cat=${esc(cat)}">${esc(catLabel(cat))}</a>
    </nav>
    <div class="article-meta">
      <span class="cat-pill cat-${esc(cat)}">${esc(catLabel(cat))}</span>
      <span>${fmtDate(p.published_at)}</span>
      <span aria-hidden="true">·</span>
      <span>${readMins(p)} phút đọc</span>
    </div>
    <h1 class="post-title">${esc(p.title)}</h1>
    ${p.summary ? `<p class="lead post-lead">${esc(p.summary)}</p>` : ''}
    ${p.cover ? `<img class="post-cover" src="${esc(p.cover)}" alt="${esc(p.title)}">` : ''}
    <div class="prose">${markdown(p.body)}</div>
    <div class="cta-box">
      <div>
        <p class="eyebrow" style="margin-bottom:4px">Thực hành ngay tại nhà</p>
        <h3>Đặt combo 2 hũ 35g chỉ 130.000đ — Miễn phí ship</h3>
        <p>Trứng thu trong ngày, ghi ngày nở rõ ràng, ship COD toàn quốc và kèm hỗ trợ kỹ thuật 1-1.</p>
      </div>
      <div class="actions">
        <a class="btn btn-amber btn-sheen" href="/dat-hang">Đặt trứng ngay</a>
        ${ctaButtons(ctx.site)}
      </div>
    </div>
  </div>
</article>
${related.length ? `<section class="section alt"><div class="wrap">
  <div class="section-h"><h2>Bài viết liên quan</h2><a class="more-link" href="/blog">Tất cả kiến thức →</a></div>
  <div class="grid">${related.map((r, i) => postCard(r, { idx: i })).join('')}</div>
</div></section>` : ''}`,
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
    body: `${pageHead('Liên hệ & Hỗ trợ kỹ thuật', 'Đặt hũ trứng 35g, hỏi giá sỉ cho trang trại hoặc nhờ tư vấn cách ấp nở.', 'Kết nối với trại')}
<section class="section"><div class="wrap narrow">
  <div class="contact-card">
    ${rows.length ? `<dl class="info">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` : '<p class="muted">Thông tin liên hệ đang được cập nhật. Bạn vẫn có thể đặt hàng trực tiếp ngay trên website.</p>'}
    ${site.business_name ? `<h2 class="h-sm">Thông tin kinh doanh</h2><dl class="info"><div><dt>Tên</dt><dd>${esc(site.business_name)}</dd></div>${site.business_no ? `<div><dt>Giấy CN ĐKHKD</dt><dd>${esc(site.business_no)}</dd></div>` : ''}${site.tax_code ? `<div><dt>Mã số thuế</dt><dd>${esc(site.tax_code)}</dd></div>` : ''}</dl>` : ''}
    <div class="actions" style="margin-top:24px"><a class="btn btn-amber btn-sheen" href="/dat-hang">Đặt trứng trực tuyến</a>${ctaButtons(site)}</div>
  </div>
</div></section>`,
  });
}

function policyIndex(ctx) {
  return layout(ctx, {
    title: 'Chính sách', path: '/chinh-sach',
    body: `${pageHead('Chính sách & Điều khoản', 'Minh bạch quy định giao hàng, đổi trả và bảo mật thông tin khách hàng.')}<section class="section"><div class="wrap narrow"><ul class="link-list">${Object.entries(POLICIES).map(([k, t]) => `<li><a href="/chinh-sach/${k}">${t}</a></li>`).join('')}</ul></div></section>`,
  });
}

function policy(ctx, key) {
  if (!POLICIES[key]) return null;
  const md = fill(ctx.site.policies[key], ctx.site, ctx.domain);
  return layout(ctx, {
    title: POLICIES[key], path: `/chinh-sach/${key}`, description: plainText(md),
    body: `${pageHead(POLICIES[key], '', 'Chính sách')}<section class="section"><div class="wrap prose narrow">${markdown(md)}
      <p class="muted small" style="margin-top:32px">Các chính sách khác: ${Object.entries(POLICIES).filter(([k]) => k !== key).map(([k, t]) => `<a href="/chinh-sach/${k}">${t}</a>`).join(' · ')}</p></div></section>`,
  });
}

function notFound(ctx) {
  return layout(ctx, {
    title: 'Không tìm thấy trang', path: '/404', noindex: true,
    body: `${pageHead('Không tìm thấy trang', 'Trang bạn tìm không có hoặc đã được chuyển đi.')}<section class="section"><div class="wrap center"><div class="actions center"><a class="btn btn-primary" href="/">Về trang chủ</a><a class="btn btn-amber" href="/dat-hang">Đặt trứng ngay</a></div></div></section>`,
  });
}

function sitemap(ctx) {
  const urls = ['/', '/san-pham', '/dat-hang', '/trang-trai', '/blog', '/lien-he', ...Object.keys(POLICIES).map((k) => `/chinh-sach/${k}`)]
    .map((u) => ({ loc: ctx.base + u }));
  for (const p of listPosts({ limit: 500 })) urls.push({ loc: `${ctx.base}/blog/${p.slug}`, lastmod: (p.updated_at || '').slice(0, 10) });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>`;
}

// ---------------------------------------------------------------- bộ định tuyến
export function renderSite(pathname, opts) {
  const domain = opts.host;
  const ctx = {
    site: getSite(),
    priceTable: getPriceTable(),
    base: `${opts.proto}://${opts.host}`,
    domain,
    cssVer: opts.cssVer || '',
    jsVer: opts.jsVer || '',
    query: opts.query || {},
  };
  const html = (body, status = 200) => ({ status, type: 'text/html; charset=utf-8', body, headers: { 'Cache-Control': 'no-cache' } });
  const redirect = (to, status = 301) => ({ status, headers: { Location: to }, body: '' });
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  if (p === '/') return html(home(ctx));
  if (p === '/san-pham') return html(products(ctx));
  if (p === '/dat-hang') return html(orderPage(ctx));
  if (p === '/trang-trai') return html(farm(ctx));
  if (p === '/kinh-nghiem' || p === '/kien-thuc') return redirect('/blog');
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
