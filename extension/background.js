// Gọi API Apps Script (service worker không bị chặn CORS nhờ host_permissions).
async function callApi(action, data) {
  const { apiUrl, token } = await chrome.storage.sync.get({ apiUrl: '', token: '' });
  if (!apiUrl) {
    chrome.runtime.openOptionsPage();
    throw new Error('Chưa cài đặt địa chỉ web — mở trang Cài đặt của extension');
  }
  let res;
  try {
    res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token, ...data }),
    });
  } catch {
    throw new Error('Không kết nối được ' + new URL(apiUrl).host + ' — kiểm tra server / mạng');
  }
  const txt = await res.text();
  try {
    return JSON.parse(txt);
  } catch {
    throw new Error(apiUrl.includes('script.google')
      ? 'Apps Script trả về không phải JSON — kiểm tra quyền truy cập "Anyone" khi Deploy'
      : `Server trả về lỗi (HTTP ${res.status}) — kiểm tra địa chỉ web trong Cài đặt`);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'api') {
    callApi(msg.action, msg.data || {})
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: e.message || String(e) }));
    return true;
  }
});
