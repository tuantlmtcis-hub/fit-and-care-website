document.addEventListener('DOMContentLoaded', () => {

  /* Header shadow on scroll */
  const header = document.getElementById('header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

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
