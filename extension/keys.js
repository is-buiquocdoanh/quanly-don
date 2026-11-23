// Phím tắt tùy chỉnh — dùng chung cho khung lưu đơn (content.js), trang Tùy chọn và bảng bên cạnh.
// Phím được lưu dạng chuỗi: "1", "Q", "F2", "Alt+S", "Ctrl+Shift+1"…
(function (root) {
  const DEFAULTS = { openKey: 'Alt+S', saveKey: '', copyOpens: true };

  const SPECIAL = {
    Space: 'Space', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
    Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Enter: 'Enter', NumpadEnter: 'Enter', Escape: 'Esc',
    Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete', Insert: 'Insert', Home: 'Home', End: 'End', PageUp: 'PageUp',
    PageDown: 'PageDown', NumpadAdd: '+', NumpadSubtract: '-', NumpadMultiply: '*', NumpadDivide: '/', NumpadDecimal: '.',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  };

  // dựa vào vị trí phím (e.code) để không phụ thuộc bộ gõ tiếng Việt / bàn phím; số ở hàng trên và bàn phím số như nhau
  function keyName(e) {
    if (['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'CapsLock'].includes(e.key)) return '';
    const c = e.code || '';
    let m;
    if ((m = c.match(/^Key([A-Z])$/))) return m[1];
    if ((m = c.match(/^(?:Digit|Numpad)(\d)$/))) return m[1];
    if (/^F\d{1,2}$/.test(c)) return c;
    return SPECIAL[c] || (e.key && e.key.length === 1 ? e.key.toUpperCase() : e.key) || '';
  }
  function combo(e) {
    const k = keyName(e);
    if (!k) return '';
    return [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Meta', k].filter(Boolean).join('+');
  }
  // phím đơn (không Ctrl/Alt…, không phải F1–F12) → chỉ dùng khi không gõ chữ
  const isPlain = (c) => !!c && !c.includes('+') && !/^F\d+$/.test(c);
  function isEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.isContentEditable) return true;
    if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
    return el.tagName === 'INPUT' && !/^(button|checkbox|radio|submit|reset|range|color|file|image)$/i.test(el.type);
  }
  // phím không cho đặt (phá thao tác cơ bản)
  const RESERVED = new Set(['Enter', 'Esc', 'Tab', 'Backspace', 'Delete', 'Space', 'Ctrl+C', 'Ctrl+V', 'Ctrl+X', 'Ctrl+A', 'Ctrl+Z', 'Ctrl+Y',
    'Meta+C', 'Meta+V', 'Meta+X', 'Meta+A', 'Meta+Z', 'Alt+Shift+B', 'Shift+Space', 'Ctrl+Enter']);
  function check(c) {
    if (!c) return 'Nhấn một phím';
    if (RESERVED.has(c)) return `Không dùng được ${c} (phím thao tác cơ bản)`;
    if (/^Shift\+.$/.test(c)) return 'Shift + 1 phím dễ trùng khi gõ chữ hoa — chọn phím khác';
    return '';
  }
  // hiển thị đẹp: "Alt+S" → "Alt + S"
  const label = (c) => (c ? c.split('+').join(' + ') : '');

  const api = { DEFAULTS, keyName, combo, isPlain, isEditable, check, label };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Keys = api;
})(typeof window !== 'undefined' ? window : globalThis);
