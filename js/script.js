document.addEventListener('DOMContentLoaded', () => {

  /* Header shadow on scroll + back-to-top visibility */
  const header = document.getElementById('header');
  const backToTop = document.getElementById('backToTop');
  const onScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 8);
    backToTop.classList.toggle('show', window.scrollY > 480);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* Mobile menu toggle */
  const menuToggle = document.getElementById('menuToggle');
  const nav = document.getElementById('nav');
  menuToggle.addEventListener('click', () => {
    nav.classList.toggle('open');
  });
  nav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => nav.classList.remove('open'));
  });

  /* "Về chúng tôi" dropdown: click/tap toggle + Escape/outside-click to close */
  const navAboutToggle = document.getElementById('navAboutToggle');
  if (navAboutToggle) {
    const navAboutItem = navAboutToggle.closest('.nav-item');
    const closeNavAbout = () => {
      navAboutItem.classList.remove('open');
      navAboutToggle.setAttribute('aria-expanded', 'false');
    };
    navAboutToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = navAboutItem.classList.toggle('open');
      navAboutToggle.setAttribute('aria-expanded', String(isOpen));
    });
    document.addEventListener('click', (e) => {
      if (!navAboutItem.contains(e.target)) closeNavAbout();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeNavAbout();
    });
  }

  /* FAQ accordion */
  const faqItems = document.querySelectorAll('.faq-item');
  const setFaqHeight = (item, open) => {
    const answer = item.querySelector('.faq-a');
    answer.style.maxHeight = open ? answer.scrollHeight + 'px' : 0;
  };
  faqItems.forEach(item => {
    setFaqHeight(item, item.classList.contains('open'));
    item.querySelector('.faq-q').addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      faqItems.forEach(i => { i.classList.remove('open'); setFaqHeight(i, false); });
      if (!isOpen) { item.classList.add('open'); setFaqHeight(item, true); }
    });
  });

  /* Testimonial track controls (homepage only) */
  const tmTrack = document.getElementById('tmTrack');
  const tmPrev = document.getElementById('tmPrev');
  const tmNext = document.getElementById('tmNext');
  if (tmTrack && tmPrev && tmNext) {
    const scrollAmount = () => (tmTrack.querySelector('.tm-card')?.offsetWidth || 300) + 24;
    tmPrev.addEventListener('click', () => tmTrack.scrollBy({ left: -scrollAmount(), behavior: 'smooth' }));
    tmNext.addEventListener('click', () => tmTrack.scrollBy({ left: scrollAmount(), behavior: 'smooth' }));
  }

  /* Testimonial category filter */
  const tmFilters = document.getElementById('tmFilters');
  if (tmFilters && tmTrack) {
    const tmCards = tmTrack.querySelectorAll('.tm-card');
    tmFilters.addEventListener('click', (e) => {
      const btn = e.target.closest('.tm-filter');
      if (!btn) return;
      tmFilters.querySelectorAll('.tm-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      tmCards.forEach(card => {
        const match = filter === 'all' || card.dataset.category === filter;
        card.classList.toggle('tm-hidden', !match);
        if (match) {
          card.classList.remove('tm-fade-in');
          void card.offsetWidth;
          card.classList.add('tm-fade-in');
        }
      });
      tmTrack.scrollTo({ left: 0, behavior: 'smooth' });
    });
  }

  /* Team teaser track controls (homepage "Đội ngũ đồng hành") */
  const ttTrack = document.getElementById('ttTrack');
  const ttPrev = document.getElementById('ttPrev');
  const ttNext = document.getElementById('ttNext');
  if (ttTrack && ttPrev && ttNext) {
    const ttScrollAmount = () => (ttTrack.querySelector('.tt-card')?.offsetWidth || 300) + 24;
    ttPrev.addEventListener('click', () => ttTrack.scrollBy({ left: -ttScrollAmount(), behavior: 'smooth' }));
    ttNext.addEventListener('click', () => ttTrack.scrollBy({ left: ttScrollAmount(), behavior: 'smooth' }));
  }

  /* Consultation modal open/close */
  const consultModal = document.getElementById('consultModal');
  const modalClose = document.getElementById('modalClose');
  let lastFocused = null;

  const openConsultModal = () => {
    lastFocused = document.activeElement;
    consultModal.classList.add('open');
    consultModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    const firstInput = document.getElementById('cf-name');
    if (firstInput) setTimeout(() => firstInput.focus(), 200);
  };
  const closeConsultModal = () => {
    consultModal.classList.remove('open');
    consultModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    if (lastFocused) lastFocused.focus();
  };

  document.querySelectorAll('a[href="#lien-he"]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      openConsultModal();
    });
  });
  modalClose.addEventListener('click', closeConsultModal);
  consultModal.addEventListener('click', (e) => {
    if (e.target === consultModal) closeConsultModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && consultModal.classList.contains('open')) closeConsultModal();
  });

  /* Consultation form validation */
  const consultForm = document.getElementById('consultForm');
  if (consultForm) {
    const fields = {
      name: { input: document.getElementById('cf-name'), error: document.getElementById('err-name') },
      phone: { input: document.getElementById('cf-phone'), error: document.getElementById('err-phone') },
      email: { input: document.getElementById('cf-email'), error: document.getElementById('err-email') },
      consent: { input: document.getElementById('cf-consent'), error: document.getElementById('err-consent') },
    };
    const phoneRe = /^(0|\+84)[0-9]{9,10}$/;
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const setError = (field, message) => {
      const row = field.input.closest('.form-row') || field.input.closest('.form-check');
      if (message) {
        field.error.textContent = message;
        field.error.classList.add('show');
        if (row) row.classList.add('has-error');
      } else {
        field.error.textContent = '';
        field.error.classList.remove('show');
        if (row) row.classList.remove('has-error');
      }
    };

    const validate = () => {
      let valid = true;
      const nameVal = fields.name.input.value.trim();
      if (nameVal.length < 2) { setError(fields.name, 'Vui lòng nhập họ tên đầy đủ'); valid = false; }
      else setError(fields.name, '');

      const phoneVal = fields.phone.input.value.trim();
      if (!phoneRe.test(phoneVal)) { setError(fields.phone, 'Số điện thoại không hợp lệ'); valid = false; }
      else setError(fields.phone, '');

      const emailVal = fields.email.input.value.trim();
      if (!emailRe.test(emailVal)) { setError(fields.email, 'Email không hợp lệ'); valid = false; }
      else setError(fields.email, '');

      if (!fields.consent.input.checked) { setError(fields.consent, 'Vui lòng đồng ý để FIT AND CARE liên hệ lại'); valid = false; }
      else setError(fields.consent, '');

      return valid;
    };

    const formStatus = document.getElementById('formStatus');
    const submitBtn = consultForm.querySelector('button[type="submit"]');

    consultForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validate()) {
        formStatus.textContent = 'Vui lòng kiểm tra lại thông tin bên trên.';
        formStatus.className = 'form-status error';
        return;
      }

      const payload = {
        name: fields.name.input.value.trim(),
        phone: fields.phone.input.value.trim(),
        email: fields.email.input.value.trim(),
        goal: document.getElementById('cf-goal').value,
        message: document.getElementById('cf-message').value.trim(),
      };

      submitBtn.disabled = true;
      formStatus.textContent = 'Đang gửi...';
      formStatus.className = 'form-status';

      try {
        const res = await fetch('/api/consult', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (res.ok && data.ok) {
          formStatus.textContent = 'Cảm ơn bạn! FIT AND CARE đã nhận được thông tin và sẽ liên hệ lại sớm nhất.';
          formStatus.className = 'form-status success';
          consultForm.reset();
        } else {
          formStatus.textContent = data.error || 'Có lỗi xảy ra, vui lòng thử lại hoặc liên hệ trực tiếp qua hotline/email.';
          formStatus.className = 'form-status error';
        }
      } catch (err) {
        formStatus.textContent = 'Không kết nối được máy chủ. Vui lòng thử lại hoặc liên hệ trực tiếp qua hotline/email.';
        formStatus.className = 'form-status error';
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  /* Payment modal: chọn gói + thanh toán (index.html only) */
  const paymentModal = document.getElementById('paymentModal');
  if (paymentModal) {
  const paymentModalClose = document.getElementById('paymentModalClose');
  const paymentForm = document.getElementById('paymentForm');
  const bankResult = document.getElementById('bankResult');
  const paymentModalTitle = document.getElementById('paymentModalTitle');
  const defaultPaymentModalTitle = paymentModalTitle ? paymentModalTitle.textContent : '';
  const PACKAGE_LABELS = { start: 'Start Fit', smart: 'Smart Fit', super: 'Super Fit' };
  let lastFocusedPayment = null;

  const resetPaymentModal = () => {
    paymentForm.hidden = false;
    bankResult.hidden = true;
    paymentForm.reset();
    document.getElementById('paymentFormStatus').textContent = '';
    document.getElementById('paymentFormStatus').className = 'form-status';
    document.getElementById('bankConfirmStatus').textContent = '';
    document.getElementById('bankConfirmStatus').className = 'form-status';
    ['pkg', 'pf-name', 'pf-phone', 'pf-email', 'pf-amount', 'method'].forEach(id => {
      const err = document.getElementById('err-' + id);
      if (err) { err.textContent = ''; err.classList.remove('show'); }
    });
  };

  const openPaymentModal = (preselectPackage) => {
    resetPaymentModal();
    if (preselectPackage) {
      const radio = paymentForm.querySelector(`input[name="pkg"][value="${preselectPackage}"]`);
      if (radio) radio.checked = true;
    }
    if (paymentModalTitle) {
      paymentModalTitle.textContent = PACKAGE_LABELS[preselectPackage]
        ? `Hoàn tất đăng ký gói ${PACKAGE_LABELS[preselectPackage]}`
        : defaultPaymentModalTitle;
    }
    lastFocusedPayment = document.activeElement;
    paymentModal.classList.add('open');
    paymentModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(() => document.getElementById('pf-name')?.focus(), 200);
  };
  const closePaymentModal = () => {
    paymentModal.classList.remove('open');
    paymentModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    if (lastFocusedPayment) lastFocusedPayment.focus();
  };

  document.querySelectorAll('.open-payment').forEach(btn => {
    btn.addEventListener('click', () => openPaymentModal(btn.dataset.package));
  });
  paymentModalClose.addEventListener('click', closePaymentModal);
  paymentModal.addEventListener('click', (e) => {
    if (e.target === paymentModal) closePaymentModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && paymentModal.classList.contains('open')) closePaymentModal();
  });

  if (paymentForm) {
    const phoneRe = /^(0|\+84)[0-9]{9,10}$/;
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pfName = document.getElementById('pf-name');
    const pfPhone = document.getElementById('pf-phone');
    const pfEmail = document.getElementById('pf-email');
    const pfAmount = document.getElementById('pf-amount');
    const setErr = (id, message) => {
      const err = document.getElementById('err-' + id);
      if (!err) return;
      err.textContent = message || '';
      err.classList.toggle('show', Boolean(message));
    };

    // Ô số tiền: nội dung sai KHÔNG BAO GIỜ bị âm thầm "sửa" thành một số khác (vd 5000.5 không
    // được biến thành 50005, -5000 không được biến thành 5000). Khi nội dung không phải số nguyên
    // hợp lệ (thuần số, hoặc có phân cách hàng nghìn đúng chuẩn từng nhóm 3 số), ta để nguyên đúng
    // những gì người dùng đã gõ/dán và chỉ báo lỗi rõ ràng — không tự trích/ghép lại chữ số.
    const AMOUNT_PLAIN_DIGITS_RE = /^\d+$/;
    const AMOUNT_THOUSANDS_DOT_RE = /^\d{1,3}(\.\d{3})+$/;   // vd 5.000.000
    const AMOUNT_THOUSANDS_COMMA_RE = /^\d{1,3}(,\d{3})+$/;  // vd 5,000,000
    const normalizeAmountText = (text) => {
      const t = String(text || '').trim();
      if (AMOUNT_PLAIN_DIGITS_RE.test(t)) return t;
      if (AMOUNT_THOUSANDS_DOT_RE.test(t)) return t.replace(/\./g, '');
      if (AMOUNT_THOUSANDS_COMMA_RE.test(t)) return t.replace(/,/g, '');
      return null;
    };
    if (pfAmount) {
      const formatDigits = (digits) => (digits ? Number(digits).toLocaleString('vi-VN') : '');

      pfAmount.addEventListener('input', (e) => {
        // Dán nguyên một số đã có phân cách hàng nghìn hợp lệ (chấm hoặc phẩy): chuẩn hoá hiển thị
        // ngay vì đây là một thao tác trọn vẹn, không phải đang gõ dở.
        if (e.inputType === 'insertFromPaste') {
          const clean = normalizeAmountText(pfAmount.value);
          if (clean !== null) {
            pfAmount.value = formatDigits(clean);
            setErr('pf-amount', '');
            return;
          }
        }
        // Đang gõ tay: không viết lại nội dung ô (tránh làm sai lệch ý người dùng đang gõ dở),
        // chỉ kiểm tra và báo lỗi ngay nếu nội dung hiện chưa phải số nguyên hợp lệ.
        if (pfAmount.value.trim() === '') { setErr('pf-amount', ''); return; }
        setErr(
          'pf-amount',
          normalizeAmountText(pfAmount.value) === null
            ? 'Số tiền không hợp lệ. Chỉ nhập số nguyên VNĐ (không chữ, không dấu thập phân, không dấu âm).'
            : ''
        );
      });

      // Khi rời khỏi ô (đã gõ xong): nếu hợp lệ thì format lại dấu phân cách hàng nghìn cho dễ đọc.
      pfAmount.addEventListener('blur', () => {
        const clean = normalizeAmountText(pfAmount.value);
        if (clean !== null) pfAmount.value = formatDigits(clean);
      });
    }
    const parseAmountValue = () => {
      const clean = pfAmount ? normalizeAmountText(pfAmount.value) : null;
      if (clean === null) return null;
      const n = parseInt(clean, 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const validatePayment = () => {
      let valid = true;
      if (!paymentForm.querySelector('input[name="pkg"]:checked')) { setErr('pkg', 'Vui lòng chọn 1 gói dịch vụ'); valid = false; } else setErr('pkg', '');
      if (pfName.value.trim().length < 2) { setErr('pf-name', 'Vui lòng nhập họ tên đầy đủ'); valid = false; } else setErr('pf-name', '');
      if (!phoneRe.test(pfPhone.value.trim())) { setErr('pf-phone', 'Số điện thoại không hợp lệ'); valid = false; } else setErr('pf-phone', '');
      if (!emailRe.test(pfEmail.value.trim())) { setErr('pf-email', 'Email không hợp lệ'); valid = false; } else setErr('pf-email', '');
      if (parseAmountValue() === null) { setErr('pf-amount', 'Vui lòng nhập số tiền hợp lệ (số nguyên dương) đã được FIT AND CARE xác nhận'); valid = false; } else setErr('pf-amount', '');
      if (!paymentForm.querySelector('input[name="method"]:checked')) { setErr('method', 'Vui lòng chọn phương thức thanh toán'); valid = false; } else setErr('method', '');
      return valid;
    };

    const paymentFormStatus = document.getElementById('paymentFormStatus');
    const paymentSubmitBtn = document.getElementById('paymentSubmitBtn');

    paymentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validatePayment()) {
        paymentFormStatus.textContent = 'Vui lòng kiểm tra lại thông tin bên trên.';
        paymentFormStatus.className = 'form-status error';
        return;
      }
      const payload = {
        package: paymentForm.querySelector('input[name="pkg"]:checked').value,
        name: pfName.value.trim(),
        phone: pfPhone.value.trim(),
        email: pfEmail.value.trim(),
        amount: parseAmountValue(),
        method: paymentForm.querySelector('input[name="method"]:checked').value,
      };

      paymentSubmitBtn.disabled = true;
      paymentFormStatus.textContent = 'Đang xử lý...';
      paymentFormStatus.className = 'form-status';

      try {
        const res = await fetch('/api/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (!res.ok || !data.ok) {
          paymentFormStatus.textContent = data.error || 'Có lỗi xảy ra, vui lòng thử lại hoặc liên hệ trực tiếp.';
          paymentFormStatus.className = 'form-status error';
          paymentSubmitBtn.disabled = false;
          return;
        }

        if (payload.method === 'vnpay') {
          paymentFormStatus.textContent = 'Đang chuyển đến trang thanh toán...';
          paymentFormStatus.className = 'form-status success';
          window.location.href = data.paymentUrl;
          return;
        }

        // bank_transfer
        document.getElementById('bankName').textContent = data.bank.name;
        document.getElementById('bankAccount').textContent = data.bank.account;
        document.getElementById('bankHolder').textContent = data.bank.holder;
        document.getElementById('bankAmount').textContent = data.bank.amount.toLocaleString('vi-VN') + 'đ';
        document.getElementById('bankContent').textContent = data.bank.content;
        paymentForm.hidden = true;
        bankResult.hidden = false;
        bankResult.dataset.orderId = data.id;
      } catch (err) {
        paymentFormStatus.textContent = 'Không kết nối được máy chủ. Vui lòng thử lại hoặc liên hệ trực tiếp.';
        paymentFormStatus.className = 'form-status error';
      } finally {
        paymentSubmitBtn.disabled = false;
      }
    });
  }

  const bankConfirmBtn = document.getElementById('bankConfirmBtn');
  if (bankConfirmBtn) {
    bankConfirmBtn.addEventListener('click', async () => {
      const orderId = bankResult.dataset.orderId;
      const status = document.getElementById('bankConfirmStatus');
      if (!orderId) return;
      bankConfirmBtn.disabled = true;
      try {
        await fetch(`/api/order/${encodeURIComponent(orderId)}/confirm-transfer`, { method: 'POST' });
        status.textContent = 'Cảm ơn bạn! FIT AND CARE sẽ xác nhận và liên hệ trong thời gian sớm nhất.';
        status.className = 'form-status success';
        bankConfirmBtn.hidden = true;
      } catch (err) {
        status.textContent = 'Không kết nối được máy chủ, vui lòng thử lại.';
        status.className = 'form-status error';
        bankConfirmBtn.disabled = false;
      }
    });
  }
  } // end if (paymentModal)

  /* Reveal on scroll */
  const revealEls = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealEls.forEach(el => io.observe(el));

});
