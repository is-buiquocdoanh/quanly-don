// Zalo Web (chat.zalo.me): khung "Đơn báo kho" — lấy các đơn Chờ gửi chưa báo kho từ web quản lý đơn,
// dán từng đơn vào ô chat ĐANG MỞ rồi bấm gửi, mỗi đơn 1 tin, giãn cách ngẫu nhiên theo Cài đặt của web.
// Gửi xong đơn nào báo web đánh dấu "Đã báo Zalo" ngay đơn đó (dừng giữa chừng không bị gửi lặp).
// Không đọc tin nhắn, không làm gì khác trên Zalo ngoài gõ + gửi khi bạn bấm nút.
(() => {
  if (window.__qldZalo) return;
  window.__qldZalo = true;

  const api = (action, data) => chrome.runtime.sendMessage({ type: 'api', action, data })
    .catch((e) => ({ ok: false, error: String(e?.message || e) }));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
  const norm = (s) => String(s || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

  // ---------------------------------------------------------------- tìm ô chat, tên cuộc chat đang mở
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 40 && r.height > 10 && r.bottom > 0 && r.top < innerHeight; };
  function chatInput() {
    const byId = document.getElementById('richInput');
    if (byId && visible(byId)) return byId;
    // ô soạn tin: contenteditable thấp nhất màn hình, nằm bên phải danh sách hội thoại
    const list = [...document.querySelectorAll('[contenteditable="true"]')].filter((el) => visible(el) && !el.closest('#qld-zalo-host'));
    list.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
    return list[0] || null;
  }
  // chữ mờ trong ô soạn tin của Zalo: "Nhập @, tin nhắn tới <tên chat>" — luôn ghi đúng tên chat đang mở
  const PH_RE = /^\s*nhập\s*@?\s*,?\s*tin nhắn tới\s*/iu;
  function placeholderText() {
    for (const el of document.querySelectorAll('[placeholder], [data-placeholder], [aria-placeholder]')) {
      if (el.closest('#qld-zalo-host')) continue;
      for (const a of ['placeholder', 'data-placeholder', 'aria-placeholder']) {
        const v = el.getAttribute(a);
        if (v && PH_RE.test(v)) return v;
      }
    }
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const t = n.nodeValue;
      if (t && t.length < 200 && PH_RE.test(t)) return t.trim();
    }
    return '';
  }
  // chữ trong ô soạn tin (bỏ chữ mờ gợi ý nếu Zalo vẽ nó bên trong ô)
  const inputText = (el) => {
    const t = (el.innerText || el.textContent || '').replace(/​/g, '').trim();
    return PH_RE.test(t) ? '' : t;
  };
  // nằm trong vùng cuộn được (khung tin nhắn, danh sách hội thoại) → không phải tiêu đề chat
  function inScroller(el) {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const oy = getComputedStyle(p).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 4) return true;
    }
    return false;
  }
  // chữ đang thật sự hiện ra (không bị thanh tiêu đề / ghim che mất)
  function onTop(el, r) {
    const h = document.elementFromPoint(r.left + Math.min(r.width / 2, 12), r.top + r.height / 2);
    return !!h && (h === el || el.contains(h) || h.contains(el));
  }
  /** Tên cuộc chat đang mở. Ưu tiên chữ mờ trong ô soạn tin ("… tin nhắn tới <tên>");
   *  không có thì lấy chữ to nhất ở dải trên cùng, bên phải danh sách hội thoại, ngoài khung tin nhắn, không phải link. */
  function chatName() {
    const ph = placeholderText().replace(PH_RE, '').trim();
    if (ph) return ph;
    const inp = chatInput();
    const minLeft = inp ? inp.getBoundingClientRect().left - 40 : innerWidth * 0.3;
    let best = null;
    let bestSize = 0;
    for (const el of document.querySelectorAll('div, span, h1, h2, h3, p')) {
      if (el.children.length || el.closest('#qld-zalo-host, a, button')) continue; // "Tải ngay" trên thanh quảng cáo là link
      const t = (el.textContent || '').trim();
      if (t.length < 2 || t.length > 80 || !/\p{L}.*\p{L}/u.test(t)) continue; // phải có chữ cái, không lấy emoji 📍
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.top > 130 || r.left < minLeft || r.width < 10) continue;
      if (inScroller(el) || !onTop(el, r)) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize) || 0;
      const fw = parseInt(getComputedStyle(el).fontWeight, 10) || 400;
      const score = fs + (fw >= 600 ? 2 : 0);
      if (score > bestSize) { bestSize = score; best = t; }
    }
    return best;
  }

  // số lần "key" (SĐT của đơn) hiện trên trang, không tính trong ô soạn tin → tăng lên = tin đã lên khung chat
  const occ = (hay, needle) => (needle ? String(hay || '').split(needle).length - 1 : 0);
  const pageCount = (key, el) => occ(document.body.innerText, key) - occ(el.innerText, key);
  const attrs = (b) => [...(b.attributes || [])].map((a) => a.value).join(' ') + ' ' + String(b.className?.baseVal ?? '');
  const desc = (b) => `${b.tagName.toLowerCase()}${b.id ? '#' + b.id : ''} [${attrs(b).slice(0, 160)}] "${(b.children.length ? '' : (b.textContent || '').trim()).slice(0, 30)}"`;
  /** Các phần tử đang hiện trên cùng hàng với ô soạn tin, bên phải nó (nút Gửi, 👍, biểu tượng cảm xúc…). */
  function rowEls(el) {
    const ir = el.getBoundingClientRect();
    if (!el.isConnected || ir.height < 4) return []; // ô cũ đã bị Zalo gỡ khỏi trang
    return [...document.querySelectorAll('button, div, span, i, svg, a, img')].filter((b) => {
      if (b.closest('#qld-zalo-host') || el.contains(b) || b.contains(el)) return false;
      const r = b.getBoundingClientRect();
      return r.width > 4 && r.height > 4 && r.width < 160 && r.height < 80 && r.bottom > ir.top - 10 && r.top < ir.bottom + 10 && r.left >= ir.left - 10;
    });
  }
  let lastSent = ''; // nội dung đơn vừa gửi xong (nhận ra chữ cũ còn sót trong ô chat)
  const NOT_SEND =/like|thumb|emoji|emoticon|sticker|smile|mention|attach|image|photo|file|card|gif|reaction/i;
  const LOOKS_SEND = /sen[dt]|gửi|str_send/i;

  /** Dán text vào ô chat rồi gửi. key = SĐT của đơn (để nhận biết tin đã lên khung chat).
   *  Trả về { err, diag }: err rỗng = đã gửi; diag = thông tin để báo lỗi khi Zalo đổi giao diện. */
  async function typeAndSend(text, key) {
    const el = chatInput();
    if (!el) return { err: 'Không thấy ô soạn tin. Mở cuộc chat nhóm kho trên Zalo Web trước.' };
    // còn chữ của đơn vừa gửi (Zalo xóa ô chat chậm) → chờ; quá 6 giây thì tự xóa (chỉ khi đúng là chữ của đơn trước)
    const same = (a, b) => a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim();
    if (inputText(el) && lastSent && same(inputText(el), lastSent)) {
      for (let t = 0; t < 6000 && inputText(el); t += 200) await sleep(200);
      if (inputText(el) && same(inputText(el), lastSent)) { el.focus(); document.execCommand('selectAll'); document.execCommand('delete'); await sleep(200); }
    }
    if (inputText(el)) return { err: 'Ô soạn tin đang có chữ. Xóa đi rồi gửi lại (để không gửi lẫn).' };
    // Zalo VẼ LẠI ô soạn tin (thay bằng phần tử mới) ngay khi có chữ → luôn tìm lại ô hiện tại, không giữ phần tử cũ
    const E = () => { const c = chatInput(); return c && c.isConnected ? c : el; };
    const shownBefore = new Set(rowEls(el));
    el.focus();
    // cách 1: gõ chữ như bàn phím; cách 2: giả lập dán (Ctrl+V)
    document.execCommand('insertText', false, text);
    await sleep(300);
    if (!inputText(E())) {
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      E().dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      await sleep(400);
    }
    const diag = () => ({ input: desc(E()), stale: !el.isConnected, inputText: inputText(E()).slice(0, 60), placeholder: placeholderText().slice(0, 80), row: rowEls(E()).slice(0, 30).map(desc) });
    if (!inputText(E())) return { err: 'Không dán được chữ vào ô chat của Zalo (Zalo có thể vừa đổi giao diện).', diag: diag() };
    await sleep(150);
    const base = pageCount(key, E());
    const sent = () => { const c = E(); return !inputText(c) || (key && pageCount(key, c) > base); };
    const waitSent = async (ms) => { for (let t = 0; t < ms; t += 150) { if (sent()) return true; await sleep(150); } return sent(); };
    // gửi: nhấn Enter (vào ô hiện tại, đặt lại con trỏ vào ô trước)
    const inp = E();
    inp.focus();
    const press = (type) => inp.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    press('keydown'); press('keypress'); press('keyup');
    if (await waitSent(3000)) { lastSent = text; return { err: '' }; }
    // không được thì bấm nút Gửi: nút vừa hiện ra khi ô có chữ, hoặc nút có chữ / thuộc tính "Gửi", "send"…; bỏ qua 👍, cảm xúc, đính kèm
    const row = rowEls(E()).filter((b) => !NOT_SEND.test(attrs(b)));
    const label = (b) => (b.getAttribute('title') || b.getAttribute('aria-label') || (b.children.length ? '' : b.textContent) || '').trim();
    const btn = row.find((b) => /^(gửi|send)$/iu.test(label(b)))
      || row.find((b) => LOOKS_SEND.test(attrs(b)))
      || row.filter((b) => !shownBefore.has(b)).sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0];
    if (btn) {
      const target = btn.closest('button, [role=button]') || btn;
      ['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach((t) => target.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })));
      target.click();
      if (await waitSent(3000)) { lastSent = text; return { err: '' }; }
    }
    return { err: 'Đã dán chữ nhưng không bấm gửi được. Bạn bấm Enter tay đơn này rồi bấm Gửi tiếp, và bấm "Chép thông tin lỗi" gửi cho người sửa.', diag: { ...diag(), clicked: btn ? desc(btn) : null } };
  }

  // ---------------------------------------------------------------- giao diện (shadow DOM, không dính CSS của Zalo)
  // icon nét (cùng kiểu icon "Kho" trên web quản lý đơn)
  const svg = (size, body) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const ICON = {
    box: (s) => svg(s, '<path d="M4 8l8-4.5L20 8v8l-8 4.5L4 16z"/><path d="M4 8l8 4.5L20 8M12 12.5v8"/>'),
    reload: svg(16, '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
    min: svg(16, '<path d="M5 12h14"/>'),
    send: svg(16, '<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>'),
  };
  const host = document.createElement('div');
  host.id = 'qld-zalo-host';
  // đặt cao hơn thanh soạn tin của Zalo (không che ô chat + nút gửi)
  host.style.cssText = 'position:fixed;right:20px;bottom:120px;z-index:2147483000';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host { all: initial; }
    * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    svg { display: block; flex: none; }
    .pill { display: flex; align-items: center; gap: 8px; cursor: pointer; border: 0; border-radius: 999px; padding: 9px 14px 9px 10px; background: #16a34a; color: #fff; font: 600 14px system-ui; box-shadow: 0 6px 20px rgba(22,163,74,.35), 0 2px 6px rgba(0,0,0,.15); transition: transform .15s, background .15s; }
    .pill:hover { background: #15803d; transform: translateY(-1px); }
    .pill .ic { width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,.2); display: grid; place-items: center; }
    .pill .n { background: #fff; color: #15803d; border-radius: 999px; padding: 1px 8px; font-size: 12px; min-width: 22px; text-align: center; }
    .logo { width: 30px; height: 30px; border-radius: 8px; background: #16a34a; color: #fff; display: grid; place-items: center; }
    .panel { width: 380px; max-height: min(600px, calc(100vh - 150px)); display: flex; flex-direction: column; background: #fff; color: #101828; border: 1px solid #d0d5dd; border-radius: 14px; box-shadow: 0 16px 40px rgba(16,24,40,.25); overflow: hidden; font-size: 13px; }
    .hd { display: flex; align-items: center; gap: 8px; padding: 12px 14px; background: #f9fafb; border-bottom: 1px solid #e4e7ec; }
    .hd b { font-size: 15px; flex: 1; }
    .x { border: 0; background: none; cursor: pointer; color: #667085; width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; }
    .x:hover { background: #eaecf0; color: #101828; }
    .btn { display: flex; align-items: center; justify-content: center; gap: 8px; }
    .sec { padding: 10px 14px; border-bottom: 1px solid #e4e7ec; }
    .row { display: flex; align-items: center; gap: 8px; }
    .muted { color: #667085; } .small { font-size: 12px; }
    input[type=text] { flex: 1; min-width: 0; border: 1px solid #d0d5dd; border-radius: 8px; padding: 6px 10px; font-size: 13px; }
    .chat { margin-top: 6px; } .ok { color: #067647; font-weight: 600; } .bad { color: #b42318; font-weight: 600; }
    .list { overflow: auto; flex: 1; min-height: 60px; }
    .it { display: flex; gap: 10px; align-items: flex-start; padding: 8px 14px; border-bottom: 1px solid #f2f4f7; cursor: pointer; }
    .it:hover { background: #f9fafb; } .it input { margin-top: 3px; }
    .it .t { flex: 1; min-width: 0; } .it .t b { font-weight: 600; } .it .s { color: #667085; font-size: 12px; }
    .it.done { opacity: .55; } .it.done .t b::after { content: '  ✓ đã gửi'; color: #067647; font-weight: 600; }
    .it.cur { background: #ecfdf3; }
    .empty { padding: 24px 14px; text-align: center; color: #667085; }
    .all { display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-bottom: 1px solid #e4e7ec; background: #fcfcfd; cursor: pointer; font-weight: 600; }
    .all .muted { font-weight: 400; }
    .lnk { margin-left: auto; border: 0; background: none; color: #15803d; font: 600 12px system-ui; cursor: pointer; padding: 2px 4px; }
    .lnk:hover { text-decoration: underline; }
    .ft { padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; background: #f9fafb; border-top: 1px solid #e4e7ec; }
    .btn { cursor: pointer; border: 1px solid #16a34a; background: #16a34a; color: #fff; border-radius: 8px; padding: 8px 12px; font: 600 13px system-ui; }
    .btn:disabled { opacity: .5; cursor: default; }
    .btn.s { background: #fff; color: #344054; border-color: #d0d5dd; }
    .msg { font-size: 12px; line-height: 1.5; } .msg.err { color: #b42318; }
    .bar { height: 6px; background: #e4e7ec; border-radius: 99px; overflow: hidden; } .bar i { display: block; height: 100%; width: 0; background: #16a34a; transition: width .3s; }
  </style><div id="w"></div>`;
  const w = root.getElementById('w');
  document.documentElement.appendChild(host);

  const st = { open: false, orders: [], picked: new Set(), done: new Set(), sending: false, stop: false, cur: null, msg: '', err: false, gap: { min: 3, max: 5 }, group: '', loaded: false, prog: 0 };

  async function load() {
    const r = await api('zalo_pending', { days: 7 });
    if (!r?.ok) { Object.assign(st, { msg: r?.error || 'Không tải được đơn', err: true }); return draw(); }
    const { zaloGroup } = await chrome.storage.local.get('zaloGroup');
    Object.assign(st, { orders: r.orders, gap: r.gap || st.gap, loaded: true, msg: '', err: false, done: new Set() });
    st.group = zaloGroup ?? r.group ?? '';
    st.picked = new Set(r.orders.map((o) => o.id));
    draw();
  }

  function chatLine() {
    const name = chatName();
    const want = norm(st.group);
    const match = !want ? null : !!name && (norm(name).includes(want) || want.includes(norm(name)));
    return `Chat đang mở: ${name ? `<b>${esc(name)}</b>` : '<span class="muted">không đọc được tên</span>'}`
      + (match === true ? ' <span class="ok">✓ đúng nhóm</span>' : match === false ? ' <span class="bad">✗ không khớp tên nhóm kho</span>' : '');
  }

  function draw() {
    if (!st.open) {
      const n = st.loaded ? st.orders.length : '';
      w.innerHTML = `<button class="pill" id="open" title="Gửi đơn báo kho vào chat đang mở"><span class="ic">${ICON.box(16)}</span>Đơn báo kho ${n !== '' ? `<span class="n">${n}</span>` : ''}</button>`;
      root.getElementById('open').onclick = () => { st.open = true; draw(); if (!st.loaded) load(); };
      return;
    }
    const left = st.orders.filter((o) => st.picked.has(o.id) && !st.done.has(o.id));
    w.innerHTML = `<div class="panel">
      <div class="hd"><span class="logo">${ICON.box(17)}</span><b>Đơn báo kho</b><button class="x" id="reload" title="Tải lại danh sách đơn">${ICON.reload}</button><button class="x" id="min" title="Thu nhỏ">${ICON.min}</button></div>
      <div class="sec">
        <div class="row"><span class="small muted">Nhóm kho</span><input type="text" id="grp" placeholder="Tên nhóm Zalo của kho (để kiểm tra mở đúng chat)" value="${esc(st.group)}"></div>
        <div class="chat small">${chatLine()}</div>
      </div>
      ${st.loaded && st.orders.length ? (() => {
        const open = st.orders.filter((o) => !st.done.has(o.id));
        const n = open.filter((o) => st.picked.has(o.id)).length;
        return `<label class="all"><input type="checkbox" id="all" ${n && n === open.length ? 'checked' : ''} ${st.sending || !open.length ? 'disabled' : ''}>
          <span>Chọn tất cả</span><span class="muted small">đã chọn ${n}/${open.length} đơn</span>
          ${n ? '<button type="button" class="lnk" id="none">Bỏ chọn hết</button>' : ''}</label>`;
      })() : ''}
      <div class="list">${!st.loaded ? '<div class="empty">Đang tải…</div>' : st.orders.length ? st.orders.map((o) => `
        <label class="it ${st.done.has(o.id) ? 'done' : ''} ${st.cur === o.id ? 'cur' : ''}"><input type="checkbox" data-id="${o.id}" ${st.picked.has(o.id) ? 'checked' : ''} ${st.sending || st.done.has(o.id) ? 'disabled' : ''}>
          <span class="t"><b>${esc(o.name)}</b> · ${esc(o.phone)}<div class="s">${esc(o.code)} · ${esc(o.time)} · ${o.qty} hộp · ${money(o.total)}${o.kho ? ' · ' + esc(o.kho) : ''}</div></span></label>`).join('')
        : '<div class="empty">Không có đơn Chờ gửi nào chưa báo kho (7 ngày gần nhất).</div>'}</div>
      <div class="ft">
        ${st.sending ? `<div class="bar"><i style="width:${st.prog}%"></i></div>` : ''}
        ${st.msg ? `<div class="msg ${st.err ? 'err' : ''}">${esc(st.msg)}</div>` : ''}
        ${st.diag && !st.sending ? '<button class="btn s" id="diag">Chép thông tin lỗi (để gửi cho người sửa)</button>' : ''}
        <div class="row">
          ${st.sending ? '<button class="btn s" id="stop" style="flex:1">Dừng</button>'
            : `<button class="btn" id="go" style="flex:1" ${left.length ? '' : 'disabled'}>${ICON.send}Gửi ${left.length} đơn vào chat đang mở</button>`}
        </div>
        <div class="small muted">Mỗi đơn 1 tin, cách nhau ngẫu nhiên ${st.gap.min}–${st.gap.max} giây (đổi ở web → Cài đặt → Chép &amp; gửi Zalo). Để tab Zalo này mở trên màn hình trong lúc gửi.</div>
      </div></div>`;
    root.getElementById('min').onclick = () => { st.open = false; draw(); };
    root.getElementById('reload').onclick = () => { if (!st.sending) { st.loaded = false; draw(); load(); } };
    const grp = root.getElementById('grp');
    grp.onchange = () => { st.group = grp.value.trim(); chrome.storage.local.set({ zaloGroup: st.group }); if (st.err) { st.msg = ''; st.err = false; } draw(); };
    // chọn tất cả / bỏ chọn hết (không tính đơn đã gửi xong)
    const all = root.getElementById('all');
    if (all) {
      const open = st.orders.filter((o) => !st.done.has(o.id));
      const n = open.filter((o) => st.picked.has(o.id)).length;
      all.indeterminate = n > 0 && n < open.length;
      all.onchange = () => { open.forEach((o) => (all.checked ? st.picked.add(o.id) : st.picked.delete(o.id))); draw(); };
    }
    const none = root.getElementById('none');
    if (none) none.onclick = (e) => { e.preventDefault(); if (!st.sending) { st.picked.clear(); draw(); } };
    root.querySelectorAll('[data-id]').forEach((cb) => { cb.onchange = () => { const id = Number(cb.dataset.id); cb.checked ? st.picked.add(id) : st.picked.delete(id); draw(); }; });
    const dg = root.getElementById('diag');
    if (dg) dg.onclick = async () => {
      const info = JSON.stringify({ ext: chrome.runtime.getManifest?.().version, url: location.href.split('?')[0], at: new Date().toISOString(), ...st.diag }, null, 1);
      try { await navigator.clipboard.writeText(info); dg.textContent = 'Đã chép. Dán vào tin nhắn gửi cho người sửa.'; } catch { prompt('Chép đoạn này:', info); }
    };
    const go = root.getElementById('go');
    if (go) go.onclick = () => send();
    const stop = root.getElementById('stop');
    if (stop) stop.onclick = () => { st.stop = true; st.msg = 'Đang dừng sau đơn hiện tại…'; draw(); };
  }

  async function send() {
    const list = st.orders.filter((o) => st.picked.has(o.id) && !st.done.has(o.id));
    if (!list.length) return;
    const name = chatName();
    const want = norm(st.group);
    if (want) {
      // tên đọc được không khớp (hoặc không đọc được) → hỏi lại, phòng khi extension đọc nhầm tên trên giao diện Zalo
      if (!name || !(norm(name).includes(want) || want.includes(norm(name)))) {
        const ok = confirm(`Extension đọc tên chat đang mở là: ${name ? `"${name}"` : '(không đọc được)'}\nkhông khớp nhóm kho "${st.group}".\n\nNhìn lên đầu khung chat: nếu ĐÚNG là nhóm kho thì bấm OK để vẫn gửi ${list.length} đơn.\nKhông phải thì bấm Hủy, mở đúng nhóm kho rồi bấm lại.`);
        if (!ok) return;
      }
    } else if (!confirm(`Gửi ${list.length} đơn vào cuộc chat đang mở${name ? `: "${name}"` : ''}?\n\nMẹo: nhập tên nhóm kho ở ô "Nhóm kho" để extension tự kiểm tra mở đúng chat.`)) return;

    Object.assign(st, { sending: true, stop: false, msg: '', err: false, prog: 0, diag: null });
    let sent = 0;
    for (const o of list) {
      if (st.stop) break;
      st.cur = o.id;
      st.prog = Math.round((sent / list.length) * 100);
      st.msg = `Đang gửi ${sent + 1}/${list.length}: ${o.name}`;
      draw();
      const r = await typeAndSend(o.text, String(o.phone || ''));
      if (r.err) { Object.assign(st, { msg: `Dừng ở đơn ${o.name}: ${r.err}`, err: true, diag: r.diag || null }); break; }
      st.done.add(o.id);
      sent++;
      const m = await api('zalo_mark', { ids: [o.id] });
      if (!m?.ok) { Object.assign(st, { msg: `Đã gửi ${o.name} lên Zalo nhưng web chưa đánh dấu được (${m?.error || 'lỗi mạng'}). Dừng để tránh gửi lặp.`, err: true }); break; }
      if (sent < list.length && !st.stop) {
        const ms = (st.gap.min + Math.random() * (st.gap.max - st.gap.min)) * 1000;
        st.msg = `Đã gửi ${sent}/${list.length}. Chờ ${Math.round(ms / 100) / 10} giây…`;
        draw();
        await sleep(ms);
      }
    }
    Object.assign(st, { sending: false, cur: null, prog: 100 });
    if (!st.err) st.msg = st.stop ? `Đã dừng: gửi ${sent}/${list.length} đơn.` : `Xong: đã gửi ${sent} đơn, web đã đánh dấu "Đã báo Zalo".`;
    draw();
  }

  draw();
  load(); // lấy sẵn số đơn chờ báo kho để hiện trên nút thu gọn
  // tên chat đổi khi bấm sang hội thoại khác → vẽ lại dòng "Chat đang mở"
  setInterval(() => { const el = st.open && root.querySelector('.chat'); if (el) el.innerHTML = chatLine(); }, 2000);
})();
