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
const S = { user: null, settings: {}, pages: [], statuses: {}, today: '' };

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

function toast(msg, err = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), err ? 5000 : 2500);
}
const fail = (e) => toast(e.message || String(e), true);

async function copyText(text) {
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
  toast('Đã copy');
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
const flagBadge = (f) => (f === 'bom' ? '<span class="badge b-bom">BOM HÀNG</span>' : f === 'vip' ? '<span class="badge b-vip">VIP</span>' : '');
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
  const html = `<span class="range">
    <select data-r="preset">${Object.entries(PRESETS).map(([k, [l]]) => `<option value="${k}" ${state.preset === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <input type="date" data-r="from" value="${state.from}"> – <input type="date" data-r="to" value="${state.to}">
  </span>`;
  const bind = (root) => {
    $('[data-r=preset]', root).addEventListener('change', (e) => {
      state.preset = e.target.value;
      if (PRESETS[state.preset][1]) [state.from, state.to] = PRESETS[state.preset][1]();
      $('[data-r=from]', root).value = state.from;
      $('[data-r=to]', root).value = state.to;
      onChange();
    });
    for (const k of ['from', 'to']) {
      $(`[data-r=${k}]`, root).addEventListener('change', (e) => {
        state[k] = e.target.value;
        state.preset = 'custom';
        $('[data-r=preset]', root).value = 'custom';
        onChange();
      });
    }
  };
  return { html, bind };
}
function makeRange(preset) {
  const [from, to] = PRESETS[preset][1]();
  return { preset, from, to };
}

// ================================================================ đăng nhập
function showLogin() {
  $('#top').hidden = true;
  $('#app').innerHTML = `<form class="login" id="loginForm">
    <h1>🧾 Quản lý đơn</h1>
    <label>Tên đăng nhập</label><input name="username" autocomplete="username" autocapitalize="none" required autofocus>
    <label>Mật khẩu</label><input name="password" type="password" autocomplete="current-password" required>
    <button class="btn">Đăng nhập</button>
    <p class="warn" id="loginErr" hidden></p>
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
  admin: [['dashboard', 'Tổng quan'], ['orders', 'Đơn hàng'], ['kho', 'Kho gửi hàng'], ['customers', 'Khách hàng'], ['finance', 'Thu chi'], ['settings', 'Cài đặt']],
  kho: [['kho', 'Gửi hàng'], ['account', 'Tài khoản']],
};
const VIEWS = {};
let viewTimer = null;

function route() {
  if (!S.user) return;
  const items = NAV[S.user.role];
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
    Object.assign(S, { user: b.user, settings: b.settings, pages: b.pages, statuses: b.statuses, today: b.today });
  } catch {
    return; // showLogin đã được gọi
  }
  $('#top').hidden = false;
  $('#brand').textContent = S.settings.shop_name || 'Quản lý đơn';
  document.title = S.settings.shop_name || 'Quản lý đơn';
  $('#meName').textContent = S.user.display_name || S.user.username;
  $('#nav').innerHTML = NAV[S.user.role].map(([k, l]) => `<a href="#/${k}" data-v="${k}">${l}</a>`).join('');
  route();
}

async function refreshPages() {
  if (S.user.role !== 'admin') return;
  const b = await api('GET', '/api/bootstrap');
  S.pages = b.pages;
}

// ================================================================ TỔNG QUAN
const dashState = { range: null };
VIEWS.dashboard = async (root) => {
  dashState.range ||= makeRange('d7');
  const rp = rangePicker(dashState.range, () => VIEWS.dashboard(root).catch(fail));
  const r = await api('GET', `/api/report?from=${dashState.range.from}&to=${dashState.range.to}`);
  const kpi = (l, v, s = '', cls = '') => `<div class="kpi ${cls}"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
  root.innerHTML = `
    <div class="toolbar"><h1 style="margin:0">Tổng quan</h1><span class="spacer"></span>${rp.html}</div>
    <div class="kpis">
      ${kpi('Đơn hàng', num(r.orders), `${num(r.qty)} hộp · ${r.cancelled} hủy`)}
      ${kpi('Doanh thu', money(r.revenue), `Đã giao: ${money(r.delivered)}`)}
      ${kpi('Chi quảng cáo', money(r.ads), `${money(r.cost_per_order)} / đơn`)}
      ${kpi('Lãi ước tính', money(r.profit), r.cost_per_unit ? `giá vốn ${money(r.cost_per_unit)}/hộp` : '⚠️ chưa nhập giá vốn (Cài đặt)', r.profit >= 0 ? 'good' : 'bad')}
      ${kpi('Tỷ lệ hoàn', pct(r.return_rate), `${r.by_status.hoan || 0} hoàn / ${(r.by_status.hoan || 0) + (r.by_status.da_giao || 0)} đã xong`, r.return_rate > 0.15 ? 'bad' : '')}
      ${kpi('COD chờ về', money(r.cod_pending.amount), `${r.cod_pending.count} đơn đã giao chưa nhận tiền`)}
      ${kpi('Đang chờ gửi', num(r.waiting), 'đơn kho chưa gửi', r.waiting ? '' : 'good')}
      ${kpi('Phí ship', money(r.ship), `COD về trong kỳ: ${money(r.cod_in.amount)}`)}
    </div>
    <div class="card chart"><h2>Theo ngày</h2>${barChart(r.by_day)}
      <div class="legend"><span><i style="background:var(--brand)"></i>Doanh thu</span><span><i style="background:#e8a33d"></i>Chi quảng cáo</span></div></div>
    <div class="grid2">
      <div class="card"><h2>Theo page</h2>
        <div class="table-wrap" style="border:0"><table><thead><tr><th>Page</th><th class="right">Đơn</th><th class="right">Hộp</th><th class="right">Doanh thu</th><th class="right">Chi QC</th><th class="right">QC/đơn</th><th class="right">Hoàn</th></tr></thead>
        <tbody>${r.by_page.map((p) => `<tr><td>${esc(p.page)}</td><td class="right">${p.orders}</td><td class="right">${p.qty}</td><td class="right">${money(p.revenue)}</td><td class="right">${money(p.ads)}</td><td class="right">${money(p.cpo)}</td><td class="right">${p.returns}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Chưa có dữ liệu</td></tr>'}</tbody></table></div>
      </div>
      <div class="card"><h2>Chi phí theo danh mục</h2>
        <table><tbody>
          <tr><td>Giá vốn hàng (ước tính)</td><td class="right">${money(r.cogs)}</td></tr>
          <tr><td>Phí ship</td><td class="right">${money(r.ship)}</td></tr>
          ${Object.entries(r.chi_by_cat).map(([k, v]) => `<tr><td>${esc(k)}${k === 'Nhập hàng' ? ' <span class="muted small">(không trừ vào lãi)</span>' : ''}</td><td class="right">${money(v)}</td></tr>`).join('')}
          ${r.other_thu ? `<tr><td>Thu khác</td><td class="right">+${money(r.other_thu)}</td></tr>` : ''}
        </tbody></table>
        <p class="muted small">Lãi ước tính = Doanh thu − Giá vốn − Ship − Quảng cáo − Chi khác (+ Thu khác). Đơn hủy/hoàn không tính doanh thu.</p>
      </div>
    </div>`;
  rp.bind(root);
};

function barChart(days) {
  if (!days.length) return '<div class="empty">Chưa có dữ liệu</div>';
  const W = 900, H = 220, pad = 28;
  const max = Math.max(1, ...days.map((d) => Math.max(d.revenue, d.ads)));
  const bw = (W - pad) / days.length;
  const every = Math.ceil(days.length / 15);
  let s = '';
  days.forEach((d, i) => {
    const x = pad + i * bw;
    const h1 = (d.revenue / max) * (H - 30);
    const h2 = (d.ads / max) * (H - 30);
    const w = Math.max(2, bw * 0.38);
    s += `<rect class="bar" x="${x + bw * 0.1}" y="${H - 18 - h1}" width="${w}" height="${h1}"><title>${dd(d.date)}: ${d.orders} đơn, ${money(d.revenue)}</title></rect>`;
    s += `<rect class="bar ads" x="${x + bw * 0.1 + w + 1}" y="${H - 18 - h2}" width="${w}" height="${h2}"><title>${dd(d.date)}: QC ${money(d.ads)}</title></rect>`;
    if (i % every === 0) s += `<text x="${x + bw / 2}" y="${H - 4}" text-anchor="middle">${dd(d.date)}</text>`;
  });
  const short = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'tr' : Math.round(n / 1000) + 'k');
  s += `<text x="0" y="12">${short(max)}</text><line x1="${pad}" x2="${W}" y1="${H - 18}" y2="${H - 18}" stroke="#ddd"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${s}</svg>`;
}

// ================================================================ ĐƠN HÀNG
const ordState = { range: null, q: '', status: '', page: '', dup: false, selected: new Set() };
VIEWS.orders = async (root) => {
  ordState.range ||= makeRange('d7');
  const rp = rangePicker(ordState.range, () => load());
  root.innerHTML = `
    <div class="toolbar">
      <h1 style="margin:0">Đơn hàng</h1><span class="spacer"></span>
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
      <label class="nowrap"><input type="checkbox" id="dup" ${ordState.dup ? 'checked' : ''}> Chỉ đơn trùng</label>
    </div>
    <div id="bulk"></div>
    <div id="sum" class="muted small" style="margin-bottom:8px"></div>
    <div class="table-wrap" id="tbl"><div class="loading">Đang tải…</div></div>`;
  rp.bind(root);

  let t;
  $('#q').addEventListener('input', (e) => { ordState.q = e.target.value; clearTimeout(t); t = setTimeout(load, 300); });
  $('#st').addEventListener('change', (e) => { ordState.status = e.target.value; load(); });
  $('#pg').addEventListener('change', (e) => { ordState.page = e.target.value; load(); });
  $('#dup').addEventListener('change', (e) => { ordState.dup = e.target.checked; load(); });
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
      <th class="right">SL</th><th class="right">Tiền</th><th>Page</th><th>Trạng thái</th><th>Vận đơn</th></tr></thead><tbody>
      ${rows.map((o) => `<tr class="click ${o.dup_codes ? 'is-dup' : ''} ${o.status === 'huy' ? 'is-huy' : ''}" data-id="${o.id}">
        <td><input type="checkbox" data-sel="${o.id}" ${ordState.selected.has(o.id) ? 'checked' : ''}></td>
        <td class="nowrap"><b class="mono">${esc(o.code)}</b><div class="cell-sub">${dt(o.created_at)}</div></td>
        <td>${esc(o.name)}<div class="cell-sub mono">${esc(o.phone)}</div></td>
        <td class="addr">${esc(o.address)}${o.note ? `<div class="cell-sub">📝 ${esc(o.note)}</div>` : ''}</td>
        <td class="right">${o.qty}</td>
        <td class="right nowrap">${money(o.total)}${o.cod_received ? '<div><span class="badge b-cod">COD về</span></div>' : ''}</td>
        <td class="small">${esc(o.page)}</td>
        <td>${badge(o.status)}${o.dup_codes ? `<div><span class="badge b-dup" title="Trùng: ${esc(o.dup_codes)}">TRÙNG</span></div>` : ''}</td>
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
      <button class="btn sm" id="bCod">💰 Đánh dấu COD đã về</button>
      <button class="btn sm sec" id="bCopy">📋 Copy</button>
      <span class="spacer"></span><button class="link" id="bClear">Bỏ chọn</button></div>`;
    const ids = [...ordState.selected];
    $('#bSt').addEventListener('change', async (e) => {
      if (!e.target.value) return;
      const r = await api('POST', '/api/orders/bulk', { ids, status: e.target.value }).catch(fail);
      if (r) { toast(`Đã cập nhật ${r.updated} đơn`); ordState.selected.clear(); load(); }
    });
    $('#bCod').addEventListener('click', async () => {
      const r = await api('POST', '/api/orders/bulk', { ids, cod_received: true }).catch(fail);
      if (r) { toast(`Đã đánh dấu COD ${r.updated} đơn`); ordState.selected.clear(); load(); }
    });
    $('#bCopy').addEventListener('click', () => copyText(ordersText(rows.filter((o) => ordState.selected.has(o.id)))));
    $('#bClear').addEventListener('click', () => { ordState.selected.clear(); render(); });
  }

  await load();
};

function orderLine(o) {
  return `${o.name} — ${o.phone}\n📍 ${o.address}\n🛒 ${o.qty || '?'} hộp — thu ${money(o.total)}${o.note ? ' — ' + o.note : ''}`;
}
function ordersText(list) {
  const qty = list.reduce((s, o) => s + (Number(o.qty) || 0), 0);
  const tot = list.reduce((s, o) => s + (Number(o.total) || 0), 0);
  return list.map((o, i) => `${i + 1}) ${o.code}\n${orderLine(o)}`).join('\n\n') + `\n\nTổng: ${list.length} đơn · ${qty} hộp · ${money(tot)}`;
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

function orderForm(prefill, onDone) {
  const m = modal('Tạo đơn mới', `
    <label class="small muted" style="font-weight:600">Dán tin nhắn chốt đơn (tự điền các ô bên dưới)</label>
    <textarea id="paste" rows="4" placeholder="Dán tin nhắn xác nhận đơn vào đây…" style="margin:4px 0 12px"></textarea>
    <div id="dupBox"></div>
    <form class="form" id="f">${orderFields(prefill || {})}</form>
    <div class="actions"><button class="btn sec" data-close>Hủy</button><button class="btn" id="save">Lưu đơn</button></div>`);
  const f = $('#f', m.el);
  const set = (k, v) => { if (v !== '' && v != null && v !== 0) f.elements[k].value = v; };
  $('#paste', m.el).addEventListener('input', (e) => {
    const p = OrderParser.parse(e.target.value);
    set('name', p.name); set('phone', p.phone); set('address', p.address); set('product', p.product);
    set('qty', p.qty); set('total', p.total ? num(p.total) : ''); set('note', p.note);
    checkDup();
  });
  async function checkDup() {
    const phone = OrderParser.normalizePhone(f.elements.phone.value);
    const box = $('#dupBox', m.el);
    if (phone.length !== 10) { box.innerHTML = ''; return; }
    const r = await api('GET', '/api/orders/check?phone=' + phone).catch(() => null);
    if (!r) return;
    let html = '';
    if (r.customer?.flag === 'bom') html += `<div class="warn">🚫 <b>Khách này từng BOM HÀNG.</b> ${esc(r.customer.note)}</div>`;
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
    ${r.customer?.flag === 'bom' ? `<div class="warn">🚫 Khách từng BOM HÀNG. ${esc(r.customer.note)}</div>` : ''}
    ${o.dup_codes ? `<div class="warn">⚠️ Trùng với: ${esc(o.dup_codes)}</div>` : ''}
    <div class="cols">
      <div>
        <form class="form" id="f">
          ${admin ? orderFields(o) : `<div class="full"><b>${esc(o.name)}</b> · ${esc(o.phone)}<div>${esc(o.address)}</div><div>${o.qty} hộp · ${money(o.total)}</div></div>`}
          <label>Trạng thái<select name="status">${stOpts}</select></label>
          <label>Mã vận đơn<input name="tracking_code" value="${esc(o.tracking_code)}"></label>
          <label>Phí ship<input name="ship_fee" value="${o.ship_fee ? num(o.ship_fee) : ''}" inputmode="numeric"></label>
          <label>Ghi chú kho<input name="kho_note" value="${esc(o.kho_note)}"></label>
          ${admin ? `<label class="check full"><input type="checkbox" name="cod_received" ${o.cod_received ? 'checked' : ''}> COD đã về${o.cod_at ? ` <span class="muted small">(${dt(o.cod_at)})</span>` : ''}</label>` : ''}
        </form>
        <div class="actions">
          ${admin ? '<button class="btn danger" id="del">Xóa đơn</button><span class="spacer"></span>' : ''}
          <button class="btn sec" id="copy">📋 Copy</button>
          ${o.link ? `<a class="btn sec" href="${esc(o.link)}" target="_blank" rel="noopener">💬 Mở chat</a>` : ''}
          <button class="btn" id="save">Lưu</button>
        </div>
      </div>
      <div>
        <h2>Lịch sử đơn</h2>
        <ul class="timeline">${r.events.map((e) => `<li><span class="muted small">${dt(e.at)} · ${esc(e.user)}</span><br>${esc(e.action)}</li>`).join('')}</ul>
        <h2 style="margin-top:14px">Đơn khác của khách (${r.history.length})</h2>
        <ul class="timeline">${r.history.map((h) => `<li><a href="#" data-open="${h.id}">${esc(h.code)}</a> · ${dt(h.created_at)} · ${h.qty} hộp · ${money(h.total)} ${badge(h.status)}</li>`).join('') || '<li class="muted">Chưa có</li>'}</ul>
      </div>
    </div>`, { wide: true });

  $('#save', m.el).addEventListener('click', async () => {
    const d = formData($('#f', m.el));
    d.ship_fee = OrderParser.parseMoney(d.ship_fee);
    if ('total' in d) d.total = OrderParser.parseMoney(d.total);
    try {
      await api('PATCH', '/api/orders/' + id, d);
      toast('Đã lưu');
      m.close();
      onDone && onDone();
    } catch (e) { fail(e); }
  });
  $('#copy', m.el).addEventListener('click', () => copyText(orderLine(o)));
  $('#del', m.el)?.addEventListener('click', async () => {
    if (!confirm(`Xóa hẳn đơn ${o.code}? Không khôi phục được. (Nên dùng trạng thái "Hủy" thay vì xóa)`)) return;
    try { await api('DELETE', '/api/orders/' + id); toast('Đã xóa'); m.close(); onDone && onDone(); } catch (e) { fail(e); }
  });
  $$('[data-open]', m.el).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); m.close(); openOrder(Number(a.dataset.open), onDone); }));
}

// ================================================================ KHO
const khoState = { tab: 'moi' };
VIEWS.kho = async (root) => {
  const TABS = { moi: 'Chờ gửi', da_gui: 'Đã gửi', xong: 'Đã giao / Hoàn' };
  root.innerHTML = `
    <div class="toolbar no-print">
      <div class="tabs" id="tabs" style="margin:0"></div><span class="spacer"></span>
      <button class="btn sec sm" id="copyAll">📋 Copy tất cả</button>
      <button class="btn sec sm" id="print">🖨 In</button>
      <button class="btn sec sm" id="reload">↻</button>
    </div>
    <input id="kq" placeholder="Tìm tên, SĐT, mã đơn…" style="width:100%;margin-bottom:12px" class="no-print">
    <div class="kho-list" id="list"><div class="loading">Đang tải…</div></div>`;
  let lists = {};

  async function load() {
    const since = addDays(S.today, -14);
    const [a, b, c] = await Promise.all([
      api('GET', '/api/orders?status=moi&sort=asc&limit=1000'),
      api('GET', `/api/orders?status=da_gui&from=${since}&limit=500`),
      api('GET', `/api/orders?status=da_giao,hoan&from=${addDays(S.today, -3)}&limit=300`),
    ]);
    lists = { moi: a.orders, da_gui: b.orders, xong: c.orders };
    render();
  }

  function render() {
    $('#tabs').innerHTML = Object.entries(TABS).map(([k, v]) =>
      `<button class="tab ${khoState.tab === k ? 'on' : ''}" data-tab="${k}">${v}<span class="n">${lists[k]?.length ?? 0}</span></button>`).join('');
    const q = $('#kq').value.trim().toLowerCase();
    const rows = (lists[khoState.tab] || []).filter((o) => !q || [o.code, o.name, o.phone, o.address, o.tracking_code].join(' ').toLowerCase().includes(q));
    $('#list').innerHTML = rows.length ? rows.map(card).join('') : `<div class="empty">${khoState.tab === 'moi' ? '🎉 Không còn đơn nào chờ gửi' : 'Không có đơn'}</div>`;
  }

  function card(o) {
    const act = o.status === 'moi'
      ? `<div class="act">
          <input placeholder="Mã vận đơn VTP" data-f="tracking_code" value="${esc(o.tracking_code)}">
          <input placeholder="Phí ship" data-f="ship_fee" inputmode="numeric" value="${o.ship_fee ? num(o.ship_fee) : ''}">
          <button class="btn big" data-act="da_gui">✓ Đã gửi</button></div>`
      : o.status === 'da_gui'
        ? `<div class="act" style="grid-template-columns:1fr 1fr"><button class="btn sec" data-act="da_giao" style="grid-column:auto">✓ Đã giao</button><button class="btn danger" data-act="hoan" style="grid-column:auto">↩ Hoàn</button></div>`
        : '';
    return `<div class="kcard ${o.dup_codes ? 'dup' : ''}" data-id="${o.id}">
      <div class="h"><b class="mono">${esc(o.code)}</b><span>${dt(o.created_at)}</span><span class="spacer"></span>${o.dup_codes ? '<span class="badge b-dup">TRÙNG</span>' : ''}${badge(o.status)}</div>
      <div class="row"><div class="t name">${esc(o.name)}</div><button class="copy" data-copy="${esc(o.name)}">copy</button></div>
      <div class="row"><div class="t mono" style="font-size:15px">${esc(o.phone)}</div><button class="copy" data-copy="${esc(o.phone)}">copy</button></div>
      <div class="row"><div class="t">📍 ${esc(o.address)}</div><button class="copy" data-copy="${esc(o.address)}">copy</button></div>
      <div class="row"><div class="t">🛒 <b>${o.qty} hộp</b> · ${esc(o.product)}</div></div>
      <div class="row"><div class="t cod">Thu COD: ${money(o.total)}</div><button class="copy" data-copy="${o.total}">copy</button></div>
      ${o.note ? `<div class="note">📝 ${esc(o.note)}</div>` : ''}
      ${o.kho_note ? `<div class="note">📦 ${esc(o.kho_note)}</div>` : ''}
      ${o.tracking_code && o.status !== 'moi' ? `<div class="row"><div class="t small">Vận đơn: <b class="mono">${esc(o.tracking_code)}</b>${o.ship_fee ? ' · ship ' + money(o.ship_fee) : ''}</div><button class="copy" data-copy="${esc(o.tracking_code)}">copy</button></div>` : ''}
      <div class="row no-print"><button class="copy" data-copyall="${o.id}">📋 Copy cả đơn</button><button class="copy" data-detail="${o.id}">Chi tiết</button></div>
      ${act}
    </div>`;
  }

  root.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.dataset.tab) { khoState.tab = t.closest('[data-tab]').dataset.tab; render(); return; }
    const tabBtn = t.closest('[data-tab]');
    if (tabBtn) { khoState.tab = tabBtn.dataset.tab; render(); return; }
    if (t.dataset.copy != null) return copyText(t.dataset.copy);
    const all = [...lists.moi, ...lists.da_gui, ...lists.xong];
    if (t.dataset.copyall) { const o = all.find((x) => x.id === Number(t.dataset.copyall)); return copyText(`${o.code}\n${orderLine(o)}`); }
    if (t.dataset.detail) return openOrder(Number(t.dataset.detail), load);
    const act = t.closest('[data-act]');
    if (act) {
      const c = act.closest('.kcard');
      const body = { status: act.dataset.act };
      for (const inp of $$('[data-f]', c)) body[inp.dataset.f] = inp.dataset.f === 'ship_fee' ? OrderParser.parseMoney(inp.value) : inp.value.trim();
      if (body.status === 'hoan' && !confirm('Xác nhận đơn bị HOÀN?')) return;
      act.disabled = true;
      try {
        await api('PATCH', '/api/orders/' + c.dataset.id, body);
        toast(`Đã chuyển sang "${S.statuses[body.status]}"`);
        await load();
      } catch (err) { fail(err); act.disabled = false; }
    }
  });
  $('#kq').addEventListener('input', render);
  $('#reload').addEventListener('click', () => load().catch(fail));
  $('#print').addEventListener('click', () => window.print());
  $('#copyAll').addEventListener('click', () => {
    const rows = lists[khoState.tab] || [];
    if (rows.length) copyText(ordersText(rows));
  });
  // tự làm mới mỗi 60 giây (khi không gõ dở)
  viewTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && !$$('[data-f]').some((i) => i.value && i === document.activeElement)) load().catch(() => {});
  }, 60e3);
  await load();
};

// ================================================================ KHÁCH HÀNG
const cusState = { q: '', flag: '' };
VIEWS.customers = async (root) => {
  root.innerHTML = `
    <div class="toolbar"><h1 style="margin:0">Khách hàng</h1><span class="spacer"></span></div>
    <div class="toolbar">
      <input class="grow" id="q" placeholder="Tìm tên, SĐT, địa chỉ…" value="${esc(cusState.q)}">
      <select id="flag"><option value="">Tất cả</option><option value="vip" ${cusState.flag === 'vip' ? 'selected' : ''}>VIP</option><option value="bom" ${cusState.flag === 'bom' ? 'selected' : ''}>Bom hàng</option></select>
    </div>
    <div class="table-wrap" id="tbl"><div class="loading">Đang tải…</div></div>`;
  async function load() {
    const r = await api('GET', `/api/customers?q=${encodeURIComponent(cusState.q)}&flag=${cusState.flag}`);
    $('#tbl').innerHTML = r.customers.length ? `<table><thead><tr><th>Khách</th><th>Địa chỉ</th><th class="right">Số đơn</th><th class="right">Đã mua</th><th class="right">Hoàn</th><th>Lần cuối</th></tr></thead><tbody>
      ${r.customers.map((c) => `<tr class="click" data-id="${c.id}"><td>${esc(c.name)} ${flagBadge(c.flag)}<div class="cell-sub mono">${esc(c.phone)}</div></td>
        <td class="addr">${esc(c.address)}</td><td class="right">${c.orders}</td><td class="right">${money(c.spent)}</td>
        <td class="right">${c.returns || ''}</td><td class="small">${dt(c.last_order)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Chưa có khách</div>';
  }
  let t;
  $('#q').addEventListener('input', (e) => { cusState.q = e.target.value; clearTimeout(t); t = setTimeout(load, 300); });
  $('#flag').addEventListener('change', (e) => { cusState.flag = e.target.value; load(); });
  $('#tbl').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) openCustomer(Number(tr.dataset.id), load); });
  await load();
};

async function openCustomer(id, onDone) {
  const r = await api('GET', '/api/customers/' + id).catch(fail);
  if (!r) return;
  const c = r.customer;
  const m = modal(`Khách ${c.phone}`, `
    <form class="form" id="f">
      <label>Tên<input name="name" value="${esc(c.name)}"></label>
      <label>Đánh dấu<select name="flag"><option value="">—</option><option value="vip" ${c.flag === 'vip' ? 'selected' : ''}>VIP</option><option value="bom" ${c.flag === 'bom' ? 'selected' : ''}>Bom hàng</option></select></label>
      <label class="full">Địa chỉ<textarea name="address" rows="2">${esc(c.address)}</textarea></label>
      <label class="full">Ghi chú<textarea name="note" rows="2">${esc(c.note)}</textarea></label>
    </form>
    <div class="actions"><button class="btn" id="save">Lưu</button></div>
    <h2>Đơn hàng (${r.orders.length})</h2>
    <ul class="timeline">${r.orders.map((o) => `<li><a href="#" data-open="${o.id}">${esc(o.code)}</a> · ${dt(o.created_at)} · ${o.qty} hộp · ${money(o.total)} ${badge(o.status)} <span class="muted small">${esc(o.page)}</span></li>`).join('')}</ul>`, { wide: true });
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
    <div class="toolbar"><h1 style="margin:0">Thu chi</h1><span class="spacer"></span>${rp.html}</div>
    <div class="card">
      <h2>Thêm khoản thu / chi</h2>
      <form class="toolbar" id="add" style="margin:0">
        <input type="date" name="date" value="${S.today}">
        <select name="type"><option value="chi">Chi</option><option value="thu">Thu</option></select>
        <select name="category">${catOpts('chi')}</select>
        <input name="amount" placeholder="Số tiền (vd 500k)" inputmode="numeric" style="width:150px" required>
        <input name="page" placeholder="Page (nếu là QC)" list="pl" style="width:150px"><datalist id="pl">${S.pages.map((p) => `<option value="${esc(p)}">`).join('')}</datalist>
        <input name="note" placeholder="Ghi chú" class="grow">
        <button class="btn">+ Thêm</button>
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
        <label>Loại<select name="type"><option value="chi" ${x.type === 'chi' ? 'selected' : ''}>Chi</option><option value="thu" ${x.type === 'thu' ? 'selected' : ''}>Thu</option></select></label>
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
  const u = await api('GET', '/api/users');
  const s = S.settings;
  root.innerHTML = `
    <h1>Cài đặt</h1>
    <div class="grid2">
      <div class="card"><h2>Cửa hàng</h2>
        <form class="form" id="shop">
          <label class="full">Tên cửa hàng<input name="shop_name" value="${esc(s.shop_name)}"></label>
          <label>Giá vốn 1 hộp (để tính lãi)<input name="cost_per_unit" value="${num(s.cost_per_unit)}" inputmode="numeric"></label>
          <label>Kiểm tra trùng SĐT trong (ngày)<input name="dup_days" value="${s.dup_days}" inputmode="numeric"></label>
          <label class="full">Sản phẩm mặc định<input name="default_product" value="${esc(s.default_product)}"></label>
          <label class="full">Danh mục CHI (mỗi dòng 1 mục)<textarea name="chi_categories" rows="4">${esc(s.chi_categories.join('\n'))}</textarea></label>
          <label class="full">Danh mục THU (mỗi dòng 1 mục)<textarea name="thu_categories" rows="2">${esc(s.thu_categories.join('\n'))}</textarea></label>
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
        <div class="card"><h2>Sao lưu dữ liệu</h2>
          <p class="small">Server tự sao lưu mỗi ngày (giữ 30 bản) trong thư mục <code>data/backups</code>. Nên tải 1 bản về máy mỗi tuần.</p>
          <a class="btn sec" href="/api/backup">⬇ Tải bản sao lưu</a>
        </div>
        ${passwordCard()}
      </div>
    </div>
    <div class="card"><h2>Tài khoản</h2>
      <div class="table-wrap" style="border:0"><table><thead><tr><th>Tên đăng nhập</th><th>Tên hiển thị</th><th>Quyền</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${u.users.map((x) => `<tr><td class="mono">${esc(x.username)}</td><td>${esc(x.display_name)}</td><td>${x.role === 'admin' ? 'Chủ shop' : 'Kho'}</td>
        <td>${x.active ? '<span class="badge st-da_giao">Hoạt động</span>' : '<span class="badge st-huy">Đã khóa</span>'}</td>
        <td class="nowrap">${x.id === S.user.id ? '<span class="muted small">(bạn)</span>' : `<button class="btn sm sec" data-pw="${x.id}">Đặt lại mật khẩu</button> <button class="btn sm ${x.active ? 'danger' : 'sec'}" data-active="${x.id}" data-v="${x.active ? 0 : 1}">${x.active ? 'Khóa' : 'Mở khóa'}</button>`}</td></tr>`).join('')}
      </tbody></table></div>
      <h2 style="margin-top:14px">Thêm tài khoản</h2>
      <form class="toolbar" id="newUser" style="margin:0">
        <input name="username" placeholder="Tên đăng nhập (vd: kho)" autocapitalize="none" required>
        <input name="display_name" placeholder="Tên hiển thị">
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
      toast('Đã lưu cài đặt');
    } catch (e) { fail(e); }
  });
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
    const pw = e.target.dataset.pw;
    const ac = e.target.dataset.active;
    try {
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
};

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
