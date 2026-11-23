/* Thành phần giao diện dùng chung:
   - Ô sổ xuống đẹp (tự áp cho mọi <select>), trên điện thoại hiện dạng bảng chọn từ dưới lên
   - Bộ chọn khoảng ngày (nút + bảng chọn mốc có sẵn / tùy chọn)
   - Nút gạt (segmented), ô nhập danh mục dạng thẻ, thông báo có nút Hoàn tác */
'use strict';
/* global document, window, MutationObserver */

const UI = (() => {
  const q = (s, el = document) => el.querySelector(s);
  const qa = (s, el = document) => [...el.querySelectorAll(s)];
  const e = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CHEV = '<svg class="dd-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  const CHECK = '<svg class="dd-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const CAL = '<svg class="rg-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></svg>';
  const isPhone = () => window.matchMedia('(max-width: 640px)').matches;

  // ---------------------------------------------------------------- bảng nổi dùng chung
  let pop = null, backdrop = null, popOwner = null, popClose = null;
  function closePop() {
    if (!pop) return;
    pop.remove(); backdrop?.remove();
    pop = backdrop = null;
    const o = popOwner; popOwner = null;
    o?.setAttribute('aria-expanded', 'false');
    popClose?.(); popClose = null;
  }
  function openPop(owner, html, { cls = '', onClose, minWidth } = {}) {
    closePop();
    popOwner = owner; popClose = onClose;
    owner.setAttribute('aria-expanded', 'true');
    pop = document.createElement('div');
    pop.className = 'pop ' + cls;
    pop.innerHTML = html;
    if (isPhone()) {
      backdrop = document.createElement('div');
      backdrop.className = 'pop-backdrop';
      backdrop.addEventListener('click', closePop);
      document.body.appendChild(backdrop);
      pop.classList.add('sheet');
      document.body.appendChild(pop);
    } else {
      document.body.appendChild(pop);
      const r = owner.getBoundingClientRect();
      pop.style.minWidth = Math.max(minWidth || 0, r.width) + 'px';
      const ph = pop.offsetHeight, pw = pop.offsetWidth;
      let top = r.bottom + 6;
      if (top + ph > window.innerHeight - 8 && r.top - ph - 6 > 8) top = r.top - ph - 6;
      let left = r.left;
      if (left + pw > window.innerWidth - 8) left = Math.max(8, r.right - pw);
      pop.style.top = top + 'px';
      pop.style.left = left + 'px';
    }
    return pop;
  }
  document.addEventListener('pointerdown', (ev) => {
    if (pop && !pop.contains(ev.target) && !popOwner?.contains(ev.target) && !backdrop) closePop();
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && pop) { const o = popOwner; closePop(); o?.focus(); } });
  window.addEventListener('resize', () => { if (pop && !pop.classList.contains('sheet')) closePop(); });
  window.addEventListener('scroll', (ev) => { if (pop && !pop.classList.contains('sheet') && !pop.contains(ev.target)) closePop(); }, true);

  // ---------------------------------------------------------------- ô sổ xuống
  function enhanceSelect(sel) {
    if (sel.dataset.enh || sel.multiple || sel.closest('.dd')) return;
    sel.dataset.enh = '1';
    const wrap = document.createElement('div');
    wrap.className = 'dd';
    if (sel.style.width) wrap.style.width = sel.style.width;
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    sel.tabIndex = -1;
    sel.setAttribute('aria-hidden', 'true');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dd-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    const label = sel.closest('label');
    if (label) btn.setAttribute('aria-label', (label.firstChild?.textContent || '').trim());
    wrap.appendChild(btn);
    const sync = () => {
      const o = sel.selectedOptions[0];
      btn.innerHTML = `<span class="dd-val">${e(o ? o.textContent : '')}</span>${CHEV}`;
      btn.disabled = sel.disabled;
    };
    sync();
    sel.addEventListener('change', sync);
    new MutationObserver(sync).observe(sel, { childList: true, subtree: true, attributes: true });
    // đổi .value bằng code cũng cập nhật nút
    const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    Object.defineProperty(sel, 'value', { get() { return desc.get.call(this); }, set(v) { desc.set.call(this, v); sync(); } });

    btn.addEventListener('click', () => {
      if (popOwner === btn) return closePop();
      const opts = [...sel.options];
      const title = btn.getAttribute('aria-label');
      const p = openPop(btn, `${title ? `<div class="pop-title">${e(title)}</div>` : ''}<div class="dd-list" role="listbox">${opts.map((o, i) =>
        `<button type="button" role="option" class="dd-opt${o.selected ? ' on' : ''}" data-i="${i}" aria-selected="${o.selected}" ${o.disabled ? 'disabled' : ''}><span>${e(o.textContent)}</span>${CHECK}</button>`).join('')}</div>`,
      { cls: 'dd-pop' });
      const list = qa('.dd-opt', p);
      (list.find((b) => b.classList.contains('on')) || list[0])?.focus({ preventScroll: false });
      p.addEventListener('click', (ev) => {
        const b = ev.target.closest('.dd-opt');
        if (!b) return;
        sel.selectedIndex = Number(b.dataset.i);
        sync();
        closePop();
        btn.focus();
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });
      p.addEventListener('keydown', (ev) => {
        const i = list.indexOf(document.activeElement);
        if (ev.key === 'ArrowDown') { ev.preventDefault(); list[Math.min(list.length - 1, i + 1)]?.focus(); }
        if (ev.key === 'ArrowUp') { ev.preventDefault(); list[Math.max(0, i - 1)]?.focus(); }
        if (ev.key === 'Tab') closePop();
      });
    });
    btn.addEventListener('keydown', (ev) => { if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); btn.click(); } });
  }
  function enhanceAll(root = document) { qa('select', root).forEach(enhanceSelect); }
  new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.tagName === 'SELECT') enhanceSelect(n); else enhanceAll(n); }
  }).observe(document.documentElement, { childList: true, subtree: true });

  // ---------------------------------------------------------------- nút gạt
  // seg('type', [['chi','Chi'],['thu','Thu']], 'chi') → có <input type=hidden name=type>
  function seg(name, items, value) {
    return `<div class="seg" role="radiogroup"><input type="hidden" name="${e(name)}" value="${e(value)}">${items.map(([v, l]) =>
      `<button type="button" role="radio" aria-checked="${v === value}" class="${v === value ? 'on' : ''}" data-seg="${e(v)}">${e(l)}</button>`).join('')}</div>`;
  }
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('.seg [data-seg]');
    if (!b) return;
    const g = b.closest('.seg');
    const inp = q('input[type=hidden]', g);
    if (inp.value === b.dataset.seg) return;
    inp.value = b.dataset.seg;
    qa('[data-seg]', g).forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // ---------------------------------------------------------------- ô danh mục dạng thẻ
  // giá trị lưu trong <textarea name hidden> mỗi dòng 1 mục → server không cần đổi
  function tags(name, values, placeholder = 'Thêm mục rồi nhấn Enter') {
    return `<div class="tags"><textarea name="${e(name)}" hidden>${e(values.join('\n'))}</textarea>
      ${values.map((v) => `<span class="tag" data-v="${e(v)}">${e(v)}<button type="button" class="tag-x" aria-label="Xóa ${e(v)}">×</button></span>`).join('')}
      <input class="tag-in" placeholder="${e(placeholder)}" enterkeyhint="done"></div>`;
  }
  function tagSync(box) {
    q('textarea', box).value = qa('.tag', box).map((t) => t.dataset.v).join('\n');
  }
  function tagAdd(box, raw) {
    const vals = qa('.tag', box).map((t) => t.dataset.v.toLowerCase());
    for (const v of raw.split(/[,\n]/).map((x) => x.trim()).filter(Boolean)) {
      if (vals.includes(v.toLowerCase())) continue;
      const t = document.createElement('span');
      t.className = 'tag'; t.dataset.v = v;
      t.innerHTML = `${e(v)}<button type="button" class="tag-x" aria-label="Xóa ${e(v)}">×</button>`;
      box.insertBefore(t, q('.tag-in', box));
      vals.push(v.toLowerCase());
    }
    tagSync(box);
  }
  document.addEventListener('click', (ev) => {
    const x = ev.target.closest('.tag-x');
    if (x) { const box = x.closest('.tags'); x.parentElement.remove(); tagSync(box); return; }
    const box = ev.target.closest('.tags');
    if (box && ev.target === box) q('.tag-in', box).focus();
  });
  document.addEventListener('keydown', (ev) => {
    const inp = ev.target.closest?.('.tag-in');
    if (!inp) return;
    const box = inp.closest('.tags');
    if ((ev.key === 'Enter' || ev.key === ',') && inp.value.trim()) { ev.preventDefault(); tagAdd(box, inp.value); inp.value = ''; }
    else if (ev.key === 'Enter') ev.preventDefault();
    else if (ev.key === 'Backspace' && !inp.value) { const last = qa('.tag', box).pop(); if (last) { last.remove(); tagSync(box); } }
  });
  document.addEventListener('focusout', (ev) => {
    const inp = ev.target.closest?.('.tag-in');
    if (inp && inp.value.trim()) { tagAdd(inp.closest('.tags'), inp.value); inp.value = ''; }
  });

  // ---------------------------------------------------------------- bộ chọn khoảng ngày
  // presets: { key: [label, () => [from, to]] }, custom = null
  function rangePicker(state, presets, onChange) {
    const fmt = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '');
    const short = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
    const label = () => {
      const p = presets[state.preset];
      const span = state.from === state.to ? fmt(state.from) : `${short(state.from)} – ${short(state.to)}${state.to.slice(0, 4) !== state.from.slice(0, 4) ? '' : '/' + state.to.slice(0, 4)}`;
      return state.preset !== 'custom' && p ? `<b>${e(p[0])}</b><span>${span}</span>` : `<b>${span}</b>`;
    };
    const html = `<button type="button" class="range-btn" data-range aria-haspopup="dialog" aria-expanded="false">${CAL}<span class="rg-text">${label()}</span>${CHEV}</button>`;
    const bind = (root) => {
      const btn = q('[data-range]', root);
      const refresh = () => { q('.rg-text', btn).innerHTML = label(); };
      btn.addEventListener('click', () => {
        if (popOwner === btn) return closePop();
        const p = openPop(btn, `<div class="pop-title">Khoảng thời gian</div>
          <div class="rg-list">${Object.entries(presets).filter(([, v]) => v[1]).map(([k, [l, fn]]) => {
            const [f, t] = fn();
            return `<button type="button" class="dd-opt${state.preset === k ? ' on' : ''}" data-p="${k}"><span>${e(l)}<small>${f === t ? fmt(f) : `${short(f)} – ${short(t)}`}</small></span>${CHECK}</button>`;
          }).join('')}</div>
          <div class="rg-custom">
            <div class="rg-custom-t">Tùy chọn</div>
            <div class="rg-dates"><label>Từ ngày<input type="date" data-rf value="${state.from}"></label><label>Đến ngày<input type="date" data-rt value="${state.to}"></label></div>
            <button type="button" class="btn sm" data-apply>Áp dụng</button>
          </div>`, { cls: 'range-pop', minWidth: 300 });
        p.addEventListener('click', (ev) => {
          const o = ev.target.closest('[data-p]');
          if (o) {
            state.preset = o.dataset.p;
            [state.from, state.to] = presets[state.preset][1]();
            closePop(); refresh(); onChange();
            return;
          }
          if (ev.target.closest('[data-apply]')) {
            let f = q('[data-rf]', p).value, t = q('[data-rt]', p).value;
            if (!f || !t) return;
            if (f > t) [f, t] = [t, f];
            Object.assign(state, { preset: 'custom', from: f, to: t });
            closePop(); refresh(); onChange();
          }
        });
      });
    };
    return { html, bind };
  }

  // ---------------------------------------------------------------- thông báo
  function toast(msg, err = false, action = null) {
    const t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.setAttribute('role', err ? 'alert' : 'status');
    t.innerHTML = `<span class="toast-msg">${e(msg)}</span>${action ? `<button type="button" class="toast-act">${e(action.label)}</button>` : ''}`;
    q('#toasts').appendChild(t);
    const timer = setTimeout(() => t.remove(), action ? 7000 : err ? 5000 : 2500);
    if (action) q('.toast-act', t).addEventListener('click', () => { clearTimeout(timer); t.remove(); action.run(); });
  }

  return { enhanceAll, seg, tags, rangePicker, toast, closePop };
})();
window.UI = UI;
