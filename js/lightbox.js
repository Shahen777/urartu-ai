/* ============================================================
   lightbox.js — увеличение фото оборудования/услуг по клику.
   Один общий оверлей на весь сайт, без зависимостей.
   ============================================================ */
(function () {
  'use strict';
  if (window.Lightbox) return;

  var overlay, imgEl, capEl, closeBtnEl, lastFocus = null;
  function lang() { return (window.__lang === 'en') ? 'en' : 'ru'; }
  function tr(k) { return (window.I18N && window.I18N.t) ? window.I18N.t(k, lang()) : k; }

  function ensure() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'lbx';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="lbx__backdrop" data-lbx-close></div>' +
      '<figure class="lbx__frame">' +
        '<button type="button" class="lbx__close" data-lbx-close>✕</button>' +
        '<img class="lbx__img" alt="">' +
        '<figcaption class="lbx__cap"></figcaption>' +
      '</figure>';
    document.body.appendChild(overlay);
    imgEl = overlay.querySelector('.lbx__img');
    capEl = overlay.querySelector('.lbx__cap');
    closeBtnEl = overlay.querySelector('.lbx__close');
    closeBtnEl.setAttribute('aria-label', tr('ui.close'));
    document.addEventListener('i18n:change', function () { closeBtnEl.setAttribute('aria-label', tr('ui.close')); });
    overlay.addEventListener('click', function (e) {
      if (e.target.closest('[data-lbx-close]')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay && !overlay.hidden) close();
    });
  }

  function open(src, caption) {
    ensure();
    imgEl.src = src;
    imgEl.alt = caption || '';
    capEl.textContent = caption || '';
    capEl.hidden = !caption;
    lastFocus = document.activeElement;
    overlay.hidden = false;
    void overlay.offsetHeight;
    overlay.classList.add('is-in');
    if (closeBtnEl) closeBtnEl.focus();
  }

  function close() {
    if (!overlay || overlay.hidden) return;
    overlay.classList.remove('is-in');
    var fin = function () { overlay.hidden = true; imgEl.src = ''; };
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) fin(); else setTimeout(fin, 180);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }

  /* карточки услуг — обычные <article>, не кнопки, поэтому конфликтовать
     не с чем: просто делегированный клик по иллюстрации открывает лайтбокс */
  document.addEventListener('click', function (e) {
    var ill = e.target.closest ? e.target.closest('.svc-card__ill') : null;
    if (!ill) return;
    var img = ill.querySelector('img');
    var card = ill.closest('.svc-card');
    var h = card ? card.querySelector('h4') : null;
    if (img && img.src) open(img.currentSrc || img.src, h ? h.textContent : '');
  });

  window.Lightbox = { open: open, close: close };
})();
