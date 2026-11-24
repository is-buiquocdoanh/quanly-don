// Website công khai (doanhwork.com): trang chủ, sản phẩm, trang trại, blog, liên hệ, chính sách.
// Trang được dựng sẵn HTML ở server (Google đọc được, chia sẻ Facebook có ảnh + tiêu đề). Không cần JavaScript.
import { esc, markdown, plainText } from './markdown.js';
import { getSite, POLICIES, listPosts, getPost } from './content.js';

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
<link rel="icon" href="${esc(site.logo || '/logo.svg')}">
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
const imgOr = (src, alt, cls = '') => (src ? `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy">` : `<div class="${cls} ph" aria-hidden="true"></div>`);

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
function home(ctx) {
  const { site } = ctx;
  const posts = listPosts({ limit: 3 });
  return layout(ctx, {
    path: '/', description: site.hero_text || site.tagline,
    body: `
<section class="hero">
  <div class="wrap hero-in">
    <div class="hero-text">
      <h1>${esc(site.tagline)}</h1>
      <p class="lead">${esc(site.hero_text)}</p>
      <div class="actions">${ctaButtons(site)}${contacts(site).length ? '' : '<a class="btn btn-primary" href="/lien-he">Liên hệ đặt hàng</a>'}</div>
    </div>
    ${imgOr(site.hero_image, site.brand, 'hero-img')}
  </div>
</section>
<section class="section">
  <div class="wrap">
    <div class="section-h"><h2>Sản phẩm</h2><a href="/san-pham">Xem chi tiết →</a></div>
    <div class="grid">${site.products.map(productCard).join('')}</div>
  </div>
</section>
<section class="section alt">
  <div class="wrap two">
    <div class="prose">${markdown(site.usage)}</div>
    <div class="prose">${markdown(site.farm.split(/\n(?=## )/)[0])}<p><a href="/trang-trai">Xem trang trại →</a></p></div>
  </div>
</section>
${posts.length ? `<section class="section">
  <div class="wrap">
    <div class="section-h"><h2>Kinh nghiệm chăn nuôi</h2><a href="/blog">Tất cả bài viết →</a></div>
    <div class="grid">${posts.map(postCard).join('')}</div>
  </div>
</section>` : ''}
<section class="section cta">
  <div class="wrap cta-in"><h2>Đặt hàng hoặc hỏi thêm?</h2><p>Nhắn tin cho shop, trả lời nhanh trong giờ làm việc.</p><div class="actions">${ctaButtons(site)}</div></div>
</section>`,
  });
}

function products(ctx) {
  const { site } = ctx;
  const p0 = site.products[0];
  return layout(ctx, {
    title: 'Sản phẩm', path: '/san-pham', description: plainText(p0.desc || site.tagline),
    jsonLd: site.products.map((p) => ({
      '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.desc,
      ...(p.image ? { image: ctx.base + p.image } : {}),
      ...(p.price > 0 ? { offers: { '@type': 'Offer', price: p.price, priceCurrency: 'VND', availability: 'https://schema.org/InStock' } } : {}),
    }))[0],
    body: `${pageHead('Sản phẩm', site.tagline)}
<section class="section"><div class="wrap">
  <div class="grid">${site.products.map(productCard).join('')}</div>
  <div class="prose narrow" style="margin-top:32px">${markdown(site.usage)}</div>
  <div class="actions center" style="margin-top:24px">${ctaButtons(site)}</div>
</div></section>`,
  });
}

function farm(ctx) {
  const { site } = ctx;
  return layout(ctx, {
    title: 'Trang trại', path: '/trang-trai', description: plainText(site.farm),
    body: `${pageHead('Trang trại của chúng tôi')}<section class="section"><div class="wrap prose narrow">${markdown(site.farm)}</div></section>`,
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
