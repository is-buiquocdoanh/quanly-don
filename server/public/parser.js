// Bộ tách thông tin đơn hàng từ đoạn chat (tiếng Việt).
// Dùng được cả trong extension (window.OrderParser) và Node (module.exports) để test.
(function (root) {
  const PHONE_RE = /(?:\+?84|0)(?:[\s.\-]?\d){9}(?!\d)/;
  const LOC_RE = /(^|[\s,(])(xã|phường|thị trấn|thị xã|quận|huyện|tỉnh|thành phố|tp\.?|thôn|xóm|ấp|bản|khu phố|kp|tổ|số nhà|đường|ngõ|ngách|hẻm|kiệt)[\s.]/iu;
  const UNIT = '(?:hộp|hop|hũ|hủ|gói|goi|túi|lọ|combo|set|bịch)';

  function normalizePhone(s) {
    let d = String(s || '').replace(/\D/g, '');
    if (d.startsWith('84') && d.length === 11) d = '0' + d.slice(2);
    if (d.length === 9) d = '0' + d;
    return d;
  }

  function parseMoney(s) {
    if (s == null || s === '') return 0;
    if (typeof s === 'number') return Math.round(s);
    const str = String(s).toLowerCase().replace(/\s/g, '');
    const m = str.match(/(\d+(?:[.,]\d+)*)(k|nghìn|ngàn|tr|triệu)?/u);
    if (!m) return 0;
    let n;
    if (m[2]) {
      n = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
      if (/^(k|nghìn|ngàn)$/u.test(m[2])) n *= 1000;
      else n *= 1e6;
    } else {
      n = parseInt(m[1].replace(/[.,]/g, ''), 10);
    }
    return Math.round(n) || 0;
  }

  function stripLead(s) {
    // bỏ emoji / ký tự đầu dòng
    return String(s || '').replace(/^[^\p{L}\d+]+/u, '').trim();
  }

  function labeled(text, labelRe) {
    const re = new RegExp('(?:^|\\n)[^\\p{L}\\n]*(?:' + labelRe + ')\\s*:\\s*([^\\n]+)', 'iu');
    const m = text.match(re);
    return m ? m[1].trim() : '';
  }

  function parse(raw) {
    const text = String(raw || '').replace(/\r/g, '').trim();
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const out = { name: '', phone: '', address: '', product: '', qty: 0, total: 0, note: '' };

    // --- SĐT ---
    const pm = text.match(PHONE_RE);
    if (pm) out.phone = normalizePhone(pm[0]);

    // --- Trường có nhãn rõ ràng (dạng "Tên: ...", "Địa chỉ: ...") ---
    out.name = labeled(text, 'họ tên|họ và tên|tên khách|tên người nhận|người nhận|tên');
    out.address = labeled(text, 'địa chỉ(?: nhận(?: hàng)?| giao(?: hàng)?)?|đc');
    out.product = labeled(text, 'sản phẩm|sp|mặt hàng|đơn hàng');

    // --- Dòng chứa SĐT: "Tên, SĐT 09xx, địa chỉ, đơn 2 hộp 130K" ---
    const infoRaw = lines.find((l) => PHONE_RE.test(l)) || '';
    if (infoRaw) {
      let info = stripLead(infoRaw).replace(
        /^(?:thông tin(?: nhận hàng| giao hàng| người nhận)?|người nhận|giao (?:đến|tới)|địa chỉ(?: nhận hàng)?)\s*:\s*/iu,
        ''
      );
      const m = info.match(PHONE_RE);
      if (m) {
        const before = info.slice(0, m.index)
          .replace(/[,\-–:;|]*\s*(?:sđt|sdt|đt|dt|điện thoại|số điện thoại|phone|tel)\s*:?\s*$/iu, '')
          .replace(/[\s,\-–:;|]+$/u, '')
          .trim();
        let after = info.slice(m.index + m[0].length).replace(/^[\s,\-–:;|.]+/u, '');
        after = after.split(/[,\-–]\s*(?:đơn|đặt|sl|số lượng|lấy)\s*:?\s*\d/iu)[0].replace(/[\s,.\-–]+$/u, '').trim();

        if (!out.name && before && before.length <= 40 && !LOC_RE.test(' ' + before + ' ')) out.name = before;
        if (!out.address && after) out.address = after;
        // trường hợp "Tên - địa chỉ - SĐT" (SĐT nằm cuối)
        if (!out.address && before && LOC_RE.test(' ' + before + ' ')) {
          const parts = before.split(/\s*[,\-–]\s*/);
          if (!out.name && parts.length > 1 && !LOC_RE.test(' ' + parts[0] + ' ')) {
            out.name = parts.shift();
          }
          out.address = parts.join(', ');
        }
      }
    }

    // --- Địa chỉ dự phòng: dòng có xã/phường/huyện... ---
    if (!out.address) {
      const locLines = lines.filter((l) => LOC_RE.test(' ' + l + ' ') && !PHONE_RE.test(l));
      if (locLines.length) out.address = locLines.map(stripLead).join(', ');
    }

    // --- Tên dự phòng: "Cảm ơn anh Nguyễn Văn A đã..." ---
    if (!out.name) {
      const g = text.match(/(?:anh|chị|chi|cô|chú|bác|bạn|em)\s+(\p{Lu}\p{L}*(?:\s+\p{Lu}\p{L}*){0,4})/u);
      if (g) out.name = g[1];
    }

    // --- Sản phẩm + số lượng ---
    const qtyRe = new RegExp('(\\d+)\\s*' + UNIT, 'iu');
    if (!out.product) {
      const pl = lines.find((l) => qtyRe.test(l) && !PHONE_RE.test(l));
      if (pl) out.product = stripLead(pl);
    }
    const qm = (out.product && out.product.match(qtyRe)) || text.match(qtyRe);
    if (qm) out.qty = parseInt(qm[1], 10);

    // --- Tổng tiền ---
    const tm = text.match(
      /(?:tổng(?: thanh toán| tiền| cộng| đơn)?|thành tiền|thu hộ|cod|giá)\s*:?\s*(\d[\d.,]*\s*(?:k|nghìn|ngàn|tr|triệu)?)/iu
    );
    if (tm) out.total = parseMoney(tm[1]);
    if (!out.total) {
      const km = text.match(/(\d[\d.,]*)\s*(?:k|nghìn|ngàn)(?![\p{L}])/iu) || text.match(/(\d{1,3}(?:[.,]\d{3})+)\s*(?:đ|vnđ|vnd|d)(?![\p{L}])/iu);
      if (km) out.total = parseMoney(km[0]);
    }

    // --- Ghi chú ship ---
    const notes = [];
    if (/miễn phí (?:ship|vận chuyển|giao hàng)|free\s?ship/iu.test(text)) notes.push('Freeship');
    else {
      const sm = text.match(/(?:phí ship|ship)\s*:?\s*(\d[\d.,]*\s*k?)/iu);
      if (sm) notes.push('Ship ' + sm[1].trim());
    }
    out.note = notes.join(', ');

    return out;
  }

  const api = { parse, normalizePhone, parseMoney, PHONE_RE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OrderParser = api;
})(typeof window !== 'undefined' ? window : globalThis);
