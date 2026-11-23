// Bộ đọc địa chỉ Việt Nam không cần AI: so khớp (không dấu) với danh sách xã/huyện/tỉnh thật
// (cả 63 tỉnh cũ có quận/huyện lẫn 34 tỉnh sau sáp nhập 7/2025), rồi trả lại địa chỉ có dấu đầy đủ.
// Dùng được trong extension, web (window.VnAddr) và Node (module.exports) để test.
//   VnAddr.load(data)        data = nội dung vn-admin.json
//   VnAddr.resolve(text)     → { address, ward, district, province, detail, missing, warnings, ... } | null
//   VnAddr.fixName(name)     → { name, unsure } thêm dấu cho họ / tên đệm / tên phổ biến
(function (root) {
  const FULL = { x: 'Xã', p: 'Phường', t: 'Thị trấn', k: 'Đặc khu', h: 'Huyện', q: 'Quận', s: 'Thị xã', c: 'Thành phố', T: 'Tỉnh', C: 'Thành phố' };

  // từ khóa loại đơn vị khách hay viết (đã bỏ dấu) — đứng ngay trước tên
  const KW = {
    w: ['x', 'xa', 'p', 'ph', 'phg', 'phuong', 'f', 'tt', 'thi tran', 'ttr', 'dac khu'],
    d: ['h', 'hu', 'huyen', 'hyen', 'q', 'quan', 'tx', 'thi xa', 'tp', 'thanh pho'],
    p: ['t', 'tinh', 'tp', 'thanh pho'],
  };
  // tên tỉnh viết tắt / tên khác
  const ALIAS = {
    'hcm': 'Hồ Chí Minh', 'tphcm': 'Hồ Chí Minh', 'sg': 'Hồ Chí Minh', 'saigon': 'Hồ Chí Minh', 'sai gon': 'Hồ Chí Minh', 'hochiminh': 'Hồ Chí Minh',
    'hn': 'Hà Nội', 'hanoi': 'Hà Nội',
    'hue': 'Thừa Thiên Huế', 'tth': 'Thừa Thiên Huế',
    'brvt': 'Bà Rịa - Vũng Tàu', 'ba ria': 'Bà Rịa - Vũng Tàu',
    'daklak': 'Đắk Lắk', 'dac lac': 'Đắk Lắk', 'daklac': 'Đắk Lắk', 'dak lac': 'Đắk Lắk',
    'daknong': 'Đắk Nông', 'dac nong': 'Đắk Nông',
    'danang': 'Đà Nẵng', 'haiphong': 'Hải Phòng', 'cantho': 'Cần Thơ',
  };
  // từ đầu phần chi tiết (thôn, xóm, số nhà…) → có dấu
  const DETAIL_WORD = {
    thon: 'Thôn', xom: 'Xóm', ap: 'Ấp', ban: 'Bản', so: 'Số', sn: 'Số nhà', 'so nha': 'Số nhà', ngo: 'Ngõ', ngach: 'Ngách', hem: 'Hẻm', kiet: 'Kiệt',
    duong: 'Đường', to: 'Tổ', kp: 'Khu phố', 'khu pho': 'Khu phố', khom: 'Khóm', cum: 'Cụm', doi: 'Đội', lang: 'Làng', 'chung cu': 'Chung cư',
    'toa nha': 'Tòa nhà', 'tdp': 'Tổ dân phố', 'to dan pho': 'Tổ dân phố', 'khu': 'Khu', 'pho': 'Phố', 'cho': 'Chợ', 'gan': 'gần', 'canh': 'cạnh', 'doi dien': 'đối diện',
  };

  // ---- bỏ dấu, giữ nguyên độ dài chuỗi để ánh xạ vị trí về chuỗi gốc
  function fold(s) {
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === 'đ' || c === 'Đ') { out += 'd'; continue; }
      const b = c.normalize('NFD')[0].toLowerCase();
      out += /[a-z0-9]/.test(b) ? b : ' ';
    }
    return out;
  }
  const keyOf = (s) => (fold(s.normalize('NFC')).match(/[a-z]+|[0-9]+/g) || []).map((t) => (/^\d+$/.test(t) ? String(+t) : t)).join(' ');

  let INDEX = null; // key → [unit]
  let MAXLEN = 1;
  const PROV = { o: new Map(), n: new Map() }; // tên tỉnh → unit

  function add(key, u) {
    if (!key) return;
    (INDEX.get(key) || INDEX.set(key, []).get(key)).push(u);
    MAXLEN = Math.max(MAXLEN, key.split(' ').length);
  }
  function mk(code, extra) {
    const name = code.slice(1);
    return { type: code[0], name, full: FULL[code[0]] + ' ' + name, num: /^\d+$/.test(name), ...extra };
  }

  function load(data) {
    INDEX = new Map();
    MAXLEN = 1;
    for (const [pc, dists] of data.o) {
      const p = mk(pc, { sys: 'o', lvl: 'p' });
      add(keyOf(p.name), p);
      PROV.o.set(p.name, p);
      for (const [dc, wards] of dists) {
        const d = mk(dc, { sys: 'o', lvl: 'd', p, wards: [] });
        add(keyOf(d.name), d);
        for (const wc of wards) { const w = mk(wc, { sys: 'o', lvl: 'w', d, p }); d.wards.push(w); add(keyOf(w.name), w); }
      }
    }
    for (const [pc, wards] of data.n) {
      const p = mk(pc, { sys: 'n', lvl: 'p', wards: [] });
      add(keyOf(p.name), p);
      PROV.n.set(p.name, p);
      for (const wc of wards) { const w = mk(wc, { sys: 'n', lvl: 'w', p }); p.wards.push(w); add(keyOf(w.name), w); }
    }
    for (const [k, name] of Object.entries(ALIAS)) {
      for (const sys of ['o', 'n']) {
        const p = PROV[sys].get(name) || (name === 'Thừa Thiên Huế' && sys === 'n' ? PROV.n.get('Huế') : null);
        if (p && !(INDEX.get(k) || []).includes(p)) add(k, p);
      }
    }
    return true;
  }
  const ready = () => !!INDEX;

  // ---- tách từ, giữ vị trí ký tự + số dòng
  function tokenize(text) {
    const f = fold(text);
    const toks = [];
    const re = /[a-z]+|[0-9]+/g;
    let m;
    while ((m = re.exec(f))) {
      const line = (text.slice(0, m.index).match(/\n/g) || []).length;
      toks.push({ s: m.index, e: m.index + m[0].length, k: /^\d+$/.test(m[0]) ? String(+m[0]) : m[0], line });
    }
    return toks;
  }
  const KWT = Object.fromEntries(Object.entries(KW).map(([l, arr]) => [l, arr.map((x) => x.split(' '))]));
  // từ khóa nói rõ loại nào: "xã" ≠ "thị trấn", "huyện" ≠ "thành phố"…
  const KW_TYPE = {
    x: 'x', xa: 'x', p: 'p', ph: 'p', phg: 'p', phuong: 'p', f: 'p', tt: 't', 'thi tran': 't', ttr: 't', 'dac khu': 'k',
    h: 'h', hu: 'h', huyen: 'h', hyen: 'h', q: 'q', quan: 'q', tx: 's', 'thi xa': 's', tp: 'cC', 'thanh pho': 'cC', t: 'T', tinh: 'T',
  };
  function typedBefore(toks, i, lvl) {
    for (const kw of KWT[lvl]) {
      const st = i - kw.length;
      if (st < 0) continue;
      if (kw.every((w, j) => toks[st + j].k === w) && toks[st].line === toks[i].line) return { st, kind: KW_TYPE[kw.join(' ')] || '' };
    }
    return null;
  }

  function findMatches(toks, blocked) {
    const out = []; // {i, j, u, typed (token start of keyword or -1)}
    for (let i = 0; i < toks.length; i++) {
      if (blocked(i)) continue;
      let key = '';
      for (let len = 1; len <= MAXLEN && i + len <= toks.length; len++) {
        const t = toks[i + len - 1];
        if (blocked(i + len - 1) || t.line !== toks[i].line) break;
        key = len === 1 ? t.k : key + ' ' + t.k;
        const units = INDEX.get(key);
        if (!units) continue;
        for (const u of units) {
          const tb = typedBefore(toks, i, u.lvl);
          if (u.num && !tb) continue; // "5", "3": chỉ nhận khi có "phường 5", "quận 3"
          out.push({ i, j: i + len, len, u, typed: tb ? tb.st : -1, kindOk: tb ? tb.kind.includes(u.type) : null });
        }
      }
    }
    return out;
  }

  // điểm của 1 phần khớp: có từ khóa (xã/huyện/tỉnh) rất chắc; tên 1 từ không từ khóa thì yếu
  const unitScore = (m) => (m.typed >= 0 ? (m.kindOk ? 6 : 3) : m.len === 1 ? 1 : 2) + (m.len - 1);

  function combos(matches) {
    const by = new Map();
    for (const m of matches) (by.get(m.u) || by.set(m.u, []).get(m.u)).push(m);
    const pick = (u, after) => {
      const list = by.get(u) || [];
      let best = null;
      for (const m of list) {
        const sc = unitScore(m) + (after == null || m.i >= after ? 1 : 0);
        if (!best || sc > best.sc) best = { m, sc };
      }
      return best;
    };
    const res = [];
    const overl = (a, b) => a && b && a.i < b.j && b.i < a.j;
    const push = (sys, w, d, p, inferP) => {
      const parts = [w, d, p].filter(Boolean);
      if (parts.some((a, x) => parts.some((b, y) => x < y && overl(a.m, b.m)))) return;
      let score = parts.reduce((s, x) => s + x.sc, 0);
      const ms = parts.map((x) => x.m);
      const lines = new Set(ms.map((m) => m.line));
      const first = Math.min(...ms.map((m) => (m.typed >= 0 ? m.typed : m.i)));
      const last = Math.max(...ms.map((m) => m.j));
      if (last - first > 12) score -= 3; // các phần nằm quá xa nhau
      res.push({ sys, w: w && w.m, d: d && d.m, p: p && p.m, inferP, score, first, last, nUnits: parts.length });
    };
    for (const m of matches) {
      const u = m.u;
      if (u.lvl === 'w') {
        const w = { m, sc: unitScore(m) };
        const d = u.sys === 'o' ? pick(u.d, m.j) : null;
        const p = pick(u.p, d ? d.m.j : m.j);
        if (d && p) push(u.sys, w, d, p);
        if (d) push(u.sys, w, d, null, true);
        if (p) push(u.sys, w, null, p);
        if (m.typed >= 0 && m.len >= 2) push(u.sys, w, null, null, true);
      } else if (u.lvl === 'd') {
        const d = { m, sc: unitScore(m) };
        const p = pick(u.p, m.j);
        if (p) push('o', null, d, p);
        if (m.typed >= 0) push('o', null, d, null, true);
      } else {
        push(u.sys, null, null, { m, sc: unitScore(m) });
      }
    }
    return res;
  }

  function lev(a, b) {
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > 3) return 99;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  function titleWords(s) {
    return s.replace(/(^|[\s,./-])(\p{Ll})/gu, (_, a, b) => a + b.toUpperCase());
  }
  function prettyDetail(raw) {
    let s = raw.replace(/^[\s,.;:|\-–]+|[\s,.;:|\-–]+$/g, '').replace(/\s+/g, ' ');
    if (!s) return '';
    const plain = fold(s) === s.toLowerCase().replace(/[^a-z0-9]/g, ' ');
    s = s.replace(/\b(kp|to|tdp|ap|thon|xom|so|sn|ngo|hem|kiet|ngach|doi|cum|khom)(\d)/gi, '$1 $2'); // "kp3" → "kp 3"
    // mở rộng thôn/xóm/số nhà… khi khách viết không dấu
    s = s.replace(/(^|[\s,])([a-zA-Z]+(?: [a-zA-Z]+)?)(?=$|[\s,0-9])/g, (all, a, w) => {
      const k = w.toLowerCase();
      if (DETAIL_WORD[k]) return a + DETAIL_WORD[k];
      const first = k.split(' ')[0];
      if (k.includes(' ') && DETAIL_WORD[first]) return a + DETAIL_WORD[first] + w.slice(first.length);
      return all;
    });
    s = plain ? titleWords(s) : s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  const MISS = { detail: 'số nhà / thôn', ward: 'xã / phường', province: 'tỉnh / thành phố' };

  /**
   * Tìm địa chỉ trong đoạn chat. opts.skip: các khoảng ký tự [s, e) không xét (SĐT, tên…).
   * Trả về null nếu không tìm được địa chỉ nào đủ tin cậy.
   */
  function resolve(text, opts = {}) {
    if (!INDEX) return null;
    text = String(text || '').normalize('NFC');
    const toks = tokenize(text);
    const skip = opts.skip || [];
    const blocked = (i) => skip.some(([s, e]) => toks[i].s < e && s < toks[i].e);
    const matches = findMatches(toks, blocked);
    for (const m of matches) m.line = toks[m.i].line;
    // tỉnh khách ghi rõ (tên ≥ 2 từ hoặc có chữ "tỉnh") — điền tỉnh khác theo tên huyện là sai
    const saidProv = new Set(matches.filter((m) => m.u.lvl === 'p' && (m.len >= 2 || m.typed >= 0)).map((m) => m.u.name));
    let cs = combos(matches);
    for (const c of cs) {
      const pName = c.p ? c.p.u.name : (c.w || c.d).u.p.name;
      if (c.inferP && saidProv.size && !saidProv.has(pName)) c.score -= 6;
    }
    cs = cs.filter((c) => c.score >= (c.nUnits === 1 ? 3 : 5));
    if (!cs.length) return null;
    cs.sort((a, b) => b.score - a.score || b.nUnits - a.nUnits || (a.sys === 'o' && a.d ? -1 : 0) - (b.sys === 'o' && b.d ? -1 : 0) || b.last - a.last);
    const best = cs[0];

    let W = best.w && best.w.u;
    const D = best.d && best.d.u;
    const P = best.p ? best.p.u : (W || D).p;
    const warnings = [];
    let first = best.first;
    let wardText = W ? W.full : '';
    if (!W) {
      // khách có ghi "xã/phường ..." nhưng tên không khớp: tìm xã gần đúng trong đúng huyện (cũ) / tỉnh (mới)
      const line = toks[first].line;
      let kwAt = -1, kind = '';
      for (let i = first - 1; i >= 0 && toks[i].line === line; i--) {
        const tb = typedBefore(toks, i + 1, 'w');
        if (tb && tb.st < first && i + 1 < first) { kwAt = tb.st; kind = tb.kind; break; }
      }
      if (kwAt >= 0) {
        const kwLen = KWT.w.find((kw) => kw.every((w, j) => toks[kwAt + j] && toks[kwAt + j].k === w)).length;
        const words = toks.slice(kwAt + kwLen, first);
        if (words.length && words.length <= 5) {
          const said = words.map((t) => t.k).join(' ');
          const pool = D ? D.wards : best.sys === 'n' ? P.wards : [];
          let bestW = null, bestD = 99;
          for (const w of pool) { const dd = lev(keyOf(w.name), said); if (dd < bestD) { bestD = dd; bestW = w; } }
          const rawSaid = text.slice(words[0].s, words[words.length - 1].e);
          if (bestW && bestD <= Math.max(1, Math.floor(said.length / 5))) {
            W = bestW;
            wardText = W.full;
            warnings.push(`Khách ghi "${rawSaid}" — gần nhất là ${W.full}, kiểm tra lại`);
          } else {
            wardText = (FULL[kind] || 'Xã') + ' ' + titleWords(rawSaid);
            warnings.push(`Không tìm thấy "${rawSaid}" trong ${D ? D.full : P.full} — kiểm tra lại tên xã/phường`);
          }
          first = kwAt;
        }
      }
    }
    if (best.inferP) warnings.push(`Khách không ghi tỉnh — đã điền ${P.full} theo tên ${D ? D.full : W.full}`);
    // cùng điểm nhưng khác nơi → mơ hồ
    const alt = cs.filter((c) => c !== best && c.score === best.score && c.nUnits === best.nUnits)
      .map((c) => [c.w && c.w.u.full, c.d && c.d.u.full, (c.p ? c.p.u : (c.w || c.d).u.p).full].filter(Boolean).join(', '))
      .filter((s, i, a) => a.indexOf(s) === i && s !== [W && W.full, D && D.full, P.full].filter(Boolean).join(', '));
    if (alt.length) warnings.push('Cũng có thể là: ' + alt.slice(0, 2).join(' · '));

    // phần chi tiết (số nhà, thôn…): từ đầu dòng (sau SĐT / tên) đến trước tên đơn vị đầu tiên
    const firstTok = toks[first];
    const lineStart = text.lastIndexOf('\n', firstTok.s - 1) + 1;
    let ds = lineStart;
    for (const [s, e] of skip) if (e <= firstTok.s && e > ds && s >= lineStart - 1) ds = e;
    let detailRaw = text.slice(ds, firstTok.s);
    // bỏ nhãn "địa chỉ:", "đc:"
    detailRaw = detailRaw.replace(/^[\s,.;:|\-–]*(?:địa chỉ|dia chi|đ\/c|đc|dc|d\/c|add|addr)\s*(?:nhận(?: hàng)?|nhan(?: hang)?|giao(?: hàng)?)?\s*[:\-]?\s*/iu, '');
    const detail = prettyDetail(detailRaw);

    const address = [detail, wardText, D && D.full, P.full].filter(Boolean).join(', ');
    const missing = [];
    if (!detail) missing.push('detail');
    if (!wardText) missing.push('ward');
    return {
      address, detail,
      ward: wardText, district: D ? D.full : '', province: P.full,
      system: best.sys === 'o' ? 'cũ (63 tỉnh)' : 'mới (34 tỉnh)',
      start: detail ? ds : firstTok.s, end: toks[best.last - 1].e,
      score: best.score, missing, missingText: missing.map((m) => MISS[m]), warnings,
    };
  }

  // ---- thêm dấu cho tên khách viết không dấu (họ, tên đệm, tên phổ biến ít nhầm)
  const NAME = Object.fromEntries(`Nguyễn Trần Lê Phạm Hoàng Huỳnh Phan Vũ Võ Đặng Bùi Đỗ Hồ Ngô Dương Lý Đinh Trương Mai Cao Lâm Trịnh Đoàn Lương Tạ Chu Kiều Đàm Tô Quách Thái Văn Thị Đức Minh Quốc Thành Công Hữu Xuân Thu Ngọc Thanh Kim Bảo Gia Hồng Tuấn Hùng Cường Thắng Dũng Huy Khánh Trung Hiếu Quang Phúc Tùng Sơn Long Nam Duy Hải Anh Linh Trang Hương Phương Thảo Nga Lan Hạnh Huyền Yến Nhung Giang Loan Hiền Trâm Vy Ngân Quỳnh Diệp Như Nhi Tâm Thủy Tiến Toàn Vinh Đạt Hiển Khoa Kiên Lộc Nghĩa Nhân Phong Quân Tài Thiện Thịnh Tú Việt Vương Lực Hưng Hoa Hà Huệ Liên Liễu Lụa Mận Mến Nguyệt Nhàn Oanh Phượng Sương Tuyết Uyên Vân Xoan Yên Đào Bích Diễm Hằng Hậu Hoài Hường Khuyên Lệ Lý Mỹ Ánh Châu Chi Dung Duyên Hảo Hiên Hoà`
    .split(/\s+/).reverse().map((w) => [fold(w).trim(), w])); // trùng không dấu: giữ cách viết đứng trước (phổ biến hơn)
  // tên có nhiều cách viết dấu → không đoán
  const AMBIG = new Set(['hoa', 'ha', 'thuy', 'dung', 'ly', 'tu', 'yen', 'chi', 'hoai', 'mai', 'hien', 'thu', 'tam', 'nhan', 'loc', 'hai', 'nga', 'my', 'vy', 'thi', 'van']);
  const ALWAYS = new Set(['nguyen', 'tran', 'le', 'pham', 'hoang', 'huynh', 'phan', 'vu', 'vo', 'dang', 'bui', 'do', 'ho', 'ngo', 'duong', 'dinh', 'truong', 'doan', 'luong', 'trinh', 'thi', 'van']);

  function fixName(name) {
    name = String(name || '').trim().replace(/\s+/g, ' ');
    if (!name) return { name: '', unsure: [] };
    const words = name.split(' ');
    const accented = fold(name) !== name.toLowerCase().replace(/[^a-z0-9]/g, ' ');
    if (accented) return { name: words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' '), unsure: [] };
    const unsure = [];
    const out = words.map((w, i) => {
      const k = w.toLowerCase();
      // họ (từ đầu) và tên đệm thị/văn: chắc chắn; từ cuối mơ hồ thì giữ nguyên
      if (NAME[k] && (ALWAYS.has(k) && i < words.length - 1 || !AMBIG.has(k))) return NAME[k];
      if (NAME[k] && i === 0 && ALWAYS.has(k)) return NAME[k];
      unsure.push(w);
      return k.charAt(0).toUpperCase() + k.slice(1);
    });
    return { name: out.join(' '), unsure };
  }

  const isSurname = (w) => ALWAYS.has(fold(String(w || '')).trim()) || ['mai', 'cao', 'lam', 'ta', 'chu', 'kieu', 'dam', 'to', 'quach', 'thai', 'ly', 'ha'].includes(fold(String(w || '')).trim());
  const api = { load, ready, resolve, fixName, isSurname, fold, keyOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VnAddr = api;
})(typeof window !== 'undefined' ? window : globalThis);
