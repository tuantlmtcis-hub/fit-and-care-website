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

  /* Testimonial track controls */
  const tmTrack = document.getElementById('tmTrack');
  const tmPrev = document.getElementById('tmPrev');
  const tmNext = document.getElementById('tmNext');
  const scrollAmount = () => (tmTrack.querySelector('.tm-card')?.offsetWidth || 300) + 24;
  tmPrev.addEventListener('click', () => tmTrack.scrollBy({ left: -scrollAmount(), behavior: 'smooth' }));
  tmNext.addEventListener('click', () => tmTrack.scrollBy({ left: scrollAmount(), behavior: 'smooth' }));

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

      if (!fields.consent.input.checked) { setError(fields.consent, 'Vui lòng đồng ý để Fit and Care liên hệ lại'); valid = false; }
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
          formStatus.textContent = 'Cảm ơn bạn! Fit and Care đã nhận được thông tin và sẽ liên hệ lại sớm nhất.';
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
