const $ = (s) => document.querySelector(s);
const fmtMoney = (n) => (Number(n) || 0).toLocaleString('vi-VN') + 'đ';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const api = (action, data) => chrome.runtime.sendMessage({ type: 'api', action, data });

let webUrl = '';

function msg(text) {
  $('#msg').hidden = !text;
  $('#msg').textContent = text || '';
}

async function load() {
  $('#stats').textContent = 'Đang tải…';
  $('#list').innerHTML = '';
  msg('');
  const r = await api('list', { days: Number($('#days').value) });
  if (!r.ok) { $('#stats').textContent = ''; msg(r.error); return; }
  webUrl = r.webUrl || r.sheetUrl || '';
  const orders = r.orders.reverse();
  const active = orders.filter((o) => o.status !== 'Hủy');
  const qty = active.reduce((s, o) => s + (Number(o.qty) || 0), 0);
  const money = active.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const waiting = active.filter((o) => o.status === 'Chờ gửi' || o.status === 'Mới').length;
  const dups = active.filter((o) => o.dup).length;
  $('#stats').innerHTML = `<b>${active.length}</b> đơn · <b>${qty}</b> hộp · <b>${fmtMoney(money)}</b> · chờ gửi: <b>${waiting}</b>` +
    (dups ? ` · <span style="color:#8a1c14">trùng: <b>${dups}</b></span>` : '');
  if (!orders.length) { $('#list').innerHTML = '<div class="empty">Chưa có đơn nào</div>'; return; }
  const cls = (s) => (s === 'Chờ gửi' || s === 'Mới' ? 'new' : s === 'Đã gửi' || s === 'Đã gửi kho' ? 'sent' : s === 'Đã giao' ? 'done' : '');
  $('#list').innerHTML = orders.map((o) => `<li class="${o.status === 'Hủy' ? 'cancel' : o.dup ? 'dup' : ''}">
    <div class="top"><span class="n">${esc(o.name)} · ${esc(o.phone)}</span>
      ${o.dup ? `<span class="tag dup" title="${esc(o.dup)}">TRÙNG</span>` : ''}<span class="tag ${cls(o.status)}">${esc(o.status)}</span></div>
    <div class="addr">${esc(o.address)}</div>
    <div class="addr">${esc(o.qty)} hộp · ${fmtMoney(o.total)} ${o.page ? '· ' + esc(o.page) : ''} · <span class="id">${esc(o.id)} ${esc(o.time)}</span></div>
  </li>`).join('');
}

$('#days').addEventListener('change', load);
$('#reload').addEventListener('click', load);
$('#openOpts').addEventListener('click', (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); });
$('#openWeb').addEventListener('click', (e) => {
  e.preventDefault();
  if (webUrl) chrome.tabs.create({ url: webUrl.includes('script.google') ? webUrl : webUrl + '/#/orders' });
  else chrome.runtime.openOptionsPage();
});

chrome.storage.sync.get({ enabled: true }, (v) => ($('#enabled').checked = v.enabled));
$('#enabled').addEventListener('change', (e) => chrome.storage.sync.set({ enabled: e.target.checked }));

load();
