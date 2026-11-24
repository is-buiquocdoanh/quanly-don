/* Web quản lý đơn — SPA thuần JS, điều hướng bằng #hash */
'use strict';

// ================================================================ tiện ích
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => (Number(n) || 0).toLocaleString('vi-VN') + 'đ';
const num = (n) => (Number(n) || 0).toLocaleString('vi-VN');
const pct = (x) => (Math.round((Number(x) || 0) * 1000) / 10).toLocaleString('vi-VN') + '%';
const dt = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)} ${s.slice(11, 16)}` : '');
const dd = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '');
const S = { user: null, settings: {}, pages: [], khos: [], statuses: {}, today: '' };

function addDays(date, n) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function api(method, url, body) {
  const opt = { method, credentials: 'same-origin', headers: {} };
  if (method !== 'GET') {
    opt.headers['Content-Type'] = 'application/json';
    opt.body = JSON.stringify(body || {});
  }
  let r, j;
  try {
    r = await fetch(url, opt);
    j = await r.json();
  } catch {
    throw new Error('Không kết nối được máy chủ');
  }
  if (r.status === 401 && url !== '/api/login') {
    showLogin();
    throw new Error(j.error || 'Hết phiên đăng nhập');
  }
  if (!j.ok) throw new Error(j.error || 'Lỗi không rõ');
  return j;
}

const toast = (msg, err = false, action = null) => UI.toast(msg, err, action);
const fail = (e) => toast(e.message || String(e), true);

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // http (không phải https) không có clipboard API → dùng cách cũ
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  if (btn) {
    const old = btn.textContent;
    btn.classList.add('done'); btn.textContent = 'Đã chép';
    setTimeout(() => { btn.classList.remove('done'); btn.textContent = old; }, 1200);
  } else toast('Đã chép');
}

function modal(title, html, { wide = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog">
    <div class="modal-head"><b>${esc(title)}</b><button class="x" data-close title="Đóng">✕</button></div>
    <div class="modal-body">${html}</div></div>`;
  document.body.appendChild(wrap);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  return { el: $('.modal-body', wrap), close };
}

function formData(el) {
  const o = {};
  for (const f of $$('[name]', el)) o[f.name] = f.type === 'checkbox' ? f.checked : f.value;
  return o;
}

const badge = (st) => `<span class="badge st-${st}">${esc(S.statuses[st] || st)}</span>`;
// ---------------------------------------------------------------- chia đơn cho tài khoản kho (mỗi tài khoản kho = 1 bên có hàng)
const whName = (id) => (id ? (S.khos.find((w) => w.id === id)?.name || `#${id}`) : 'Chưa chia');
const hasWh = () => S.user?.role === 'admin' && S.khos.length > 1;
const whBadge = (id) => `<span class="who${id ? '' : ' none'}">${esc(whName(id))}</span>`;
/** all: thêm "Mọi kho" (lọc). noneLabel: nhãn cho "chưa chia". */
function whOptions(sel, { all = false, noneLabel = 'Chưa chia' } = {}) {
  const v = sel == null ? '' : String(sel);
  const o = (val, label) => `<option value="${val}" ${v === String(val) ? 'selected' : ''}>${esc(label)}</option>`;
  return (all ? o('', 'Mọi kho') : '')
    + (noneLabel ? o(all ? 'none' : '', noneLabel) : '')
    + S.khos.filter((w) => w.active || v === String(w.id)).map((w) => o(w.id, w.name + (w.active ? '' : ' (đã khóa)'))).join('');
}
/** Công tắc "Đơn mới đang giao cho …": đổi bên nhận đơn mới, hỏi chuyển luôn đơn chờ gửi của bên cũ. */
function supplierSwitch(onDone) {
  const html = `<label class="sup-switch"><span>Đơn mới giao cho</span><select data-actsup>${whOptions(S.settings.active_kho || '', { noneLabel: 'Chưa chia (tôi tự chia)' })}</select></label>`;
  const bind = (root) => {
    const sel = $('[data-actsup]', root);
    if (!sel) return;
    sel.addEventListener('change', async () => {
      const prev = Number(S.settings.active_kho) || 0;
      const next = Number(sel.value) || 0;
      try {
        const r = await api('PUT', '/api/settings', { active_kho: next });
        S.settings = r.settings;
        toast(next ? `Đơn mới sẽ giao cho ${whName(next)}` : 'Đơn mới sẽ chưa chia cho kho nào');
        if (prev && next) {
          const st = await api('GET', '/api/kho');
          const n = st.khos.find((x) => x.id === prev)?.waiting || 0;
          if (n && confirm(`${whName(prev)} còn ${n} đơn chờ gửi. Chuyển luôn ${n} đơn này sang ${whName(next)}?`)) {
            const m = await api('POST', '/api/kho/move', { from: prev, to: next });
            toast(`Đã chuyển ${m.updated} đơn sang ${whName(next)}`);
          }
        }
        onDone && onDone();
      } catch (e) { fail(e); }
    });
  };
  return { html, bind };
}
const flagBadge = (f) => (f === 'bom' ? '<span class="badge b-bom">Sổ đỏ</span>' : f === 'vip' ? '<span class="badge b-vip">VIP</span>' : '');
const returnReasons = () => S.settings.return_reasons || [];

/** Hỏi lý do hoàn. Trả về { return_reason, red } hoặc null nếu bấm hủy.
 *  red = chủ shop tick "đưa SĐT vào sổ đỏ" (kho không thấy ô này). */
function askReturn(o, { count = 1 } = {}) {
  const admin = S.user.role === 'admin';
  const reasons = returnReasons();
  return new Promise((resolve) => {
    let done = false;
    const m = modal(count > 1 ? `${count} đơn bị hoàn` : `Đơn của ${o.name || o.phone} bị hoàn`, `
      <p class="muted small" style="margin:0 0 10px">Chọn lý do hoàn${count > 1 ? ' (áp dụng cho mọi đơn đã chọn)' : ''}:</p>
      <div class="reasons">${reasons.map((x, i) => `<label class="reason"><input type="radio" name="rr" value="${esc(x)}" ${i === 0 ? 'data-fake' : ''}> ${esc(x)}</label>`).join('')}
        <label class="reason"><input type="radio" name="rr" value="__other"> Lý do khác</label></div>
      <input id="rrOther" placeholder="Ghi lý do…" hidden style="width:100%;margin-top:8px">
      ${admin && count === 1 ? `<label class="check red-check" id="redWrap"><input type="checkbox" id="red"> Đưa SĐT ${esc(o.phone)} vào <b>Sổ đỏ</b> (cảnh báo khi đặt lại)</label>` : ''}
      <div class="actions"><span class="spacer"></span><button class="btn sec" data-close>Hủy</button><button class="btn danger" id="ok">Xác nhận hoàn</button></div>`);
    const finish = (v) => { if (done) return; done = true; resolve(v); };
    const wrap = m.el.closest('.modal-wrap');
    new MutationObserver((_, ob) => { if (!wrap.isConnected) { ob.disconnect(); finish(null); } }).observe(document.body, { childList: true });
    m.el.addEventListener('change', (e) => {
      if (e.target.name !== 'rr') return;
      $('#rrOther', m.el).hidden = e.target.value !== '__other';
      if (e.target.value === '__other') $('#rrOther', m.el).focus();
      const red = $('#red', m.el);
      if (red) red.checked = e.target.hasAttribute('data-fake');
    });
    $('#ok', m.el).addEventListener('click', () => {
      const pick = $('input[name=rr]:checked', m.el);
      let reason = pick ? pick.value : '';
      if (reason === '__other') reason = $('#rrOther', m.el).value.trim();
      if (!reason) { toast('Chọn lý do hoàn', true); return; }
      finish({ return_reason: reason, red: !!$('#red', m.el)?.checked });
      m.close();
    });
  });
}

/** Đưa SĐT của đơn vào sổ đỏ, ghi lý do kèm mã đơn. */
async function addToRedBook(o, reason) {
  await api('POST', '/api/customers/blacklist', { phone: o.phone, name: o.name, note: `${o.code}: ${reason}` });
  toast(`Đã đưa ${o.phone} vào Sổ đỏ`);
}
const pageOptions = (sel = '', all = 'Tất cả page') =>
  `<option value="">${all}</option>` + S.pages.map((p) => `<option ${p === sel ? 'selected' : ''}>${esc(p)}</option>`).join('');

// ---------------------------------------------------------------- chọn khoảng ngày
const PRESETS = {
  today: ['Hôm nay', () => [S.today, S.today]],
  yesterday: ['Hôm qua', () => [addDays(S.today, -1), addDays(S.today, -1)]],
  d7: ['7 ngày', () => [addDays(S.today, -6), S.today]],
  d30: ['30 ngày', () => [addDays(S.today, -29), S.today]],
  month: ['Tháng này', () => [S.today.slice(0, 8) + '01', S.today]],
  lastmonth: ['Tháng trước', () => {
    const first = S.today.slice(0, 8) + '01';
    const end = addDays(first, -1);
    return [end.slice(0, 8) + '01', end];
  }],
  custom: ['Tùy chọn', null],
};
function rangePicker(state, onChange) {
  return UI.rangePicker(state, PRESETS, onChange);
}
function makeRange(preset) {
  const [from, to] = PRESETS[preset][1]();
  return { preset, from, to };
}

// ================================================================ đăng nhập
function showLogin() {
  $('#top').hidden = true;
  document.body.classList.remove('signed-in');
  $('#app').innerHTML = `<form class="login" id="loginForm">
    <img class="login-mark" src="/logo.svg" alt="" width="56" height="56">
    <h1>Đăng nhập</h1>
    <p class="sub">Quản lý đơn hàng, kho và thu chi của shop.</p>
    <div class="box">
      <label for="lu">Tên đăng nhập</label><input id="lu" name="username" autocomplete="username" autocapitalize="none" required autofocus>
      <label for="lp">Mật khẩu</label><input id="lp" name="password" type="password" autocomplete="current-password" required>
      <button class="btn">Đăng nhập</button>
      <p class="warn" id="loginErr" hidden></p>
    </div>
  </form>`;
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('POST', '/api/login', formData(e.target));
      await boot();
    } catch (err) {
      $('#loginErr').hidden = false;
      $('#loginErr').textContent = err.message;
    }
  });
}

$('#logout').addEventListener('click', async () => {
  await api('POST', '/api/logout').catch(() => {});
  location.hash = '';
  showLogin();
});

// ================================================================ điều hướng
const NAV = {
  admin: [['dashboard', 'Tổng quan', 'Tổng quan'], ['orders', 'Đơn hàng', 'Đơn'], ['kho', 'Kho gửi hàng', 'Kho'], ['customers', 'Khách hàng', 'Khách'], ['finance', 'Thu chi', 'Thu chi'], ['settings', 'Cài đặt', 'Cài đặt']],
  kho: [['kho', 'Gửi hàng', 'Gửi hàng'], ['account', 'Tài khoản', 'Tài khoản']],
};
const ICONS = {
  dashboard: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  orders: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 8.5h6M9 12.5h6M9 16.5h3.5"/>',
  kho: '<path d="M4 8l8-4.5L20 8v8l-8 4.5L4 16z"/><path d="M4 8l8 4.5L20 8M12 12.5v8"/>',
  customers: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.3-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.6a3.5 3.5 0 010 6.8M18.2 14.8c1.8.8 2.9 2.5 3.3 5.2"/>',
  finance: '<rect x="2.5" y="6" width="19" height="13.5" rx="2"/><path d="M2.5 10.5h19M6.5 15.5h4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  account: '<circle cx="12" cy="8.5" r="4"/><path d="M4 20.5c1-4 4.2-6 8-6s7 2 8 6"/>',
};
const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k] || ''}</svg>`;
const VIEWS = {};
let viewTimer = null;

function route() {
  if (!S.user) return;
  const items = NAV[S.user.role];
  window.scrollTo(0, 0);
  let name = location.hash.replace(/^#\/?/, '').split('?')[0];
  if (!items.some(([k]) => k === name) && !(name === 'account')) name = items[0][0];
  $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.v === name));
  clearInterval(viewTimer);
  // mỗi lần chuyển trang dùng 1 khung mới để không dính sự kiện của trang cũ
  const view = document.createElement('div');
  view.innerHTML = '<div class="loading">Đang tải…</div>';
  $('#app').replaceChildren(view);
  VIEWS[name](view).catch(fail);
}
window.addEventListener('hashchange', route);

async function boot() {
  try {
    const b = await api('GET', '/api/bootstrap');
    Object.assign(S, { user: b.user, settings: b.settings, pages: b.pages, khos: b.khos || [], statuses: b.statuses, today: b.today });
  } catch {
    return; // showLogin đã được gọi
  }
  $('#top').hidden = false;
  document.body.classList.add('signed-in');
  $('#brand').textContent = S.settings.shop_name || 'Quản lý đơn';
  document.title = S.settings.shop_name || 'Quản lý đơn';
  const who = S.user.display_name || S.user.username;
  $('#meName').textContent = who;
  $('#meRole').textContent = S.user.role === 'admin' ? 'Chủ shop' : 'Kho';
  $('#meAvatar').textContent = who.trim().split(/\s+/).pop().charAt(0).toUpperCase();
  $('#nav').innerHTML = NAV[S.user.role].map(([k, l, sh]) => `<a href="#/${k}" data-v="${k}" title="${l}">${icon(k)}<span class="nl">${l}</span><span class="ns">${sh}</span></a>`).join('');
  route();
}

async function refreshPages() {
  if (S.user.role !== 'admin') return;
  const b = await api('GET', '/api/bootstrap');
  S.pages = b.pages;
  S.khos = b.khos || [];
}

// ================================================================ TỔNG QUAN
const dashState = { range: null };
const C = Charts.COLORS;

// thay đổi so với kỳ trước: mũi tên + chữ, không chỉ dùng màu
function delta(cur, prev, { goodUp = true, isRate = false } = {}) {
  if (prev == null) return '';
  let d, txt;
  if (isRate) {
    d = cur - prev;
    if (Math.abs(d) < 0.0005) return '<span class="delta flat">Không đổi so với kỳ trước</span>';
    txt = (Math.round(Math.abs(d) * 1000) / 10).toLocaleString('vi-VN') + ' điểm %';
  } else {
    if (!prev) return cur ? '<span class="delta flat">Kỳ trước chưa có số liệu</span>' : '';
    d = (cur - prev) / Math.abs(prev);
    if (Math.abs(d) < 0.005) return '<span class="delta flat">Không đổi so với kỳ trước</span>';
    txt = (Math.round(Math.abs(d) * 1000) / 10).toLocaleString('vi-VN') + '%';
  }
  const up = d > 0;
  const cls = goodUp == null ? 'flat' : up === goodUp ? 'good' : 'bad';
  return `<span class="delta ${cls}"><b>${up ? '↑' : '↓'} ${txt}</b><span class="vs"> so với kỳ trước</span></span>`;
}

VIEWS.dashboard = async (root) => {
  dashState.range ||= makeRange('d7');
  const rp = rangePicker(dashState.range, () => VIEWS.dashboard(root).catch(fail));
  const r = await api('GET', `/api/report?from=${dashState.range.from}&to=${dashState.range.to}`);
  const P = r.prev || {};
  const days = r.by_day;
  const labels = days.map((d) => dd(d.date));
  const titles = days.map((d) => { const w = new Date(d.date + 'T00:00:00').getDay(); return `${w ? 'Thứ ' + (w + 1) : 'Chủ nhật'}, ${dd(d.date)}`; });
  const roasTxt = (x) => (x ? x.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' lần' : '–');

  const tile = (label, value, sub, spark, extra = '') => `<div class="tile">
      <div class="tile-l">${label}</div>
      <div class="tile-v">${value}</div>
      <div class="tile-s">${sub}</div>${spark ? `<div class="tile-spark">${spark}</div>` : ''}${extra}</div>`;
  const mini = (label, value, sub) => `<div class="mini"><div class="mini-l">${label}</div><div class="mini-v">${value}</div><div class="mini-s">${sub}</div></div>`;

  const statusParts = ['moi', 'da_gui', 'da_giao', 'hoan', 'huy'].map((k) => ({ key: k, label: S.statuses[k] || k, value: r.by_status[k] || 0, color: C[k] }));
  const peak = r.by_hour.reduce((a, h) => (h.orders > a.orders ? h : a), { hour: -1, orders: 0 });
  const peakUnique = peak.orders > 0 && r.by_hour.filter((h) => h.orders === peak.orders).length === 1;
  const peakHours = r.by_hour.filter((h) => h.orders === peak.orders && peak.orders).map((h) => h.hour + 'h');
  const qtyTotal = r.by_qty.reduce((a, q) => a + q.orders, 0);
  const multi = qtyTotal ? r.by_qty.filter((q) => q.qty !== '1').reduce((a, q) => a + q.orders, 0) / qtyTotal : 0;
  const otherNet = r.other_chi - r.other_thu;

  root.innerHTML = `
    <div class="page-head">
      <div><h1>Tổng quan</h1><p class="page-sub">${r.prev ? `So sánh với ${dd(P.from)} – ${dd(P.to)}` : ''}</p></div>
      ${rp.html}
    </div>
    ${r.waiting ? `<a class="callout" href="#/kho"><b>${num(r.waiting)} đơn đang chờ gửi</b><span>Mở kho gửi hàng</span></a>` : ''}

    <section class="tiles">
      ${tile('Doanh thu', money(r.revenue), delta(r.revenue, P.revenue), Charts.spark(days.map((d) => d.revenue), C.revenue))}
      ${tile('Lãi ước tính', `<span class="${r.profit < 0 ? 'neg' : ''}">${money(r.profit)}</span>`,
        r.cost_per_unit ? delta(r.profit, P.profit) : '<span class="delta bad">Chưa nhập giá vốn — vào Cài đặt</span>', Charts.spark(days.map((d) => d.profit), C.profit))}
      ${tile('Đơn hàng', num(r.orders), delta(r.orders, P.orders), Charts.spark(days.map((d) => d.orders), C.revenue), `<div class="tile-foot">${num(r.qty)} hộp · ${r.cancelled} đơn hủy</div>`)}
      ${tile('Chi quảng cáo', money(r.ads), delta(r.ads, P.ads, { goodUp: null }), Charts.spark(days.map((d) => d.ads), C.ads), `<div class="tile-foot">${money(r.cost_per_order)} mỗi đơn</div>`)}
    </section>

    <section class="minis">
      ${mini('Doanh thu / chi quảng cáo', roasTxt(r.roas), delta(r.roas, P.roas))}
      ${mini('Giá trị trung bình 1 đơn', money(r.aov), delta(r.aov, P.aov))}
      ${mini('Tỷ lệ hoàn', pct(r.return_rate), delta(r.return_rate, P.return_rate, { goodUp: false, isRate: true }))}
      ${mini('COD chờ về', money(r.cod_pending.amount), `<span class="delta flat">${r.cod_pending.count} đơn đã giao, chưa nhận tiền</span>`)}
    </section>

    <section class="grid g-2-1">
      <div class="panel">
        <div class="panel-h"><h2>Doanh thu, chi quảng cáo và lãi theo ngày</h2>
          <div class="legend"><span><i style="background:${C.revenue}"></i>Doanh thu</span><span><i style="background:${C.ads}"></i>Chi quảng cáo</span><span><i style="background:${C.profit}"></i>Lãi ước tính</span></div></div>
        <div class="chart" id="cTrend"></div>
      </div>
      <div class="panel">
        <div class="panel-h"><h2>Trạng thái đơn</h2></div>
        ${Charts.stack(statusParts, { fmt: num })}
      </div>
    </section>

    ${r.by_kho?.length ? `<section class="panel">
      <div class="panel-h"><h2>Theo kho</h2><span class="panel-note">Đang chờ gửi tính tại thời điểm hiện tại</span></div>
      <div class="table-wrap flat"><table class="tbl">
        <thead><tr><th>Kho</th><th class="right">Đơn</th><th>Doanh thu</th><th class="right">Đã gửi</th><th class="right">Hoàn</th><th class="right">Đang chờ gửi</th></tr></thead>
        <tbody>${(() => {
          const max = Math.max(1, ...r.by_kho.map((w) => w.revenue));
          return r.by_kho.map((w) => `<tr><td class="strong nowrap">${w.id ? esc(w.name) : `<span class="muted">${esc(w.name)}</span>`}</td>
            <td class="right">${num(w.orders)}</td>
            <td><div class="inbar"><span style="width:${(w.revenue / max) * 100}%"></span><b>${money(w.revenue)}</b></div></td>
            <td class="right">${num(w.shipped)}</td><td class="right">${num(w.returns)}</td>
            <td class="right">${w.waiting ? `<a href="#/kho" class="pill ${w.id ? 'warn' : 'bad'}">${num(w.waiting)} đơn</a>` : '<span class="muted">0</span>'}</td></tr>`).join('');
        })()}</tbody></table></div>
    </section>` : ''}

    <section class="grid g-1-1">
      <div class="panel">
        <div class="panel-h"><h2>Số đơn theo ngày</h2><span class="panel-note">Không tính đơn hủy</span></div>
        <div class="chart" id="cOrders"></div>
      </div>
      <div class="panel">
        <div class="panel-h"><h2>Giờ khách chốt đơn</h2><span class="panel-note">${peakUnique ? `Nhiều nhất lúc ${peak.hour}h–${peak.hour + 1}h` : peak.orders ? `Nhiều nhất: ${peakHours.slice(0, 4).join(', ')}${peakHours.length > 4 ? '…' : ''}` : ''}</span></div>
        <div class="chart" id="cHours"></div>
      </div>
    </section>

    <section class="grid g-2-1">
      <div class="panel">
        <div class="panel-h"><h2>Hiệu quả theo page</h2></div>
        <div class="table-wrap flat"><table class="tbl">
          <thead><tr><th>Page</th><th class="right">Đơn</th><th>Doanh thu</th><th class="right">Chi QC</th><th class="right">QC / đơn</th><th class="right">DT / QC</th><th class="right">Hoàn</th></tr></thead>
          <tbody>${(() => {
            const maxRev = Math.max(1, ...r.by_page.map((p) => p.revenue));
            return r.by_page.map((p) => {
              const roas = p.ads ? p.revenue / p.ads : 0;
              const done = p.delivered + p.returns;
              return `<tr><td class="strong nowrap">${esc(p.page)}</td><td class="right">${num(p.orders)}</td>
                <td><div class="inbar"><span style="width:${(p.revenue / maxRev) * 100}%"></span><b>${money(p.revenue)}</b></div></td>
                <td class="right">${p.ads ? money(p.ads) : '<span class="muted">–</span>'}</td>
                <td class="right">${p.ads ? money(p.cpo) : '<span class="muted">–</span>'}</td>
                <td class="right">${p.ads ? `<span class="pill ${roas >= 3 ? 'good' : roas >= 1.5 ? 'warn' : 'bad'}">${roasTxt(roas)}</span>` : '<span class="muted">–</span>'}</td>
                <td class="right">${done ? pct(p.returns / done) : '<span class="muted">–</span>'}</td></tr>`;
            }).join('') || '<tr><td colspan="7" class="empty sm">Chưa có dữ liệu</td></tr>';
          })()}</tbody></table></div>
        <p class="hint">DT / QC: mỗi 1đ quảng cáo mang về bao nhiêu đồng doanh thu. Từ 3 lần trở lên là tốt, dưới 1,5 lần là đang lỗ quảng cáo.</p>
      </div>
      <div class="panel">
        <div class="panel-h"><h2>Từ doanh thu đến lãi</h2></div>
        ${Charts.waterfall([
          { label: 'Doanh thu', value: r.revenue, color: C.revenue },
          { label: 'Giá vốn hàng', value: -r.cogs, color: C.cost },
          { label: 'Phí ship', value: -r.ship, color: C.cost },
          { label: 'Quảng cáo', value: -r.ads, color: C.ads },
          ...(otherNet ? [{ label: otherNet > 0 ? 'Chi khác' : 'Thu khác', value: -otherNet, color: C.cost }] : []),
          { label: r.profit < 0 ? 'Lỗ ước tính' : 'Lãi ước tính', value: r.profit, color: r.profit < 0 ? C.loss : C.profit, total: true },
        ])}
        <p class="hint">Nhập hàng (${money(r.import)}) không trừ vào lãi vì đã tính qua giá vốn từng hộp.</p>
      </div>
    </section>

    <section class="grid g-1-1">
      ${Object.keys(r.by_return_reason || {}).length ? `<div class="panel">
        <div class="panel-h"><h2>Lý do hoàn</h2><span class="panel-note">${num(r.by_status.hoan || 0)} đơn hoàn</span></div>
        ${Charts.hbars(Object.entries(r.by_return_reason).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v })), { fmt: (v) => num(v) + ' đơn' })}
      </div>` : ''}
      <div class="panel">
        <div class="panel-h"><h2>Tỉnh/thành mua nhiều</h2><span class="panel-note">Theo số đơn</span></div>
        ${Charts.hbars(r.by_province.map((p) => ({ label: p.province, value: p.orders, sub: p.returns ? `${p.returns} hoàn` : '' })), { fmt: (v) => num(v) + ' đơn' })}
      </div>
      <div class="panel">
        <div class="panel-h"><h2>Số hộp mỗi đơn</h2><span class="panel-note">${qtyTotal ? `${pct(multi)} đơn mua từ 2 hộp` : ''}</span></div>
        <div class="chart" id="cQty"></div>
      </div>
    </section>`;
  rp.bind(root);

  Charts.line($('#cTrend', root), {
    labels, titles, height: 280, valueFmt: money,
    series: [
      { name: 'Doanh thu', color: C.revenue, values: days.map((d) => d.revenue), area: true },
      { name: 'Chi quảng cáo', color: C.ads, values: days.map((d) => d.ads) },
      { name: 'Lãi ước tính', color: C.profit, values: days.map((d) => d.profit) },
    ],
  });
  Charts.bars($('#cOrders', root), { labels, titles, int: true, name: 'Số đơn', values: days.map((d) => d.orders), color: C.revenue, fmt: (v) => num(v), valueFmt: (v) => num(v) + ' đơn' });
  Charts.bars($('#cHours', root), {
    labels: r.by_hour.map((h) => h.hour + 'h'), titles: r.by_hour.map((h) => `${h.hour}h – ${h.hour + 1}h`), every: 3,
    name: 'Số đơn', values: r.by_hour.map((h) => h.orders), color: C.revenue, fmt: (v) => num(v), valueFmt: (v) => num(v) + ' đơn',
    mark: peakUnique ? peak.hour : null, int: true,
  });
  Charts.bars($('#cQty', root), {
    labels: r.by_qty.map((q) => q.qty + ' hộp'), int: true, name: 'Số đơn', values: r.by_qty.map((q) => q.orders), color: C.revenue,
    fmt: (v) => num(v), valueFmt: (v) => `${num(v)} đơn${qtyTotal ? ` (${pct(v / qtyTotal)})` : ''}`, height: 200,
  });
};

// ================================================================ ĐƠN HÀNG
const ordState = { range: null, q: '', status: '', page: '', kho: '', dup: false, selected: new Set() };
VIEWS.orders = async (root) => {
  ordState.range ||= makeRange('d7');
  const sw = supplierSwitch(() => load());
  const rp = rangePicker(ordState.range, () => load());
  root.innerHTML = `
    <div class="toolbar">
      <h1>Đơn hàng</h1><span class="spacer"></span>
      ${hasWh() ? sw.html : ''}
      <button class="btn" id="newOrder">+ Tạo đơn</button>
    </div>
    <div class="toolbar">
      <input class="grow" id="q" placeholder="Tìm mã đơn, tên, SĐT, địa chỉ, mã vận đơn…" value="${esc(ordState.q)}">
      ${rp.html}
      <select id="st">
        <option value="">Mọi trạng thái</option>
        ${Object.entries(S.statuses).map(([k, v]) => `<option value="${k}" ${ordState.status === k ? 'selected' : ''}>${v}</option>`).join('')}
        <option value="cod" ${ordState.status === 'cod' ? 'selected' : ''}>COD chờ về</option>
      </select>
      <select id="pg">${pageOptions(ordState.page)}</select>
      ${hasWh() ? `<select id="wh">${whOptions(ordState.kho, { all: true })}</select>` : ''}
      <label class="nowrap"><input type="checkbox" id="dup" ${ordState.dup ? 'checked' : ''}> Chỉ đơn trùng</label>
    </div>
    <div id="bulk"></div>
    <div id="sum" class="muted small" style="margin-bottom:8px"></div>
    <div class="table-wrap" id="tbl"><div class="loading">Đang tải…</div></div>`;
  rp.bind(root);
  sw.bind(root);

  let t;
  $('#q').addEventListener('input', (e) => { ordState.q = e.target.value; clearTimeout(t); t = setTimeout(load, 300); });
  $('#st').addEventListener('change', (e) => { ordState.status = e.target.value; load(); });
  $('#pg').addEventListener('change', (e) => { ordState.page = e.target.value; load(); });
  $('#dup').addEventListener('change', (e) => { ordState.dup = e.target.checked; load(); });
  $('#wh')?.addEventListener('change', (e) => { ordState.kho = e.target.value; load(); });
  $('#newOrder').addEventListener('click', () => orderForm(null, load));

  let rows = [];
  async function load() {
    const p = new URLSearchParams();
    // tìm kiếm thì bỏ qua khoảng ngày để tìm được đơn cũ
    if (!ordState.q) { p.set('from', ordState.range.from); p.set('to', ordState.range.to); }
    if (ordState.q) p.set('q', ordState.q);
    if (ordState.status === 'cod') p.set('cod', 'pending');
    else if (ordState.status) p.set('status', ordState.status);
    if (ordState.page) p.set('page', ordState.page);
    if (ordState.dup) p.set('dup', '1');
    if (ordState.kho && hasWh()) p.set('kho', ordState.kho);
    const r = await api('GET', '/api/orders?' + p);
    rows = r.orders;
    ordState.selected = new Set([...ordState.selected].filter((id) => rows.some((o) => o.id === id)));
    $('#sum').textContent = `${r.count} đơn · ${num(r.qty)} hộp · ${money(r.total)}` + (ordState.q ? ' (tìm trong mọi ngày)' : '') + (r.count > rows.length ? ` — đang hiện ${rows.length} đơn mới nhất` : '');
    render();
  }

  function render() {
    if (!rows.length) { $('#tbl').innerHTML = '<div class="empty">Không có đơn nào</div>'; renderBulk(); return; }
    const all = rows.every((o) => ordState.selected.has(o.id));
    $('#tbl').innerHTML = `<table><thead><tr>
      <th><input type="checkbox" id="selAll" ${all ? 'checked' : ''}></th><th>Mã / Giờ</th><th>Khách</th><th>Địa chỉ</th>
      <th class="right">SL</th><th class="right">Tiền</th><th>Page</th><th>Trạng thái</th>${hasWh() ? '<th>Kho</th>' : ''}<th>Vận đơn</th></tr></thead><tbody>
      ${rows.map((o) => `<tr class="click ${o.dup_codes ? 'is-dup' : ''} ${o.status === 'huy' ? 'is-huy' : ''}" data-id="${o.id}">
        <td><input type="checkbox" data-sel="${o.id}" ${ordState.selected.has(o.id) ? 'checked' : ''}></td>
        <td class="nowrap"><b class="mono">${esc(o.code)}</b><div class="cell-sub">${dt(o.created_at)}</div></td>
        <td>${esc(o.name)} ${o.cflag === 'bom' ? flagBadge('bom') : ''}<div class="cell-sub mono">${esc(o.phone)}</div></td>
        <td class="addr">${esc(o.address)}${o.note ? `<div class="cell-sub">📝 ${esc(o.note)}</div>` : ''}</td>
        <td class="right">${o.qty}</td>
        <td class="right nowrap">${money(o.total)}${o.cod_received ? '<div><span class="badge b-cod">COD về</span></div>' : ''}</td>
        <td class="small">${esc(o.page)}</td>
        <td>${badge(o.status)}${o.return_reason ? `<div class="cell-sub">${esc(o.return_reason)}</div>` : ''}${o.dup_codes ? `<div><span class="badge b-dup" title="Trùng: ${esc(o.dup_codes)}">Trùng đơn</span></div>` : ''}</td>
        ${hasWh() ? `<td>${whBadge(o.kho_id)}</td>` : ''}
        <td class="small mono">${esc(o.tracking_code)}</td></tr>`).join('')}
      </tbody></table>`;
    $('#selAll').addEventListener('change', (e) => {
      rows.forEach((o) => (e.target.checked ? ordState.selected.add(o.id) : ordState.selected.delete(o.id)));
      render();
    });
    $('#tbl tbody').addEventListener('click', (e) => {
      const cb = e.target.closest('[data-sel]');
      if (cb) {
        const id = Number(cb.dataset.sel);
        cb.checked ? ordState.selected.add(id) : ordState.selected.delete(id);
        renderBulk();
        return;
      }
      const tr = e.target.closest('tr[data-id]');
      if (tr) openOrder(Number(tr.dataset.id), load);
    });
    renderBulk();
  }

  function renderBulk() {
    const n = ordState.selected.size;
    if (!n) { $('#bulk').innerHTML = ''; return; }
    $('#bulk').innerHTML = `<div class="bulk">
      <b>Đã chọn ${n} đơn</b>
      <select id="bSt"><option value="">Đổi trạng thái…</option>${Object.entries(S.statuses).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      ${hasWh() ? `<select id="bWh"><option value="-">Chia cho kho…</option>${whOptions('-', { noneLabel: 'Bỏ chia (chưa kho nào)' })}</select>` : ''}
      <button class="btn sm" id="bCod">Đánh dấu COD đã về</button>
      <button class="btn sm sec" id="bCopy">Chép</button>
      <span class="spacer"></span><button class="link" id="bClear">Bỏ chọn</button></div>`;
    const ids = [...ordState.selected];
    $('#bSt').addEventListener('change', async (e) => {
      if (!e.target.value) return;
      const body = { ids, status: e.target.value };
      if (body.status === 'hoan') {
        const a = await askReturn(null, { count: ids.length });
        if (!a) { e.target.value = ''; return; }
        body.return_reason = a.return_reason;
      }
      const r = await api('POST', '/api/orders/bulk', body).catch(fail);
      if (r) { toast(`Đã cập nhật ${r.updated} đơn`); ordState.selected.clear(); load(); }
    });
    $('#bWh')?.addEventListener('change', async (e) => {
      if (e.target.value === '-') return;
      const r = await api('POST', '/api/orders/bulk', { ids, kho_id: e.target.value }).catch(fail);
      if (r) { toast(`Đã chuyển ${r.updated} đơn cho ${whName(Number(e.target.value))}`); ordState.selected.clear(); load(); }
    });
    $('#bCod').addEventListener('click', async () => {
      const r = await api('POST', '/api/orders/bulk', { ids, cod_received: true }).catch(fail);
      if (r) { toast(`Đã đánh dấu COD ${r.updated} đơn`); ordState.selected.clear(); load(); }
    });
    $('#bCopy').addEventListener('click', (e) => copyText(ordersText(rows.filter((o) => ordState.selected.has(o.id))), e.currentTarget));
    $('#bClear').addEventListener('click', () => { ordState.selected.clear(); render(); });
  }

  await load();
};

// nội dung khi bấm "Chép" một đơn: tên, SĐT, địa chỉ, số hộp, tổng tiền, ngăn cách theo Cài đặt
const SEPS = { pipe: ' | ', dash: ' - ', semi: '; ', tab: '\t', newline: '\n' };
function orderLine(o, settings = S.settings) {
  const sep = SEPS[settings.copy_sep] ?? SEPS.pipe;
  const lab = Number(settings.copy_labels) === 1;
  return [['Tên', o.name], ['SĐT', o.phone], ['Địa chỉ', o.address], ['SL', `${o.qty || '?'} hộp`], ['Tổng tiền', money(o.total)]]
    .map(([k, v]) => (lab ? `${k}: ${v}` : v)).join(sep);
}
function ordersText(list, settings = S.settings) {
  const key = SEPS[settings.copy_sep] ? settings.copy_sep : 'pipe';
  const qty = list.reduce((s, o) => s + (Number(o.qty) || 0), 0);
  const tot = list.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const body = key === 'newline'
    ? list.map((o, i) => `${i + 1})\n${orderLine(o, settings)}`).join('\n\n')
    : list.map((o, i) => `${i + 1}${key === 'tab' ? '\t' : '. '}${orderLine(o, settings)}`).join('\n');
  return `${body}\n\nTổng: ${list.length} đơn · ${qty} hộp · ${money(tot)}`;
}

// ---------------------------------------------------------------- form tạo / sửa đơn
function orderFields(o = {}) {
  return `
    <label>Tên khách<input name="name" value="${esc(o.name)}"></label>
    <label>SĐT<input name="phone" value="${esc(o.phone)}" inputmode="numeric" required></label>
    <label class="full">Địa chỉ<textarea name="address" rows="2" required>${esc(o.address)}</textarea></label>
    <label class="full">Sản phẩm<input name="product" value="${esc(o.product ?? S.settings.default_product)}"></label>
    <label>Số lượng (hộp)<input name="qty" value="${o.qty ?? ''}" inputmode="numeric"></label>
    <label>Tổng tiền thu (COD)<input name="total" value="${o.total ? num(o.total) : ''}" inputmode="numeric"></label>
    <label>Page<input name="page" value="${esc(o.page)}" list="pagesList"><datalist id="pagesList">${S.pages.map((p) => `<option value="${esc(p)}">`).join('')}</datalist></label>
    <label>Ghi chú<input name="note" value="${esc(o.note)}"></label>`;
}

// danh sách xã/huyện/tỉnh cho bộ đọc địa chỉ — nạp khi cần lần đầu
let addrReady = null;
const loadAddr = () => (addrReady ||= fetch('/vn-admin.json').then((r) => r.json()).then((d) => VnAddr.load(d)).catch(() => { addrReady = null; }));

function orderForm(prefill, onDone) {
  const m = modal('Tạo đơn mới', `
    <label class="small muted" style="font-weight:600">Dán tin nhắn chốt đơn (tự điền các ô bên dưới)</label>
    <textarea id="paste" rows="4" placeholder="Dán tin nhắn xác nhận đơn vào đây…" style="margin:4px 0 12px"></textarea>
    <div id="hintBox"></div>
    <div id="dupBox"></div>
    <form class="form" id="f">${orderFields(prefill || {})}</form>
    <div class="actions"><button class="btn sec" data-close>Hủy</button><button class="btn" id="save">Lưu đơn</button></div>`);
  const f = $('#f', m.el);
  const set = (k, v) => { if (v !== '' && v != null && v !== 0) f.elements[k].value = v; };
  $('#paste', m.el).addEventListener('input', async (e) => {
    await loadAddr();
    const p = OrderParser.parse(e.target.value);
    set('name', p.name); set('phone', p.phone); set('address', p.address); set('product', p.product);
    set('qty', p.qty); set('total', p.total ? num(p.total) : ''); set('note', p.note);
    const h = p.hints || { warnings: [], missing: [] };
    const L = { name: 'tên', phone: 'SĐT', address: 'địa chỉ', detail: 'số nhà / thôn', ward: 'xã / phường', qty: 'số lượng', total: 'tổng tiền' };
    const miss = h.missing.map((x) => L[x]).filter(Boolean);
    $('#hintBox', m.el).innerHTML = e.target.value.trim() && (miss.length || h.warnings.length)
      ? `<div class="warn soft">${miss.length ? `<b>Thiếu: ${esc(miss.join(', '))}</b>` : '<b>Kiểm tra lại</b>'}${h.warnings.map((w) => `<div>• ${esc(w)}</div>`).join('')}</div>` : '';
    checkDup();
  });
  async function checkDup() {
    const phone = OrderParser.normalizePhone(f.elements.phone.value);
    const box = $('#dupBox', m.el);
    if (phone.length !== 10) { box.innerHTML = ''; return; }
    const r = await api('GET', '/api/orders/check?phone=' + phone).catch(() => null);
    if (!r) return;
    let html = '';
    if (r.customer?.flag === 'bom') html += `<div class="warn">🚫 <b>SĐT này nằm trong SỔ ĐỎ</b> (từng phá / bom hàng). ${esc(r.customer.note)}</div>`;
    if (r.matches.length) html += `<div class="warn"><b>⚠️ SĐT này đã đặt trong ${S.settings.dup_days} ngày qua:</b>${r.matches.map((d) => `<div>${esc(d.code)} · ${dt(d.created_at)} · ${d.qty} hộp · ${money(d.total)} · ${esc(S.statuses[d.status])}</div>`).join('')}</div>`;
    box.innerHTML = html;
    $('#save', m.el).textContent = r.matches.length ? 'Vẫn lưu (đơn trùng)' : 'Lưu đơn';
  }
  f.elements.phone.addEventListener('change', checkDup);
  $('#save', m.el).addEventListener('click', async () => {
    const d = formData(f);
    d.total = OrderParser.parseMoney(d.total);
    try {
      const r = await api('POST', '/api/orders', d);
      toast(`Đã lưu ${r.order.code}`);
      m.close();
      refreshPages();
      onDone && onDone();
    } catch (e) { fail(e); }
  });
  $('#paste', m.el).focus();
}

// ---------------------------------------------------------------- chi tiết đơn
async function openOrder(id, onDone) {
  const r = await api('GET', '/api/orders/' + id).catch(fail);
  if (!r) return;
  const o = r.order;
  const admin = S.user.role === 'admin';
  const stOpts = Object.entries(S.statuses).filter(([k]) => admin || k !== 'huy')
    .map(([k, v]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v}</option>`).join('');
  const m = modal(`Đơn ${o.code}`, `
    ${r.customer?.flag === 'bom' ? `<div class="warn">🚫 <b>SĐT này nằm trong SỔ ĐỎ</b> (từng phá / bom hàng). ${esc(r.customer.note)}</div>` : ''}
    ${o.dup_codes ? `<div class="warn">⚠️ Trùng với: ${esc(o.dup_codes)}</div>` : ''}
    <div class="cols">
      <div>
        <form class="form" id="f">
          ${admin ? orderFields(o) : `<div class="full"><b>${esc(o.name)}</b> · ${esc(o.phone)}<div>${esc(o.address)}</div><div>${o.qty} hộp · ${money(o.total)}</div></div>`}
          <label>Trạng thái<select name="status">${stOpts}</select></label>
          <label id="rrBox" ${o.status === 'hoan' ? '' : 'hidden'}>Lý do hoàn<input name="return_reason" list="rrList" value="${esc(o.return_reason)}" placeholder="Chọn hoặc gõ lý do"><datalist id="rrList">${returnReasons().map((x) => `<option value="${esc(x)}">`).join('')}</datalist></label>
          ${admin && S.khos.length ? `<label>Kho gửi đơn này<select name="kho_id">${whOptions(o.kho_id || '')}</select></label>` : ''}
          <label>Mã vận đơn<input name="tracking_code" value="${esc(o.tracking_code)}"></label>
          <label>Phí ship<input name="ship_fee" value="${o.ship_fee ? num(o.ship_fee) : ''}" inputmode="numeric"></label>
          <label>Ghi chú kho<input name="kho_note" value="${esc(o.kho_note)}"></label>
          ${admin ? `<label class="check full"><input type="checkbox" name="cod_received" ${o.cod_received ? 'checked' : ''}> COD đã về${o.cod_at ? ` <span class="muted small">(${dt(o.cod_at)})</span>` : ''}</label>` : ''}
        </form>
        <div class="actions">
          ${admin ? '<button class="btn danger" id="del">Xóa đơn</button><span class="spacer"></span>' : ''}
          <button class="btn sec" id="copy">Chép</button>
          ${o.link ? `<a class="btn sec" href="${esc(o.link)}" target="_blank" rel="noopener">💬 Mở chat</a>` : ''}
          <button class="btn" id="save">Lưu</button>
        </div>
      </div>
      <div>
        <h2>Lịch sử đơn</h2>
        <ul class="timeline">${r.events.map((e) => `<li><span class="muted small">${dt(e.at)} · ${esc(e.user)}</span><br>${esc(e.action)}</li>`).join('')}</ul>
        ${admin ? `<h2 style="margin-top:14px">Đơn khác của khách (${r.history.length})</h2>` : ''}
        <ul class="timeline" ${admin ? '' : 'hidden'}>${r.history.map((h) => `<li><a href="#" data-open="${h.id}">${esc(h.code)}</a> · ${dt(h.created_at)} · ${h.qty} hộp · ${money(h.total)} ${badge(h.status)}</li>`).join('') || '<li class="muted">Chưa có</li>'}</ul>
      </div>
    </div>`, { wide: true });

  $('[name=status]', m.el).addEventListener('change', (e) => { $('#rrBox', m.el).hidden = e.target.value !== 'hoan'; });
  $('#save', m.el).addEventListener('click', async () => {
    const d = formData($('#f', m.el));
    d.ship_fee = OrderParser.parseMoney(d.ship_fee);
    if ('total' in d) d.total = OrderParser.parseMoney(d.total);
    let red = false;
    if (d.status === 'hoan' && o.status !== 'hoan' && !d.return_reason.trim()) {
      const a = await askReturn(o);
      if (!a) return;
      d.return_reason = a.return_reason;
      red = a.red;
    }
    try {
      await api('PATCH', '/api/orders/' + id, d);
      if (red) await addToRedBook(o, d.return_reason);
      toast('Đã lưu');
      m.close();
      onDone && onDone();
    } catch (e) { fail(e); }
  });
  $('#copy', m.el).addEventListener('click', (e) => copyText(orderLine(o), e.currentTarget));
  $('#del', m.el)?.addEventListener('click', async () => {
    if (!confirm(`Xóa hẳn đơn ${o.code}? Không khôi phục được. (Nên dùng trạng thái "Hủy" thay vì xóa)`)) return;
    try { await api('DELETE', '/api/orders/' + id); toast('Đã xóa'); m.close(); onDone && onDone(); } catch (e) { fail(e); }
  });
  $$('[data-open]', m.el).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); m.close(); openOrder(Number(a.dataset.open), onDone); }));
}

// ================================================================ KHO
const khoState = { tab: 'moi', open: new Set(), sup: '' };
VIEWS.kho = async (root) => {
  const TABS = { moi: 'Chờ gửi', da_gui: 'Đã gửi', xong: 'Giao / Hoàn' };
  root.innerHTML = `
    <div class="page-head no-print">
      <div><h1>${S.user.role === 'admin' ? 'Kho gửi hàng' : 'Gửi hàng'}</h1><p class="page-sub" id="ksum"></p></div>
      <div class="kho-actions">
        <button class="btn sec sm" id="copyAll">Chép tất cả</button>
        <button class="btn sec sm" id="print">In danh sách</button>
        <button class="btn sec sm icon-only" id="reload" title="Tải lại" aria-label="Tải lại"><svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/></svg></button>
      </div>
    </div>
    <div class="kho-bar no-print">
      <div class="tabs" id="tabs"></div>
      ${hasWh() ? `<select id="kwh" aria-label="Lọc theo kho">${whOptions(khoState.sup, { all: true })}</select>` : ''}
      <div class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        <input id="kq" type="search" placeholder="Tìm tên, SĐT, mã đơn…" aria-label="Tìm đơn"></div>
    </div>
    <div class="klist" id="list"><div class="loading">Đang tải…</div></div>`;
  let lists = {};

  async function load() {
    const since = addDays(S.today, -14);
    const w = hasWh() && khoState.sup ? `&kho=${khoState.sup}` : '';
    const [a, b, c] = await Promise.all([
      api('GET', `/api/orders?status=moi&sort=asc&limit=1000${w}`),
      api('GET', `/api/orders?status=da_gui&from=${since}&limit=500${w}`),
      api('GET', `/api/orders?status=da_giao,hoan&from=${addDays(S.today, -3)}&limit=300${w}`),
    ]);
    lists = { moi: a.orders, da_gui: b.orders, xong: c.orders };
    render();
  }

  function visible() {
    const q = $('#kq').value.trim().toLowerCase();
    return (lists[khoState.tab] || []).filter((o) => !q || [o.code, o.name, o.phone, o.address, o.tracking_code].join(' ').toLowerCase().includes(q));
  }

  function render() {
    $('#tabs').innerHTML = Object.entries(TABS).map(([k, v]) =>
      `<button class="tab ${khoState.tab === k ? 'on' : ''}" data-tab="${k}">${v}<span class="n">${lists[k]?.length ?? 0}</span></button>`).join('');
    const rows = visible();
    const qty = rows.reduce((s, o) => s + (Number(o.qty) || 0), 0);
    const tot = rows.reduce((s, o) => s + (Number(o.total) || 0), 0);
    $('#ksum').textContent = (rows.length ? `${rows.length} đơn · ${num(qty)} hộp · ${money(tot)}` : 'Không có đơn');
    const q = $('#kq').value.trim();
    $('#list').innerHTML = rows.length
      ? `<div class="krow khead" aria-hidden="true"><div class="krow-main"><span class="k-no">#</span><span>Khách</span><span>Địa chỉ</span><span class="right">SL</span><span class="right">Tổng tiền</span><span>Trạng thái</span><span></span></div><div class="k-acts"></div></div>
         ${rows.map((o, i) => row(o, i + 1)).join('')}`
      : `<div class="empty">${q ? 'Không tìm thấy đơn phù hợp.' : khoState.tab === 'moi' ? 'Đã gửi hết. Đơn mới sẽ tự hiện ở đây.' : 'Chưa có đơn nào ở mục này.'}</div>`;
  }

  function row(o, no) {
    const open = khoState.open.has(o.id);
    const C = (v, label) => `<button class="chip" data-copy="${esc(v)}">${label}</button>`;
    const when = o.status === 'da_gui' ? o.shipped_at : (o.status === 'da_giao' || o.status === 'hoan') ? o.done_at : null;
    const whenLbl = { da_gui: 'Gửi lúc', da_giao: 'Giao lúc', hoan: 'Hoàn lúc' }[o.status];
    const primary = o.status === 'moi'
      ? `<button class="btn sm k-go" data-act="da_gui">Đã gửi</button>`
      : o.status === 'da_gui' ? `<button class="btn sm sec k-go" data-act="da_giao">Đã giao</button>` : '';
    const shipFields = o.status === 'moi' || o.status === 'da_gui'
      ? `<div class="k-ship">
          <label>Mã vận đơn<input placeholder="VD: VTP123456789" data-f="tracking_code" value="${esc(o.tracking_code)}" autocomplete="off"></label>
          <label>Phí ship<input placeholder="VD: 32k" data-f="ship_fee" inputmode="numeric" value="${o.ship_fee ? num(o.ship_fee) : ''}"></label>
          <button class="btn sec" data-save>Lưu</button>
          ${o.status === 'da_gui' ? '<button class="btn danger" data-act="hoan">Bị hoàn</button>' : ''}
        </div>` : '';
    return `<div class="krow${open ? ' open' : ''}${o.dup_codes ? ' dup' : ''}" data-id="${o.id}">
      <button class="krow-main" data-toggle aria-expanded="${open}" aria-label="Đơn ${no}: ${esc(o.name)}, bấm để xem thêm">
        <span class="k-no">${no}</span>
        <span class="k-who"><b class="k-name">${esc(o.name) || '(chưa có tên)'}</b><span class="k-phone">${esc(o.phone)}</span></span>
        <span class="k-addr">${esc(o.address)}</span>
        <span class="k-qty"><b>${o.qty || '?'}</b> hộp</span>
        <span class="k-total">${money(o.total)}</span>
        <span class="k-st">${badge(o.status)}${o.return_reason ? `<span class="k-when">${esc(o.return_reason)}</span>` : ''}${o.cflag === 'bom' ? flagBadge('bom') : ''}${o.dup_codes ? `<span class="badge b-dup" title="Trùng: ${esc(o.dup_codes)}">Trùng đơn</span>` : ''}${when ? `<span class="k-when">${whenLbl} ${dt(when)}</span>` : ''}${hasWh() && !khoState.sup ? whBadge(o.kho_id) : ''}</span>
        <span class="chev" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></span>
      </button>
      <div class="k-acts no-print">
        <button class="btn sec sm" data-copyall="${o.id}" title="Chép tên, SĐT, địa chỉ, số hộp, tổng tiền">Chép</button>
        ${primary}
      </div>
      <div class="k-detail">
        <div class="k-meta"><span>Mã đơn <b>${esc(o.code)}</b></span><span>Tạo lúc ${dt(o.created_at)}</span>${o.shipped_at ? `<span>Gửi lúc <b>${dt(o.shipped_at)}</b></span>` : ''}<span>${esc(o.product)}</span></div>
        ${o.note ? `<div class="note">Khách dặn: ${esc(o.note)}</div>` : ''}
        ${o.kho_note ? `<div class="note">Ghi chú kho: ${esc(o.kho_note)}</div>` : ''}
        ${o.tracking_code && o.status !== 'moi' && o.status !== 'da_gui' ? `<div class="k-track">Vận đơn <b>${esc(o.tracking_code)}</b>${o.ship_fee ? ` · ship ${money(o.ship_fee)}` : ''} ${C(o.tracking_code, 'Chép mã')}</div>` : ''}
        <div class="k-chips no-print"><span class="muted small">Chép từng mục:</span>${C(o.name, 'Tên')}${C(o.phone, 'SĐT')}${C(o.address, 'Địa chỉ')}${C(o.qty, 'Số hộp')}${C(o.total, 'Tổng tiền')}${o.tracking_code ? C(o.tracking_code, 'Mã vận đơn') : ''}<button class="chip ghost" data-detail="${o.id}">Xem chi tiết</button></div>
        ${shipFields}
      </div>
    </div>`;
  }

  async function setStatus(id, status, extra = {}) {
    await api('PATCH', '/api/orders/' + id, { status, ...extra });
  }

  root.addEventListener('click', async (e) => {
    const t = e.target.closest('button, a');
    if (!t || !root.contains(t)) return;
    if (t.dataset.tab) { khoState.tab = t.dataset.tab; render(); return; }
    if (t.dataset.copy != null) return copyText(t.dataset.copy, t);
    const all = [...lists.moi, ...lists.da_gui, ...lists.xong];
    if (t.dataset.copyall) { const o = all.find((x) => x.id === Number(t.dataset.copyall)); return copyText(orderLine(o), t); }
    if (t.dataset.detail) return openOrder(Number(t.dataset.detail), load);
    if (t.dataset.toggle != null) {
      const r = t.closest('.krow');
      const id = Number(r.dataset.id);
      const open = !khoState.open.has(id);
      if (open) khoState.open.add(id);
      else khoState.open.delete(id);
      r.classList.toggle('open', open);
      t.setAttribute('aria-expanded', open);
      return;
    }
    const r = t.closest('.krow');
    if (!r) return;
    const id = Number(r.dataset.id);
    const o = all.find((x) => x.id === id);
    const fields = {};
    for (const inp of $$('[data-f]', r)) fields[inp.dataset.f] = inp.dataset.f === 'ship_fee' ? OrderParser.parseMoney(inp.value) : inp.value.trim();

    if (t.dataset.save != null) {
      t.disabled = true;
      try { await api('PATCH', '/api/orders/' + id, fields); toast('Đã lưu mã vận đơn và phí ship'); await load(); } catch (err) { fail(err); t.disabled = false; }
      return;
    }
    if (t.dataset.act) {
      const st = t.dataset.act;
      let ret = null;
      if (st === 'hoan') {
        ret = await askReturn(o);
        if (!ret) return;
        fields.return_reason = ret.return_reason;
      }
      t.disabled = true;
      const before = o.status;
      try {
        await setStatus(id, st, fields);
        if (ret?.red) await addToRedBook(o, ret.return_reason).catch(fail);
        khoState.open.delete(id);
        await load();
        const who = o.name || o.phone;
        const msg = st === 'da_gui' ? `Đã gửi đơn của ${who} lúc ${new Date().toTimeString().slice(0, 5)}` : `Đơn của ${who}: ${S.statuses[st]}`;
        toast(msg, false, {
          label: 'Hoàn tác',
          run: async () => { try { await setStatus(id, before); await load(); toast('Đã hoàn tác'); } catch (err) { fail(err); } },
        });
      } catch (err) { fail(err); t.disabled = false; }
    }
  });
  $('#kq').addEventListener('input', render);
  $('#kwh')?.addEventListener('change', (e) => { khoState.sup = e.target.value; load().catch(fail); });
  $('#reload').addEventListener('click', () => load().then(() => toast('Đã tải lại')).catch(fail));
  $('#print').addEventListener('click', () => window.print());
  $('#copyAll').addEventListener('click', (e) => {
    const rows = visible();
    if (rows.length) copyText(ordersText(rows), e.currentTarget);
  });
  // tự làm mới mỗi 60 giây (khi không gõ dở)
  viewTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && !$$('[data-f]').some((i) => i === document.activeElement)) load().catch(() => {});
  }, 60e3);
  await load();
};

// ================================================================ KHÁCH HÀNG
const cusState = { q: '', tab: 'all' };
VIEWS.customers = async (root) => {
  const TABS = { all: 'Tất cả', loyal: 'Khách quen', red: 'Sổ đỏ' };
  root.innerHTML = `
    <div class="toolbar page-title"><h1>Khách hàng</h1><span class="spacer"></span>
      <button class="btn danger sm" id="addRed">+ Thêm SĐT vào Sổ đỏ</button></div>
    <div class="tabs" id="ctabs">${Object.entries(TABS).map(([k, v]) => `<button class="tab ${cusState.tab === k ? 'on' : ''}" data-tab="${k}">${v}</button>`).join('')}</div>
    <div class="toolbar"><input class="grow" id="q" placeholder="Tìm tên, SĐT, địa chỉ…" value="${esc(cusState.q)}"></div>
    <p class="muted small" id="chint" style="margin:0 0 8px"></p>
    <div class="table-wrap" id="tbl"><div class="loading">Đang tải…</div></div>
    <div id="sus"></div>`;

  const HINT = {
    all: '',
    loyal: 'Khách có từ 2 đơn đã giao, mua nhiều nhất trước. "Chu kỳ" là số ngày trung bình giữa 2 lần mua; khách quá chu kỳ mà chưa đặt lại thì nên nhắn chăm sóc.',
    red: 'Số điện thoại từng tạo đơn ảo, cố tình phá hoặc bom hàng. Đặt đơn bằng SĐT này thì web và extension đều cảnh báo đỏ.',
  };
  const who = (c) => `<td>${esc(c.name) || '<span class="muted">(chưa có tên)</span>'} ${flagBadge(c.flag)}<div class="cell-sub mono">${esc(c.phone)}</div></td>`;

  function tableAll(list) {
    return `<table><thead><tr><th>Khách</th><th>Địa chỉ</th><th class="right">Số đơn</th><th class="right">Đã mua</th><th class="right">Hoàn</th><th>Lần cuối</th></tr></thead><tbody>
      ${list.map((c) => `<tr class="click" data-id="${c.id}">${who(c)}
        <td class="addr">${esc(c.address)}</td><td class="right">${c.orders}</td><td class="right">${money(c.spent)}</td>
        <td class="right">${c.returns || ''}</td><td class="small">${dt(c.last_order)}</td></tr>`).join('')}</tbody></table>`;
  }
  function tableLoyal(list) {
    return `<table><thead><tr><th>#</th><th>Khách</th><th class="right">Đơn đã giao</th><th class="right">Tổng hộp</th><th class="right">Tổng tiền</th><th class="right">Chu kỳ</th><th>Lần cuối đặt</th></tr></thead><tbody>
      ${list.map((c, i) => {
        const late = c.cycle_days && c.since_days > c.cycle_days * 1.3;
        return `<tr class="click" data-id="${c.id}"><td class="muted">${i + 1}</td>${who(c)}
        <td class="right"><b>${c.delivered}</b>${c.returns ? `<div class="cell-sub">${c.returns} hoàn</div>` : ''}</td>
        <td class="right">${num(c.boxes)}</td><td class="right nowrap">${money(c.spent)}</td>
        <td class="right nowrap">${c.cycle_days ? `${c.cycle_days} ngày` : '—'}</td>
        <td class="small">${dt(c.last_order)}<div class="cell-sub">${c.since_days} ngày trước${late ? ' · <b class="neg">quá chu kỳ</b>' : ''}</div></td></tr>`;
      }).join('')}</tbody></table>`;
  }
  function tableRed(list) {
    return `<table><thead><tr><th>Khách</th><th>Lý do</th><th class="right">Đơn</th><th class="right">Hoàn</th><th>Vào sổ đỏ</th></tr></thead><tbody>
      ${list.map((c) => `<tr class="click" data-id="${c.id}">${who(c)}
        <td class="small" style="white-space:pre-line">${esc(c.note) || '<span class="muted">—</span>'}</td>
        <td class="right">${c.orders}</td><td class="right">${c.returns || ''}</td>
        <td class="small">${dt(c.flagged_at)}</td></tr>`).join('')}</tbody></table>`;
  }

  async function load() {
    const tab = cusState.tab;
    const view = tab === 'all' ? '' : tab;
    const [r, sus] = await Promise.all([
      api('GET', `/api/customers?q=${encodeURIComponent(cusState.q)}&view=${view}`),
      tab === 'red' ? api('GET', '/api/customers/suspects') : null,
    ]);
    if (tab !== cusState.tab) return;
    $('#chint').textContent = HINT[tab];
    const empty = { all: 'Chưa có khách', loyal: 'Chưa có khách nào mua từ 2 lần trở lên', red: 'Sổ đỏ đang trống' }[tab];
    $('#tbl').innerHTML = r.customers.length
      ? (tab === 'loyal' ? tableLoyal : tab === 'red' ? tableRed : tableAll)(r.customers)
      : `<div class="empty">${empty}</div>`;
    $('#sus').innerHTML = sus && sus.customers.length ? `
      <h2 style="margin:18px 0 4px">Nghi vấn (${sus.customers.length})</h2>
      <p class="muted small" style="margin:0 0 8px">Chưa vào sổ đỏ nhưng có đơn hoàn vì "${esc(returnReasons()[0] || '')}", hoặc hoàn nhiều mà gần như không nhận đơn nào.</p>
      <div class="table-wrap"><table><thead><tr><th>Khách</th><th class="right">Đơn</th><th class="right">Đã nhận</th><th class="right">Hoàn</th><th>Lần cuối</th><th></th></tr></thead><tbody>
      ${sus.customers.map((c) => `<tr class="click" data-id="${c.id}">${who(c)}<td class="right">${c.orders}</td><td class="right">${c.delivered}</td>
        <td class="right"><b class="neg">${c.returns}</b>${c.fake_returns ? `<div class="cell-sub">${c.fake_returns} cố tình phá</div>` : ''}</td>
        <td class="small">${dt(c.last_order)}</td>
        <td class="right"><button class="btn danger sm" data-red="${c.id}">Vào sổ đỏ</button></td></tr>`).join('')}</tbody></table></div>` : '';
  }

  function addRedForm(prefill = {}) {
    const m = modal('Thêm vào Sổ đỏ', `
      <form class="form" id="rf">
        <label>Số điện thoại<input name="phone" inputmode="tel" value="${esc(prefill.phone || '')}" required></label>
        <label>Tên (nếu biết)<input name="name" value="${esc(prefill.name || '')}"></label>
        <label class="full">Lý do<input name="note" list="rrList2" placeholder="VD: tạo đơn ảo, đặt nhiều SĐT để phá"><datalist id="rrList2">${returnReasons().map((x) => `<option value="${esc(x)}">`).join('')}</datalist></label>
      </form>
      <div class="actions"><span class="spacer"></span><button class="btn danger" id="ok">Đưa vào Sổ đỏ</button></div>`);
    $('#ok', m.el).addEventListener('click', async () => {
      try {
        const r = await api('POST', '/api/customers/blacklist', formData($('#rf', m.el)));
        toast(`Đã đưa ${r.customer.phone} vào Sổ đỏ`);
        m.close();
        cusState.tab = 'red';
        route();
      } catch (e) { fail(e); }
    });
    $('[name=phone]', m.el).focus();
  }

  let t;
  $('#q').addEventListener('input', (e) => { cusState.q = e.target.value; clearTimeout(t); t = setTimeout(load, 300); });
  $('#ctabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    cusState.tab = b.dataset.tab;
    $$('#ctabs .tab').forEach((x) => x.classList.toggle('on', x === b));
    $('#tbl').innerHTML = '<div class="loading">Đang tải…</div>';
    $('#sus').innerHTML = '';
    load().catch(fail);
  });
  $('#addRed').addEventListener('click', () => addRedForm());
  root.addEventListener('click', async (e) => {
    const rb = e.target.closest('[data-red]');
    if (rb) {
      e.stopPropagation();
      const id = Number(rb.dataset.red);
      if (!confirm('Đưa khách này vào Sổ đỏ?')) return;
      try { await api('PATCH', '/api/customers/' + id, { flag: 'bom' }); toast('Đã đưa vào Sổ đỏ'); load(); } catch (err) { fail(err); }
      return;
    }
    const tr = e.target.closest('tr[data-id]');
    if (tr && root.contains(tr)) openCustomer(Number(tr.dataset.id), load);
  });
  await load();
};

async function openCustomer(id, onDone) {
  const r = await api('GET', '/api/customers/' + id).catch(fail);
  if (!r) return;
  const c = r.customer;
  const m = modal(`Khách ${c.phone}`, `
    <form class="form" id="f">
      <label>Tên<input name="name" value="${esc(c.name)}"></label>
      <label>Đánh dấu<select name="flag"><option value="">—</option><option value="vip" ${c.flag === 'vip' ? 'selected' : ''}>VIP</option><option value="bom" ${c.flag === 'bom' ? 'selected' : ''}>Sổ đỏ (phá / bom hàng)</option></select></label>
      <label class="full">Địa chỉ<textarea name="address" rows="2">${esc(c.address)}</textarea></label>
      <label class="full">Ghi chú${c.flag === 'bom' ? ' (lý do vào sổ đỏ)' : ''}<textarea name="note" rows="2">${esc(c.note)}</textarea></label>
      ${c.flagged_at ? `<p class="full muted small" style="margin:0">Vào sổ đỏ lúc ${dt(c.flagged_at)}</p>` : ''}
    </form>
    <div class="actions"><button class="btn" id="save">Lưu</button></div>
    <h2>Đơn hàng (${r.orders.length})</h2>
    <ul class="timeline">${r.orders.map((o) => `<li><a href="#" data-open="${o.id}">${esc(o.code)}</a> · ${dt(o.created_at)} · ${o.qty} hộp · ${money(o.total)} ${badge(o.status)}${o.return_reason ? ` <span class="small">(${esc(o.return_reason)})</span>` : ''} <span class="muted small">${esc(o.page)}</span></li>`).join('')}</ul>`, { wide: true });
  $('#save', m.el).addEventListener('click', async () => {
    try { await api('PATCH', '/api/customers/' + id, formData($('#f', m.el))); toast('Đã lưu'); m.close(); onDone && onDone(); } catch (e) { fail(e); }
  });
  $$('[data-open]', m.el).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); m.close(); openOrder(Number(a.dataset.open)); }));
}

// ================================================================ THU CHI
const finState = { range: null };
VIEWS.finance = async (root) => {
  finState.range ||= makeRange('month');
  const rp = rangePicker(finState.range, () => load());
  const cats = (type) => (type === 'thu' ? S.settings.thu_categories : S.settings.chi_categories);
  const catOpts = (type, sel) => cats(type).map((c) => `<option ${c === sel ? 'selected' : ''}>${esc(c)}</option>`).join('');
  root.innerHTML = `
    <div class="toolbar page-title"><h1>Thu chi</h1><span class="spacer"></span>${rp.html}</div>
    <div class="card">
      <h2>Thêm khoản thu / chi</h2>
      <form class="addtx" id="add">
        <div class="fld"><span class="fld-l">Loại</span>${UI.seg('type', [['chi', 'Khoản chi'], ['thu', 'Khoản thu']], 'chi')}</div>
        <label class="fld">Ngày<input type="date" name="date" value="${S.today}"></label>
        <label class="fld">Danh mục<select name="category">${catOpts('chi')}</select></label>
        <label class="fld">Số tiền<input name="amount" placeholder="VD: 500k" inputmode="numeric" required></label>
        <label class="fld">Page quảng cáo<input name="page" placeholder="Bỏ trống nếu không phải QC" list="pl"><datalist id="pl">${S.pages.map((p) => `<option value="${esc(p)}">`).join('')}</datalist></label>
        <label class="fld grow">Ghi chú<input name="note" placeholder="Không bắt buộc"></label>
        <button class="btn">Thêm khoản</button>
      </form>
    </div>
    <div class="kpis" id="sum"></div>
    <div class="table-wrap" id="tbl"><div class="loading">Đang tải…</div></div>`;
  rp.bind(root);
  const add = $('#add');
  add.elements.type.addEventListener('change', (e) => { add.elements.category.innerHTML = catOpts(e.target.value); });
  add.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = formData(add);
    d.amount = OrderParser.parseMoney(d.amount);
    try {
      await api('POST', '/api/transactions', d);
      toast('Đã thêm');
      add.elements.amount.value = '';
      add.elements.note.value = '';
      add.elements.amount.focus();
      refreshPages();
      load();
    } catch (err) { fail(err); }
  });

  let rows = [];
  async function load() {
    const { from, to } = finState.range;
    const [t, rep] = await Promise.all([
      api('GET', `/api/transactions?from=${from}&to=${to}`),
      api('GET', `/api/report?from=${from}&to=${to}`),
    ]);
    rows = t.transactions;
    const thu = rows.filter((x) => x.type === 'thu').reduce((s, x) => s + x.amount, 0);
    const chi = rows.filter((x) => x.type === 'chi').reduce((s, x) => s + x.amount, 0);
    $('#sum').innerHTML = `
      <div class="kpi good"><div class="l">COD về trong kỳ</div><div class="v">${money(rep.cod_in.amount)}</div><div class="s">${rep.cod_in.count} đơn</div></div>
      <div class="kpi"><div class="l">COD chờ về</div><div class="v">${money(rep.cod_pending.amount)}</div><div class="s">${rep.cod_pending.count} đơn đã giao</div></div>
      <div class="kpi"><div class="l">Thu khác</div><div class="v">${money(thu)}</div></div>
      <div class="kpi bad"><div class="l">Tổng chi</div><div class="v">${money(chi)}</div><div class="s">${Object.entries(rep.chi_by_cat).map(([k, v]) => `${esc(k)}: ${money(v)}`).join(' · ')}</div></div>`;
    $('#tbl').innerHTML = rows.length ? `<table><thead><tr><th>Ngày</th><th>Loại</th><th>Danh mục</th><th class="right">Số tiền</th><th>Page</th><th>Ghi chú</th><th></th></tr></thead><tbody>
      ${rows.map((x) => `<tr><td class="nowrap">${dd(x.date)}/${x.date.slice(0, 4)}</td><td>${x.type === 'thu' ? '<span class="badge st-da_giao">Thu</span>' : '<span class="badge st-hoan">Chi</span>'}</td>
        <td>${esc(x.category)}</td><td class="right nowrap">${money(x.amount)}</td><td class="small">${esc(x.page)}</td><td class="small">${esc(x.note)}<div class="cell-sub">${esc(x.user)}</div></td>
        <td class="nowrap"><button class="btn sm sec" data-edit="${x.id}">Sửa</button> <button class="btn sm danger" data-del="${x.id}">Xóa</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Chưa có khoản nào trong kỳ</div>';
  }
  $('#tbl').addEventListener('click', async (e) => {
    const del = e.target.dataset.del;
    const edit = e.target.dataset.edit;
    if (del && confirm('Xóa khoản này?')) {
      try { await api('DELETE', '/api/transactions/' + del); toast('Đã xóa'); load(); } catch (err) { fail(err); }
    }
    if (edit) {
      const x = rows.find((r) => r.id === Number(edit));
      const m = modal('Sửa khoản thu chi', `<form class="form" id="f">
        <label>Ngày<input type="date" name="date" value="${x.date}"></label>
        <div class="fld"><span class="fld-l">Loại</span>${UI.seg('type', [['chi', 'Khoản chi'], ['thu', 'Khoản thu']], x.type)}</div>
        <label>Danh mục<select name="category">${catOpts(x.type, x.category)}${cats(x.type).includes(x.category) ? '' : `<option selected>${esc(x.category)}</option>`}</select></label>
        <label>Số tiền<input name="amount" value="${num(x.amount)}"></label>
        <label>Page<input name="page" value="${esc(x.page)}"></label>
        <label>Ghi chú<input name="note" value="${esc(x.note)}"></label></form>
        <div class="actions"><button class="btn" id="save">Lưu</button></div>`);
      const f = $('#f', m.el);
      f.elements.type.addEventListener('change', (ev) => { f.elements.category.innerHTML = catOpts(ev.target.value); });
      $('#save', m.el).addEventListener('click', async () => {
        const d = formData(f);
        d.amount = OrderParser.parseMoney(d.amount);
        try { await api('PATCH', '/api/transactions/' + x.id, d); toast('Đã lưu'); m.close(); load(); } catch (err) { fail(err); }
      });
    }
  });
  await load();
};

// ================================================================ CÀI ĐẶT
VIEWS.settings = async (root) => {
  const [u, sp] = await Promise.all([api('GET', '/api/users'), api('GET', '/api/kho')]);
  S.khos = sp.khos.map(({ waiting, shipped, ...w }) => w);
  const s = S.settings;
  const sample = { name: 'Bùi Thanh Tâm', phone: '0949047192', address: 'Xã Nghĩa Đàn, Nghệ An', qty: 2, total: 240000 };
  const sw = supplierSwitch(() => route());
  root.innerHTML = `
    <h1>Cài đặt</h1>
    <div class="grid2">
      <div class="card"><h2>Cửa hàng</h2>
        <form class="form" id="shop">
          <label class="full">Tên cửa hàng<input name="shop_name" value="${esc(s.shop_name)}"></label>
          <label>Giá vốn 1 hộp (để tính lãi)<input name="cost_per_unit" value="${num(s.cost_per_unit)}" inputmode="numeric"></label>
          <label>Kiểm tra trùng SĐT trong (ngày)<input name="dup_days" value="${s.dup_days}" inputmode="numeric"></label>
          <label class="full">Sản phẩm mặc định<input name="default_product" value="${esc(s.default_product)}"></label>
          <div class="full fld"><span class="fld-l">Các page Facebook của shop</span>${UI.tags('fb_pages', s.fb_pages || [], 'Nhập tên page, nhấn Enter (vd: Trứng Sâu Canxi Miền Bắc)')}
            <span class="hint" style="margin:4px 0 0">Extension dùng danh sách này để tự điền page cho từng đơn.</span></div>
          <div class="full fld"><span class="fld-l">Danh mục chi</span>${UI.tags('chi_categories', s.chi_categories, 'Thêm danh mục chi, nhấn Enter')}</div>
          <div class="full fld"><span class="fld-l">Danh mục thu</span>${UI.tags('thu_categories', s.thu_categories, 'Thêm danh mục thu, nhấn Enter')}</div>
          <div class="full fld"><span class="fld-l">Lý do hoàn (để chọn nhanh)</span>${UI.tags('return_reasons', s.return_reasons || [], 'Thêm lý do, nhấn Enter')}
            <span class="hint" style="margin:4px 0 0">Lý do <b>đầu tiên</b> được hiểu là "khách cố tình phá": chọn lý do này thì web gợi ý đưa SĐT vào Sổ đỏ.</span></div>
          <div class="full form-sep">Khi bấm "Chép" một đơn</div>
          <label>Ngăn cách các mục bằng<select name="copy_sep">
            ${[['pipe', 'Gạch đứng  |'], ['dash', 'Gạch ngang  -'], ['semi', 'Chấm phẩy  ;'], ['tab', 'Tab (dán vào Excel/Sheets thành từng cột)'], ['newline', 'Xuống dòng (mỗi mục 1 dòng)']]
              .map(([k, l]) => `<option value="${k}" ${s.copy_sep === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label>Ghi tên mục<select name="copy_labels"><option value="0" ${Number(s.copy_labels) !== 1 ? 'selected' : ''}>Không, chỉ chép giá trị</option><option value="1" ${Number(s.copy_labels) === 1 ? 'selected' : ''}>Có (Tên: …, SĐT: …)</option></select></label>
          <div class="full copy-preview"><span class="fld-l">Xem trước</span><pre id="cpv"></pre></div>
        </form>
        <div class="actions"><button class="btn" id="saveShop">Lưu cài đặt</button></div>
      </div>
      <div>
        <div class="card"><h2>Chrome extension (bắt đơn Ctrl+C)</h2>
          <p class="small">Trong phần Cài đặt của extension, nhập:</p>
          <form class="form"><label class="full">Địa chỉ web<input readonly value="${esc(location.origin)}"></label>
          <label class="full">Mã API<input readonly id="tok" placeholder="Bấm “Tạo mã mới”"></label></form>
          <div class="actions"><button class="btn sec" id="newTok">Tạo mã mới</button></div>
          <p class="muted small">Mã chỉ hiện 1 lần. Tạo mã mới thì mã cũ hết hiệu lực.</p>
        </div>
        <div class="card" id="metaCard"><h2>Messenger (thử nghiệm)</h2><div class="loading">Đang tải…</div></div>
        <div class="card"><h2>Sao lưu dữ liệu</h2>
          <p class="small">Server tự sao lưu mỗi ngày (giữ 30 bản) trong thư mục <code>data/backups</code>. Nên tải 1 bản về máy mỗi tuần.</p>
          <a class="btn sec" href="/api/backup">⬇ Tải bản sao lưu</a>
        </div>
        ${passwordCard()}
      </div>
    </div>
    <div class="card" id="supCard">
      <h2>Chia đơn cho kho</h2>
      <p class="hint" style="margin:-4px 0 16px">Mỗi tài khoản <b>Kho</b> là 1 bên có hàng thật (bạn tạo ở mục Tài khoản bên dưới rồi đưa cho họ).
        Họ đăng nhập, chép đơn, gửi hàng rồi bấm <b>Đã gửi</b>. Mỗi tài khoản kho <b>chỉ thấy đơn bạn chia cho họ</b>: không thấy đơn, tên, ghi chú, mã vận đơn của kho khác,
        không thấy fanpage, link chat, giá vốn. Đơn mới tự chia cho kho đang chọn. Khi kho đó hết hàng, đổi sang kho khác.</p>
      ${sp.khos.length ? `
      <div class="sup-bar">${sp.khos.length > 1 ? sw.html : ''}
        ${sp.unassigned ? `<a class="pill bad" href="#/orders" id="goUn">${sp.unassigned} đơn chờ gửi chưa chia cho kho nào</a>` : ''}</div>
      <div class="table-wrap flat"><table class="tbl"><thead><tr><th>Kho</th><th>Tên đăng nhập</th><th class="right">Chờ gửi</th><th class="right">Đang gửi</th><th></th></tr></thead><tbody>
        ${sp.khos.map((w) => `<tr class="${w.active ? '' : 'is-huy'}"><td class="strong nowrap">${esc(w.name)}
            ${Number(S.settings.active_kho) === w.id || (sp.khos.filter((x) => x.active).length === 1 && w.active && !Number(S.settings.active_kho)) ? ' <span class="badge st-da_giao">Đang nhận đơn mới</span>' : ''}${w.active ? '' : ' <span class="badge st-huy">Đã khóa</span>'}</td>
          <td class="mono">${esc(w.username)}</td><td class="right">${w.waiting}</td><td class="right">${w.shipped}</td>
          <td class="right nowrap">${w.waiting && sp.khos.length > 1 ? `<button class="btn sm sec" data-movesup="${w.id}">Chuyển ${w.waiting} đơn chờ gửi…</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>`
      : '<div class="empty sm">Chưa có tài khoản kho nào. Tạo tài khoản quyền <b>Kho</b> ở mục Tài khoản bên dưới cho từng bên có hàng.</div>'}
    </div>
    <div class="card"><h2>Tài khoản</h2>
      <div class="table-wrap" style="border:0"><table><thead><tr><th>Tên đăng nhập</th><th>Tên hiển thị</th><th>Quyền</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${u.users.map((x) => `<tr><td class="mono">${esc(x.username)}</td><td>${esc(x.display_name)}</td><td>${x.role === 'admin' ? 'Chủ shop' : 'Kho'}</td>
        <td>${x.active ? '<span class="badge st-da_giao">Hoạt động</span>' : '<span class="badge st-huy">Đã khóa</span>'}</td>
        <td class="nowrap">${x.id === S.user.id ? '<span class="muted small">(bạn)</span>' : `<button class="btn sm sec" data-pw="${x.id}">Đặt lại mật khẩu</button> <button class="btn sm ${x.active ? 'danger' : 'sec'}" data-active="${x.id}" data-v="${x.active ? 0 : 1}">${x.active ? 'Khóa' : 'Mở khóa'}</button> <button class="btn sm sec" data-deluser="${x.id}" data-name="${esc(x.display_name || x.username)}" title="Chỉ xóa được tài khoản chưa có đơn hay thao tác nào (tạo nhầm)">Xóa</button>`}</td></tr>`).join('')}
      </tbody></table></div>
      <h2 style="margin-top:14px">Thêm tài khoản</h2>
      <form class="toolbar" id="newUser" style="margin:0">
        <input name="username" placeholder="Tên đăng nhập (vd: kho)" autocapitalize="none" required>
        <input name="display_name" placeholder="Tên hiển thị (vd: Kho Phú Thọ)">
        <input name="password" placeholder="Mật khẩu (≥ 6 ký tự)" required>
        <select name="role"><option value="kho">Kho</option><option value="admin">Chủ shop</option></select>
        <button class="btn">+ Thêm</button>
      </form>
    </div>`;

  $('#saveShop').addEventListener('click', async () => {
    const d = formData($('#shop'));
    d.cost_per_unit = OrderParser.parseMoney(d.cost_per_unit);
    try {
      const r = await api('PUT', '/api/settings', d);
      S.settings = r.settings;
      $('#brand').textContent = S.settings.shop_name;
      await refreshPages();
      toast('Đã lưu cài đặt');
    } catch (e) { fail(e); }
  });
  const shop = $('#shop');
  const preview = () => {
    const d = formData(shop);
    $('#cpv').textContent = orderLine(sample, d) + '\n\nChép tất cả:\n' + ordersText([sample, { ...sample, name: 'Trần Thị Mai', phone: '0916012577', qty: 1, total: 130000 }], d);
  };
  preview();
  shop.addEventListener('change', preview);

  function moveForm(from) {
    const f = sp.khos.find((x) => x.id === from);
    const m = modal(`Chuyển đơn chờ gửi của ${f.name}`, `<form class="form" id="mvf">
        <p class="full" style="margin:0">${f.waiting} đơn <b>chờ gửi</b> của ${esc(f.name)} sẽ chuyển sang kho khác. Mã vận đơn, phí ship và ghi chú kho cũ đã nhập sẽ được xóa để kho mới không thấy. Đơn đã gửi giữ nguyên.</p>
        <label class="full">Chuyển sang<select name="to">${whOptions('', { noneLabel: '' }).replace(`<option value="${from}"`, `<option disabled value="${from}"`)}</select></label>
      </form>
      <div class="actions"><button class="btn sec" data-close>Hủy</button><button class="btn" id="mvGo">Chuyển ${f.waiting} đơn</button></div>`);
    $('#mvGo', m.el).addEventListener('click', async () => {
      const to = $('#mvf', m.el).elements.to.value;
      try {
        const r = await api('POST', '/api/kho/move', { from, to });
        toast(`Đã chuyển ${r.updated} đơn sang ${whName(Number(to))}`);
        m.close(); route();
      } catch (e) { fail(e); }
    });
  }
  sw.bind(root);
  $('#goUn')?.addEventListener('click', () => { ordState.kho = 'none'; ordState.status = 'moi'; });

  $('#newTok').addEventListener('click', async () => {
    if (!confirm('Tạo mã mới? Mã cũ (nếu có) sẽ hết hiệu lực.')) return;
    const r = await api('POST', '/api/me/api-token').catch(fail);
    if (r) { $('#tok').value = r.token; $('#tok').select(); copyText(r.token); }
  });
  $('#newUser').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('POST', '/api/users', formData(e.target)); toast('Đã tạo tài khoản'); route(); } catch (err) { fail(err); }
  });
  root.addEventListener('click', async (e) => {
    const mv = e.target.closest('[data-movesup]');
    if (mv) return moveForm(Number(mv.dataset.movesup));
    const pw = e.target.dataset.pw;
    const ac = e.target.dataset.active;
    const del = e.target.dataset.deluser;
    try {
      if (del) {
        if (!confirm(`Xóa hẳn tài khoản "${e.target.dataset.name}"? Không khôi phục được.`)) return;
        await api('DELETE', '/api/users/' + del);
        toast('Đã xóa tài khoản');
        route();
        return;
      }
      if (pw) {
        const p = prompt('Mật khẩu mới (≥ 6 ký tự):');
        if (!p) return;
        await api('PATCH', '/api/users/' + pw, { password: p });
        toast('Đã đặt lại mật khẩu');
      }
      if (ac) {
        await api('PATCH', '/api/users/' + ac, { active: e.target.dataset.v === '1' });
        route();
      }
    } catch (err) { fail(err); }
  });
  bindPassword(root);
  metaCard();
};

// Thẻ kiểm tra Messenger webhook: tin Meta gửi tới + nút gửi tin trả lời thử
async function metaCard() {
  const box = $('#metaCard');
  if (!box) return;
  const r = await api('GET', '/api/meta/events').catch((e) => ({ error: e.message }));
  if (!box.isConnected) return;
  if (r.error) { box.innerHTML = `<h2>Messenger (thử nghiệm)</h2><div class="warn">${esc(r.error)}</div>`; return; }
  const ok = (v, label) => `<span class="badge ${v ? 'st-da_giao' : 'st-huy'}">${v ? '✓' : '✗'} ${label}</span>`;
  const tp = r.token_page;
  const other = tp?.id ? (r.seen_pages || []).filter((p) => p.page_id !== tp.id) : [];
  const pageName = (id) => (tp?.id === id ? tp.name : id);
  const KIND = { message: 'Khách nhắn', echo: 'Page gửi', postback: 'Bấm nút', test: 'Tin mẫu (nút Thử nghiệm)', rejected: '⚠ Bị từ chối', other: '⚠ Lạ' };
  box.innerHTML = `<h2>Messenger (thử nghiệm)</h2>
    <p class="small" style="margin-top:0">Kiểm tra app Meta có nhận / trả lời được <b>khách thật</b> không. URL gọi lại dán vào Meta → Webhooks → Page:</p>
    <form class="form"><label class="full">URL gọi lại<input readonly value="${esc(r.webhook_url)}"></label></form>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0">${ok(r.status.verify_token, 'META_VERIFY_TOKEN')}${ok(r.status.app_secret, 'META_APP_SECRET')}${ok(r.status.page_token, 'META_PAGE_TOKEN')}</div>
    ${tp ? (tp.error ? `<div class="warn">META_PAGE_TOKEN không dùng được: ${esc(tp.error)}</div>`
      : `<p class="small" style="margin:4px 0">Mã page đang dùng là của: <b>${esc(tp.name)}</b> <span class="mono muted">(${esc(tp.id)})</span></p>`) : ''}
    ${other.length ? `<div class="warn soft">Có tin đến từ page khác với page của mã (${other.map((p) => `<span class="mono">${esc(p.page_id)}</span>: ${p.n} tin`).join(', ')}). Mã người nhắn chỉ dùng được với đúng page họ nhắn vào, nên "Trả lời thử" các tin đó sẽ báo lỗi (#100). Muốn thử page nào thì đặt META_PAGE_TOKEN của page đó.</div>` : ''}
    <div class="actions" style="margin-top:4px"><span class="muted small">${r.events.length ? `${r.events.length} tin gần nhất` : 'Chưa nhận được tin nào'}</span><span class="spacer"></span><button class="btn sec sm" id="metaReload">Tải lại</button></div>
    ${r.events.length ? `<div class="table-wrap" style="max-height:320px;overflow:auto"><table><thead><tr><th>Lúc</th><th>Page</th><th>Loại</th><th>Người</th><th>Nội dung</th><th></th></tr></thead><tbody>
      ${r.events.map((e) => `<tr><td class="small nowrap">${dt(e.at)}</td><td class="small${tp?.id && e.page_id && e.page_id !== tp.id ? ' neg' : ''}">${esc(pageName(e.page_id))}</td><td class="small">${KIND[e.kind] || e.kind}</td><td class="mono small">${esc(e.sender_id)}</td>
        <td class="small${e.kind === 'rejected' || e.kind === 'other' ? ' neg' : ''}">${esc(e.text)}</td><td>${e.kind === 'message' && (!tp?.id || e.page_id === tp.id) ? `<button class="btn sm sec" data-reply="${esc(e.sender_id)}">Trả lời thử</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : ''}`;
  $('#metaReload', box).addEventListener('click', () => metaCard());
  if (box.dataset.bound) return; // thẻ được vẽ lại nhiều lần, chỉ gắn sự kiện 1 lần
  box.dataset.bound = '1';
  box.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-reply]');
    if (!b) return;
    const text = prompt('Nội dung gửi thử cho người này:', 'Shop đã nhận được tin nhắn của bạn ạ (tin tự động thử nghiệm).');
    if (!text) return;
    b.disabled = true;
    try { await api('POST', '/api/meta/test-reply', { sender_id: b.dataset.reply, text }); toast('Đã gửi. Người đó nhận được là app trả lời được khách này.'); setTimeout(metaCard, 1500); }
    catch (err) { fail(err); b.disabled = false; }
  });
}

function passwordCard() {
  return `<div class="card"><h2>Đổi mật khẩu của bạn</h2>
    <form class="form" id="pwForm">
      <label class="full">Mật khẩu hiện tại<input type="password" name="old_password" autocomplete="current-password" required></label>
      <label class="full">Mật khẩu mới<input type="password" name="new_password" autocomplete="new-password" required></label>
    </form>
    <div class="actions"><button class="btn sec" id="pwSave">Đổi mật khẩu</button></div></div>`;
}
function bindPassword(root) {
  $('#pwSave', root).addEventListener('click', async () => {
    try {
      await api('POST', '/api/me/password', formData($('#pwForm', root)));
      toast('Đã đổi mật khẩu');
      $('#pwForm', root).reset();
    } catch (e) { fail(e); }
  });
}

VIEWS.account = async (root) => {
  root.innerHTML = `<h1>Tài khoản</h1><div style="max-width:460px">${passwordCard()}</div>`;
  bindPassword(root);
};

boot();
