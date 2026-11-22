/**
 * API lưu đơn hàng vào Google Sheets cho extension "Bắt đơn Mess".
 * Cách cài: xem README.md
 */

// ⚠️ ĐỔI mã bí mật này, và nhập đúng mã này trong phần Cài đặt của extension
const SECRET = 'doi-ma-bi-mat-nay';

const SHEET_NAME = 'Đơn hàng';
const TODAY_SHEET = 'Hôm nay';
const DUP_DAYS = 7;               // kiểm tra trùng SĐT trong bao nhiêu ngày
const TZ = 'Asia/Ho_Chi_Minh';
const HEADERS = ['Mã đơn', 'Thời gian', 'Tên KH', 'SĐT', 'Địa chỉ', 'Sản phẩm', 'SL', 'Tổng tiền',
  'Ghi chú', 'Page', 'Link chat', 'Trạng thái', 'Trùng'];
const STATUSES = ['Mới', 'Đã gửi kho', 'Đã giao', 'Hoàn', 'Hủy'];
const C = { ID: 0, TIME: 1, NAME: 2, PHONE: 3, ADDR: 4, PRODUCT: 5, QTY: 6, TOTAL: 7, NOTE: 8, PAGE: 9, LINK: 10, STATUS: 11, DUP: 12 };

/** Chạy hàm này 1 lần (bấm ▶ Run) để tạo bảng + định dạng. */
function setup() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME, 0);
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    .setFontWeight('bold').setBackground('#1f6f43').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  sh.getRange('B:B').setNumberFormat('dd/MM/yyyy HH:mm');
  sh.getRange('D:D').setNumberFormat('@');
  sh.getRange('H:H').setNumberFormat('#,##0');
  [110, 120, 150, 105, 320, 260, 45, 90, 120, 110, 80, 100, 160].forEach((w, i) => sh.setColumnWidth(i + 1, w));

  sh.getRange('L2:L').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(true).build());

  const body = sh.getRange('A2:M');
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$L2="Hủy"')
      .setBackground('#eeeeee').setFontColor('#999999').setRanges([body]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$M2<>""')
      .setBackground('#fde2e1').setRanges([body]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$L2="Đã gửi kho"')
      .setBackground('#e3f4e8').setRanges([body]).build(),
  ]);

  // Tab "Hôm nay": tự lọc đơn trong ngày
  let t = ss.getSheetByName(TODAY_SHEET) || ss.insertSheet(TODAY_SHEET, 1);
  t.clear();
  t.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    .setFontWeight('bold').setBackground('#1f6f43').setFontColor('#ffffff');
  t.setFrozenRows(1);
  t.getRange('A2').setFormula(
    "=IFERROR(SORT(FILTER('" + SHEET_NAME + "'!A2:M, INT('" + SHEET_NAME + "'!B2:B)=TODAY()), 2, TRUE), \"Chưa có đơn hôm nay\")");
  t.getRange('B:B').setNumberFormat('HH:mm');
  t.getRange('H:H').setNumberFormat('#,##0');
  [110, 60, 150, 105, 320, 260, 45, 90, 120, 110, 80, 100, 160].forEach((w, i) => t.setColumnWidth(i + 1, w));

  const def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 2) ss.deleteSheet(def);
  ss.setSpreadsheetTimeZone(TZ);
}

function doGet() {
  return json({ ok: true, msg: 'API đơn hàng đang chạy' });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: 'Dữ liệu gửi lên không hợp lệ' }); }
  if (req.token !== SECRET) return json({ ok: false, error: 'Sai mã bí mật — kiểm tra lại Cài đặt extension' });
  try {
    switch (req.action) {
      case 'ping': return json({ ok: true, sheetUrl: SpreadsheetApp.getActive().getUrl() });
      case 'check': return json({ ok: true, matches: findDup(req.order && req.order.phone) });
      case 'save': return json(saveOrder(req.order || {}));
      case 'list': return json({ ok: true, orders: listOrders(req.days || 1), sheetUrl: SpreadsheetApp.getActive().getUrl() });
      case 'markSent': return json(markSent(req.ids || []));
      default: return json({ ok: false, error: 'Không rõ thao tác: ' + req.action });
    }
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

// ---------------------------------------------------------------------------

function sheet() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Chưa có tab "' + SHEET_NAME + '" — hãy chạy hàm setup() trong Apps Script');
  return sh;
}

function rows() {
  const sh = sheet();
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, HEADERS.length).getValues().map((r, i) => ({ r, row: i + 2 }));
}

function normPhone(s) {
  let d = String(s || '').replace(/\D/g, '');
  if (d.indexOf('84') === 0 && d.length === 11) d = '0' + d.slice(2);
  if (d.length === 9) d = '0' + d;
  return d;
}

function fmtTime(d) {
  return d instanceof Date ? Utilities.formatDate(d, TZ, 'dd/MM HH:mm') : String(d);
}

function toOrder(x) {
  const r = x.r;
  return {
    id: r[C.ID], time: fmtTime(r[C.TIME]), name: r[C.NAME], phone: normPhone(r[C.PHONE]), address: r[C.ADDR],
    product: r[C.PRODUCT], qty: r[C.QTY], total: r[C.TOTAL], note: r[C.NOTE], page: r[C.PAGE],
    link: r[C.LINK], status: r[C.STATUS], dup: r[C.DUP],
  };
}

function findDup(phone, all) {
  phone = normPhone(phone);
  if (phone.length < 10) return [];
  const since = Date.now() - DUP_DAYS * 864e5;
  return (all || rows())
    .filter((x) => normPhone(x.r[C.PHONE]) === phone && x.r[C.TIME] instanceof Date && x.r[C.TIME].getTime() >= since)
    .map(toOrder);
}

function saveOrder(o) {
  const phone = normPhone(o.phone);
  if (phone.length !== 10) return { ok: false, error: 'SĐT không hợp lệ: ' + (o.phone || '(trống)') };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const all = rows();
    const dups = findDup(phone, all);
    const prefix = 'DH' + Utilities.formatDate(new Date(), TZ, 'yyMMdd') + '-';
    const todayCount = all.filter((x) => String(x.r[C.ID]).indexOf(prefix) === 0).length;
    const id = prefix + ('00' + (todayCount + 1)).slice(-3);
    const dupText = dups.length ? 'Trùng ' + dups.map((d) => d.id + ' (' + d.time + ')').join(', ') : '';

    const sh = sheet();
    const row = sh.getLastRow() + 1;
    sh.getRange(row, 1, 1, HEADERS.length).setValues([[
      id, new Date(), o.name || '', "'" + phone, o.address || '', o.product || '', Number(o.qty) || '',
      Number(o.total) || '', o.note || '', o.page || '', o.link || '', 'Mới', dupText,
    ]]);
    // đánh dấu ngược lại cho các đơn cũ bị trùng
    dups.forEach((d) => {
      const x = all.find((a) => a.r[C.ID] === d.id);
      if (x && !x.r[C.DUP]) sh.getRange(x.row, C.DUP + 1).setValue('Trùng ' + id);
    });
    return { ok: true, id: id, dups: dups };
  } finally {
    lock.releaseLock();
  }
}

function listOrders(days) {
  const start = new Date(Date.now() - (days - 1) * 864e5);
  const startStr = Utilities.formatDate(start, TZ, 'yyyy-MM-dd');
  return rows()
    .filter((x) => x.r[C.TIME] instanceof Date && Utilities.formatDate(x.r[C.TIME], TZ, 'yyyy-MM-dd') >= startStr)
    .map(toOrder);
}

function markSent(ids) {
  const set = {};
  ids.forEach((id) => (set[id] = true));
  const sh = sheet();
  let n = 0;
  rows().forEach((x) => {
    if (set[x.r[C.ID]]) { sh.getRange(x.row, C.STATUS + 1).setValue('Đã gửi kho'); n++; }
  });
  return { ok: true, updated: n };
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
