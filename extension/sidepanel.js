// Bảng bên cạnh: luôn mở khi làm việc trên Facebook (không tự đóng khi bấm ra ngoài như popup).
const $ = (s) => document.querySelector(s);
const money = (n) => (Number(n) || 0).toLocaleString('vi-VN') + 'đ';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const api = (action, data) => chrome.runtime.sendMessage({ type: 'api', action, data });

// nhãn trạng thái → mã màu (web mới + Google Sheets cũ)
const ST = { 'Chờ gửi': 'moi', 'Mới': 'moi', 'Đã gửi': 'da_gui', 'Đã gửi kho': 'da_gui', 'Đã giao': 'da_giao', 'Hoàn': 'hoan', 'Hủy': 'huy' };

let days = 1;
let webUrl = '';
let lastIds = null;
let busy = false;

function msg(text) {
  $('#msg').hidden = !text;
  $('#msg').innerHTML = text || '';
}

async function load({ quiet = false } = {}) {
  if (busy) return;
  busy = true;
  if (!quiet) $('#list').innerHTML = '<div class="empty">Đang tải…</div>';
  let r;
  try { r = await api('list', { days }); } catch (e) { r = { ok: false, error: String(e.message || e) }; }
  busy = false;
  if (!r.ok) {
    $('#tiles').innerHTML = '';
    $('#list').innerHTML = '';
    msg(esc(r.error) + (/Cài đặt|mã API/i.test(r.error) ? ' <a href="#" data-opts>Mở cài đặt</a>' : ''));
    return;
  }
  msg('');
  webUrl = r.webUrl || r.sheetUrl || '';
  const orders = r.orders.slice().reverse();
  const live = orders.filter((o) => o.status !== 'Hủy');
  const qty = live.reduce((s, o) => s + (Number(o.qty) || 0), 0);
  const tot = live.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const waiting = live.filter((o) => ST[o.status] === 'moi').length;
  const dups = live.filter((o) => o.dup).length;
  $('#tiles').innerHTML = `
    <div class="tile"><span>Đơn</span><b>${live.length}</b></div>
    <div class="tile"><span>Doanh thu</span><b>${money(tot)}</b></div>
    <div class="tile"><span>Số hộp</span><b>${qty}</b></div>
    <div class="tile ${dups ? 'warn' : ''}"><span>${dups ? 'Chờ gửi · trùng' : 'Chờ gửi'}</span><b>${waiting}${dups ? ` · ${dups}` : ''}</b></div>`;
  $('#upd').textContent = 'Cập nhật ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  const prev = lastIds;
  lastIds = new Set(orders.map((o) => o.id));
  if (!orders.length) { $('#list').innerHTML = '<div class="empty">Chưa có đơn nào.<br>Bôi đen tin nhắn có đơn trên Facebook rồi bấm Ctrl+C.</div>'; return; }
  $('#list').innerHTML = orders.map((o) => {
    const st = ST[o.status] || '';
    return `<div class="o ${st === 'huy' ? 'cancel' : ''} ${o.dup ? 'dup' : ''} ${prev && !prev.has(o.id) ? 'fresh' : ''}">
      <div class="r1"><span class="n">${esc(o.name) || '(chưa có tên)'}</span>
        ${o.dup ? `<span class="chip dup" title="Trùng: ${esc(o.dup)}">Trùng</span>` : ''}<span class="chip ${st}">${esc(o.status)}</span></div>
      <div class="ph">${esc(o.phone)}</div>
      <div class="ad">${esc(o.address)}</div>
      <div class="r3"><span class="m">${esc(o.qty)} hộp · ${money(o.total)}</span>${o.kho ? `<span class="chip kho">${esc(o.kho)}</span>` : o.page ? `<span>${esc(o.page)}</span>` : ''}
        <span class="when">${esc(o.time)}</span></div>
    </div>`;
  }).join('');
}

// ---- bật / tắt
function paintPower(on) {
  $('#enabled').checked = on;
  $('#power').classList.toggle('off', !on);
  $('#pwT').textContent = on ? 'Đang bật bắt đơn' : 'Đang tắt bắt đơn';
  chrome.storage.sync.get(Keys.DEFAULTS, (k) => {
    const how = [k.copyOpens && 'Ctrl+C', k.openKey && Keys.label(k.openKey)].filter(Boolean).join(' hoặc ') || '(chưa đặt phím — vào Cài đặt)';
    $('#pwS').textContent = on
      ? `Bôi đen tin có đơn rồi nhấn ${how}${k.saveKey ? ` · ${Keys.label(k.saveKey)} để lưu` : ''}`
      : 'Facebook sẽ không mở khung lưu đơn · Alt+Shift+B để bật';
  });
}
chrome.storage.sync.get({ enabled: true }, (v) => paintPower(v.enabled));
$('#enabled').addEventListener('change', (e) => chrome.storage.sync.set({ enabled: e.target.checked }));

chrome.storage.onChanged.addListener((ch, area) => {
  if (area === 'sync' && ch.enabled) paintPower(ch.enabled.newValue);
  if (area === 'sync' && (ch.openKey || ch.saveKey || ch.copyOpens)) paintPower($('#enabled').checked);
  if (area === 'sync' && (ch.apiUrl || ch.token)) load();
  if (area === 'local' && ch.lastSaved) load({ quiet: true }); // vừa lưu đơn trên Facebook → cập nhật ngay
});

$('#days').addEventListener('click', (e) => {
  const b = e.target.closest('[data-d]');
  if (!b) return;
  days = Number(b.dataset.d);
  for (const x of $('#days').children) x.classList.toggle('on', x === b);
  lastIds = null;
  load();
});
$('#reload').addEventListener('click', () => load());
$('#openOpts').addEventListener('click', () => chrome.runtime.openOptionsPage());
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-opts]')) { e.preventDefault(); chrome.runtime.openOptionsPage(); }
});
$('#openWeb').addEventListener('click', (e) => {
  e.preventDefault();
  if (webUrl) chrome.tabs.create({ url: webUrl.includes('script.google') ? webUrl : webUrl + '/#/orders' });
  else chrome.runtime.openOptionsPage();
});

// ---- Page đang mở: mỗi page trong Business Suite chọn tên 1 lần, sau đó đơn từ page đó tự điền
async function activeTab() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t;
}
let pagesAt = 0;
let touchedAt = 0;
for (const ev of ['pointerdown', 'keydown']) $('#curPage').addEventListener(ev, () => { touchedAt = Date.now(); });
async function loadPage() {
  const box = $('#pagebox');
  if (Date.now() - touchedAt < 4000) return; // vừa bấm vào danh sách chọn → đừng dựng lại giữa chừng
  const tab = await activeTab();
  let info = null;
  try { info = tab && await chrome.tabs.sendMessage(tab.id, { type: 'pageInfo' }); } catch { info = null; }
  const src = $('#pagesrc');
  if (!info || !info.ok) { box.hidden = true; src.hidden = true; return; } // không phải tab Facebook / chưa F5 sau khi cài
  let { knownPages: pages = [] } = await chrome.storage.local.get('knownPages');
  if (!pages.length || Date.now() - pagesAt > 60000) { // danh sách page lấy từ web tối đa 1 lần / phút
    pagesAt = Date.now();
    const r = await api('pages').catch(() => null);
    if (r && r.ok) { pages = r.pages; chrome.storage.local.set({ knownPages: pages }); }
  }
  if (info.page && !pages.includes(info.page)) pages = [info.page, ...pages];
  const sel = $('#curPage');
  sel.innerHTML = `<option value="">— Chọn page này là… —</option>`
    + pages.map((p) => `<option value="${esc(p)}" ${p === info.page ? 'selected' : ''}>${esc(p)}</option>`).join('')
    + '<option value="__new">+ Tên khác…</option>';
  box.hidden = false;
  box.classList.toggle('unset', !info.page);
  const SRC = {
    screen: 'Tự nhận theo tên page đang hiện trên màn hình',
    url: 'Theo lần chọn trước cho page này',
    tab: 'Theo lần chọn trước trong tab này',
  };
  src.hidden = false;
  src.className = 'pagesrc' + (info.page ? ' ok' : '');
  src.innerHTML = info.page ? esc(SRC[info.source] || '')
    : (pages.length
      ? 'Chưa nhận ra. Chọn 1 lần ở trên, hoặc kiểm tra tên trong web → Cài đặt → Các page Facebook có <b>giống hệt</b> tên page trên Facebook không.'
      : 'Chưa có danh sách page: vào web → Cài đặt → <b>Các page Facebook</b> nhập tên 4 page (giống hệt tên trên Facebook).')
      + `<br><code>${esc(info.path)}${info.aid ? ' · ' + esc(info.aid.slice(0, 14)) : ' · không có mã page'}</code>`;
}
// chuyển page trong Business Suite: kiểm tra lại mỗi 3 giây khi bảng đang hiện
setInterval(() => { if (document.visibilityState === 'visible' && $('#newPage').hidden) loadPage(); }, 3000);
$('#curPage').addEventListener('change', async (e) => {
  const page = e.target.value;
  if (page === '__new') {
    // gõ tên mới ngay trong bảng: Enter lưu, Esc hủy
    $('#curPage').hidden = true;
    const inp = $('#newPage');
    inp.hidden = false;
    inp.value = '';
    inp.focus();
    return;
  }
  touchedAt = 0;
  e.target.blur();
  await savePage(page);
});
async function savePage(page) {
  const tab = await activeTab();
  try { await chrome.tabs.sendMessage(tab.id, { type: 'setPage', page }); } catch { /* */ }
  $('#newPage').hidden = true;
  $('#curPage').hidden = false;
  loadPage();
}
$('#newPage').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.value.trim()) savePage(e.target.value.trim());
  if (e.key === 'Escape') { $('#newPage').hidden = true; $('#curPage').hidden = false; loadPage(); }
});
$('#newPage').addEventListener('blur', (e) => { if (!e.target.value.trim()) { $('#newPage').hidden = true; $('#curPage').hidden = false; } });
chrome.tabs.onActivated.addListener(loadPage);
chrome.tabs.onUpdated.addListener((_id, ch) => { if (ch.status === 'complete') loadPage(); });
chrome.runtime.onMessage.addListener((m) => { if (m && m.type === 'pageChanged') loadPage(); });
loadPage();

// tự làm mới mỗi phút khi bảng đang hiện
setInterval(() => { if (document.visibilityState === 'visible') load({ quiet: true }); }, 60000);
load();
