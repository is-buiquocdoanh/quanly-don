const $ = (s) => document.querySelector(s);

function show(text, ok) {
  const m = $('#msg');
  m.hidden = false;
  m.textContent = text;
  m.className = 'msg' + (ok ? '' : ' err');
}

// bật / tắt bắt đơn
const paint = (on) => { $('#enabled').checked = on; $('#pwT').textContent = on ? 'Bắt đơn đang bật' : 'Bắt đơn đang tắt'; };
chrome.storage.sync.get({ enabled: true }, (v) => paint(v.enabled));
$('#enabled').addEventListener('change', (e) => chrome.storage.sync.set({ enabled: e.target.checked }));
chrome.storage.onChanged.addListener((ch, area) => { if (area === 'sync' && ch.enabled) paint(ch.enabled.newValue); });
chrome.storage.sync.get({ useAi: false }, (v) => ($('#useAi').checked = v.useAi));
$('#useAi').addEventListener('change', (e) => chrome.storage.sync.set({ useAi: e.target.checked }));

chrome.storage.sync.get({ apiUrl: '', token: '' }, (v) => {
  // hiển thị địa chỉ gốc cho dễ đọc (bỏ /api/ext)
  $('#apiUrl').value = v.apiUrl.replace(/\/api\/ext$/, '');
  $('#token').value = v.token;
});

/** Trả về { apiUrl, origin } hoặc null nếu link sai. */
function resolveUrl(raw) {
  raw = raw.trim().replace(/\/+$/, '');
  if (/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(raw)) return { apiUrl: raw, origin: null };
  let u;
  try { u = new URL(/^https?:\/\//.test(raw) ? raw : 'https://' + raw); } catch { return null; }
  return { apiUrl: u.origin + '/api/ext', origin: u.origin };
}

// Lưu ý: chrome.permissions.request phải gọi NGAY trong lúc bấm nút (trước mọi await)
function save() {
  const r = resolveUrl($('#apiUrl').value);
  if (!r) { show('Địa chỉ không hợp lệ', false); return Promise.resolve(false); }
  const token = $('#token').value.trim();
  const perm = r.origin ? chrome.permissions.request({ origins: [r.origin + '/*'] }) : Promise.resolve(true);
  return perm.then(async (granted) => {
    if (!granted) { show('Cần cho phép extension truy cập ' + r.origin + ' để gửi đơn.', false); return false; }
    await chrome.storage.sync.set({ apiUrl: r.apiUrl, token });
    return true;
  });
}

$('#save').addEventListener('click', () => save().then((ok) => ok && show('Đã lưu.', true)));
$('#test').addEventListener('click', () => save().then(async (ok) => {
  if (!ok) return;
  show('Đang kiểm tra…', true);
  const r = await chrome.runtime.sendMessage({ type: 'api', action: 'ping', data: {} });
  if (r.ok) show('Kết nối thành công. ' + (r.user ? `Tài khoản: ${r.user} · ` : '') + (r.webUrl || r.sheetUrl || '')
    + (r.ai === true ? ' · AI đọc đơn: đã bật trên server' : r.ai === false ? ' · AI đọc đơn: server chưa có ANTHROPIC_API_KEY (extension vẫn tự đọc địa chỉ miễn phí)' : ''), true);
  else show(r.error, false);
}));

// ---- phím tắt: bấm ô → nhấn phím để đặt
let recording = null;
function paintKeys(v) {
  for (const k of ['openKey', 'saveKey']) {
    const b = $('#k-' + k);
    b.textContent = v[k] ? Keys.label(v[k]) : 'Chưa đặt';
    b.classList.toggle('empty', !v[k]);
    b.classList.remove('rec');
  }
  $('#copyOpens').checked = v.copyOpens;
}
const keyMsg = (t) => { $('#keyMsg').hidden = !t; $('#keyMsg').textContent = t || ''; };
chrome.storage.sync.get(Keys.DEFAULTS, paintKeys);
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === 'sync' && (ch.openKey || ch.saveKey || ch.copyOpens)) chrome.storage.sync.get(Keys.DEFAULTS, paintKeys);
});
$('#copyOpens').addEventListener('change', (e) => chrome.storage.sync.set({ copyOpens: e.target.checked }));
for (const k of ['openKey', 'saveKey']) {
  $('#k-' + k).addEventListener('click', () => {
    if (recording) chrome.storage.sync.get(Keys.DEFAULTS, paintKeys);
    recording = k;
    keyMsg('');
    const b = $('#k-' + k);
    b.textContent = 'Nhấn phím…';
    b.classList.add('rec');
    b.classList.remove('empty');
  });
}
document.querySelectorAll('[data-clear]').forEach((b) => b.addEventListener('click', () => {
  recording = null;
  keyMsg('');
  chrome.storage.sync.set({ [b.dataset.clear]: '' });
}));
document.addEventListener('keydown', (e) => {
  if (!recording) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.key === 'Escape') { recording = null; keyMsg(''); chrome.storage.sync.get(Keys.DEFAULTS, paintKeys); return; }
  const c = Keys.combo(e);
  if (!c) return; // mới nhấn Ctrl/Alt… chờ phím chính
  const err = Keys.check(c);
  if (err) { keyMsg(err); return; }
  const k = recording;
  recording = null;
  keyMsg('');
  chrome.storage.sync.set({ [k]: c });
}, true);
