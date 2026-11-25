// Bảng bên cạnh — 2 tab: "Bắt đơn" (sidepanel.js) và "Gửi Zalo" (file này).
// Gửi Zalo: lấy đơn Chờ gửi chưa báo kho từ web (ext zalo_pending), ra lệnh cho zalo.js trên tab chat.zalo.me
// gõ từng đơn vào chat đang mở rồi bấm gửi; gửi xong đơn nào báo web đánh dấu ngay đơn đó (ext zalo_mark).
// Dùng chung $, esc, money, api của sidepanel.js.
const ZURL = 'https://chat.zalo.me/';
const Z = {
  orders: [], picked: new Set(), done: new Set(), loaded: false,
  sending: false, stop: false, cur: null, prog: 0, msg: '', err: false, diag: null,
  gap: { min: 3, max: 5 }, group: '', tab: null, info: null,
};
const sleepZ = (ms) => new Promise((r) => setTimeout(r, ms));
const normZ = (s) => String(s || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------- 2 tab
let paneNow = 'bat';
function showPane(k) {
  paneNow = k;
  document.querySelectorAll('.tabs [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === k));
  $('#topBat').hidden = k !== 'bat';
  $('#paneBat').hidden = k !== 'bat';
  $('#paneZalo').hidden = k !== 'zalo';
  if (k === 'zalo') { if (!Z.loaded) zLoad(); zInfo(); }
}
document.querySelector('.tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) showPane(b.dataset.tab); });
// chuyển sang tab Zalo Web → tự mở tab "Gửi Zalo"; sang Facebook → "Bắt đơn"
async function autoPane() {
  if (Z.sending) return;
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!t) return;
  if ((t.url || '').startsWith(ZURL)) return showPane('zalo');
  try { const r = await chrome.tabs.sendMessage(t.id, { type: 'pageInfo' }); if (r?.ok) showPane('bat'); } catch { /* không phải Facebook */ }
}
chrome.tabs.onActivated.addListener(autoPane);
chrome.tabs.onUpdated.addListener((_id, ch, t) => { if (ch.status === 'complete' && t.active) autoPane(); });

// ---------------------------------------------------------------- dữ liệu
async function zLoad() {
  const r = await api('zalo_pending', { days: 7 }).catch((e) => ({ ok: false, error: String(e?.message || e) }));
  if (!r?.ok) { Object.assign(Z, { msg: r?.error || 'Không tải được đơn', err: true, loaded: true, orders: [] }); return zDraw(); }
  const { zaloGroup } = await chrome.storage.local.get('zaloGroup');
  Object.assign(Z, { orders: r.orders, gap: r.gap || Z.gap, loaded: true, done: new Set(), msg: Z.err ? '' : Z.msg, err: false });
  Z.group = zaloGroup ?? r.group ?? '';
  Z.picked = new Set(r.orders.map((o) => o.id));
  zDraw();
}
/** Tab Zalo Web đang mở (ưu tiên tab đang xem) + tên chat đang mở trong đó. */
async function zFindTab() {
  const tabs = await chrome.tabs.query({ url: ZURL + '*' });
  return tabs.find((t) => t.active && t.windowId) || tabs[0] || null;
}
async function zInfo() {
  const tab = await zFindTab();
  Z.tab = tab;
  if (!tab) Z.info = { state: 'none' };
  else {
    try {
      const r = await chrome.tabs.sendMessage(tab.id, { type: 'zaloInfo' });
      Z.info = r?.ok ? { state: 'ok', name: r.name, input: r.input } : { state: 'stale' };
    } catch { Z.info = { state: 'stale' }; } // tab mở từ trước khi cài / cập nhật extension
  }
  zDrawChat();
}
const zMatch = () => {
  const want = normZ(Z.group);
  const name = Z.info?.name;
  if (!want) return null;
  return !!name && (normZ(name).includes(want) || want.includes(normZ(name)));
};

// ---------------------------------------------------------------- vẽ
function zDrawChat() {
  const i = Z.info || {};
  let h;
  if (i.state === 'none') h = '<span class="no">Chưa mở Zalo Web.</span><br><button class="btn sec" data-z="open">Mở Zalo Web</button>';
  else if (i.state === 'stale') h = '<span class="no">Tab Zalo Web chưa nạp extension.</span> Tải lại tab Zalo (F5) một lần.<br><button class="btn sec" data-z="reloadTab">Tải lại tab Zalo</button>';
  else if (i.state === 'ok') {
    const m = zMatch();
    h = `Chat đang mở: ${i.name ? `<b>${esc(i.name)}</b>` : '<span class="muted">không đọc được tên</span>'}`
      + (m === true ? ' <span class="ok">✓ đúng nhóm</span>' : m === false ? ' <span class="no">✗ không khớp tên nhóm kho</span>' : '')
      + (i.input ? '' : '<br><span class="no">Chưa mở cuộc chat nào: bấm vào nhóm kho trên Zalo.</span>');
  } else h = '<span class="muted">Đang tìm tab Zalo Web…</span>';
  $('#zChat').innerHTML = h;
}
function zDraw() {
  const open = Z.orders.filter((o) => !Z.done.has(o.id));
  const left = open.filter((o) => Z.picked.has(o.id));
  const cnt = $('#zCnt');
  cnt.hidden = !Z.loaded || !open.length;
  cnt.textContent = open.length;
  if (document.activeElement !== $('#zGroup')) $('#zGroup').value = Z.group;
  $('#zAllRow').hidden = !Z.orders.length;
  $('#zAll').checked = !!open.length && left.length === open.length;
  $('#zAll').indeterminate = left.length > 0 && left.length < open.length;
  $('#zAll').disabled = Z.sending || !open.length;
  $('#zCount').textContent = `đã chọn ${left.length}/${open.length}`;
  $('#zNone').hidden = !left.length || Z.sending;
  $('#zList').innerHTML = !Z.loaded ? '<div class="empty">Đang tải…</div>'
    : !Z.orders.length ? '<div class="empty">Không có đơn Chờ gửi nào chưa báo kho (7 ngày gần nhất).</div>'
    : Z.orders.map((o) => `<label class="zo ${Z.done.has(o.id) ? 'done' : ''} ${Z.cur === o.id ? 'cur' : ''}">
        <input type="checkbox" data-id="${o.id}" ${Z.picked.has(o.id) ? 'checked' : ''} ${Z.sending || Z.done.has(o.id) ? 'disabled' : ''}>
        <span class="t"><b>${esc(o.name)}</b> · ${esc(o.phone)}<div class="s">${esc(o.code)} · ${esc(o.time)} · ${o.qty} hộp · ${money(o.total)}${o.kho ? ' · ' + esc(o.kho) : ''}</div></span></label>`).join('');
  $('#zBar').hidden = !Z.sending;
  $('#zBar').firstElementChild.style.width = Z.prog + '%';
  $('#zMsg').hidden = !Z.msg;
  $('#zMsg').className = 'zmsg' + (Z.err ? ' err' : '');
  $('#zMsg').textContent = Z.msg;
  $('#zDiag').hidden = !Z.diag || Z.sending;
  const go = $('#zGo');
  go.disabled = !Z.sending && !left.length;
  go.className = 'btn block' + (Z.sending ? ' sec' : '');
  go.textContent = Z.sending ? 'Dừng' : `Gửi ${left.length} đơn vào chat đang mở`;
  $('#zHint').innerHTML = `Mỗi đơn 1 tin, cách nhau ngẫu nhiên ${Z.gap.min}–${Z.gap.max} giây (đổi ở web → Cài đặt → Chép &amp; gửi Zalo). Trong lúc gửi để tab Zalo Web đang mở, đừng gõ vào ô chat.`;
  zDrawChat();
}

// ---------------------------------------------------------------- thao tác
$('#zList').addEventListener('change', (e) => {
  const id = Number(e.target.dataset.id);
  if (!id) return;
  e.target.checked ? Z.picked.add(id) : Z.picked.delete(id);
  zDraw();
});
$('#zAll').addEventListener('change', (e) => {
  Z.orders.filter((o) => !Z.done.has(o.id)).forEach((o) => (e.target.checked ? Z.picked.add(o.id) : Z.picked.delete(o.id)));
  zDraw();
});
$('#zNone').addEventListener('click', (e) => { e.preventDefault(); if (!Z.sending) { Z.picked.clear(); zDraw(); } });
$('#zGroup').addEventListener('change', (e) => {
  Z.group = e.target.value.trim();
  chrome.storage.local.set({ zaloGroup: Z.group });
  if (Z.err) { Z.msg = ''; Z.err = false; }
  zDraw();
});
$('#zChat').addEventListener('click', async (e) => {
  const a = e.target.closest('[data-z]')?.dataset.z;
  if (a === 'open') { await chrome.tabs.create({ url: ZURL }); setTimeout(zInfo, 3000); }
  if (a === 'reloadTab' && Z.tab) { await chrome.tabs.reload(Z.tab.id); setTimeout(zInfo, 4000); }
});
$('#zDiag').addEventListener('click', async () => {
  const info = JSON.stringify({ ext: chrome.runtime.getManifest().version, at: new Date().toISOString(), ...Z.diag }, null, 1);
  try { await navigator.clipboard.writeText(info); $('#zDiag').textContent = 'Đã chép. Dán vào tin nhắn gửi cho người sửa.'; } catch { prompt('Chép đoạn này:', info); }
});
$('#zGo').addEventListener('click', () => (Z.sending ? (Z.stop = true, Z.msg = 'Đang dừng sau đơn hiện tại…', zDraw()) : zSend()));

async function zSend() {
  const list = Z.orders.filter((o) => Z.picked.has(o.id) && !Z.done.has(o.id));
  if (!list.length) return;
  await zInfo();
  const i = Z.info || {};
  if (i.state !== 'ok') { Object.assign(Z, { msg: i.state === 'none' ? 'Chưa mở Zalo Web: bấm "Mở Zalo Web", đăng nhập, mở nhóm kho rồi bấm gửi lại.' : 'Tải lại tab Zalo Web (F5) rồi bấm gửi lại.', err: true }); return zDraw(); }
  if (!i.input) { Object.assign(Z, { msg: 'Chưa mở cuộc chat nào trên Zalo Web. Bấm vào nhóm kho rồi bấm gửi lại.', err: true }); return zDraw(); }
  const m = zMatch();
  if (m === false && !confirm(`Extension đọc tên chat đang mở là: "${i.name || '(không đọc được)'}"\nkhông khớp nhóm kho "${Z.group}".\n\nNhìn trên Zalo: nếu ĐÚNG là nhóm kho thì bấm OK để vẫn gửi ${list.length} đơn.\nKhông phải thì bấm Hủy, mở đúng nhóm kho rồi bấm lại.`)) return;
  if (m === null && !confirm(`Gửi ${list.length} đơn vào chat đang mở${i.name ? `: "${i.name}"` : ''}?\n\nMẹo: nhập tên nhóm kho ở ô "Nhóm kho" để extension tự kiểm tra mở đúng chat.`)) return;
  // đưa tab Zalo lên trước để Zalo nhận chữ + nút gửi bình thường
  try { await chrome.tabs.update(Z.tab.id, { active: true }); await chrome.windows.update(Z.tab.windowId, { focused: true }); } catch { /* */ }
  await sleepZ(400);

  Object.assign(Z, { sending: true, stop: false, msg: '', err: false, diag: null, prog: 0 });
  let sent = 0;
  for (const o of list) {
    if (Z.stop) break;
    Object.assign(Z, { cur: o.id, prog: Math.round((sent / list.length) * 100), msg: `Đang gửi ${sent + 1}/${list.length}: ${o.name}` });
    zDraw();
    let r;
    try { r = await chrome.tabs.sendMessage(Z.tab.id, { type: 'zaloSend', text: o.text, key: o.key || o.phone }); } catch (e) { r = { err: 'Mất kết nối với tab Zalo Web (đã đóng hoặc tải lại?). ' + (e?.message || '') }; }
    if (!r || r.err) { Object.assign(Z, { msg: `Dừng ở đơn ${o.name}: ${r?.err || 'không rõ lỗi'}`, err: true, diag: r?.diag || null }); break; }
    Z.done.add(o.id);
    sent++;
    const mk = await api('zalo_mark', { ids: [o.id] }).catch((e) => ({ ok: false, error: String(e?.message || e) }));
    if (!mk?.ok) { Object.assign(Z, { msg: `Đã gửi ${o.name} lên Zalo nhưng web chưa đánh dấu được (${mk?.error || 'lỗi mạng'}). Dừng để tránh gửi lặp.`, err: true }); break; }
    if (sent < list.length && !Z.stop) {
      const ms = (Z.gap.min + Math.random() * (Z.gap.max - Z.gap.min)) * 1000;
      Z.msg = `Đã gửi ${sent}/${list.length}. Chờ ${Math.round(ms / 100) / 10} giây…`;
      zDraw();
      await sleepZ(ms);
    }
  }
  Object.assign(Z, { sending: false, cur: null, prog: 100 });
  if (!Z.err) Z.msg = Z.stop ? `Đã dừng: gửi ${sent}/${list.length} đơn.` : `Xong: đã gửi ${sent} đơn, web đã đánh dấu "Đã báo Zalo".`;
  zDraw();
  load({ quiet: true }); // cập nhật tab Bắt đơn (trạng thái đơn có thể đã đổi)
}

// tên chat đổi khi bấm sang hội thoại khác; danh sách đơn tự làm mới mỗi phút
setInterval(() => { if (paneNow === 'zalo' && !Z.sending && document.visibilityState === 'visible') zInfo(); }, 2000);
setInterval(() => { if (!Z.sending && document.visibilityState === 'visible') zLoad(); }, 60000);
zLoad();
autoPane();
