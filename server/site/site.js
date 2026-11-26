// Tương tác mượt mà cho website công khai: hiệu ứng cuộn trang, thanh tiến độ, chọn combo 35g, freeship tự động, gửi đơn trực tiếp.
(() => {
  const fmtMoney = (n) => (Number(n) || 0).toLocaleString('vi-VN') + 'đ';

  // 0. Thống kê truy cập (gửi về trang quản lý đơn) + sự kiện Facebook Pixel (nếu shop đã cài Pixel)
  const T = (() => {
    const store = (st, k, v) => { try { if (v === undefined) return st.getItem(k); st.setItem(k, v); return v; } catch { return null; } };
    const L = (k, v) => store(window.localStorage, k, v);
    const S = (k, v) => store(window.sessionStorage, k, v);
    const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    let isNew = 0;
    let vid = L('qld_v');
    if (!vid) { vid = L('qld_v', rid()) || ''; isNew = vid ? 1 : 0; } // trình duyệt chặn lưu → để trống, máy chủ tự tính
    const sid = S('qld_s') || S('qld_s', rid()) || '';
    // nguồn của phiên: lấy ở trang đầu tiên khách vào (trang dẫn tới + utm + fbclid)
    let src = null;
    try { src = JSON.parse(S('qld_src') || 'null'); } catch { src = null; }
    if (!src) {
      const q = new URLSearchParams(location.search);
      src = {
        r: document.referrer || '', us: q.get('utm_source') || '', um: q.get('utm_medium') || '', uc: q.get('utm_campaign') || '',
        fb: q.has('fbclid') ? 1 : 0, g: q.has('gclid') ? 1 : 0, tt: q.has('ttclid') ? 1 : 0,
        fbclid: (q.get('fbclid') || '').slice(0, 200), at: Date.now(),
      };
      S('qld_src', JSON.stringify(src));
    }
    const base = () => ({ v: vid, s: sid, p: location.pathname, u: location.href.split('#')[0].slice(0, 500), r: src.r, us: src.us, um: src.um, uc: src.uc, fb: src.fb, g: src.g, tt: src.tt });
    function send(t, extra = {}) {
      const body = JSON.stringify({ ...base(), t, n: t === 'view' ? isNew : 0, ...extra });
      if (t === 'view') isNew = 0;
      try {
        if (navigator.sendBeacon && navigator.sendBeacon('/api/t', new Blob([body], { type: 'application/json' }))) return;
      } catch { /* dùng fetch */ }
      fetch('/api/t', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    }
    const fbq = (...a) => { try { if (typeof window.fbq === 'function') window.fbq(...a); } catch { /* bỏ qua */ } };
    const cookie = (k) => (document.cookie.match(new RegExp('(?:^|; )' + k + '=([^;]*)')) || [])[1] || '';
    // để gửi kèm đơn hàng (máy chủ báo Facebook bằng Conversions API, gộp với Pixel)
    const forOrder = () => ({
      _t: base(),
      fbp: cookie('_fbp'),
      fbc: cookie('_fbc') || (src.fbclid ? `fb.1.${src.at || Date.now()}.${src.fbclid}` : ''),
    });
    return { send, fbq, forOrder };
  })();

  T.send('view');
  if (document.querySelector('[data-order-form]')) T.fbq('track', 'ViewContent', { content_name: 'Trứng sâu canxi hũ 35g', content_type: 'product', currency: 'VND', value: 130000 });

  // lượt bấm: gọi điện, Zalo, Messenger, nút đặt hàng, chọn combo
  document.addEventListener('click', (e) => {
    const el = e.target.closest('a, button');
    if (!el) return;
    const href = el.getAttribute('href') || '';
    let label = '';
    let contact = false;
    if (/^tel:/i.test(href)) { label = 'Gọi điện'; contact = true; }
    else if (/zalo\.me|zalo\.vn/i.test(href)) { label = 'Chat Zalo'; contact = true; }
    else if (/m\.me\/|messenger\.com/i.test(href)) { label = 'Nhắn Messenger'; contact = true; }
    else if (/facebook\.com/i.test(href)) label = 'Mở fanpage';
    else if (/tiktok\.com/i.test(href)) label = 'Mở TikTok';
    else if (el.hasAttribute('data-pick-qty')) label = `Chọn combo ${el.getAttribute('data-pick-qty')} hũ`;
    else if (el.hasAttribute('data-order-submit')) label = 'Bấm gửi đơn';
    else if (/dat-hang/.test(href)) label = 'Nút Đặt hàng';
    if (!label) return;
    T.send('click', { l: label });
    if (contact) T.fbq('track', 'Contact', { content_name: label });
  }, true);

  // bắt đầu điền form đặt hàng (1 lần mỗi trang)
  document.querySelectorAll('[data-order-form]').forEach((f) => {
    let started = false;
    f.addEventListener('input', () => {
      if (started) return;
      started = true;
      T.send('form');
      T.fbq('track', 'InitiateCheckout', { currency: 'VND', content_type: 'product' });
    });
  });

  // 1. Hiệu ứng xuất hiện khi cuộn trang (Scroll Reveal)
  const reveals = document.querySelectorAll('[data-reveal]');
  if (reveals.length && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('has-reveal');
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  // 2. Thanh tiến độ đọc bài / cuộn trang ở đỉnh màn hình
  const progressBar = document.querySelector('[data-scroll-progress]');
  if (progressBar) {
    let ticking = false;
    const updateProgress = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const pct = h > 0 ? Math.min(100, Math.max(0, (window.scrollY / h) * 100)) : 0;
      progressBar.style.transform = `scaleX(${pct / 100})`;
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(updateProgress); }
    }, { passive: true });
    updateProgress();
  }

  // 3. Tự ẩn thanh đặt hàng đáy màn hình mobile khi khách đang đứng ngay trong form #dat-hang
  const mobDock = document.querySelector('[data-mob-dock]');
  const orderSection = document.getElementById('dat-hang');
  if (mobDock && orderSection && 'IntersectionObserver' in window) {
    const dockIo = new IntersectionObserver((entries) => {
      mobDock.classList.toggle('is-hidden', entries[0].isIntersecting);
    }, { threshold: 0.2 });
    dockIo.observe(orderSection);
  }

  // 4. Đóng menu mobile khi bấm link hoặc chạm ngoài
  const mobMenu = document.querySelector('details.menu');
  if (mobMenu) {
    mobMenu.addEventListener('click', (e) => {
      if (e.target.closest('a')) mobMenu.removeAttribute('open');
    });
    document.addEventListener('click', (e) => {
      if (mobMenu.open && !mobMenu.contains(e.target)) mobMenu.removeAttribute('open');
    });
  }

  // 5. Bấm vào thẻ Combo / nút "Chọn đặt" / thẻ giá trên Hero → chọn sẵn số hũ và cuộn mượt tới form
  const formControllers = new WeakMap();
  document.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-pick-qty]');
    if (!pick) return;
    const form = document.querySelector('[data-order-form]');
    if (!form) return;
    e.preventDefault();
    const qty = parseInt(pick.getAttribute('data-pick-qty'), 10) || 2;
    const ctrl = formControllers.get(form);
    if (ctrl) ctrl.setQty(qty, true);
    const target = document.getElementById('dat-hang') || form;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
      const card = form.closest('.order-card');
      if (card) {
        card.classList.remove('pulse-glow');
        void card.offsetWidth;
        card.classList.add('pulse-glow');
      }
      form.querySelector('input[name="name"]')?.focus({ preventScroll: true });
    }, 450);
  });

  // 6. Khởi tạo form đặt hàng chuẩn hũ 35g + tính ship & ưu đãi combo tự động
  document.querySelectorAll('[data-order-form]').forEach(initOrderForm);

  function initOrderForm(form) {
    let config = { priceTable: {}, unitBase: 65000, shipSingle: 30000 };
    try { config = JSON.parse(form.getAttribute('data-config') || '{}'); } catch { /* ignore */ }
    const priceTable = config.priceTable || {};
    const unitBase = Number(config.unitBase) || 65000;
    const shipSingle = Number(config.shipSingle) || 30000;
    const tiers = Object.keys(priceTable).map(Number).filter((n) => n > 0).sort((a, b) => a - b);

    const inputQty = form.querySelector('[name="qty"]');
    const sumSpec = form.querySelector('[data-sum-spec]');
    const sumGoods = form.querySelector('[data-sum-goods]');
    const sumDiscRow = form.querySelector('[data-sum-disc-row]');
    const sumDisc = form.querySelector('[data-sum-disc]');
    const sumShip = form.querySelector('[data-sum-ship]');
    const sumTotal = form.querySelector('[data-sum-total]');
    const sumSave = form.querySelector('[data-sum-save]');
    const freeBar = form.querySelector('[data-freeship-bar]');
    const freeMsg = form.querySelector('[data-freeship-msg]');
    const upgradeBtn = form.querySelector('[data-upgrade-free]');
    const errBox = form.querySelector('[data-order-error]');
    const submitBtn = form.querySelector('[data-order-submit]');
    const cardWrap = form.closest('[data-order-wrap]');
    const doneBox = cardWrap?.querySelector('[data-order-done]');
    const quickBtns = form.querySelectorAll('[data-qty-pick]');
    const tableRows = cardWrap ? cardWrap.querySelectorAll('[data-tier-qty]') : [];

    function calcBreakdown(qty) {
      const q = Math.max(1, Math.min(100, parseInt(qty, 10) || 1));
      let total = 0;
      if (tiers.length) {
        if (priceTable[q]) total = priceTable[q];
        else {
          let ref = tiers[0];
          for (const t of tiers) if (t <= q) ref = t;
          total = Math.round(((priceTable[ref] / ref) * q) / 1000) * 1000;
        }
      } else {
        total = unitBase * q + (q === 1 ? shipSingle : 0);
      }
      const ship = q === 1 ? shipSingle : 0;
      const baseGoods = unitBase * q;
      const disc = q >= 2 && baseGoods > total ? baseGoods - total : 0;
      const goods = q === 1 ? Math.max(0, total - ship) : baseGoods;
      return { q, grams: q * 35, goods, ship, disc, total };
    }

    function popEl(el) {
      if (!el) return;
      el.classList.remove('price-pop');
      void el.offsetWidth;
      el.classList.add('price-pop');
    }

    function syncUI(animate = false) {
      const b = calcBreakdown(inputQty.value);

      if (sumSpec) sumSpec.textContent = `${b.q} hũ × 35g (${b.grams}g trứng tươi)`;
      if (sumGoods) sumGoods.textContent = fmtMoney(b.goods);
      if (sumDiscRow && sumDisc) {
        if (b.disc > 0) {
          sumDisc.textContent = `−${fmtMoney(b.disc)}`;
          sumDiscRow.hidden = false;
        } else {
          sumDiscRow.hidden = true;
        }
      }
      if (sumShip) {
        sumShip.innerHTML = b.ship > 0
          ? `${fmtMoney(b.ship)}`
          : '<span class="pill-free">MIỄN PHÍ</span>';
      }
      if (sumTotal) {
        sumTotal.textContent = fmtMoney(b.total);
        if (animate) popEl(sumTotal);
      }
      if (sumSave) {
        if (b.q >= 2) {
          const totalSaved = b.disc + shipSingle;
          sumSave.textContent = b.disc > 0
            ? `Tiết kiệm ${fmtMoney(b.disc)} + Miễn phí ship`
            : `Tiết kiệm ${fmtMoney(totalSaved)} phí ship`;
          sumSave.hidden = false;
        } else {
          sumSave.hidden = true;
        }
      }

      if (freeBar && freeMsg && upgradeBtn) {
        if (b.q === 1) {
          freeBar.classList.remove('is-ok');
          freeBar.classList.add('is-nudge');
          freeMsg.innerHTML = '💡 Thêm chỉ <strong>1 hũ nữa (2 hũ = 130.000đ)</strong> để được <strong>MIỄN PHÍ SHIP</strong> ngay!';
          upgradeBtn.hidden = false;
        } else {
          freeBar.classList.remove('is-nudge');
          freeBar.classList.add('is-ok');
          freeMsg.innerHTML = b.disc > 0
            ? `✓ Tuyệt vời! Đơn ${b.q} hũ được <strong>MIỄN PHÍ SHIP</strong> & giảm thêm <strong>${fmtMoney(b.disc)}</strong>!`
            : `✓ Đơn ${b.q} hũ đã được <strong>MIỄN PHÍ GIAO HÀNG</strong> toàn quốc!`;
          upgradeBtn.hidden = true;
        }
      }

      quickBtns.forEach((btn) => btn.classList.toggle('is-active', Number(btn.getAttribute('data-qty-pick')) === b.q));
      tableRows.forEach((row) => row.classList.toggle('is-active', Number(row.getAttribute('data-tier-qty')) === b.q));
    }

    function setQty(next, animate = true) {
      const q = Math.max(1, Math.min(100, parseInt(next, 10) || 1));
      inputQty.value = String(q);
      syncUI(animate);
    }

    formControllers.set(form, { setQty });

    form.querySelector('[data-qty-dec]')?.addEventListener('click', () => setQty((parseInt(inputQty.value, 10) || 1) - 1, true));
    form.querySelector('[data-qty-inc]')?.addEventListener('click', () => setQty((parseInt(inputQty.value, 10) || 1) + 1, true));
    quickBtns.forEach((b) => b.addEventListener('click', () => setQty(b.getAttribute('data-qty-pick'), true)));
    upgradeBtn?.addEventListener('click', () => setQty(2, true));
    tableRows.forEach((r) => r.addEventListener('click', () => {
      setQty(r.getAttribute('data-tier-qty'), true);
      form.querySelector('input[name="name"]')?.focus();
    }));
    inputQty?.addEventListener('input', () => syncUI(false));
    syncUI(false);

    function showError(msg) {
      if (!errBox) return;
      errBox.textContent = msg;
      errBox.hidden = !msg;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showError('');
      const fd = new FormData(form);
      const payload = {
        name: String(fd.get('name') || '').trim(),
        phone: String(fd.get('phone') || '').trim(),
        address: String(fd.get('address') || '').trim(),
        product: String(fd.get('product') || 'Trứng sâu canxi Ruồi Lính Đen (Hũ 35g)').trim(),
        qty: parseInt(String(fd.get('qty') || '2'), 10) || 2,
        note: String(fd.get('note') || '').trim(),
        website: String(fd.get('website') || ''),
        ...T.forOrder(),
      };

      if (payload.name.length < 2) { showError('Vui lòng nhập họ tên người nhận.'); form.querySelector('[name="name"]')?.focus(); return; }
      const d = payload.phone.replace(/\D/g, '').replace(/^84/, '0');
      if (!/^0\d{9}$/.test(d)) { showError('Số điện thoại cần đủ 10 số (VD: 0912 345 678).'); form.querySelector('[name="phone"]')?.focus(); return; }
      if (payload.address.length < 6) { showError('Vui lòng nhập địa chỉ giao hàng cụ thể (thôn/số nhà, xã/phường, huyện/tỉnh).'); form.querySelector('[name="address"]')?.focus(); return; }

      const origText = submitBtn?.textContent || 'Xác nhận đặt hàng';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Đang gửi đơn về trại…'; }

      try {
        const res = await fetch('/api/dat-hang', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({ ok: false, error: 'Không đọc được phản hồi từ máy chủ.' }));
        if (!res.ok || !data.ok) {
          showError(data.error || 'Chưa gửi được đơn, vui lòng kiểm tra lại thông tin.');
          return;
        }
        const o = data.order;
        if (!data.duplicate_recent) {
          T.fbq('track', 'Purchase', { value: Number(o.total) || 0, currency: 'VND', num_items: Number(o.qty) || 1, content_name: o.product, content_type: 'product' }, { eventID: o.code });
        }
        if (doneBox) {
          const set = (k, v) => { const el = doneBox.querySelector(`[data-done-${k}]`); if (el) el.textContent = v; };
          set('code', o.code);
          set('name', o.name);
          set('phone', o.phone);
          set('address', o.address);
          set('product', `${o.qty} hũ 35g (${o.qty * 35}g) · ${o.qty >= 2 ? 'Miễn phí ship' : 'Đã gồm ship 30k'}`);
          set('total', o.total > 0 ? fmtMoney(o.total) : 'Shop báo giá khi xác nhận');
          form.hidden = true;
          doneBox.hidden = false;
          doneBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } catch {
        showError('Lỗi kết nối mạng. Vui lòng thử lại hoặc gọi trực tiếp cho shop.');
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = origText; }
      }
    });

    doneBox?.querySelector('[data-order-again]')?.addEventListener('click', () => {
      form.reset();
      setQty(2, true);
      showError('');
      doneBox.hidden = true;
      form.hidden = false;
    });
  }
})();
