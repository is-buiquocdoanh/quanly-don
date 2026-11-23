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
      /(?:tổng(?: thanh toán| tiền| cộng| đơn)?|tong(?: thanh toan| tien| cong| don)?|thành tiền|thanh tien|thu hộ|thu ho|cod|giá|gia)\s*:?\s*(\d[\d.,]*\s*(?:k|nghìn|ngàn|nghin|ngan|tr|triệu|trieu)?)/iu
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
    const NOTE_RE = /(gọi trước(?: khi giao)?|goi truoc(?: khi giao)?|giao giờ hành chính|giao gio hanh chinh|giờ hành chính|gio hanh chinh|cho xem hàng|cho xem hang|không cho xem hàng|giao (?:buổi )?(?:sáng|chiều|tối)|giao (?:buoi )?(?:sang|chieu|toi)|giao (?:thứ \d|t\d|chủ nhật|cuối tuần))/giu;
    const nm = [...text.matchAll(NOTE_RE)].map((m) => m[1]);
    for (const n of nm) {
      const pretty = (globalThis.VnAddr && /^[a-z0-9 ]+$/i.test(n) ? ({ 'goi truoc': 'Gọi trước', 'goi truoc khi giao': 'Gọi trước khi giao', 'giao gio hanh chinh': 'Giao giờ hành chính', 'gio hanh chinh': 'Giờ hành chính', 'cho xem hang': 'Cho xem hàng' }[n.toLowerCase()] || n) : n);
      const cap = pretty.charAt(0).toUpperCase() + pretty.slice(1);
      if (!notes.some((x) => x.toLowerCase() === cap.toLowerCase())) notes.push(cap);
    }
    out.note = notes.join(', ');

    smarten(out, text, pm);
    return out;
  }

  // ---- Bổ sung bằng danh sách địa giới (vnaddr.js) nếu đã nạp: địa chỉ có dấu đầy đủ, tên có dấu,
  //      báo thiếu / nghi ngờ. Không có danh sách thì giữ kết quả cũ.
  function smarten(out, text, pm) {
    out.hints = { warnings: [], missing: [], auto: [] };
    const V = typeof root.VnAddr !== 'undefined' ? root.VnAddr : null;
    if (!V || !V.ready()) return;
    const skip = pm ? [[pm.index, pm.index + pm[0].length]] : [];
    const r = V.resolve(text, { skip });
    const fold = (x) => V.fold(String(x || '')).replace(/\s+/g, ' ').trim();

    // tên đoán nhầm thành một phần địa chỉ (vd "yen phu nam dinh 09…")
    if (r && out.name && r.start <= text.indexOf(out.name) && text.indexOf(out.name) < r.end && !r.detail.includes(out.name)) out.name = '';
    if (r) {
      let detail = r.detail;
      // "Tên, địa chỉ…" cùng dòng: bỏ tên khỏi phần chi tiết
      if (out.name && fold(detail).startsWith(fold(out.name))) detail = detail.slice(out.name.length).replace(/^[\s,.;:\-–]+/, '');
      out.address = [detail, r.ward, r.district, r.province].filter(Boolean).join(', ');
      out.hints.auto.push('address');
      out.hints.warnings.push(...r.warnings);
      if (!detail) out.hints.missing.push('detail');
      if (!r.ward) out.hints.missing.push('ward');
    } else {
      if (!out.address) out.hints.missing.push('address');
      else out.hints.warnings.push('Không nhận ra xã / huyện / tỉnh trong địa chỉ — kiểm tra lại');
    }
    // bỏ phần mở đầu dính vào tên: "Gửi về:", "Người nhận", "em tên là"…
    const NAME_LEAD = /^(?:gửi về|gui ve|giao về|giao ve|ship về|ship ve|gửi cho|gui cho|người nhận|nguoi nhan|tên người nhận|ten nguoi nhan|họ và tên|ho va ten|họ tên|ho ten|tên|ten|(?:e|em|chị|chi|c|a|anh|mình|minh|tôi|toi)\s+t[eê]n(?:\s+l[aà])?|t[eê]n\s+(?:e|em|chị|chi|mình|minh)(?:\s+l[aà])?)\s*[:\-]?\s*/iu;
    if (out.name) out.name = out.name.replace(NAME_LEAD, '').trim();
    if (!out.name) {
      // "người nhận Hoàng Lan 09…", "tên: …" ở giữa câu
      const m = text.match(/(?:người nhận|nguoi nhan|gửi cho|gui cho|giao cho|tên người nhận|ten nguoi nhan)\s*:?\s*([\p{L}]+(?:\s+[\p{L}]+){0,4}?)(?=\s*(?:[,.;\-–|(\n]|\+?\d|sđt|sdt|$))/iu);
      if (m) out.name = m[1];
    }
    if (!out.name) {
      // tên nằm riêng 1 dòng: 2–5 chữ, bắt đầu bằng họ phổ biến
      const line = text.split(/\n+/).map((l) => l.trim()).find((l) => /^[\p{L}]+(?:\s+[\p{L}]+){1,4}$/u.test(l) && V.isSurname(l.split(/\s+/)[0]));
      if (line) out.name = line;
    }
    // tên không dấu → thêm dấu cho họ / tên đệm / tên phổ biến
    if (out.name) {
      const f = V.fixName(out.name);
      if (f.name !== out.name) out.hints.auto.push('name');
      out.name = f.name;
      if (f.unsure.length && f.unsure.length < out.name.split(' ').length) out.hints.warnings.push(`Tên "${f.unsure.join(' ')}" chưa rõ dấu — sửa nếu cần`);
    } else out.hints.missing.push('name');
    if (!out.phone) out.hints.missing.push('phone');
    if (!out.qty) {
      // "lấy 2", "sl 2", dòng chỉ có "2h"
      const q = text.match(/(?:lấy|lay|đặt|dat|sl|số lượng|so luong)\s*:?\s*(\d{1,2})(?!\d|\s*(?:k|nghìn|ngàn|tr|đ)\b)/iu) || text.match(/(?:^|\n)\s*(\d{1,2})\s*h\s*(?:\n|$)/iu);
      if (q) out.qty = parseInt(q[1], 10);
    }
    if (!out.qty) out.hints.missing.push('qty');
    if (!out.total) out.hints.missing.push('total');
    // dòng chat kiểu "chị ơi lấy em 2 hộp nhé" không phải tên sản phẩm
    if (out.product && !/trứng|trung|sâu|sau|canxi|ruồi|ruoi|combo|loại|loai|size/iu.test(out.product)) out.product = '';
  }

  const api = { parse, normalizePhone, parseMoney, PHONE_RE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OrderParser = api;
})(typeof window !== 'undefined' ? window : globalThis);
