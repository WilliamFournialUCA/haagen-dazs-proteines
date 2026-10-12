(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const progress = document.querySelector('.reading-progress');
  const back = document.querySelector('.back-to-top');
  let scheduled = false;
  const update = () => {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = `scaleX(${total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 0})`;
    if (back) back.hidden = window.scrollY < 600;
    scheduled = false;
  };
  window.addEventListener('scroll', () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener('resize', update);
  document.querySelectorAll('details').forEach(item => item.addEventListener('toggle', update));
  update();
  if (back) back.addEventListener('click', () => {
    document.querySelector('.skip').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reduced.matches ? 'instant' : 'smooth' });
  });
  if (reduced.matches || !('IntersectionObserver' in window) || !Element.prototype.animate) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const element = entry.target;
      element.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }], {
        duration: 620, easing: 'cubic-bezier(.2,.65,.3,1)', delay: Number(element.dataset.delay || 0)
      });
      observer.unobserve(element);
    });
  }, { threshold: .06 });
  document.querySelectorAll('main > h1, main > h2, main > .lead, .hero > div, .hero > aside, .brand-banner, .card, .note, .conclusion, section > h2, section > h3, .circles, .steps > a').forEach((element, index) => {
    element.dataset.delay = element.matches('.card, .steps > a') ? String((index % 3) * 65) : '0';
    observer.observe(element);
  });
  reduced.addEventListener('change', event => { if (event.matches) { observer.disconnect(); document.getAnimations().forEach(animation => animation.cancel()); } });
})();
