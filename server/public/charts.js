// Biểu đồ SVG/HTML nhỏ gọn, không thư viện ngoài.
// Quy tắc: nét mảnh, lưới mờ, 1 trục y, rê chuột/chạm để xem số liệu, tự vẽ lại khi đổi kích thước.
/* global window, document, ResizeObserver */
const Charts = (() => {
  const COLORS = {
    revenue: '#2a78d6', ads: '#eb6834', profit: '#1baf7a',
    moi: '#eda100', da_gui: '#2a78d6', da_giao: '#1baf7a', hoan: '#e34948', huy: '#c3c2b7',
    cost: '#b8b6ae', loss: '#d03b3b',
  };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dec = (n) => n.toFixed(1).replace(/\.0$/, '').replace('.', ',');
  const short = (n) => {
    const a = Math.abs(n);
    if (a >= 1e9) return dec(n / 1e9) + ' tỷ';
    if (a >= 1e6) return dec(n / 1e6) + 'tr';
    if (a >= 1e3) return Math.round(n / 1e3) + 'k';
    return String(Math.round(n));
  };

  function niceTicks(min, max, count = 4, int = false) {
    if (max === min) max = min + 1;
    const raw = (max - min) / count;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const f = raw / mag;
    let step = (f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * mag;
    if (int) step = Math.max(1, Math.round(step));
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const out = [];
    for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
    return out;
  }

  // ---------- ô thông tin khi rê chuột ----------
  let tipEl = null;
  function tip(html, x, y) {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'chart-tip';
      tipEl.setAttribute('role', 'status');
      document.body.appendChild(tipEl);
    }
    if (html == null) { tipEl.hidden = true; return; }
    tipEl.hidden = false;
    tipEl.innerHTML = html;
    const r = tipEl.getBoundingClientRect();
    let left = x + 14;
    let top = y - r.height - 12;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
    if (left < 8) left = 8;
    if (top < 8) top = y + 18;
    tipEl.style.left = left + 'px';
    tipEl.style.top = top + 'px';
  }
  const tipRow = (color, name, value) =>
    `<div class="tr">${color ? `<i style="background:${color}"></i>` : ''}<span>${esc(name)}</span><b>${value}</b></div>`;

  // vẽ lại khi khung đổi chiều rộng
  function mount(el, draw) {
    let w = 0;
    const run = () => {
      const nw = Math.round(el.clientWidth);
      if (!nw || nw === w) return;
      w = nw;
      draw(nw);
    };
    run();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(run).observe(el);
  }

  // ---------- đường (nhiều chuỗi, cùng 1 trục) ----------
  // opts: { labels, titles?, series:[{name,color,values,area?}], fmt, valueFmt, height }
  function line(el, opts) {
    mount(el, (W) => {
      const { labels, series, fmt = short, valueFmt = fmt, height = 260 } = opts;
      const titles = opts.titles || labels;
      const H = height;
      const m = { t: 14, r: 14, b: 28, l: 46 };
      const n = labels.length;
      const all = series.flatMap((s) => s.values);
      const tk = niceTicks(Math.min(0, ...all), Math.max(0, ...all), 4);
      const min = tk[0], max = tk[tk.length - 1];
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const x = (i) => m.l + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
      const y = (v) => m.t + ih - ((v - min) / (max - min)) * ih;
      let s = `<svg width="${W}" height="${H}" class="chart-svg" aria-hidden="true">`;
      for (const v of tk) {
        s += `<line class="${v === 0 ? 'base' : 'grid'}" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/>`;
        s += `<text class="ax" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${fmt(v)}</text>`;
      }
      const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 70))));
      labels.forEach((l, i) => {
        if (i % every === 0) s += `<text class="ax" x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(l)}</text>`;
      });
      for (const se of series) {
        const pts = se.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
        if (se.area) s += `<polygon class="area" fill="${se.color}" points="${x(0)},${y(Math.max(min, 0))} ${pts} ${x(n - 1)},${y(Math.max(min, 0))}"/>`;
        s += `<polyline class="ln" stroke="${se.color}" points="${pts}"/>`;
      }
      s += `<line class="xh" y1="${m.t}" y2="${m.t + ih}" visibility="hidden"/>`;
      series.forEach((se, k) => { s += `<circle class="dot" data-k="${k}" r="4.5" fill="${se.color}" visibility="hidden"/>`; });
      s += `<rect x="${m.l - 10}" y="0" width="${iw + 20}" height="${H}" fill="transparent"/></svg>`;
      el.innerHTML = s;

      const svg = el.firstChild;
      const xh = svg.querySelector('.xh');
      const dots = svg.querySelectorAll('.dot');
      const show = (e) => {
        const b = svg.getBoundingClientRect();
        const i = Math.max(0, Math.min(n - 1, Math.round((e.clientX - b.left - m.l) / (n <= 1 ? 1 : iw / (n - 1)))));
        xh.setAttribute('x1', x(i)); xh.setAttribute('x2', x(i)); xh.setAttribute('visibility', 'visible');
        dots.forEach((d) => {
          d.setAttribute('cx', x(i)); d.setAttribute('cy', y(series[d.dataset.k].values[i])); d.setAttribute('visibility', 'visible');
        });
        tip(`<div class="tt">${esc(titles[i])}</div>` + series.map((se) => tipRow(se.color, se.name, valueFmt(se.values[i]))).join(''), e.clientX, e.clientY);
      };
      const hide = () => { xh.setAttribute('visibility', 'hidden'); dots.forEach((d) => d.setAttribute('visibility', 'hidden')); tip(null); };
      svg.addEventListener('pointermove', show);
      svg.addEventListener('pointerdown', show);
      svg.addEventListener('pointerleave', hide);
    });
  }

  // ---------- cột dọc (1 chuỗi) ----------
  // opts: { labels, titles?, values, color, name, fmt, valueFmt, height, mark?: index được tô đậm, every? }
  function bars(el, opts) {
    mount(el, (W) => {
      const { labels, values, color = COLORS.revenue, name = '', fmt = short, valueFmt = fmt, height = 220 } = opts;
      const titles = opts.titles || labels;
      const H = height;
      const m = { t: 12, r: 8, b: 26, l: 40 };
      const n = values.length;
      const tk = niceTicks(0, Math.max(1, ...values), 4, opts.int);
      const max = tk[tk.length - 1];
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const band = iw / Math.max(1, n);
      const bw = Math.max(2, Math.min(26, band * 0.62));
      const y = (v) => m.t + ih - (v / max) * ih;
      let s = `<svg width="${W}" height="${H}" class="chart-svg" aria-hidden="true">`;
      for (const v of tk) {
        s += `<line class="${v === 0 ? 'base' : 'grid'}" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/>`;
        s += `<text class="ax" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${fmt(v)}</text>`;
      }
      const every = opts.every || Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 44))));
      values.forEach((v, i) => {
        const cx = m.l + band * i + band / 2;
        const h = (v / max) * ih;
        const r = Math.min(4, bw / 2, h);
        const x0 = cx - bw / 2, y0 = m.t + ih - h, yb = m.t + ih;
        const op = opts.mark != null && opts.mark !== i ? ' style="opacity:.45"' : '';
        if (h > 0) s += `<path class="bar"${op} fill="${color}" d="M${x0},${yb}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + bw - r}Q${x0 + bw},${y0} ${x0 + bw},${y0 + r}V${yb}Z"/>`;
        s += `<rect class="hit" data-i="${i}" x="${m.l + band * i}" y="${m.t}" width="${band}" height="${ih}" fill="transparent"/>`;
        if (i % every === 0) s += `<text class="ax" x="${cx}" y="${H - 8}" text-anchor="middle">${esc(labels[i])}</text>`;
      });
      s += '</svg>';
      el.innerHTML = s;
      const svg = el.firstChild;
      const show = (e) => {
        const t = e.target.closest('.hit');
        if (!t) return tip(null);
        svg.querySelectorAll('.hit.on').forEach((h) => h.classList.remove('on'));
        t.classList.add('on');
        const i = Number(t.dataset.i);
        tip(`<div class="tt">${esc(titles[i])}</div>${tipRow(color, name, valueFmt(values[i]))}`, e.clientX, e.clientY);
      };
      svg.addEventListener('pointermove', show);
      svg.addEventListener('pointerdown', show);
      svg.addEventListener('pointerleave', () => { svg.querySelectorAll('.hit.on').forEach((h) => h.classList.remove('on')); tip(null); });
    });
  }

  // ---------- đường mini trong ô chỉ số ----------
  function spark(values, color) {
    const n = values.length;
    if (n < 2) return '';
    const W = 120, H = 36;
    const min = Math.min(...values), max = Math.max(...values);
    const span = max - min || 1;
    const pts = values.map((v, i) => `${((i * W) / (n - 1)).toFixed(1)},${(H - 3 - ((v - min) / span) * (H - 6)).toFixed(1)}`).join(' ');
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <polygon fill="${color}" opacity=".12" points="0,${H} ${pts} ${W},${H}"/>
      <polyline fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" points="${pts}"/></svg>`;
  }

  // ---------- thanh ngang xếp hạng (HTML) ----------
  // rows: [{label, value, sub?, color?}], fmt
  function hbars(rows, { fmt = short, color = COLORS.revenue, empty = 'Chưa có dữ liệu' } = {}) {
    if (!rows.length) return `<div class="empty sm">${empty}</div>`;
    const max = Math.max(1, ...rows.map((r) => r.value));
    return `<div class="hbars">${rows.map((r) => `
      <div class="hb" title="${esc(r.label)}: ${esc(fmt(r.value))}">
        <div class="hb-l">${esc(r.label)}${r.sub ? `<span>${esc(r.sub)}</span>` : ''}</div>
        <div class="hb-t"><div class="hb-b" style="width:${Math.max(1.5, (r.value / max) * 100)}%;background:${r.color || color}"></div></div>
        <div class="hb-v">${fmt(r.value)}</div>
      </div>`).join('')}</div>`;
  }

  // ---------- thanh phần trăm xếp chồng + chú thích (cơ cấu) ----------
  // parts: [{key,label,value,color}]
  function stack(parts, { fmt = String } = {}) {
    const total = parts.reduce((a, p) => a + p.value, 0);
    if (!total) return '<div class="empty sm">Chưa có đơn trong khoảng này</div>';
    const pc = (v) => (v / total) * 100;
    return `<div class="stack" role="img" aria-label="${esc(parts.map((p) => `${p.label} ${p.value}`).join(', '))}">
        ${parts.filter((p) => p.value).map((p) => `<div style="width:${pc(p.value)}%;background:${p.color}" title="${esc(p.label)}: ${p.value}"></div>`).join('')}
      </div>
      <ul class="legend-list">${parts.map((p) => `
        <li><i style="background:${p.color}"></i><span>${esc(p.label)}</span><b>${fmt(p.value)}</b><em>${p.value ? dec(pc(p.value)) + '%' : '–'}</em></li>`).join('')}
      </ul>`;
  }

  // ---------- thác nước: từ doanh thu tới lãi ----------
  // steps: [{label, value (âm = trừ), color, total?: true}]
  function waterfall(steps, { fmt = short } = {}) {
    let run = 0;
    const rows = steps.map((st) => {
      if (st.total) return { ...st, from: 0, to: st.value };
      const from = run;
      run += st.value;
      return { ...st, from, to: run };
    });
    const lo = Math.min(0, ...rows.map((r) => Math.min(r.from, r.to)));
    const hi = Math.max(1, ...rows.map((r) => Math.max(r.from, r.to)));
    const pos = (v) => ((v - lo) / (hi - lo)) * 100;
    return `<div class="wf">${rows.map((r, i) => {
      const a = pos(Math.min(r.from, r.to)), b = pos(Math.max(r.from, r.to));
      const sign = r.value < 0 ? '−' : r.total || i === 0 ? '' : '+';
      return `<div class="wf-r${r.total ? ' total' : ''}">
        <div class="wf-l">${esc(r.label)}</div>
        <div class="wf-t">${lo < 0 ? `<span class="wf-zero" style="left:${pos(0)}%"></span>` : ''}<div class="wf-b" style="left:${a}%;width:${Math.max(0.8, b - a)}%;background:${r.color}"></div></div>
        <div class="wf-v">${sign}${fmt(Math.abs(r.value))}</div>
      </div>`;
    }).join('')}</div>`;
  }

  return { COLORS, short, line, bars, spark, hbars, stack, waterfall, tip };
})();
window.Charts = Charts;
