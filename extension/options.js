const $ = (s) => document.querySelector(s);

function show(text, ok) {
  const m = $('#msg');
  m.hidden = false;
  m.textContent = text;
  m.className = ok ? 'ok' : 'err';
}

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
  if (r.ok) show('✅ Kết nối OK! ' + (r.user ? `Tài khoản: ${r.user} · ` : '') + (r.webUrl || r.sheetUrl || ''), true);
  else show('❌ ' + r.error, false);
}));
