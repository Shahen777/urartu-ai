/* ============================================================
   Urartu AI — оконный менеджер + виджеты + темы/язык/iOS
   ============================================================ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* тестовые хуки (__os/__pager) публикуем только локально — не светим внутренности в проде */
  var DEV = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var isMobile = function () { return window.matchMedia('(max-width: 1023px)').matches; };
  function lang() { return (window.__lang === 'en') ? 'en' : 'ru'; }
  function tr(key) { return (window.I18N && window.I18N.t) ? window.I18N.t(key, lang()) : key; }

  /* ---------- Z-INDEX МЕНЕДЖЕР ----------
     Потолок 7900: док (8500) и меню-бар (9000) всегда остаются сверху.
     При достижении потолка слои пересчитываются с нуля. */
  var Z_MIN = 100, Z_MAX = 7900;
  var topZ = Z_MIN;
  function bringToFront(win) {
    if (topZ >= Z_MAX) {
      var open = Array.prototype.slice.call(document.querySelectorAll('.win'))
        .sort(function (a, b) { return (+a.style.zIndex || 0) - (+b.style.zIndex || 0); });
      topZ = Z_MIN;
      open.forEach(function (w) { topZ += 1; w.style.zIndex = topZ; });
    }
    topZ += 1;
    win.style.zIndex = topZ;
    setActive(win);
  }

  /* ---------- ФОКУС АКТИВНОГО ОКНА (macOS: глубина стека видна) ---------- */
  function setActive(win) {
    var list = document.querySelectorAll('.win');
    for (var i = 0; i < list.length; i++) list[i].classList.toggle('win--active', list[i] === win);
  }
  /* верхнее открытое (не закрывающееся) окно становится активным */
  function activateTop() {
    var open = Array.prototype.slice.call(document.querySelectorAll('.win.is-open:not(.is-closing)'));
    if (!open.length) { setActive(null); return; }
    open.sort(function (a, b) { return (+b.style.zIndex || 0) - (+a.style.zIndex || 0); });
    setActive(open[0]);
  }

  /* ---------- КАСКАД ПОЗИЦИЙ ---------- */
  var cascade = 0;
  var placed = {};
  function place(win) {
    if (placed[win.id] || isMobile()) return;
    placed[win.id] = true;
    var stage = document.getElementById('stage');
    var sw = stage.clientWidth, sh = stage.clientHeight;
    var ww = win.offsetWidth || 440, wh = win.offsetHeight || 320;
    if (win.id === 'win-readme') {
      win.style.left = Math.max(24, Math.round((sw - ww) / 2)) + 'px';
      win.style.top = Math.max(20, Math.round((sh - wh) / 2 - 20)) + 'px';
      return;
    }
    var baseX = Math.round(sw * 0.30), baseY = 40;
    var off = (cascade % 6) * 30;
    cascade += 1;
    win.style.left = Math.min(baseX + off, sw - ww - 24) + 'px';
    win.style.top = (baseY + off) + 'px';
  }

  /* ---------- ГРАНИЦЫ ОКНА (общие для drag / resize / пересчёта) ---------- */
  var WIN_OVERHANG_LEFT = 40;   // насколько левый край окна может уйти за stage
  var WIN_MIN_VISIBLE_X = 80;   // сколько окна остаётся «ловибельным» справа
  var WIN_MIN_VISIBLE_Y = 40;   // сколько окна остаётся «ловибельным» снизу
  var MAX_MARGIN = 20;          // отступ развёрнутого окна от краёв stage

  /* Удержать позицию открытого окна в границах stage (после ресайза/перетаскивания) */
  function clampPos(win, stage) {
    var st = stage || document.getElementById('stage');
    var sw = st.clientWidth, sh = st.clientHeight;
    var left = parseFloat(win.style.left), top = parseFloat(win.style.top);
    if (!isNaN(left)) win.style.left = Math.max(-WIN_OVERHANG_LEFT, Math.min(left, sw - WIN_MIN_VISIBLE_X)) + 'px';
    if (!isNaN(top))  win.style.top  = Math.max(0, Math.min(top, sh - WIN_MIN_VISIBLE_Y)) + 'px';
  }

  /* ---------- ОТКРЫТИЕ / ЗАКРЫТИЕ ---------- */
  function dockApp(id) { return document.querySelector('.dock__app[data-win="' + id + '"]'); }

  /* Автозапуск 3D-офиса: iframe создаётся при ПЕРВОМ открытии окна агентов
     (не при загрузке страницы) */
  /* The Delegation рендерит через WebGPU; без него холст пустой */
  function agentsSupported() { return !!navigator.gpu; }
  function showAgentsFallback(stage) {
    if (stage.querySelector('.agents__poster')) return;
    var label = tr('agents.fallback');
    var box = document.createElement('div');
    box.className = 'agents__poster';
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', label);
    box.innerHTML =
      '<svg class="agents__poster-art" width="180" height="108" viewBox="0 0 180 108" aria-hidden="true">' +
      '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity=".65">' +
      '<rect x="20" y="60" width="42" height="22" rx="3"/><circle cx="41" cy="44" r="10"/>' +
      '<rect x="118" y="60" width="42" height="22" rx="3"/><circle cx="139" cy="44" r="10"/>' +
      '<rect x="69" y="74" width="42" height="22" rx="3"/><circle cx="90" cy="58" r="10"/>' +
      '<path d="M62 55h18M118 55h-18" stroke-dasharray="3 3"/></g></svg>' +
      '<p class="agents__poster-cap"></p>';
    box.querySelector('.agents__poster-cap').textContent = label;
    stage.appendChild(box);
  }

  function ensureAgentsFrame() {
    var stage = document.getElementById('agentsStage');
    if (!stage || stage.querySelector('iframe') || stage.querySelector('.agents__poster')) return;
    if (!agentsSupported()) { showAgentsFallback(stage); return; }
    var frame = document.createElement('iframe');
    frame.src = 'delegation/index.html';
    frame.title = document.documentElement.lang === 'en'
      ? 'The Delegation — 3D office of AI agents'
      : 'The Delegation — 3D-офис ИИ-агентов';
    frame.allow = 'fullscreen';
    frame.loading = 'lazy';
    stage.appendChild(frame);
  }

  /* триггеры, вернувшие фокус после закрытия окна (доступность диалогов) */
  var lastTrigger = {};
  function moveFocus(el) {
    if (!el) return;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }

  function openWindow(id, trigger) {
    var win = document.getElementById(id);
    if (!win) return;
    if (id === 'win-agents') ensureAgentsFrame();
    place(win);
    win.style.transform = '';
    win.classList.remove('is-closing');
    win.classList.add('is-open');
    win.setAttribute('aria-modal', 'true');
    bringToFront(win);
    var d = dockApp(id);
    if (d) d.classList.add('is-open');
    if (id === 'win-terminal') runTerminal();
    /* только для действий пользователя: переносим фокус в окно и запоминаем,
       куда его вернуть. Автооткрытие README при загрузке фокус не трогает. */
    if (trigger) { lastTrigger[id] = trigger; moveFocus(win); }
  }

  function hideWindow(id, keepDot) {
    var win = document.getElementById(id);
    if (!win || !win.classList.contains('is-open')) return;
    win.classList.add('is-closing');
    win.removeAttribute('aria-modal');
    activateTop();
    var done = function () {
      win.classList.remove('is-open', 'is-closing');
      win.style.transform = '';
      win.removeEventListener('transitionend', done);
    };
    if (reduceMotion) { done(); } else { win.addEventListener('transitionend', done); setTimeout(done, 340); }
    if (!keepDot) { var d = dockApp(id); if (d) d.classList.remove('is-open'); }
    /* вернуть фокус на триггер, если он ещё в DOM */
    var trg = lastTrigger[id];
    if (trg && document.contains(trg)) moveFocus(trg);
    lastTrigger[id] = null;
  }
  function closeWindow(id) { hideWindow(id, false); }
  function minimizeWindow(id) { hideWindow(id, true); }

  function toggleMax(win) {
    if (isMobile()) return;
    var stage = document.getElementById('stage');
    if (win.classList.contains('is-max')) {
      win.classList.remove('is-max', 'is-sized');
      win.style.left = win.dataset.px || win.style.left;
      win.style.top = win.dataset.py || win.style.top;
      win.style.width = ''; win.style.height = '';
      win.style.maxWidth = ''; win.style.maxHeight = '';
    } else {
      win.dataset.px = win.style.left; win.dataset.py = win.style.top;
      win.classList.add('is-max', 'is-sized');
      win.style.left = MAX_MARGIN + 'px'; win.style.top = MAX_MARGIN + 'px';
      // «развернуть» тянет и по вертикали на весь stage, снимая max-height
      win.style.width = (stage.clientWidth - MAX_MARGIN * 2) + 'px';
      win.style.height = (stage.clientHeight - MAX_MARGIN * 2) + 'px';
      win.style.maxWidth = 'none'; win.style.maxHeight = 'none';
    }
  }

  /* ---------- ПЕРЕТАСКИВАНИЕ (Pointer Events + capture) ---------- */
  function initDrag(win) {
    var bar = win.querySelector('.win__bar');
    if (!bar) return;
    var dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;

    bar.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.tl') || e.target.closest('.win-back')) return;
      if (isMobile()) return;
      bringToFront(win);
      dragging = true;
      var r = win.getBoundingClientRect();
      var st = document.getElementById('stage').getBoundingClientRect();
      ox = r.left - st.left; oy = r.top - st.top;
      sx = e.clientX; sy = e.clientY;
      bar.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    bar.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var nx = ox + (e.clientX - sx);
      var ny = oy + (e.clientY - sy);
      var st = document.getElementById('stage');
      nx = Math.max(-WIN_OVERHANG_LEFT, Math.min(nx, st.clientWidth - WIN_MIN_VISIBLE_X));
      ny = Math.max(0, Math.min(ny, st.clientHeight - WIN_MIN_VISIBLE_Y));
      win.style.left = nx + 'px';
      win.style.top = ny + 'px';
    });

    var end = function (e) {
      if (!dragging) return;
      dragging = false;
      try { bar.releasePointerCapture(e.pointerId); } catch (err) {}
    };
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
  }

  /* ---------- МОБИЛЬНЫЙ СВАЙП-ВНИЗ (закрытие листа) ---------- */
  function initSheetSwipe(win) {
    var handle = win.querySelector('.win__grab');
    var bar = win.querySelector('.win__bar');
    if (!handle) return;
    var startY = 0, dy = 0, active = false, t0 = 0;

    function down(e) {
      if (!isMobile()) return;
      if (e.target.closest && e.target.closest('.tl')) return;
      active = true; startY = e.clientY; dy = 0; t0 = Date.now();
      win.style.transition = 'none';
      try { this.setPointerCapture(e.pointerId); } catch (err) {}
    }
    function move(e) {
      if (!active) return;
      dy = e.clientY - startY;
      if (dy < 0) dy = 0;
      win.style.transform = 'translateY(' + dy + 'px)';
    }
    function up(e) {
      if (!active) return;
      active = false;
      win.style.transition = '';
      var dt = Date.now() - t0;
      var velocity = dy / Math.max(dt, 1);
      if (dy > 80 || velocity > 0.6) {
        closeWindow(win.id);
      } else {
        win.style.transform = '';
      }
    }
    [handle, bar].forEach(function (el) {
      if (!el) return;
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
  }

  function initFocus(win) {
    win.addEventListener('pointerdown', function () { if (!isMobile()) bringToFront(win); });
  }

  /* ---------- ИЗМЕНЕНИЕ РАЗМЕРА ОКНА (8 краёв, десктоп) ---------- */
  var RS_SIDES = ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'];
  var MIN_W = 320, MIN_H = 180;

  function initResize(win) {
    RS_SIDES.forEach(function (side) {
      var h = document.createElement('span');
      h.className = 'win__rs win__rs--' + side;
      h.setAttribute('aria-hidden', 'true');
      win.appendChild(h);

      var sx = 0, sy = 0, x0 = 0, y0 = 0, w0 = 0, h0 = 0, active = false;

      h.addEventListener('pointerdown', function (e) {
        if (isMobile() || win.classList.contains('is-max')) return;
        var stage = document.getElementById('stage');
        var st = stage.getBoundingClientRect();
        var r = win.getBoundingClientRect();
        x0 = r.left - st.left; y0 = r.top - st.top;
        w0 = r.width; h0 = r.height;
        sx = e.clientX; sy = e.clientY;
        active = true;
        // фиксируем текущие размеры, снимаем ограничения авто-размера
        win.style.width = w0 + 'px';
        win.style.height = h0 + 'px';
        win.style.maxWidth = 'none';
        win.style.maxHeight = 'none';
        win.classList.add('is-resizing', 'is-sized');
        bringToFront(win);
        try { h.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault();
        e.stopPropagation();
      });

      h.addEventListener('pointermove', function (e) {
        if (!active) return;
        var dx = e.clientX - sx, dy = e.clientY - sy;
        var stage = document.getElementById('stage');
        var maxW = stage.clientWidth, maxH = stage.clientHeight;
        var nx = x0, ny = y0, nw = w0, nh = h0;

        if (side.indexOf('e') > -1) nw = Math.min(Math.max(w0 + dx, MIN_W), maxW - x0);
        if (side.indexOf('s') > -1) nh = Math.min(Math.max(h0 + dy, MIN_H), maxH - y0);
        if (side.indexOf('w') > -1) {
          nw = Math.max(w0 - dx, MIN_W);
          nx = x0 + (w0 - nw);
          if (nx < 0) { nx = 0; nw = x0 + w0; }
        }
        if (side.indexOf('n') > -1) {
          nh = Math.max(h0 - dy, MIN_H);
          ny = y0 + (h0 - nh);
          if (ny < 0) { ny = 0; nh = y0 + h0; }
        }

        win.style.left = Math.round(nx) + 'px';
        win.style.top = Math.round(ny) + 'px';
        win.style.width = Math.round(nw) + 'px';
        win.style.height = Math.round(nh) + 'px';
      });

      var stop = function (e) {
        if (!active) return;
        active = false;
        win.classList.remove('is-resizing');
        try { h.releasePointerCapture(e.pointerId); } catch (err) {}
      };
      h.addEventListener('pointerup', stop);
      h.addEventListener('pointercancel', stop);
      h.addEventListener('dblclick', function () {
        // двойной клик по ручке — вернуть авто-размер
        win.style.width = ''; win.style.height = '';
        win.style.maxWidth = ''; win.style.maxHeight = '';
        win.classList.remove('is-sized');
      });
    });
  }

  /* ---------- ТРАФИКЛАЙТЫ ---------- */
  function initControls(win) {
    win.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var act = b.dataset.act;
      if (act === 'close') closeWindow(win.id);
      else if (act === 'min') minimizeWindow(win.id);
      else if (act === 'max') toggleMax(win);
    });
  }

  /* ---------- ИНИЦИАЛИЗАЦИЯ ОКОН ---------- */
  var wins = document.querySelectorAll('.win');
  for (var i = 0; i < wins.length; i++) {
    wins[i].setAttribute('tabindex', '-1'); // окно принимает фокус при открытии
    initDrag(wins[i]); initFocus(wins[i]); initControls(wins[i]); initSheetSwipe(wins[i]); initResize(wins[i]);
  }

  /* ---------- ТРИГГЕРЫ ОТКРЫТИЯ ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-win]');
    if (!t) return;
    e.preventDefault();
    closeCC();
    openWindow(t.dataset.win, t);
  });

  /* Верхнее открытое (не закрывающееся) окно, по z-index */
  function topOpenWindow() {
    var open = Array.prototype.slice.call(document.querySelectorAll('.win.is-open:not(.is-closing)'));
    if (!open.length) return null;
    open.sort(function (a, b) { return (+b.style.zIndex || 0) - (+a.style.zIndex || 0); });
    return open[0];
  }

  /* ESC — закрыть верхнее окно / пункт управления; Cmd(Ctrl)+W — закрыть окно */
  document.addEventListener('keydown', function (e) {
    // Cmd/Ctrl+W: перехватываем, иначе браузер закроет вкладку — грубый разрыв иллюзии ОС
    if ((e.key === 'w' || e.key === 'W') && (e.metaKey || e.ctrlKey)) {
      var top = topOpenWindow();
      if (top) { e.preventDefault(); closeWindow(top.id); }
      return;
    }
    if (e.key !== 'Escape') return;
    if (!document.getElementById('cc').hasAttribute('hidden')) { closeCC(); return; }
    var win = topOpenWindow();
    if (win) closeWindow(win.id);
  });

  /* ============================================================
     3.4 — ПЕРЕСЧЁТ ГЕОМЕТРИИ ОКОН ПРИ RESIZE / СМЕНЕ БРЕЙКПОЙНТА
     ============================================================ */
  function resetDesktopGeometry() {
    var all = document.querySelectorAll('.win');
    for (var i = 0; i < all.length; i++) {
      var w = all[i];
      w.style.left = ''; w.style.top = ''; w.style.width = ''; w.style.height = '';
      w.style.maxWidth = ''; w.style.maxHeight = ''; w.style.transform = '';
      w.classList.remove('is-max', 'is-sized', 'is-resizing');
      delete w.dataset.px; delete w.dataset.py;
    }
    placed = {}; cascade = 0;
  }

  var wasMobile = isMobile();
  function onViewportChange() {
    var nowMobile = isMobile();
    var stage = document.getElementById('stage');
    if (nowMobile) {
      // десктоп → мобайл: инлайн-геометрия перебивала бы лист iOS — сбросить
      if (!wasMobile) resetDesktopGeometry();
    } else if (wasMobile) {
      // мобайл → десктоп: заново разложить открытые окна каскадом
      var openW = Array.prototype.slice.call(document.querySelectorAll('.win.is-open'));
      resetDesktopGeometry();
      openW.forEach(function (w) { place(w); });
    } else {
      // ресайз на десктопе: удержать открытые окна в границах stage
      var sw = stage.clientWidth, sh = stage.clientHeight;
      Array.prototype.slice.call(document.querySelectorAll('.win.is-open')).forEach(function (w) {
        if (w.classList.contains('is-max')) {
          w.style.left = MAX_MARGIN + 'px'; w.style.top = MAX_MARGIN + 'px';
          w.style.width = (sw - MAX_MARGIN * 2) + 'px';
          w.style.height = (sh - MAX_MARGIN * 2) + 'px';
        } else {
          var wv = parseFloat(w.style.width); if (!isNaN(wv) && wv > sw - MAX_MARGIN) w.style.width = (sw - MAX_MARGIN) + 'px';
          var hv = parseFloat(w.style.height); if (!isNaN(hv) && hv > sh - MAX_MARGIN) w.style.height = (sh - MAX_MARGIN) + 'px';
          clampPos(w, stage);
        }
      });
    }
    wasMobile = nowMobile;
  }
  var _rzT = null;
  window.addEventListener('resize', function () { clearTimeout(_rzT); _rzT = setTimeout(onViewportChange, 120); });

  /* ============================================================
     ТЕМА
     ============================================================ */
  function currentTheme() {
    return document.documentElement.classList.contains('theme-light') ? 'light' : 'dark';
  }
  function applyTheme(theme) {
    var d = document.documentElement;
    if (theme === 'light') d.classList.add('theme-light'); else d.classList.remove('theme-light');
    var v = document.getElementById('ccThemeVal');
    if (v) v.textContent = tr(theme === 'light' ? 'cc.theme.light' : 'cc.theme.dark');
  }
  function setTheme(theme) {
    applyTheme(theme);
    try { localStorage.setItem('theme', theme); } catch (e) {}
  }
  function toggleTheme() { setTheme(currentTheme() === 'light' ? 'dark' : 'light'); }

  var themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
  var ccTheme = document.getElementById('ccTheme');
  if (ccTheme) ccTheme.addEventListener('click', toggleTheme);
  applyTheme(currentTheme()); // синхронизировать подпись в пункте управления

  /* ============================================================
     ЯЗЫК
     ============================================================ */
  function toggleLang() { if (window.I18N) window.I18N.toggle(); }
  var langToggle = document.getElementById('langToggle');
  if (langToggle) langToggle.addEventListener('click', toggleLang);
  var ccLang = document.getElementById('ccLang');
  if (ccLang) ccLang.addEventListener('click', toggleLang);

  /* ============================================================
     ПУНКТ УПРАВЛЕНИЯ
     ============================================================ */
  var cc = document.getElementById('cc');
  var ccToggle = document.getElementById('ccToggle');
  var iosCC = document.getElementById('iosCC');
  function openCC() {
    cc.removeAttribute('hidden');
    if (ccToggle) ccToggle.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(function () { cc.classList.add('is-open'); });
  }
  function closeCC() {
    if (!cc || cc.hasAttribute('hidden')) return;
    cc.classList.remove('is-open');
    if (ccToggle) ccToggle.setAttribute('aria-expanded', 'false');
    var done = function () { cc.setAttribute('hidden', ''); cc.removeEventListener('transitionend', done); };
    if (reduceMotion) done(); else { cc.addEventListener('transitionend', done); setTimeout(done, 250); }
  }
  function toggleCC() { if (cc.hasAttribute('hidden')) openCC(); else closeCC(); }
  if (ccToggle) ccToggle.addEventListener('click', function (e) { e.stopPropagation(); toggleCC(); });
  if (iosCC) iosCC.addEventListener('click', function (e) { e.stopPropagation(); toggleCC(); });
  document.addEventListener('click', function (e) {
    if (cc.hasAttribute('hidden')) return;
    if (e.target.closest('#cc') || e.target.closest('#ccToggle') || e.target.closest('#iosCC')) return;
    closeCC();
  });

  /* ============================================================
     ЧАСЫ (Москва) + ДАТА + КАЛЕНДАРЬ-ВИДЖЕТ
     ============================================================ */
  var MO_SHORT = {
    ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  };
  var MO_CAL = {
    ru: ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'],
    en: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  };
  function moscowNow() {
    var d = new Date();
    return new Date(d.getTime() + (d.getTimezoneOffset() + 180) * 60000);
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function tickClock() {
    var m = moscowNow();
    var hh = pad(m.getHours()), mm = pad(m.getMinutes());
    var el = document.getElementById('clock');
    if (el) el.textContent = m.getDate() + ' ' + MO_SHORT[lang()][m.getMonth()] + ' ' + hh + ':' + mm;
    var ios = document.getElementById('ios-clock');
    if (ios) ios.textContent = hh + ':' + mm;
  }
  function initCalendar() {
    var m = moscowNow();
    var dd = document.getElementById('cal-date');
    var mo = document.getElementById('cal-month');
    if (dd) dd.textContent = m.getDate();
    if (mo) mo.textContent = MO_CAL[lang()][m.getMonth()];
  }
  var clockTimer = null;
  function startClock() {
    tickClock();
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(tickClock, 1000);   // без отставания минуты
  }
  function stopClock() { if (clockTimer) { clearInterval(clockTimer); clockTimer = null; } }
  initCalendar();
  startClock();

  /* ============================================================
     ВИДЖЕТ АССИСТЕНТА — посимвольная печать, 3 Q&A по кругу
     ============================================================ */
  function dialog() {
    return [
      { q: tr('chat.q1'), a: tr('chat.a1') },
      { q: tr('chat.q2'), a: tr('chat.a2') },
      { q: tr('chat.q3'), a: tr('chat.a3') }
    ];
  }

  var assistantTimer = null, assistantGen = 0;

  function typeInto(el, text, speed, myGen, done) {
    if (reduceMotion) {
      el.textContent = text;
      var c = document.createElement('span'); c.className = 'caret'; el.appendChild(c);
      if (done) assistantTimer = setTimeout(done, 1600);
      return;
    }
    el.textContent = '';
    var caret = document.createElement('span'); caret.className = 'caret';
    el.appendChild(caret);
    var idx = 0;
    (function step() {
      if (myGen !== assistantGen) return; // язык переключили — прекратить
      if (idx < text.length) {
        caret.insertAdjacentText('beforebegin', text.charAt(idx));
        idx += 1;
        assistantTimer = setTimeout(step, speed);
      } else if (done) {
        assistantTimer = setTimeout(done, 1500);
      }
    })();
  }

  function runAssistant() {
    var qEl = document.getElementById('aw-q');
    var aEl = document.getElementById('aw-a');
    if (!qEl || !aEl) return;
    assistantGen += 1;
    var myGen = assistantGen;
    if (assistantTimer) { clearTimeout(assistantTimer); assistantTimer = null; }
    var pairs = dialog();
    if (reduceMotion) {
      qEl.textContent = pairs[0].q; aEl.textContent = pairs[0].a; // статичная первая пара
      return;
    }
    var n = 0;
    (function cycle() {
      if (myGen !== assistantGen) return;
      var pair = pairs[n % pairs.length];
      qEl.textContent = pair.q;
      aEl.textContent = '';
      typeInto(aEl, pair.a, 26, myGen, function () {
        n += 1;
        assistantTimer = setTimeout(cycle, 500);
      });
    })();
  }
  /* остановить печать (смена gen убивает все отложенные шаги) */
  function stopAssistant() {
    if (assistantTimer) { clearTimeout(assistantTimer); assistantTimer = null; }
    assistantGen += 1;
  }

  /* ============================================================
     ТЕРМИНАЛ — печать строк при открытии
     ============================================================ */
  var termGen = 0, termTimer = null;
  function termLines() {
    var el = document.getElementById('term');
    if (!el) return [];
    var attr = (lang() === 'en' && el.dataset.linesEn) ? el.dataset.linesEn : el.dataset.lines;
    return (attr || '').split('||');
  }
  function runTerminal() {
    var el = document.getElementById('term');
    if (!el) return;
    var lines = termLines();
    termGen += 1;
    var myGen = termGen;
    if (termTimer) { clearTimeout(termTimer); termTimer = null; }
    if (reduceMotion) { el.textContent = lines.join('\n'); return; }
    el.textContent = '';
    var li = 0;
    (function nextLine() {
      if (myGen !== termGen) return;
      if (li >= lines.length) return;
      var line = lines[li];
      var prefix = el.textContent;
      var ci = 0;
      (function ch() {
        if (myGen !== termGen) return;
        if (ci <= line.length) {
          el.textContent = prefix + line.slice(0, ci);
          ci += 1;
          termTimer = setTimeout(ch, 18);
        } else {
          el.textContent = prefix + line + '\n';
          li += 1;
          termTimer = setTimeout(nextLine, 260);
        }
      })();
    })();
  }
  function stopTerminal() {
    if (termTimer) { clearTimeout(termTimer); termTimer = null; }
    termGen += 1;
  }
  function terminalOpen() {
    var t = document.getElementById('win-terminal');
    return !!(t && t.classList.contains('is-open'));
  }

  /* ============================================================
     3.3 — ПАУЗА ПЕЧАТИ ВНЕ ЭКРАНА / В ФОНЕ (батарея, idle-вкладка)
     Печать чата и терминала (десятки мутаций DOM/сек на blur-слое)
     останавливается, когда вкладка скрыта или виджет ассистента вне вьюпорта.
     ============================================================ */
  var awInView = true;   // виджет ассистента в зоне видимости
  function assistantMayRun() { return awInView && !document.hidden; }
  function syncTypers() {
    if (assistantMayRun()) runAssistant(); else stopAssistant();
    if (!document.hidden && terminalOpen()) runTerminal(); else stopTerminal();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stopAssistant(); stopTerminal(); stopClock(); }
    else { startClock(); syncTypers(); }
  });

  (function observeAssistant() {
    var aw = document.querySelector('.widget--assistant');
    if (!aw || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      awInView = entries[0].isIntersecting;
      if (assistantMayRun()) runAssistant(); else stopAssistant();
    }, { threshold: 0.15 });
    io.observe(aw);
  })();

  /* ============================================================
     РЕАКЦИЯ НА СМЕНУ ЯЗЫКА
     ============================================================ */
  document.addEventListener('i18n:change', function () {
    tickClock();
    initCalendar();
    if (assistantMayRun()) runAssistant();
    // терминал перепечатать, если открыт
    if (terminalOpen()) runTerminal();
    // постер 3D-офиса — обновить подпись/alt под язык
    var poster = document.querySelector('.agents__poster');
    if (poster) {
      var label = tr('agents.fallback');
      poster.setAttribute('aria-label', label);
      var cap = poster.querySelector('.agents__poster-cap');
      if (cap) cap.textContent = label;
    }
  });

  /* ============================================================
     МОБИЛЬНЫЙ ПЕЙДЖЕР: экран приложений ↔ экран виджетов
     (pointer events + transform translateX, без библиотек)
     ============================================================ */
  (function initPager() {
    var pager = document.getElementById('pager');
    var track = document.getElementById('pagerTrack');
    var dotsWrap = document.getElementById('pagerDots');
    if (!pager || !track) return;
    var dots = dotsWrap ? Array.prototype.slice.call(dotsWrap.querySelectorAll('button')) : [];
    var PAGES = 2;
    var cur = 0, w = 0;
    var dragging = false, decided = false, horiz = false, justSwiped = false;
    var startX = 0, startY = 0, t0 = 0, pid = null;

    function clearTransform() { track.style.transition = ''; track.style.transform = ''; }
    function updateDots() {
      for (var i = 0; i < dots.length; i++) {
        dots[i].classList.toggle('is-active', i === cur);
        dots[i].setAttribute('aria-selected', i === cur ? 'true' : 'false');
      }
    }
    function go(i, animate) {
      cur = Math.max(0, Math.min(PAGES - 1, i));
      w = pager.clientWidth;
      track.style.transition = (animate === false || reduceMotion) ? 'none' : '';
      track.style.transform = 'translateX(' + (-cur * w) + 'px)';
      updateDots();
    }

    track.addEventListener('pointerdown', function (e) {
      if (!isMobile()) return;
      dragging = true; decided = false; horiz = false; justSwiped = false;
      startX = e.clientX; startY = e.clientY; t0 = Date.now();
      w = pager.clientWidth; pid = e.pointerId;
      track.style.transition = 'none';
    });
    track.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      if (!decided) {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          decided = true;
          horiz = Math.abs(dx) > Math.abs(dy);
          if (horiz) { try { track.setPointerCapture(pid); } catch (err) {} }
        } else return;
      }
      if (!horiz) return;
      if (e.cancelable) e.preventDefault();
      var base = -cur * w, t = base + dx, min = -(PAGES - 1) * w;
      if (t > 0) t = t * 0.35;                       // резинка у левого края
      else if (t < min) t = min + (t - min) * 0.35;  // резинка у правого края
      track.style.transform = 'translateX(' + t + 'px)';
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      try { track.releasePointerCapture(pid); } catch (err) {}
      if (!decided || !horiz) return;
      var dx = e.clientX - startX;
      var v = dx / Math.max(Date.now() - t0, 1);
      if (Math.abs(dx) > 8) justSwiped = true;
      var target = cur;
      if (dx < -60 || v < -0.5) target = cur + 1;
      else if (dx > 60 || v > 0.5) target = cur - 1;
      go(target, true);
    }
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);

    // подавить клик-открытие окна, если это был горизонтальный свайп
    track.addEventListener('click', function (e) {
      if (justSwiped) { e.stopPropagation(); e.preventDefault(); justSwiped = false; }
    }, true);

    for (var d = 0; d < dots.length; d++) {
      (function (idx) {
        dots[idx].addEventListener('click', function () { if (isMobile()) go(idx, true); });
      })(d);
    }

    function sync() { if (isMobile()) go(cur, false); else clearTransform(); }
    window.addEventListener('resize', sync);
    sync();

    var mq = window.matchMedia('(max-width: 1023px)');
    var onMq = function () { if (!mq.matches) clearTransform(); else go(cur, false); };
    if (mq.addEventListener) mq.addEventListener('change', onMq);
    else if (mq.addListener) mq.addListener(onMq);

    // экспорт для тестов (только локально)
    if (DEV) window.__pager = { go: go, current: function () { return cur; }, track: track };
  })();

  /* ============================================================
     КАСКАДНОЕ ПОЯВЛЕНИЕ + СТАРТ
     ============================================================ */
  window.requestAnimationFrame(function () {
    var rev = document.querySelectorAll('.reveal');
    for (var r = 0; r < rev.length; r++) {
      rev[r].style.transitionDelay = reduceMotion ? '0s' : (r * 0.04) + 's';
      rev[r].classList.add('in');
    }
    // На мобильном первый экран — springboard; README открывается по иконке.
    if (!isMobile()) openWindow('win-readme');
  });

  /* 3.12 — некритичную печать ассистента откладываем на простой браузера,
     чтобы не удлинять первый отрисованный кадр. Дальше её ведёт IntersectionObserver. */
  var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 200); };
  idle(function () { if (assistantMayRun()) runAssistant(); });

  /* ============================================================
     ЗВОНОК ИЗ БРАУЗЕРА (аудио / видео)

     Разговор идёт через Jitsi Meet (Apache-2.0, сквозное шифрование,
     без регистрации). Комната создаётся уникальной, iframe грузится
     ТОЛЬКО по нажатию — до этого со страницы не уходит ни одного
     внешнего запроса. Микрофон и камеру запрашивает Jitsi внутри iframe.
     ============================================================ */
  (function () {
    var win = document.getElementById('win-call');
    if (!win) return;

    var home = document.getElementById('callHome');
    var live = document.getElementById('callLive');
    var stage = document.getElementById('callStage');
    var statusEl = document.getElementById('callStatus');
    var btnAudio = document.getElementById('callAudio');
    var btnVideo = document.getElementById('callVideo');
    var btnEnd = document.getElementById('callEnd');
    var btnCopy = document.getElementById('callCopy');
    if (!home || !live || !stage) return;

    var HOST = 'https://meet.jit.si/';
    var room = null;

    function newRoom() {
      return 'urartu-ai-' +
        Math.random().toString(36).slice(2, 8) +
        Math.random().toString(36).slice(2, 6);
    }
    function roomUrl() { return HOST + room; }

    function start(video) {
      room = newRoom();

      var params = [
        'config.prejoinPageEnabled=false',
        'config.disableDeepLinking=true',
        'config.startWithVideoMuted=' + (video ? 'false' : 'true'),
        'config.startWithAudioMuted=false',
        'userInfo.displayName=' + encodeURIComponent(tr('call.guest'))
      ].join('&');

      var frame = document.createElement('iframe');
      frame.src = roomUrl() + '#' + params;
      frame.allow = 'camera; microphone; fullscreen; display-capture; autoplay';
      frame.title = tr('call.title');

      stage.innerHTML = '';
      stage.appendChild(frame);

      home.hidden = true;
      live.hidden = false;
      win.classList.add('is-live');
      if (statusEl) statusEl.textContent = tr('call.connected');
    }

    /* Кладём трубку: убираем iframe, иначе микрофон останется включённым. */
    function end() {
      stage.innerHTML = '';
      live.hidden = true;
      home.hidden = false;
      win.classList.remove('is-live');
      room = null;
    }

    if (btnAudio) btnAudio.addEventListener('click', function () { start(false); });
    if (btnVideo) btnVideo.addEventListener('click', function () { start(true); });
    if (btnEnd) btnEnd.addEventListener('click', end);

    if (btnCopy) {
      btnCopy.addEventListener('click', function () {
        if (!room) return;
        var url = roomUrl();
        var flash = function () {
          var old = btnCopy.textContent;
          btnCopy.textContent = tr('call.copied');
          window.setTimeout(function () { btnCopy.textContent = old; }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(flash, function () { window.prompt(tr('call.copy'), url); });
        } else {
          window.prompt(tr('call.copy'), url);
        }
      });
    }

    /* Закрытие окна = завершение звонка. */
    win.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-act]');
      if (b && b.dataset.act === 'close' && !live.hidden) end();
    });
  })();

  /* ============================================================
     МАГНИФИКАЦИЯ ДОКА (как в macOS)

     Ключ к «настоящему» ощущению: иконка растёт РАЗМЕРОМ, а не scale().
     Тогда соседи расступаются, а сам док плавно расширяется — как в системе.
     Размер каждой иконки плавно догоняет целевой (rAF + линейная
     интерполяция), поэтому движение мягкое и продолжается после остановки
     курсора. Расстояние считается в «неувеличенной» системе координат,
     иначе иконки дрожат: рост сдвигает центры, те меняют рост, и так по кругу.
     ============================================================ */
  (function () {
    var dock = document.querySelector('.dock');
    if (!dock) return;

    /* Параметры сняты с эталона displace.agency замером живого дока:
       базовая иконка 52px, под курсором 84px, влияние гаснет к 132px,
       кривая — косинусное окно (совпало с их значениями 84/71/53/52),
       движение — пружина с лёгким перелётом, а не линейное догоняние. */
    var BASE = 52;
    var MAX = 84;
    var RADIUS = 132;      // за этой границей иконка не реагирует

    var STIFF = 190;       // жёсткость пружины
    var DAMP = 20;         // затухание: чуть меньше критического → мягкий перелёт
    var MASS = 1;

    var apps = [];         // { el, base, size, vel }
    var raf = null, prevTs = 0;
    var mouseX = null;

    /* Центры считаем в спокойном состоянии: если брать «живые», рост иконок
       двигает центры, те меняют рост — и док начинает дрожать. */
    function measure() {
      var list = Array.prototype.slice.call(dock.querySelectorAll('.dock__app'))
        .filter(function (a) { return a.offsetParent !== null; });

      apps.forEach(function (a) { a.el.style.removeProperty('--size'); });
      apps = list.map(function (el) {
        var r = el.getBoundingClientRect();
        return { el: el, base: r.left + r.width / 2, size: BASE, vel: 0 };
      });
    }

    function targetFor(centerX) {
      if (mouseX === null) return BASE;
      var d = Math.abs(mouseX - centerX);
      if (d >= RADIUS) return BASE;
      var k = 0.5 * (1 + Math.cos(Math.PI * d / RADIUS));   // 1 → 0, гладко
      return BASE + (MAX - BASE) * k;
    }

    function tick(ts) {
      var dt = prevTs ? Math.min((ts - prevTs) / 1000, 0.032) : 0.016;
      prevTs = ts;

      var alive = false;
      apps.forEach(function (a) {
        var target = targetFor(a.base);
        // интегрируем пружину: F = -k(x - target) - c*v
        var accel = (STIFF * (target - a.size) - DAMP * a.vel) / MASS;
        a.vel += accel * dt;
        a.size += a.vel * dt;

        if (Math.abs(target - a.size) > 0.15 || Math.abs(a.vel) > 0.6) {
          alive = true;
        } else {
          a.size = target;
          a.vel = 0;
        }
        a.el.style.setProperty('--size', a.size.toFixed(2) + 'px');
      });

      if (alive) {
        raf = window.requestAnimationFrame(tick);
      } else {
        raf = null; prevTs = 0;
        if (mouseX === null) {
          apps.forEach(function (a) { a.el.style.removeProperty('--size'); });
        }
      }
    }

    function start() {
      if (raf === null) { prevTs = 0; raf = window.requestAnimationFrame(tick); }
    }

    function onMove(e) {
      if (isMobile()) return;
      mouseX = e.clientX;
      start();
    }

    function onLeave() {
      mouseX = null;
      start();   // пружина сама вернёт иконки к базовому размеру
    }

    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduceMotion) {
      dock.addEventListener('pointerenter', function (e) { measure(); onMove(e); });
      dock.addEventListener('pointermove', onMove);
      dock.addEventListener('pointerleave', onLeave);
      window.addEventListener('resize', function () {
        mouseX = null;
        apps.forEach(function (a) { a.el.style.removeProperty('--size'); });
        apps = [];
      }, { passive: true });
    }
  })();

  // экспорт для тестов (только локально)
  if (DEV) window.__os = {
    openWindow: openWindow, closeWindow: closeWindow,
    setTheme: setTheme, toggleTheme: toggleTheme, currentTheme: currentTheme
  };
})();
