// Bắt sự kiện Ctrl+C (hoặc Alt+S) trên Meta Business Suite → hiện khung xác nhận đơn.
(() => {
  if (window.__batDonMess) return;
  window.__batDonMess = true;

  let enabled = true;
  let offHinted = false;
  chrome.storage.sync.get({ enabled: true }, (v) => (enabled = v.enabled));
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'sync' || !ch.enabled) return;
    enabled = ch.enabled.newValue;
    if (!enabled) closePanel();
    toast(enabled ? 'Đã BẬT bắt đơn' : 'Đã TẮT bắt đơn', !enabled);
  });

  // phím tắt tùy chỉnh (trang Tùy chọn)
  let KEYS = { ...Keys.DEFAULTS };
  chrome.storage.sync.get(Keys.DEFAULTS, (v) => (KEYS = v));
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'sync') return;
    for (const k of Object.keys(Keys.DEFAULTS)) if (ch[k]) KEYS[k] = ch[k].newValue;
  });

  let host = null;
  let panel = null;      // { hotSave } của khung đang mở
  let opening = false;   // đang mở khung (đọc địa chỉ…)
  let queuedSave = false; // bấm phím lưu khi khung chưa kịp hiện → lưu ngay khi hiện
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
    if (!KEYS.copyOpens || (host && host.isConnected)) return;
    const text = String(window.getSelection() || '').trim();
    if (!enabled) {
      // nhắc 1 lần mỗi trang: đang tắt nên không mở khung
      if (!offHinted && OrderParser.parse(text).phone) { offHinted = true; toast('Bắt đơn đang TẮT — bật lại ở bảng bên cạnh hoặc Alt+Shift+B', true); }
      return;
    }
    trigger(text, false);
  }, true);

  // Phím mở khung (mặc định Alt+S, đặt được "1"…): mở khung với đoạn đang bôi đen, kể cả khi không thấy SĐT.
  // Phím lưu (vd "1"): lưu đơn khi khung đang mở. Phím đơn không có tác dụng khi đang gõ trong ô nhập.
  document.addEventListener('keydown', (e) => {
    if (!enabled) return;
    const c = Keys.combo(e);
    if (!c) return;
    const path = e.composedPath();
    if (host && path.includes(host)) return; // phím trong khung → khung tự xử lý
    const typing = Keys.isEditable(path[0]);
    const usable = (k) => k && c === k && !(Keys.isPlain(k) && typing);
    const stop = () => { e.preventDefault(); e.stopPropagation(); };
    if (host && host.isConnected) {
      if (usable(KEYS.saveKey)) { stop(); panel && panel.hotSave(); }
      return;
    }
    if (opening) {
      if (usable(KEYS.saveKey)) { stop(); queuedSave = true; }
      return;
    }
    if (!usable(KEYS.openKey)) return;
    const text = String(window.getSelection() || '').trim();
    if (!text) return;
    stop();
    trigger(text, true);
  }, true);

  // danh sách xã/huyện/tỉnh để đọc địa chỉ (nạp 1 lần, lần Ctrl+C đầu tiên)
  let addrReady = null;
  const loadAddr = () => (addrReady ||= fetch(chrome.runtime.getURL('vn-admin.json'))
    .then((r) => r.json()).then((d) => VnAddr.load(d)).catch(() => { addrReady = null; return false; }));

  async function trigger(text, force) {
    if (!text || opening) return;
    opening = true;
    queuedSave = false;
    try {
      await loadAddr();
      const order = OrderParser.parse(text);
      if (!order.phone && !force) return;
      if (!force && text === lastText && Date.now() - lastAt < 3000) return;
      lastText = text;
      lastAt = Date.now();
      await openPanel(order, text);
    } finally {
      opening = false;
    }
    if (queuedSave && panel) { queuedSave = false; panel.hotSave(); }
  }

  // Mã page đang mở: Business Suite ghi trong đường dẫn (?asset_id=…); facebook.com/<tên-page>/inbox thì lấy tên-page.
  // Không xác định được → '' (không đoán, tránh lưu nhầm page).
  const GENERIC = new Set(['latest', 'messages', 'home.php', 'profile.php', 'groups', 'watch', 'marketplace', 'business', 'notifications', 'settings', 'pages']);
  function assetId() {
    try {
      const q = new URLSearchParams(location.search);
      const id = q.get('asset_id') || q.get('page_id');
      if (id) return 'a:' + id;
      if (location.hostname === 'www.facebook.com') {
        const seg = location.pathname.split('/')[1] || '';
        if (seg && !GENERIC.has(seg)) return 's:' + seg;
      }
    } catch { /* */ }
    return '';
  }
  async function pageOf(aid) {
    if (!aid) return '';
    const { pageMap = {} } = await chrome.storage.local.get('pageMap');
    return pageMap[aid] || (aid.startsWith('a:') && pageMap[aid.slice(2)]) || ''; // bản cũ lưu không có tiền tố
  }
  async function setPage(aid, page) {
    if (!aid) return;
    const { pageMap = {} } = await chrome.storage.local.get('pageMap');
    if (page) pageMap[aid] = page; else delete pageMap[aid];
    await chrome.storage.local.set({ pageMap });
  }
  // danh sách page của shop (Cài đặt trên web) — cập nhật mỗi lần mở khung
  async function knownPages() {
    const { knownPages: cached = [] } = await chrome.storage.local.get('knownPages');
    const fresh = api('pages').then((r) => { if (r && r.ok) { chrome.storage.local.set({ knownPages: r.pages }); return r.pages; } return cached; });
    return cached.length ? cached : fresh; // lần đầu chưa có thì chờ lấy từ web
  }
  // giá theo số hộp (web → Cài đặt → Giá theo số hộp): dùng bản đã lưu ngay, cập nhật ngầm từ web.
  // Web bản cũ chưa có bảng giá → dùng giá mặc định.
  const DEFAULT_PRICES = { 1: 95000, 2: 130000, 3: 195000, 4: 250000, 5: 300000 };
  async function knownPrices() {
    const { knownPrices: cached } = await chrome.storage.local.get('knownPrices');
    const fresh = api('prices').then((r) => {
      if (r && r.ok && r.prices && Object.keys(r.prices).length) { chrome.storage.local.set({ knownPrices: r.prices }); return r.prices; }
      return cached || DEFAULT_PRICES;
    }).catch(() => cached || DEFAULT_PRICES);
    return cached || fresh;
  }

  // Tên page của shop đang hiện trên màn hình (ảnh đại diện, nhãn, chữ) — không phụ thuộc đường dẫn.
  // Chỉ nhận khi 1 page vượt hẳn các page khác, không thì trả ''.
  function pageOnScreen(pages) {
    if (!pages.length || !document.body) return '';
    const norm = (x) => String(x || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
    const names = pages.map((p) => [p, norm(p)]).filter(([, n]) => n.length >= 3);
    const text = norm(document.body.innerText);
    const textHits = new Map();
    for (const [p, n] of names) {
      let i = 0, c = 0;
      while ((i = text.indexOf(n, i)) >= 0 && c < 50) { c++; i += n.length; }
      textHits.set(p, c);
    }
    const score = new Map();
    for (const [p, n] of names) {
      // tên ngắn nằm trong tên dài hơn ("Trứng Sâu" ⊂ "Trứng Sâu Miền Bắc"): trừ phần trùng
      let c = textHits.get(p);
      for (const [q, m] of names) if (q !== p && m.includes(n)) c -= textHits.get(q);
      if (c > 0) score.set(p, c);
    }
    for (const el of document.querySelectorAll('img[alt], [aria-label]')) {
      if (host && host.contains(el)) continue;
      const v = norm(el.getAttribute('alt') || el.getAttribute('aria-label'));
      if (!v || v.length > 120) continue;
      for (const [p, n] of names) if (v === n || v.includes(n)) score.set(p, (score.get(p) || 0) + 3);
    }
    const ranked = [...score].sort((a, b) => b[1] - a[1]);
    if (!ranked.length) return '';
    if (ranked.length > 1 && ranked[1][1] * 2 >= ranked[0][1]) return '';
    return ranked[0][0];
  }
  // page của tab này, nhớ qua F5 (sessionStorage sống theo tab)
  const tabPage = {
    get: () => { try { return sessionStorage.getItem('bdm-page') || ''; } catch { return ''; } },
    set: (p) => { try { p ? sessionStorage.setItem('bdm-page', p) : sessionStorage.removeItem('bdm-page'); } catch { /* */ } },
  };
  /** Đoán page đang mở: tên trên màn hình → mã page trong đường dẫn → lần chọn trước trong tab. */
  async function detectPage(pages) {
    const aid = assetId();
    const screen = pageOnScreen(pages);
    if (screen) return { page: screen, source: 'screen', aid };
    const byUrl = await pageOf(aid);
    if (byUrl) return { page: byUrl, source: 'url', aid };
    const t = tabPage.get();
    if (t) return { page: t, source: 'tab', aid };
    return { page: '', source: '', aid };
  }
  async function rememberPage(page) {
    tabPage.set(page);
    await setPage(assetId(), page);
  }

  // bảng bên cạnh hỏi / đặt page cho tab này
  chrome.runtime.onMessage.addListener((msg, _s, reply) => {
    if (msg && msg.type === 'pageInfo') {
      knownPages().then(detectPage).then((d) => {
        // đường dẫn rút gọn (chỉ tên tham số, không giá trị) để chẩn đoán
        let params = [];
        try { params = [...new URLSearchParams(location.search).keys()]; } catch { /* */ }
        reply({ ...d, ok: true, path: location.hostname + location.pathname, params });
      });
      return true;
    }
    if (msg && msg.type === 'setPage') {
      rememberPage(msg.page).then(() => {
        const inp = host && host.shadowRoot.querySelector('[name="page"]');
        if (inp && !inp.dataset.edited) { inp.value = msg.page; inp.classList.remove('miss'); }
        reply({ ok: true, aid: assetId() });
      });
      return true;
    }
  });
  // đổi page / đổi trang trong Business Suite (không tải lại trang) → báo bảng bên cạnh
  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) { lastHref = location.href; chrome.runtime.sendMessage({ type: 'pageChanged' }).catch(() => {}); }
  }, 1000);

  async function openPanel(order, rawText = '') {
    closePanel();
    const aid = assetId();
    const [pages, prices] = await Promise.all([knownPages(), knownPrices()]);
    const det = await detectPage(pages);
    order.page = det.page;
    order.link = location.href;

    const { panelPos } = await chrome.storage.local.get('panelPos');
    host = document.createElement('div');
    host.style.cssText = 'all:initial;position:fixed;top:16px;right:16px;z-index:2147483647;';
    if (panelPos) placeAt(panelPos.x, panelPos.y);
    // chặn phím tắt của Facebook khi đang gõ trong khung
    ['keydown', 'keyup', 'keypress', 'copy', 'paste', 'cut', 'input', 'beforeinput', 'focusin', 'mousedown', 'click', 'wheel']
      .forEach((t) => host.addEventListener(t, (e) => e.stopPropagation()));
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${CSS}</style>
      <div class="panel" role="dialog" aria-label="Lưu đơn hàng">
        <div class="head" title="Kéo để di chuyển khung">
          <img src="${chrome.runtime.getURL('icons/icon32.png')}" alt="">
          <b>Lưu đơn hàng</b><span class="grip" aria-hidden="true">⠿</span>
          <button class="x" data-act="close" title="Đóng (Esc)" aria-label="Đóng"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
        <div class="chk" hidden></div>
        <div class="ai" hidden></div>
        <div class="dup" hidden></div>
        <div class="grid">
          <label>Tên KH<input name="name"></label>
          <label>SĐT<input name="phone" inputmode="numeric"></label>
          <label class="full">Địa chỉ<textarea name="address" rows="2"></textarea></label>
          <label class="full">Sản phẩm<input name="product" placeholder="Để trống = sản phẩm mặc định của shop"></label>
          <label>Số lượng<input name="qty" inputmode="numeric"></label>
          <label>Tổng tiền<input name="total" placeholder="130000 / 130k"></label>
          <label>Ghi chú<input name="note"></label>
          <label>Page<input name="page" list="bdm-pages" placeholder="Chọn page" autocomplete="off"></label>
          <datalist id="bdm-pages">${pages.map((p) => `<option value="${esc(p)}">`).join('')}</datalist>
        </div>
        <div class="msg" hidden></div>
        <div class="foot">
          <span class="hint">${KEYS.saveKey ? `<kbd>${esc(Keys.label(KEYS.saveKey))}</kbd> / ` : ''}<kbd>Enter</kbd> lưu · <kbd>Esc</kbd> đóng</span>
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
    // kết quả bộ đọc địa chỉ: ô tự chuẩn hóa (viền tím nhạt), ô còn thiếu (vàng), cảnh báo cần kiểm tra
    const hints = order.hints || { warnings: [], missing: [], auto: [] };
    for (const k of hints.auto) f(k)?.classList.add('by-ai');
    if (order.page) f('page').classList.add('by-ai');
    else {
      f('page').classList.add('miss');
      hints.warnings.push('Chưa nhận ra page đang mở — chọn ở ô Page (lần sau tự điền)');
    }
    f('page').addEventListener('input', () => { f('page').dataset.edited = '1'; });
    const HM = { name: ['name', 'tên'], phone: ['phone', 'SĐT'], address: ['address', 'địa chỉ'], detail: ['address', 'số nhà / thôn'], ward: ['address', 'xã / phường'], qty: ['qty', 'số lượng'], total: ['total', 'tổng tiền'] };
    for (const m of hints.missing) if (HM[m]) f(HM[m][0]).classList.add('miss');
    if (hints.warnings.length || hints.missing.length) {
      const box = $('.chk');
      box.hidden = false;
      const miss = hints.missing.map((m) => HM[m] && HM[m][1]).filter(Boolean);
      box.innerHTML = (miss.length ? `<b>Thiếu: ${esc(miss.join(', '))}</b>` : '<b>Kiểm tra lại</b>')
        + hints.warnings.map((w) => `<div>• ${esc(w)}</div>`).join('');
    }
    // ô người dùng đã tự sửa thì AI không ghi đè
    const edited = new Set();
    root.addEventListener('input', (e) => { const n = e.target.name; if (n) { edited.add(n); e.target.classList.remove('miss', 'by-ai'); } });

    // tổng tiền tự theo bảng giá khi có số lượng mà chưa có tổng tiền / khi đổi số lượng — trừ khi đã tự gõ tổng tiền
    let autoFilled = false; // tổng tiền hiện tại do bảng giá điền
    function autoTotal() {
      if (edited.has('total')) return;
      const qty = parseInt(String(f('qty').value).replace(/\D/g, ''), 10);
      const price = qty && prices[qty];
      if (!price) {
        // số hộp ngoài bảng giá: xóa giá cũ do bảng giá điền, tô vàng để tự điền
        if (autoFilled) { f('total').value = ''; f('total').classList.remove('by-ai'); f('total').classList.add('miss'); f('total').title = ''; autoFilled = false; }
        return;
      }
      autoFilled = true;
      f('total').value = price.toLocaleString('vi-VN');
      f('total').classList.remove('miss');
      f('total').classList.add('by-ai');
      f('total').title = `Theo bảng giá: ${qty} hộp = ${price.toLocaleString('vi-VN')}đ (gõ tay để đổi)`;
      const chk = $('.chk');
      if (chk && !chk.hidden) chk.innerHTML = chk.innerHTML.replace(/(, )?tổng tiền/, '').replace('<b>Thiếu: </b>', '<b>Kiểm tra lại</b>');
    }
    f('qty').addEventListener('input', autoTotal);
    if (!f('total').value) autoTotal(); // tin nhắn có số hộp mà không ghi tiền

    const saveBtn = $('.save');
    let hasDup = false;
    let busy = false;

    let dupDone = Promise.resolve();
    let dupOk = false; // đã xác nhận lưu dù trùng
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
      box.innerHTML = (isBom ? `<b>🚫 SĐT này nằm trong SỔ ĐỎ (từng phá / bom hàng).</b> ${esc(r.customer.note || '')}` : '') +
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
      // lần sau page này tự điền; chỉ ghi nhớ khi người dùng tự chọn / sửa (không ghi lại kết quả đoán theo màn hình)
      if (data.page && (f('page').dataset.edited || !det.page)) await rememberPage(data.page);
      else if (data.page) tabPage.set(data.page);
      closePanel();
      chrome.storage.local.set({ lastSaved: Date.now() }); // bảng bên cạnh tự cập nhật
      toast(`Đã lưu ${r.id} — ${data.name || data.phone}${r.kho ? ' → ' + r.kho : ''}${r.dups && r.dups.length ? ' (đơn trùng)' : ''}`);
    }

    // kéo thả khung bằng thanh tiêu đề, nhớ vị trí cho lần sau
    $('.head').addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      const r0 = host.getBoundingClientRect();
      const dx = e.clientX - r0.left, dy = e.clientY - r0.top;
      const head = $('.head');
      head.setPointerCapture(e.pointerId);
      head.classList.add('drag');
      const move = (ev) => placeAt(ev.clientX - dx, ev.clientY - dy);
      const up = () => {
        head.removeEventListener('pointermove', move);
        head.classList.remove('drag');
        const r = host.getBoundingClientRect();
        chrome.storage.local.set({ panelPos: { x: Math.round(r.left), y: Math.round(r.top) } });
      };
      head.addEventListener('pointermove', move);
      head.addEventListener('pointerup', up, { once: true });
      head.addEventListener('pointercancel', up, { once: true });
    });

    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'close') closePanel();
      if (act === 'save') save();
    });
    // lưu bằng phím tắt: chờ kiểm tra trùng xong; đơn trùng thì phải nhấn thêm 1 lần để chắc chắn
    async function hotSave() {
      await dupDone;
      if (!host) return;
      if (hasDup && !dupOk) {
        dupOk = true;
        showMsg(`SĐT này đã đặt gần đây — nhấn ${Keys.label(KEYS.saveKey) || 'Enter'} lần nữa để vẫn lưu`, true);
        saveBtn.focus();
        return;
      }
      save();
    }
    panel = { hotSave };
    root.addEventListener('keydown', (e) => {
      const c = Keys.combo(e);
      if (KEYS.saveKey && c === KEYS.saveKey && !(Keys.isPlain(c) && Keys.isEditable(e.target))) { e.preventDefault(); hotSave(); return; }
      if (e.key === 'Escape') closePanel();
      else if (e.key === 'Enter' && (e.ctrlKey || e.target.tagName !== 'TEXTAREA')) { e.preventDefault(); save(); }
    });
    f('phone').addEventListener('change', () => { dupOk = false; dupDone = checkDup(); });

    // ---- AI đọc đơn (chạy song song, khung đã mở sẵn với kết quả bộ lọc thường)
    const MISS_LABEL = { name: 'tên', phone: 'SĐT', address_detail: 'số nhà / thôn', ward: 'xã / phường', district: 'quận / huyện', province: 'tỉnh', qty: 'số lượng', total: 'tổng tiền' };
    async function runAi() {
      const { useAi } = await chrome.storage.sync.get({ useAi: false });
      if (!useAi || !rawText) return;
      const box = $('.ai');
      box.hidden = false;
      box.className = 'ai busy';
      box.innerHTML = '<span class="spin"></span> AI đang đọc đơn…';
      const myHost = host;
      const r = await api('parse', { text: rawText });
      if (host !== myHost) return; // khung đã đóng / mở đơn khác
      if (r.ok && r.ai) $('.chk').hidden = true; // AI đọc lại toàn bộ → thay cho gợi ý của bộ lọc
      if (!r.ok || !r.ai) {
        // AI chưa bật / lỗi: vẫn dùng kết quả bộ lọc thường
        if (r.error && !/Chưa bật AI|Không rõ thao tác/.test(r.error)) { box.className = 'ai err'; box.textContent = 'AI không đọc được: ' + r.error + ' — dùng bộ lọc thường.'; }
        else box.hidden = true;
        return;
      }
      const a = r.order;
      const put = (k, v) => {
        if (edited.has(k) || v === '' || v == null || v === 0) return;
        if (f(k).value === String(v)) return;
        f(k).value = v;
        f(k).classList.remove('miss');
        f(k).classList.add('by-ai');
      };
      put('name', a.name);
      put('phone', a.phone);
      put('address', a.address);
      if (a.product) put('product', a.product);
      put('qty', a.qty || '');
      put('total', a.total ? a.total.toLocaleString('vi-VN') : '');
      if (!a.total && a.qty) autoTotal(); // AI đọc ra số hộp mà tin nhắn không ghi tiền → theo bảng giá
      if (a.note) put('note', f('note').value && !edited.has('note') ? f('note').value + '; ' + a.note : a.note);
      if (!a.phone && a.phone_raw && !edited.has('phone')) { f('phone').value = a.phone_raw; f('phone').classList.add('miss'); }
      for (const [k, m] of [['name', 'name'], ['phone', 'phone'], ['qty', 'qty'], ['total', 'total']]) if (a.missing.includes(m) && !edited.has(k)) f(k).classList.add('miss');
      if (a.missing.some((m) => ['address_detail', 'ward', 'district', 'province'].includes(m)) && !edited.has('address')) f('address').classList.add('miss');

      const miss = a.missing.map((m) => MISS_LABEL[m]).filter(Boolean);
      const lvl = a.confidence === 'low' || miss.length ? 'warn' : 'ok';
      box.className = 'ai ' + lvl;
      box.innerHTML = `<b>${lvl === 'ok' ? 'AI đã đọc đơn' : 'AI đã đọc đơn — cần kiểm tra'}</b>`
        + (miss.length ? `<div>Thiếu: ${esc(miss.join(', '))}</div>` : '')
        + a.warnings.map((w) => `<div>• ${esc(w)}</div>`).join('');
      if (a.phone && !edited.has('phone')) { dupOk = false; dupDone = checkDup(); }
    }
    runAi();

    // dùng phím lưu riêng (vd "1") → đặt con trỏ ở nút Lưu để nhấn phím là lưu; không thì vào ô tên còn trống
    (KEYS.saveKey || f('name').value ? saveBtn : f('name')).focus();
    dupDone = checkDup();
  }

  function placeAt(x, y) {
    if (!host) return;
    // giữ khung trong màn hình (luôn thấy được thanh tiêu đề để kéo lại)
    const w = host.offsetWidth || 440;
    x = Math.max(4, Math.min(x, window.innerWidth - Math.min(w, window.innerWidth) - 4));
    y = Math.max(4, Math.min(y, window.innerHeight - 60));
    Object.assign(host.style, { left: x + 'px', top: y + 'px', right: 'auto' });
  }

  function closePanel() {
    if (host) host.remove();
    host = null;
    panel = null;
  }

  function toast(text, muted = false) {
    const t = document.createElement('div');
    t.textContent = text;
    t.style.cssText = 'all:initial;position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
      `background:${muted ? '#374151' : '#15803d'};color:#fff;font:600 14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;` +
      'padding:10px 16px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.25);transition:opacity .3s;max-width:90vw';
    document.documentElement.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; }, 2600);
    setTimeout(() => t.remove(), 3000);
  }

  const CSS = `
    *{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
    .panel{width:440px;max-width:calc(100vw - 32px);background:#fff;color:#0f172a;border-radius:16px;
      box-shadow:0 24px 60px rgba(15,23,42,.28),0 2px 8px rgba(15,23,42,.12);font-size:13px;overflow:hidden;border:1px solid #e5e7eb}
    .head{display:flex;gap:10px;align-items:center;padding:12px 12px 12px 14px;border-bottom:1px solid #eef0f2;cursor:grab;user-select:none;touch-action:none}
    .head.drag{cursor:grabbing;background:#f8fafc}
    .head img{width:26px;height:26px;border-radius:7px;flex:none}
    .head b{font-size:15px;font-weight:700}
    .grip{flex:1;color:#cbd5e1;font-size:14px;letter-spacing:2px;text-align:center}
    .x{width:30px;height:30px;display:grid;place-items:center;background:none;border:0;border-radius:8px;cursor:pointer;color:#64748b;padding:0}
    .x:hover{background:#f1f5f9;color:#0f172a}
    .x svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round}
    .chk{padding:9px 14px;border-bottom:1px solid #fde68a;background:#fffbeb;color:#92400e;font-size:12px;line-height:1.5}
    .chk b{font-size:13px}
    .ai{padding:9px 14px;border-bottom:1px solid #eef0f2;font-size:12px;line-height:1.5}
    .ai b{font-size:13px}
    .ai.busy{background:#f5f3ff;color:#5b21b6;display:flex;align-items:center;gap:8px}
    .ai.ok{background:#f5f3ff;color:#5b21b6}
    .ai.warn{background:#fffbeb;color:#92400e}
    .ai.err{background:#f8fafc;color:#64748b}
    .spin{width:14px;height:14px;border:2px solid #c4b5fd;border-top-color:#7c3aed;border-radius:50%;animation:sp .8s linear infinite;flex:none}
    @keyframes sp{to{transform:rotate(360deg)}}
    .by-ai{border-color:#86efac;background:#f0fdf4}
    .dup{background:#fef2f2;color:#991b1b;padding:10px 14px;border-bottom:1px solid #fecaca;font-size:12px}
    .dup b{font-size:13px}
    .dup .m{margin-top:4px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px;padding:14px}
    label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:600;color:#475569}
    label.full{grid-column:1/-1}
    input,textarea{font-size:14px;font-weight:400;color:#0f172a;border:1px solid #d6dbe1;border-radius:10px;padding:8px 10px;
      resize:vertical;background:#fff;outline:none;width:100%;transition:border-color .15s,box-shadow .15s}
    input:focus,textarea:focus{border-color:#16a34a;box-shadow:0 0 0 3px rgba(22,163,74,.16)}
    .miss{border-color:#f59e0b;background:#fffbeb}
    .msg{margin:0 14px 10px;padding:8px 10px;border-radius:10px;background:#ecfdf3;color:#15803d}
    .msg.err{background:#fef2f2;color:#b91c1c}
    .foot{display:flex;gap:8px;align-items:center;padding:12px 14px;border-top:1px solid #eef0f2;background:#f8fafc}
    .hint{flex:1;color:#64748b;font-size:12px}
    kbd{font-family:inherit;font-size:11px;font-weight:600;line-height:1;padding:2px 5px;border:1px solid #d6dbe1;border-bottom-width:2px;border-radius:5px;background:#fff;color:#334155}
    button{cursor:pointer;border-radius:10px;padding:9px 16px;font-size:13px;font-weight:600;border:1px solid transparent}
    .ghost{background:#fff;border-color:#d6dbe1;color:#0f172a}
    .ghost:hover{border-color:#94a3b8}
    .save{background:#16a34a;color:#fff;box-shadow:0 2px 6px rgba(22,163,74,.3)}
    .save:hover{background:#15803d}
    .save.warn{background:#dc2626;box-shadow:0 2px 6px rgba(220,38,38,.3)}
    .save:disabled{opacity:.6;cursor:default}
  `;
})();
