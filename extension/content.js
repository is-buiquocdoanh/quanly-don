// Bắt sự kiện Ctrl+C (hoặc Alt+S) trên Meta Business Suite → hiện khung xác nhận đơn.
(() => {
  if (window.__batDonMess) return;
  window.__batDonMess = true;

  let enabled = true;
  chrome.storage.sync.get({ enabled: true }, (v) => (enabled = v.enabled));
  chrome.storage.onChanged.addListener((ch) => { if (ch.enabled) enabled = ch.enabled.newValue; });

  let host = null;
  let lastText = '';
  let lastAt = 0;

  const fmtMoney = (n) => (Number(n) || 0).toLocaleString('vi-VN') + 'đ';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function api(action, data) {
    return chrome.runtime.sendMessage({ type: 'api', action, data }).catch((e) => ({
      ok: false,
      error: /context invalidated/i.test(String(e)) ? 'Extension vừa được cập nhật — hãy tải lại trang (F5)' : String(e),
    }));
  }

  // Ctrl+C: chỉ mở khung khi đoạn copy có số điện thoại
  document.addEventListener('copy', () => {
    if (!enabled || (host && host.isConnected)) return;
    trigger(String(window.getSelection() || '').trim(), false);
  }, true);

  // Alt+S: luôn mở khung với đoạn đang bôi đen (kể cả khi không tìm thấy SĐT)
  document.addEventListener('keydown', (e) => {
    if (!enabled || !e.altKey || e.ctrlKey || e.metaKey || e.code !== 'KeyS') return;
    const text = String(window.getSelection() || '').trim();
    if (!text || (host && host.isConnected)) return;
    e.preventDefault();
    e.stopPropagation();
    trigger(text, true);
  }, true);

  function trigger(text, force) {
    if (!text) return;
    const order = OrderParser.parse(text);
    if (!order.phone && !force) return;
    if (text === lastText && Date.now() - lastAt < 3000) return;
    lastText = text;
    lastAt = Date.now();
    openPanel(order);
  }

  function assetId() {
    try { return new URLSearchParams(location.search).get('asset_id') || location.pathname.split('/')[1] || ''; }
    catch { return ''; }
  }

  async function openPanel(order) {
    closePanel();
    const aid = assetId();
    const { pageMap = {} } = await chrome.storage.local.get('pageMap');
    order.page = pageMap[aid] || '';
    order.link = location.href;

    host = document.createElement('div');
    host.style.cssText = 'all:initial;position:fixed;top:16px;right:16px;z-index:2147483647;';
    // chặn phím tắt của Facebook khi đang gõ trong khung
    ['keydown', 'keyup', 'keypress', 'copy', 'paste', 'cut', 'input', 'beforeinput', 'focusin', 'mousedown', 'click', 'wheel']
      .forEach((t) => host.addEventListener(t, (e) => e.stopPropagation()));
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${CSS}</style>
      <div class="panel" role="dialog" aria-label="Lưu đơn hàng">
        <div class="head"><b>🧾 Lưu đơn hàng</b><button class="x" data-act="close" title="Đóng (Esc)">✕</button></div>
        <div class="dup" hidden></div>
        <div class="grid">
          <label>Tên KH<input name="name"></label>
          <label>SĐT<input name="phone" inputmode="numeric"></label>
          <label class="full">Địa chỉ<textarea name="address" rows="2"></textarea></label>
          <label class="full">Sản phẩm<input name="product"></label>
          <label>Số lượng<input name="qty" inputmode="numeric"></label>
          <label>Tổng tiền<input name="total" placeholder="130000 / 130k"></label>
          <label>Ghi chú<input name="note"></label>
          <label>Page<input name="page" placeholder="Tên page (tự nhớ)"></label>
        </div>
        <div class="msg" hidden></div>
        <div class="foot">
          <span class="hint">Enter lưu · Esc đóng</span>
          <button data-act="close" class="ghost">Hủy</button>
          <button data-act="save" class="save">Lưu đơn</button>
        </div>
      </div>`;
    document.documentElement.appendChild(host);

    const $ = (s) => root.querySelector(s);
    const f = (n) => $(`[name="${n}"]`);
    for (const k of ['name', 'phone', 'address', 'product', 'note', 'page']) f(k).value = order[k] || '';
    f('qty').value = order.qty || '';
    f('total').value = order.total ? order.total.toLocaleString('vi-VN') : '';
    for (const k of ['name', 'phone', 'address']) if (!f(k).value) f(k).classList.add('miss');

    const saveBtn = $('.save');
    let hasDup = false;
    let busy = false;

    async function checkDup() {
      const phone = OrderParser.normalizePhone(f('phone').value);
      const box = $('.dup');
      if (phone.length !== 10) { box.hidden = true; hasDup = false; setSaveLabel(); return; }
      const r = await api('check', { order: { phone } });
      if (!host || !r) return;
      if (!r.ok) { showMsg(r.error, true); return; }
      hasDup = r.matches.length > 0;
      const isBom = r.customer && r.customer.flag === 'bom';
      box.hidden = !hasDup && !isBom;
      box.innerHTML = (isBom ? `<b>🚫 Khách này từng BOM HÀNG.</b> ${esc(r.customer.note || '')}` : '') +
        (hasDup ? `<b style="display:block;margin-top:${isBom ? 6 : 0}px">⚠️ SĐT này đã đặt gần đây:</b>` + r.matches.map((m) =>
          `<div class="m">${esc(m.id)} · ${esc(m.time)} · ${esc(m.name)} · ${esc(m.qty)} hộp · ${fmtMoney(m.total)} · <i>${esc(m.status)}</i></div>`).join('') : '');
      setSaveLabel();
    }
    function setSaveLabel() {
      saveBtn.textContent = hasDup ? 'Vẫn lưu (đơn trùng)' : 'Lưu đơn';
      saveBtn.classList.toggle('warn', hasDup);
    }
    function showMsg(text, isErr) {
      const m = $('.msg');
      m.hidden = false;
      m.textContent = text;
      m.className = 'msg' + (isErr ? ' err' : '');
    }

    async function save() {
      if (busy) return;
      const data = {
        name: f('name').value.trim(),
        phone: OrderParser.normalizePhone(f('phone').value),
        address: f('address').value.trim(),
        product: f('product').value.trim(),
        qty: parseInt(f('qty').value, 10) || 0,
        total: OrderParser.parseMoney(f('total').value),
        note: f('note').value.trim(),
        page: f('page').value.trim(),
        link: order.link,
      };
      if (data.phone.length !== 10) { showMsg('SĐT phải có 10 số', true); f('phone').focus(); return; }
      if (!data.address) { showMsg('Thiếu địa chỉ', true); f('address').focus(); return; }
      busy = true;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Đang lưu…';
      const r = await api('save', { order: data });
      busy = false;
      saveBtn.disabled = false;
      if (!r.ok) { setSaveLabel(); showMsg(r.error, true); return; }
      if (data.page) {
        const { pageMap = {} } = await chrome.storage.local.get('pageMap');
        pageMap[aid] = data.page;
        chrome.storage.local.set({ pageMap });
      }
      closePanel();
      toast(`✅ Đã lưu ${r.id} — ${data.name || data.phone}${r.dups && r.dups.length ? ' (đơn trùng)' : ''}`);
    }

    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'close') closePanel();
      if (act === 'save') save();
    });
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closePanel();
      else if (e.key === 'Enter' && (e.ctrlKey || e.target.tagName !== 'TEXTAREA')) { e.preventDefault(); save(); }
    });
    f('phone').addEventListener('change', checkDup);

    (f('name').value ? saveBtn : f('name')).focus();
    checkDup();
  }

  function closePanel() {
    if (host) host.remove();
    host = null;
  }

  function toast(text) {
    const t = document.createElement('div');
    t.textContent = text;
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;background:#1f6f43;color:#fff;' +
      'font:600 14px/1.4 system-ui,sans-serif;padding:10px 14px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.25)';
    document.documentElement.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }

  const CSS = `
    *{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
    .panel{width:420px;max-width:calc(100vw - 32px);background:#fff;color:#1c1e21;border-radius:12px;
      box-shadow:0 8px 32px rgba(0,0,0,.28);font-size:13px;overflow:hidden;border:1px solid #d6d9dd}
    .head{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#1f6f43;color:#fff;font-size:14px}
    .x{background:none;border:0;color:#fff;font-size:16px;cursor:pointer}
    .dup{background:#fde2e1;color:#8a1c14;padding:8px 14px;border-bottom:1px solid #f3b5b0}
    .dup .m{margin-top:3px;font-size:12px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 10px;padding:12px 14px}
    label{display:flex;flex-direction:column;gap:3px;font-size:11px;font-weight:600;color:#606770}
    label.full{grid-column:1/-1}
    input,textarea{font-size:13px;font-weight:400;color:#1c1e21;border:1px solid #ccd0d5;border-radius:6px;padding:6px 8px;
      resize:vertical;background:#fff;outline:none;width:100%}
    input:focus,textarea:focus{border-color:#1f6f43;box-shadow:0 0 0 2px rgba(31,111,67,.18)}
    .miss{border-color:#e0a100;background:#fffbe6}
    .msg{margin:0 14px 8px;padding:6px 8px;border-radius:6px;background:#e3f4e8;color:#1f6f43}
    .msg.err{background:#fde2e1;color:#8a1c14}
    .foot{display:flex;gap:8px;align-items:center;padding:10px 14px;border-top:1px solid #eceef0;background:#f7f8fa}
    .hint{flex:1;color:#8a8d91;font-size:11px}
    button{cursor:pointer;border-radius:6px;padding:7px 14px;font-size:13px;font-weight:600;border:1px solid transparent}
    .ghost{background:#fff;border-color:#ccd0d5;color:#1c1e21}
    .save{background:#1f6f43;color:#fff}
    .save.warn{background:#c0392b}
    .save:disabled{opacity:.6;cursor:default}
  `;
})();
