// Gửi đơn cho kho qua Zalo (tài khoản Zalo PHỤ, gửi vào 1 nhóm) — dùng thư viện KHÔNG chính thức zca-js.
// Rủi ro: Zalo có thể khóa tài khoản / thư viện ngừng chạy khi Zalo đổi hệ thống → luôn còn cách "Chép lần lượt" dự phòng.
//
// Phiên đăng nhập (cookie) lưu ở DATA_DIR/zalo-session.json (KHÔNG nằm trong database, không vào bản sao lưu):
// mất file thì chỉ cần quét QR lại. Nhóm nhận đơn lưu ở settings: zalo_group_id, zalo_group_name.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, getSettings, setSetting } from './db.js';
import { bad, str } from './util.js';

const FILE = path.join(DATA_DIR, 'zalo-session.json');
const MIN_GAP = 2500; // ms giữa 2 tin, cho giống người gửi

// status: off (chưa đăng nhập) | starting | qr (đang chờ quét) | scanned (đã quét, chờ bấm Đăng nhập trên điện thoại)
//         | on (sẵn sàng) | expired (phiên hết hạn, quét lại) | error
const st = { status: 'off', qr: '', qrAt: 0, name: '', error: '', api: null, abort: null, lastSend: 0 };

let lib = null;
async function zca() {
  lib ||= await import('zca-js');
  return lib;
}
const newClient = async () => new (await zca()).Zalo({ selfListen: false, checkUpdate: false, logging: false });

function readSession() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return null; }
}
function writeSession(s) {
  fs.writeFileSync(FILE, JSON.stringify(s), { mode: 0o600 });
}

/** Trạng thái cho trang Cài đặt (không bao giờ trả cookie ra ngoài). */
export function zaloStatus() {
  const s = getSettings();
  let status = st.status;
  if (status === 'off' && readSession()) status = 'saved'; // có phiên đã lưu, chưa dùng lần nào từ khi khởi động
  return {
    status,
    qr: status === 'qr' ? st.qr : '',
    account: st.name || readSession()?.name || '',
    error: st.error,
    group: s.zalo_group_id ? { id: s.zalo_group_id, name: s.zalo_group_name } : null,
  };
}

/** Bắt đầu đăng nhập bằng QR; trả về ngay, trang Cài đặt hỏi lại zaloStatus() để lấy ảnh QR. */
export async function startQR() {
  if (['starting', 'qr', 'scanned'].includes(st.status)) st.abort?.();
  Object.assign(st, { status: 'starting', qr: '', error: '', api: null, abort: null });
  const { LoginQRCallbackEventType: E } = await zca();
  const z = await newClient();
  let info = null;
  let scannedName = '';
  z.loginQR({}, (ev) => {
    switch (ev.type) {
      case E.QRCodeGenerated: Object.assign(st, { status: 'qr', qr: ev.data.image, qrAt: Date.now(), abort: ev.actions.abort }); break;
      case E.QRCodeScanned: scannedName = ev.data.display_name || ''; Object.assign(st, { status: 'scanned', qr: '', abort: ev.actions.abort }); break;
      case E.QRCodeExpired: Object.assign(st, { status: 'off', qr: '', error: 'Mã QR hết hạn, bấm tạo mã mới.' }); ev.actions.abort(); break;
      case E.QRCodeDeclined: Object.assign(st, { status: 'off', qr: '', error: 'Bạn đã bấm Từ chối trên điện thoại.' }); ev.actions.abort(); break;
      case E.GotLoginInfo: info = ev.data; break;
    }
  }).then(async (api) => {
    let name = scannedName;
    try { name = (await api.fetchAccountInfo())?.profile?.displayName || name; } catch { /* không sao */ }
    writeSession({ ...info, name, at: Date.now() });
    Object.assign(st, { status: 'on', api, name, qr: '', error: '', abort: null });
  }).catch((e) => {
    if (st.status === 'off') return; // đã hết hạn / từ chối / hủy: lỗi đã ghi ở trên
    Object.assign(st, { status: 'error', qr: '', error: 'Đăng nhập Zalo thất bại: ' + (e?.message || e), abort: null });
  });
}

export function logout() {
  st.abort?.();
  try { fs.unlinkSync(FILE); } catch { /* chưa có */ }
  Object.assign(st, { status: 'off', qr: '', name: '', error: '', api: null, abort: null });
}

/** API đã đăng nhập: dùng lại nếu có, không thì đăng nhập lại từ phiên đã lưu. */
async function getApi() {
  if (st.api) return st.api;
  const s = readSession();
  if (!s) throw bad('Chưa đăng nhập Zalo. Vào Cài đặt → Gửi đơn qua Zalo → quét mã QR.');
  try {
    const z = await newClient();
    st.api = await z.login({ cookie: s.cookie, imei: s.imei, userAgent: s.userAgent });
    Object.assign(st, { status: 'on', name: s.name || '', error: '' });
    return st.api;
  } catch (e) {
    Object.assign(st, { status: 'expired', api: null, error: 'Phiên Zalo đã hết hạn hoặc bị đăng xuất. Quét mã QR lại. (' + (e?.message || e) + ')' });
    throw bad(st.error);
  }
}

// lỗi gọi API mà phiên cũ có thể đã chết → bỏ api đang giữ, đăng nhập lại 1 lần
async function withApi(fn) {
  const api = await getApi();
  try { return await fn(api); } catch (e) {
    st.api = null;
    const again = await getApi();
    try { return await fn(again); } catch (e2) { throw bad('Zalo báo lỗi: ' + (e2?.message || e2 || e)); }
  }
}

export async function listGroups() {
  return withApi(async (api) => {
    const ids = Object.keys((await api.getAllGroups())?.gridVerMap || {});
    const out = [];
    for (let i = 0; i < ids.length; i += 50) {
      const info = (await api.getGroupInfo(ids.slice(i, i + 50)))?.gridInfoMap || {};
      for (const [id, g] of Object.entries(info)) out.push({ id, name: g.name || id, members: g.totalMember || 0 });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  });
}

export async function chooseGroup(id) {
  id = str(id, 40);
  if (!id) { setSetting('zalo_group_id', ''); setSetting('zalo_group_name', ''); return zaloStatus(); }
  const g = (await listGroups()).find((x) => x.id === id);
  if (!g) throw bad('Tài khoản Zalo này không ở trong nhóm đó');
  setSetting('zalo_group_id', g.id);
  setSetting('zalo_group_name', str(g.name, 100));
  return zaloStatus();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let queue = Promise.resolve();

/** Gửi 1 tin vào nhóm kho. Các lần gọi xếp hàng, cách nhau ít nhất MIN_GAP. */
export function sendToGroup(text) {
  const msg = str(text, 3000);
  if (!msg) return Promise.reject(bad('Tin trống'));
  const groupId = getSettings().zalo_group_id;
  if (!groupId) return Promise.reject(bad('Chưa chọn nhóm Zalo nhận đơn (Cài đặt → Gửi đơn qua Zalo).'));
  const job = queue.then(async () => {
    const wait = st.lastSend + MIN_GAP + Math.random() * 1500 - Date.now();
    if (wait > 0) await sleep(wait);
    const { ThreadType } = await zca();
    const r = await withApi((api) => api.sendMessage(msg, groupId, ThreadType.Group));
    st.lastSend = Date.now();
    // lưu lại cookie mới (Zalo gia hạn cookie khi dùng) để phiên sống lâu
    try {
      const s = readSession();
      const cookies = st.api?.getCookie?.()?.toJSON?.()?.cookies;
      if (s && cookies?.length) writeSession({ ...s, cookie: cookies });
    } catch { /* không sao */ }
    return { msg_id: r?.message?.msgId ?? null };
  });
  queue = job.catch(() => {});
  return job;
}
