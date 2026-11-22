import crypto from 'node:crypto';

export const TZ = 'Asia/Ho_Chi_Minh';

const fmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});

/** Thời gian Việt Nam dạng 'YYYY-MM-DD HH:MM:SS' (so sánh chuỗi được). */
export function nowVN(d = new Date()) {
  return fmt.format(d).replace('T', ' ');
}
export function todayVN(d = new Date()) {
  return nowVN(d).slice(0, 10);
}
export function daysAgoVN(n) {
  return nowVN(new Date(Date.now() - n * 864e5));
}

export function normalizePhone(s) {
  let d = String(s || '').replace(/\D/g, '');
  if (d.startsWith('84') && d.length === 11) d = '0' + d.slice(2);
  if (d.length === 9) d = '0' + d;
  return d;
}

export function toInt(v, def = 0) {
  if (v === '' || v == null) return def;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d-]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : def;
}

export function str(v, max = 2000) {
  return String(v ?? '').trim().slice(0, max);
}

export function isDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(String(pw), salt, 64);
  return `scrypt$${salt.toString('hex')}$${h.toString('hex')}`;
}

export function verifyPassword(pw, stored) {
  const [alg, saltHex, hashHex] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const h = crypto.scryptSync(String(pw), Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(hashHex, 'hex');
  return expected.length === h.length && crypto.timingSafeEqual(h, expected);
}

export function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const bad = (msg) => new HttpError(400, msg);
