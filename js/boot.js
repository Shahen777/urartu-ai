/* ============================================================
   boot.js — стартовая последовательность «как в macOS / iPhone».
   Десктоп: загрузка (лого + прогресс) → экран выбора пользователя → рабочий стол.
   Мобильный: экран блокировки (часы, дата, уведомление, виджет) → свайп вверх → главный экран.
   Показывается один раз за вкладку (sessionStorage). Пропуск: клик/клавиша/тап.
   Уважает prefers-reduced-motion (без длинных анимаций).
   ============================================================ */
(function () {
  'use strict';
  var boot = document.getElementById('boot');
  if (!boot) return;

  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  function isMobile() { return window.matchMedia('(max-width: 1023px)').matches; }
  function lang() { return (window.__lang === 'en') ? 'en' : 'ru'; }
  function tr(k) { return (window.I18N && window.I18N.t) ? window.I18N.t(k, lang()) : k; }
  function avaSrc(id) { return (window.Avatars && window.Avatars.src) ? window.Avatars.src(id, 'real') : ('avatars/' + id + '-real.webp'); }

  /* Уже разблокировано в этой вкладке — не мешаем повторным заходам/переходам */
  var seen = false;
  try { seen = sessionStorage.getItem('booted') === '1'; } catch (e) {}
  if (seen) { boot.parentNode && boot.remove(); document.documentElement.classList.remove('is-locked'); return; }

  document.documentElement.classList.add('is-locked');

  function stage(name) {
    var s = boot.querySelectorAll('.boot__stage');
    for (var i = 0; i < s.length; i++) s[i].hidden = (s[i].getAttribute('data-boot') !== name);
  }

  function finish() {
    if (boot.__done) return; boot.__done = true;
    try { sessionStorage.setItem('booted', '1'); } catch (e) {}
    boot.classList.add('is-gone');
    document.documentElement.classList.remove('is-locked');
    setTimeout(function () { if (boot.parentNode) boot.remove(); }, reduce ? 0 : 620);
  }

  /* ---------- ДЕСКТОП: загрузка → логин ---------- */
  function runDesktop() {
    stage('logo');
    var bar = boot.querySelector('.boot__bar i');
    if (bar) requestAnimationFrame(function () { bar.style.width = '100%'; });
    var dwell = reduce ? 350 : 1500;
    var skip = function () { toLogin(); };
    boot.addEventListener('click', skip, { once: true });
    var t = setTimeout(toLogin, dwell);
    function toLogin() {
      clearTimeout(t);
      boot.removeEventListener('click', skip);
      buildUsers();
      stage('login');
      boot.classList.add('boot--login');
    }
  }

  function buildUsers() {
    var wrap = document.getElementById('bootUsers');
    if (!wrap || wrap.__built) return;
    wrap.__built = true;
    var users = [
      { id: 'director', ava: 'secretary', nameK: 'boot.user.dir', roleK: 'boot.user.dir.role', dir: true },
      { id: 'guest', ava: 'documoved', nameK: 'boot.user.guest', roleK: 'boot.user.guest.role' }
    ];
    users.forEach(function (u) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'boot__user';
      b.innerHTML =
        '<span class="boot__ava">' +
          (u.dir
            ? '<svg viewBox="0 0 96 96" width="80" height="80" aria-hidden="true"><circle cx="48" cy="48" r="48" fill="rgba(255,255,255,.14)"/><circle cx="48" cy="38" r="17" fill="rgba(255,255,255,.9)"/><path d="M18 82c2-17 15-26 30-26s28 9 30 26z" fill="rgba(255,255,255,.9)"/></svg>'
            : '<img src="' + avaSrc(u.ava) + '" alt="" width="80" height="80" decoding="async">') +
        '</span>' +
        '<span class="boot__uname"></span>' +
        '<span class="boot__urole"></span>' +
        '<span class="boot__enter">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
        '</span>';
      b.querySelector('.boot__uname').textContent = tr(u.nameK);
      b.querySelector('.boot__urole').textContent = tr(u.roleK);
      b.setAttribute('aria-label', tr(u.nameK) + ' — ' + tr('boot.enter'));
      b.addEventListener('click', function () {
        b.classList.add('is-in');
        setTimeout(finish, reduce ? 0 : 260);
      });
      wrap.appendChild(b);
    });
    var first = wrap.querySelector('.boot__user');
    if (first) setTimeout(function () { first.focus(); }, 200);
  }

  /* ---------- МОБИЛЬНЫЙ: экран блокировки со свайпом вверх ---------- */
  function runMobile() {
    stage('lock');
    boot.classList.add('boot--lock');
    tickClock();
    clockTimer = setInterval(tickClock, 15000);
    var lock = boot.querySelector('.boot__lock');
    var startY = null, dy = 0, dragging = false;

    function onStart(e) {
      var y = e.touches ? e.touches[0].clientY : e.clientY;
      startY = y; dy = 0; dragging = true;
      lock.style.transition = 'none';
    }
    function onMove(e) {
      if (!dragging || startY == null) return;
      var y = e.touches ? e.touches[0].clientY : e.clientY;
      dy = Math.min(0, y - startY);           // тянем только вверх
      lock.style.transform = 'translateY(' + dy + 'px)';
      lock.style.opacity = String(Math.max(0, 1 + dy / 500));
      if (e.cancelable) e.preventDefault();
    }
    function onEnd() {
      if (!dragging) return; dragging = false;
      lock.style.transition = '';
      if (dy < -80) { unlock(); }
      else { lock.style.transform = ''; lock.style.opacity = ''; }
    }
    function unlock() {
      lock.style.transform = 'translateY(-100%)';
      lock.style.opacity = '0';
      finish();
    }
    lock.addEventListener('touchstart', onStart, { passive: true });
    lock.addEventListener('touchmove', onMove, { passive: false });
    lock.addEventListener('touchend', onEnd);
    lock.addEventListener('touchcancel', onEnd);
    /* мышь/клик для десктопного превью мобилки и как запасной вариант */
    var btn = document.getElementById('lockUnlock');
    if (btn) btn.addEventListener('click', unlock);
    lock.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
  }

  var clockTimer = null;
  function tickClock() {
    var now = new Date();
    var loc = lang() === 'en' ? 'en-US' : 'ru-RU';
    var tEl = document.getElementById('lockTime');
    var dEl = document.getElementById('lockDate');
    if (tEl) tEl.textContent = now.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit', hour12: false });
    if (dEl) {
      var s = now.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' });
      dEl.textContent = s.charAt(0).toUpperCase() + s.slice(1);
    }
  }

  function start() {
    if (isMobile()) runMobile(); else runDesktop();
    /* глобальный esc — пропустить всё */
    document.addEventListener('keydown', function (e) {
      if (boot.__done) return;
      if (e.key === 'Escape') finish();
      else if (e.key === 'Enter' && boot.classList.contains('boot--login')) {
        var u = boot.querySelector('.boot__user');
        if (u) u.click();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
