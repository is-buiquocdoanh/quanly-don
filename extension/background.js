// Gọi API web quản lý đơn (service worker không bị chặn CORS nhờ quyền truy cập trang).
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

// ---- Bật / tắt bắt đơn: hiện chữ "TẮT" trên icon khi đang tắt
function showState(enabled) {
  chrome.action.setBadgeText({ text: enabled ? '' : 'TẮT' });
  chrome.action.setBadgeBackgroundColor({ color: '#6b7280' });
  chrome.action.setTitle({ title: enabled ? 'Bắt đơn Mess — đang BẬT (bấm để mở bảng đơn)' : 'Bắt đơn Mess — đang TẮT (bấm để mở bảng đơn)' });
}
async function init() {
  // bấm icon extension → mở bảng bên cạnh (không tự đóng khi bấm ra ngoài như khung popup)
  chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  const { enabled } = await chrome.storage.sync.get({ enabled: true });
  showState(enabled);
}
chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);
init();

chrome.storage.onChanged.addListener((ch, area) => {
  if (area === 'sync' && ch.enabled) showState(ch.enabled.newValue);
});

// phím tắt Alt+Shift+B: bật / tắt
chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'toggle-capture') return;
  const { enabled } = await chrome.storage.sync.get({ enabled: true });
  chrome.storage.sync.set({ enabled: !enabled });
});
