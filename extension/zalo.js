// Zalo Web (chat.zalo.me): phần chạy trên trang Zalo — KHÔNG có giao diện riêng.
// Bảng bên cạnh của extension (tab "Gửi Zalo") ra lệnh: đọc tên chat đang mở, gõ 1 đơn vào ô chat rồi bấm gửi.
// Không đọc tin nhắn, không làm gì khác trên Zalo ngoài gõ + gửi khi bạn bấm nút trong bảng bên cạnh.
(() => {
  if (window.__qldZalo) return;
  window.__qldZalo = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    const clean = (x) => x.replace(/​/g, '').replace(/\s+/g, ' ').trim(); // bỏ ký tự ẩn trong SĐT
    const same = (a, b) => clean(a) === clean(b);
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

  // ---------------------------------------------------------------- nhận lệnh từ bảng bên cạnh
  chrome.runtime.onMessage.addListener((m, _sender, reply) => {
    if (m?.type === 'zaloInfo') { reply({ ok: true, name: chatName(), input: !!chatInput() }); return; }
    if (m?.type === 'zaloSend') {
      typeAndSend(String(m.text || ''), String(m.key || '')).then(reply, (e) => reply({ err: 'Lỗi: ' + (e?.message || e) }));
      return true; // trả lời sau (gửi mất vài giây)
    }
  });
})();
