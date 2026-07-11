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

  /* ---------- БРОНЯ (ЛОТ J): санитайзер любого HTML перед innerHTML ----------
     DOMPurify грузится локально (vendor/purify.min.js), эагерно.
     Разрешаем разметку наших ответов (mark из BM25, blockquote, списки, таблицы),
     режем onerror/onclick/script и прочую инъекцию. Ссылки — только http(s). */
  function sanitizeHTML(html) {
    if (html == null) return '';
    if (window.DOMPurify && window.DOMPurify.sanitize) {
      return window.DOMPurify.sanitize(String(html), {
        ALLOWED_TAGS: ['a', 'b', 'strong', 'i', 'em', 'u', 's', 'mark', 'small', 'sup', 'sub',
          'br', 'p', 'span', 'div', 'blockquote', 'code', 'pre', 'kbd',
          'ul', 'ol', 'li', 'dl', 'dt', 'dd',
          'table', 'thead', 'tbody', 'tr', 'th', 'td',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr'],
        ALLOWED_ATTR: ['href', 'title', 'class', 'lang', 'dir', 'colspan', 'rowspan'],
        ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#)/i,
        ADD_ATTR: ['target', 'rel']
      });
    }
    return String(html); // страховка: наши строки уже безопасны (esc в localai.js)
  }
  window.OSSanitize = sanitizeHTML;

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
  /* The Delegation рендерит через WebGPU; без него холст пустой.
     navigator.gpu бывает и там, где адаптера нет (headless, старые GPU,
     блок-листы) — тогда three сыплет ошибки в пустой холст. Поэтому
     проверяем настоящий адаптер, один раз, с кешем. */
  var agentsGpuProbe = null;
  function agentsSupported() { return !!navigator.gpu; }
  function agentsAdapterOk() {
    if (agentsGpuProbe) return agentsGpuProbe;
    agentsGpuProbe = (navigator.gpu && typeof navigator.gpu.requestAdapter === 'function')
      ? navigator.gpu.requestAdapter().then(
          function (a) { return !!a; },
          function () { return false; })
      : Promise.resolve(false);
    return agentsGpuProbe;
  }
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

  /* Сплэш «Строим офис…»: тёмная заставка поверх iframe, растворяется по load.
     Если iframe не загрузился за 20 с — на сплэше появляется кнопка «Ещё раз». */
  function buildAgentsSplash(stage) {
    var sp = document.createElement('div');
    sp.className = 'agents__splash';
    sp.setAttribute('role', 'status');
    sp.innerHTML =
      '<div class="agents__splash-in">' +
        '<svg class="agents__bot" width="58" height="58" viewBox="0 0 48 48" aria-hidden="true" ' +
        'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="11" y="16" width="26" height="20" rx="5"/>' +
        '<line x1="24" y1="9" x2="24" y2="16"/><circle cx="24" cy="7" r="2.2" fill="currentColor" stroke="none"/>' +
        '<circle cx="19" cy="26" r="2.4" fill="currentColor" stroke="none"/><circle cx="29" cy="26" r="2.4" fill="currentColor" stroke="none"/>' +
        '<path d="M20 31.5h8"/><line x1="8" y1="24" x2="11" y2="24"/><line x1="37" y1="24" x2="40" y2="24"/></svg>' +
        '<p class="agents__splash-t"><span class="agents__lbl"></span>' +
          '<span class="agents__dots" aria-hidden="true"><i></i><i></i><i></i></span></p>' +
        '<p class="agents__splash-sub"></p>' +
        '<button type="button" class="agents__retry" hidden></button>' +
      '</div>';
    sp.querySelector('.agents__lbl').textContent = tr('agents.building');
    sp.querySelector('.agents__splash-sub').textContent = tr('agents.hint');
    sp.querySelector('.agents__retry').textContent = tr('agents.retry');
    return sp;
  }

  function loadAgentsFrame(stage) {
    var oldFrame = stage.querySelector('iframe');
    if (oldFrame) oldFrame.remove();
    var splash = stage.querySelector('.agents__splash');
    if (!splash) { splash = buildAgentsSplash(stage); stage.appendChild(splash); }
    splash.classList.remove('is-gone');
    var retry = splash.querySelector('.agents__retry');
    retry.hidden = true;

    var frame = document.createElement('iframe');
    frame.src = 'delegation/index.html';
    frame.title = lang() === 'en'
      ? 'The Delegation — 3D office of AI agents'
      : 'The Delegation — 3D-офис ИИ-агентов';
    frame.allow = 'fullscreen';
    frame.loading = 'lazy';

    var done = false;
    var timer = setTimeout(function () { if (!done) retry.hidden = false; }, 20000);
    frame.addEventListener('load', function () {
      if (done) return; done = true;
      clearTimeout(timer);
      splash.classList.add('is-gone');
      setTimeout(function () { if (splash.parentNode) splash.remove(); }, reduceMotion ? 0 : 450);
    });
    stage.insertBefore(frame, splash);
    retry.onclick = function () { loadAgentsFrame(stage); };
  }

  window.__ensureAgentsFrame = ensureAgentsFrame;
  function ensureAgentsFrame() {
    var stage = document.getElementById('agentsStage');
    if (!stage || stage.querySelector('iframe') || stage.querySelector('.agents__poster')) return;
    if (!agentsSupported()) { showAgentsFallback(stage); return; }
    agentsAdapterOk().then(function (okGpu) {
      if (!stage.isConnected || stage.querySelector('iframe') || stage.querySelector('.agents__poster')) return;
      if (!okGpu) { showAgentsFallback(stage); return; }
      loadAgentsFrame(stage);
    });
  }

  /* «На весь экран» для 3D-офиса: нативный Fullscreen API по контейнеру,
     с запасным вариантом (класс is-cover) там, где API недоступен (iOS Safari). */
  function agentsFsActive() {
    var fe = document.fullscreenElement || document.webkitFullscreenElement;
    var win = document.getElementById('win-agents');
    return (fe && document.getElementById('agentsStage') &&
            (fe === document.getElementById('agentsStage') || fe.contains(document.getElementById('agentsStage'))))
      || (win && win.classList.contains('is-cover'));
  }
  function setFsLabel() {
    var btn = document.getElementById('agentsFs');
    if (!btn) return;
    var span = btn.querySelector('span');
    var active = agentsFsActive();
    if (span) span.textContent = active ? tr('agents.fsExit') : tr('agents.fs');
    btn.setAttribute('aria-label', active ? tr('agents.fsExit') : tr('agents.fs'));
  }
  function toggleAgentsFs() {
    var stage = document.getElementById('agentsStage');
    var win = document.getElementById('win-agents');
    if (!stage) return;
    var fe = document.fullscreenElement || document.webkitFullscreenElement;
    if (fe) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      return;
    }
    if (win && win.classList.contains('is-cover')) { win.classList.remove('is-cover'); setFsLabel(); return; }
    var req = stage.requestFullscreen || stage.webkitRequestFullscreen;
    if (req) { try { req.call(stage); } catch (e) { if (win) win.classList.add('is-cover'); setFsLabel(); } }
    else if (win) { win.classList.add('is-cover'); setFsLabel(); }
  }
  function initAgentsFs() {
    var btn = document.getElementById('agentsFs');
    if (btn) btn.addEventListener('click', toggleAgentsFs);
    document.addEventListener('fullscreenchange', setFsLabel);
    document.addEventListener('webkitfullscreenchange', setFsLabel);
    document.addEventListener('i18n:change', setFsLabel);
  }

  /* ---------- ИГРА «Собери 70B»: iframe грузится по первому открытию ----------
     Как и 3D-офис — ничего внешнего при старте страницы; тяжёлое только по клику. */
  function ensureGameFrame() {
    var stage = document.getElementById('gameStage');
    if (!stage || stage.querySelector('iframe')) return;
    var frame = document.createElement('iframe');
    frame.src = 'game/index.html';
    frame.title = lang() === 'en' ? 'Assemble 70B — game' : 'Собери 70B — игра';
    frame.loading = 'lazy';
    frame.setAttribute('allow', 'fullscreen');
    stage.appendChild(frame);
  }
  /* ---------- ЛОТ I: ДАШБОРД «ПУЛЬС КОМПАНИИ» ----------
     js/pulse.js (а из него — vendor/echarts.min.js, ~1,1 МБ локально)
     грузится ЛЕНИВО при первом открытии окна. При старте страницы —
     ноль лишних байтов, как game/delegation. */
  var pulseLoading = false;
  function ensurePulse() {
    if (window.Pulse) { window.Pulse.open(); return; }
    if (pulseLoading) return;
    pulseLoading = true;
    var s = document.createElement('script');
    s.src = 'js/pulse.js';
    s.onload = function () { if (window.Pulse) window.Pulse.open(); };
    s.onerror = function () {
      pulseLoading = false;
      var l = document.getElementById('pulseLoading');
      if (l) l.textContent = tr('pulse.err');
    };
    document.head.appendChild(s);
  }

  /* devices.js — интерактив окна «Устройства» (LOT T2), лениво при первом открытии. */
  var devicesLoading = false;
  function ensureDevices() {
    if (window.Devices) { window.Devices.refresh(); return; }
    if (devicesLoading) return;
    devicesLoading = true;
    var s = document.createElement('script');
    s.src = 'js/devices.js';
    s.onerror = function () { devicesLoading = false; };
    document.head.appendChild(s);
  }

  /* Приёмка V7.1: localai.js (движок ответов агентов, ~41 КБ) — лениво,
     при первом открытии окна с агентом (Сообщения / Звонок / Фабрика).
     При старте страницы — ноль лишних байтов (вес первой загрузки ≤ 650 КБ).
     Внешние вызовы LocalAI и так за guard'ами window.LocalAI; колбэки
     выполняются и при onerror, чтобы окно открылось в любом случае. */
  var localaiQ = [], localaiState = 0; /* 0 — нет, 1 — грузится, 2 — готов */
  function ensureLocalAI(cb) {
    if (window.LocalAI) { if (cb) { try { cb(); } catch (e) {} } return; }
    if (cb) localaiQ.push(cb);
    if (localaiState === 1) return;
    localaiState = 1;
    var s = document.createElement('script');
    s.src = 'js/localai.js';
    s.onload = function () {
      localaiState = 2;
      var q = localaiQ; localaiQ = [];
      q.forEach(function (f) { try { f(); } catch (e) {} });
    };
    s.onerror = function () {
      localaiState = 0;
      var q = localaiQ; localaiQ = [];
      q.forEach(function (f) { try { f(); } catch (e) {} });
    };
    document.head.appendChild(s);
  }

  function gameFsActive() {
    var fe = document.fullscreenElement || document.webkitFullscreenElement;
    var win = document.getElementById('win-game');
    var st = document.getElementById('gameStage');
    return (fe && st && (fe === st || fe.contains(st))) || (win && win.classList.contains('is-cover'));
  }
  function setGameFsLabel() {
    var btn = document.getElementById('gameFs');
    if (!btn) return;
    var span = btn.querySelector('span');
    var active = gameFsActive();
    if (span) span.textContent = active ? tr('agents.fsExit') : tr('game.fs');
    btn.setAttribute('aria-label', active ? tr('agents.fsExit') : tr('game.fs'));
  }
  function toggleGameFs() {
    var stage = document.getElementById('gameStage');
    var win = document.getElementById('win-game');
    if (!stage) return;
    var fe = document.fullscreenElement || document.webkitFullscreenElement;
    if (fe) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    if (win && win.classList.contains('is-cover')) { win.classList.remove('is-cover'); setGameFsLabel(); return; }
    var req = stage.requestFullscreen || stage.webkitRequestFullscreen;
    if (req) { try { req.call(stage); } catch (e) { if (win) win.classList.add('is-cover'); setGameFsLabel(); } }
    else if (win) { win.classList.add('is-cover'); setGameFsLabel(); }
  }
  function initGameFs() {
    var btn = document.getElementById('gameFs');
    if (btn) btn.addEventListener('click', toggleGameFs);
    document.addEventListener('fullscreenchange', setGameFsLabel);
    document.addEventListener('webkitfullscreenchange', setGameFsLabel);
    document.addEventListener('i18n:change', setGameFsLabel);
  }

  /* iOS-переход открытия приложения: пока открыт хотя бы один лист,
     springboard отъезжает назад (scale .96) и темнеет, док/поиск прячутся */
  function updateAppOpen() {
    var any = document.querySelector('.win.is-open:not(.is-closing)');
    document.documentElement.classList.toggle('app-open', !!any && isMobile());
  }

  /* триггеры, вернувшие фокус после закрытия окна (доступность диалогов) */
  var lastTrigger = {};
  function moveFocus(el) {
    if (!el) return;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }

  /* ============================================================
     D1 — АНИМАЦИЯ ОКНА ИЗ ИКОНКИ-ТРИГГЕРА (как в macOS)
     Открытие: transform-origin ставится в центр иконки (в координатах
     окна), окно «вылетает» scale(.25)→1 за 320ms cubic-bezier(.32,.72,0,1).
     Закрытие/сворачивание: обратно в иконку (в док — «всасывается»), 240ms.
     Reduced-motion: мгновенно, без анимаций.
     ============================================================ */
  var WIN_EASE = 'cubic-bezier(.32,.72,0,1)';

  /* центр видимого элемента-триггера в координатах вьюпорта */
  function triggerPoint(trg) {
    if (!trg || !trg.getBoundingClientRect || !document.contains(trg)) return null;
    if (trg.offsetParent === null && getComputedStyle(trg).position !== 'fixed') return null; // скрыт
    var r = trg.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  /* transform-origin окна = точка триггера в локальных координатах окна.
     Рект меряем с transform:none — текущий scale(.96/.25) исказил бы точку. */
  function setOriginToTrigger(win, pt) {
    var prev = win.style.transform;
    win.style.transform = 'none';
    var r = win.getBoundingClientRect();
    win.style.transform = prev;
    win.style.transformOrigin = (pt.x - r.left) + 'px ' + (pt.y - r.top) + 'px';
  }

  /* окно вылетает из иконки; вернуть false, если анимация невозможна */
  function animateWinFrom(win, trg) {
    if (reduceMotion || isMobile() || !win.animate) return false;
    var pt = triggerPoint(trg);
    if (!pt) return false;
    setOriginToTrigger(win, pt);
    var anim = win.animate(
      [{ transform: 'scale(.25)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: 320, easing: WIN_EASE }
    );
    anim.onfinish = function () { win.style.transformOrigin = ''; };
    return true;
  }

  /* окно «всасывается» в иконку (scale к origin + fade); done — по завершении */
  function animateWinTo(win, trg, done) {
    if (reduceMotion || isMobile() || !win.animate) return false;
    var pt = triggerPoint(trg);
    if (!pt) return false;
    setOriginToTrigger(win, pt);
    var fin = false;
    var end = function () { if (fin) return; fin = true; win.style.transformOrigin = ''; done(); };
    var anim = win.animate(
      [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.22)', opacity: 0 }],
      { duration: 240, easing: WIN_EASE }
    );
    anim.onfinish = end;
    anim.oncancel = end;
    setTimeout(end, 320); // страховка, если onfinish не пришёл
    return true;
  }

  /* мобильный отклик от точки тапа: иконка пульсирует (лист выезжает по CSS) */
  function pulseTrigger(trg) {
    if (reduceMotion || !trg) return;
    var el = trg.querySelector && trg.querySelector('img') || trg;
    if (!el.animate) return;
    el.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }],
      { duration: 260, easing: 'ease-out' }
    );
  }

  /* скриншоты внутри окон грузим при первом открытии (вес первой загрузки) */
  function hydrateImages(win) {
    Array.prototype.forEach.call(win.querySelectorAll('img[data-src]'), function (im) {
      im.src = im.getAttribute('data-src');
      im.removeAttribute('data-src');
    });
  }
  /* SEO: только портфолио (9 фото кейсов, самое ценное для индексации/картиночного
     поиска) получает реальный src сразу — .win скрыт через opacity/visibility,
     а не display:none, поэтому loading="lazy" НЕ откладывает реальную загрузку
     (браузер всё равно её видит «в области просмотра»). Раздутие веса всей
     страницы (~250 КБ на все 25 иконок) неприемлемо — гидрируем точечно. */
  window.requestAnimationFrame(function () {
    var pf = document.getElementById('win-portfolio');
    if (pf) hydrateImages(pf);
  });

  function openWindow(id, trigger) {
    var win = document.getElementById(id);
    if (!win) return;
    hydrateImages(win);
    if (id === 'win-agents') { if (window.AgentsPanel) window.AgentsPanel.ensure(); }
    if (id === 'win-scan') { if (window.Scanner) window.Scanner.onOpen(); }
    if (id === 'win-game') ensureGameFrame();
    if (id === 'win-pulse') ensurePulse();
    if (id === 'win-devices') ensureDevices();
    if (id === 'win-assistant') ensureLocalAI(function () { if (window.Messenger) window.Messenger.onOpen(); });
    if (id === 'win-call' || id === 'win-factory') ensureLocalAI();
    place(win);
    win.style.transform = '';
    win.classList.remove('is-closing');
    win.classList.add('is-open');
    win.setAttribute('aria-modal', 'true');
    bringToFront(win);
    var d = dockApp(id);
    if (d) d.classList.add('is-open');
    if (id === 'win-terminal') runTerminal();
    updateAppOpen();
    /* только для действий пользователя: переносим фокус в окно и запоминаем,
       куда его вернуть. Автооткрытие README при загрузке фокус не трогает. */
    if (trigger) {
      lastTrigger[id] = trigger;
      moveFocus(win);
      /* красивое открытие: десктоп — вылет из иконки, мобайл — пульс иконки */
      if (isMobile()) pulseTrigger(trigger);
      else animateWinFrom(win, trigger);
    }
  }

  function hideWindow(id, keepDot) {
    var win = document.getElementById(id);
    if (!win || !win.classList.contains('is-open')) return;
    if (id === 'win-scan' && window.Scanner) window.Scanner.stop();
    win.classList.add('is-closing');
    win.removeAttribute('aria-modal');
    activateTop();
    updateAppOpen();
    var done = function () {
      win.classList.remove('is-open', 'is-closing');
      win.style.transform = '';
      win.style.transformOrigin = '';
      win.removeEventListener('transitionend', done);
    };
    /* куда «улетает» окно: сворачивание — в иконку дока,
       закрытие — в иконку-триггер (или в док, если триггер пропал) */
    var trg = lastTrigger[id];
    var target = keepDot
      ? (dockApp(id) || trg)
      : ((trg && document.contains(trg)) ? trg : dockApp(id));
    if (reduceMotion) { done(); }
    else if (animateWinTo(win, target, done)) { /* полёт в иконку запущен */ }
    else { win.addEventListener('transitionend', done); setTimeout(done, 340); }
    if (!keepDot) { var d = dockApp(id); if (d) d.classList.remove('is-open'); }
    /* вернуть фокус на триггер, если он ещё в DOM */
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
      if (e.target.closest('.tl') || e.target.closest('.win-back') || e.target.closest('.win-fs')) return;
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

  /* ---------- МОБИЛЬНЫЙ СВАЙП-ВНИЗ (закрытие листа) ----------
     Тач — через touch events (passive:false), иначе iOS Safari отменяет
     жест pointercancel'ом; pointer events остаются для мыши. */
  function initSheetSwipe(win) {
    var handle = win.querySelector('.win__grab');
    var bar = win.querySelector('.win__bar');
    if (!handle) return;
    var startY = 0, dy = 0, active = false, t0 = 0, touching = false;

    function start(y, target) {
      if (!isMobile()) return false;
      if (target && target.closest && target.closest('.tl')) return false;
      active = true; startY = y; dy = 0; t0 = Date.now();
      win.style.transition = 'none';
      return true;
    }
    function move(y, e) {
      if (!active) return;
      dy = y - startY;
      if (dy < 0) dy = 0;
      if (e && e.cancelable) e.preventDefault();
      win.style.transform = 'translateY(' + dy + 'px)';
    }
    function finish() {
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
      /* тач */
      el.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) return;
        touching = start(e.touches[0].clientY, e.target);
      }, { passive: true });
      el.addEventListener('touchmove', function (e) {
        if (!touching) return;
        move(e.touches[0].clientY, e);
      }, { passive: false });
      var tEnd = function () { if (!touching) return; touching = false; finish(); };
      el.addEventListener('touchend', tEnd);
      el.addEventListener('touchcancel', tEnd);

      /* мышь/перо */
      el.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'touch' || touching) return;
        if (start(e.clientY, e.target)) { try { el.setPointerCapture(e.pointerId); } catch (err) {} }
      });
      el.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch' || touching) return;
        move(e.clientY, e);
      });
      var pEnd = function (e) {
        if (e.pointerType === 'touch' || touching) return;
        try { el.releasePointerCapture(e.pointerId); } catch (err) {}
        finish();
      };
      el.addEventListener('pointerup', pEnd);
      el.addEventListener('pointercancel', pEnd);
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
  initAgentsFs();
  initGameFs();

  /* ---------- МЕНЮ-БАР: выпадающие списки (как в macOS) ----------
     Двенадцать плоских пунктов не помещались в строку и переносились.
     Сгруппированы в пять меню. Клик открывает; пока одно открыто,
     наведение на соседнее переключает — как в настоящей строке меню. */
  var menus = Array.prototype.slice.call(document.querySelectorAll('.mb-menu'));

  function closeMenus() {
    menus.forEach(function (m) {
      m.classList.remove('is-open');
      var d = m.querySelector('.mb-menu__d'); if (d) d.hidden = true;
      var t = m.querySelector('.mb-menu__t'); if (t) t.setAttribute('aria-expanded', 'false');
    });
  }
  function openMenu(m) {
    closeMenus();
    m.classList.add('is-open');
    var d = m.querySelector('.mb-menu__d'); if (d) d.hidden = false;
    var t = m.querySelector('.mb-menu__t'); if (t) t.setAttribute('aria-expanded', 'true');
  }
  function anyMenuOpen() { return menus.some(function (m) { return m.classList.contains('is-open'); }); }

  menus.forEach(function (m) {
    var t = m.querySelector('.mb-menu__t');
    if (!t) return;
    t.addEventListener('click', function (e) {
      e.stopPropagation();
      if (m.classList.contains('is-open')) closeMenus(); else openMenu(m);
    });
    m.addEventListener('mouseenter', function () { if (anyMenuOpen()) openMenu(m); });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); openMenu(m);
        var first = m.querySelector('.mb-menu__i'); if (first) first.focus();
      }
    });
    m.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      var items = Array.prototype.slice.call(m.querySelectorAll('.mb-menu__i'));
      var i = items.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
    });
  });

  if (menus.length) {
    document.addEventListener('click', function (e) { if (!e.target.closest('.mb-menu')) closeMenus(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && anyMenuOpen()) {
        var open = menus.filter(function (m) { return m.classList.contains('is-open'); })[0];
        closeMenus();
        var t = open && open.querySelector('.mb-menu__t'); if (t) t.focus();
      }
    });
  }

  /* ---------- ТРИГГЕРЫ ОТКРЫТИЯ ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-win]');
    if (!t) return;
    e.preventDefault();
    closeCC();
    closeMenus();
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
    // Spotlight сам обрабатывает Esc — не закрываем окно под ним
    var spot = document.getElementById('spot');
    if (spot && !spot.hasAttribute('hidden')) return;
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
    updateAppOpen();
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

    /* Жест ведём через TOUCH EVENTS (passive:false + preventDefault на
       горизонтали): iOS Safari отбирает горизонтальный жест у pointer-событий
       (шлёт pointercancel), поэтому на тач полагаться на них нельзя.
       Pointer events остаются только для мыши/пера. */
    function dragStart(x, y) {
      dragging = true; decided = false; horiz = false; justSwiped = false;
      startX = x; startY = y; t0 = Date.now();
      w = pager.clientWidth;
      track.style.transition = 'none';
    }
    function dragMove(x, y, e) {
      if (!dragging) return;
      var dx = x - startX, dy = y - startY;
      if (!decided) {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          decided = true;
          horiz = Math.abs(dx) > Math.abs(dy);
        } else return;
      }
      if (!horiz) return;
      if (e && e.cancelable) e.preventDefault();     // забрать жест у браузера
      var base = -cur * w, t = base + dx, min = -(PAGES - 1) * w;
      if (t > 0) t = t * 0.35;                       // резинка у левого края
      else if (t < min) t = min + (t - min) * 0.35;  // резинка у правого края
      track.style.transform = 'translateX(' + t + 'px)';
    }
    function dragEnd(x) {
      if (!dragging) return;
      dragging = false;
      if (!decided || !horiz) { track.style.transition = ''; return; }
      var dx = x - startX;
      var v = dx / Math.max(Date.now() - t0, 1);
      if (Math.abs(dx) > 8) justSwiped = true;
      var target = cur;
      if (dx < -60 || v < -0.5) target = cur + 1;
      else if (dx > 60 || v > 0.5) target = cur - 1;
      go(target, true);
    }

    /* --- тач: основной путь на телефоне --- */
    var touching = false;
    track.addEventListener('touchstart', function (e) {
      if (!isMobile() || e.touches.length !== 1) return;
      touching = true;
      dragStart(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    track.addEventListener('touchmove', function (e) {
      if (!touching) return;
      dragMove(e.touches[0].clientX, e.touches[0].clientY, e);
    }, { passive: false });
    function onTouchEnd(e) {
      if (!touching) return;
      touching = false;
      dragEnd(e.changedTouches[0].clientX);
    }
    track.addEventListener('touchend', onTouchEnd);
    track.addEventListener('touchcancel', onTouchEnd);

    /* --- мышь/перо: pointer events (узкое окно на десктопе) --- */
    track.addEventListener('pointerdown', function (e) {
      if (!isMobile() || e.pointerType === 'touch' || touching) return;
      pid = e.pointerId;
      dragStart(e.clientX, e.clientY);
    });
    track.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch' || touching || !dragging) return;
      var wasHoriz = horiz;
      dragMove(e.clientX, e.clientY, e);
      if (horiz && !wasHoriz) { try { track.setPointerCapture(pid); } catch (err) {} }
    });
    function endDrag(e) {
      if (e.pointerType === 'touch' || touching) return;
      try { track.releasePointerCapture(pid); } catch (err) {}
      dragEnd(e.clientX);
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

    /* стрелки — клавиатурная альтернатива свайпу */
    document.addEventListener('keydown', function (e) {
      if (!isMobile()) return;
      if (e.target.closest && e.target.closest('input, textarea, .win.is-open')) return;
      if (e.key === 'ArrowRight') go(cur + 1, true);
      else if (e.key === 'ArrowLeft') go(cur - 1, true);
    });

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
     ПУНКТ УПРАВЛЕНИЯ iOS
     Открывается свайпом вниз из правого верхнего угла (как на iPhone)
     или кнопкой в статус-баре. Внутри: связь, тема, язык, яркость,
     полноэкранный режим и звонок.
     ============================================================ */
  (function () {
    var ccx = document.getElementById('ccx');
    var sheet = document.getElementById('ccxSheet');
    var grab = document.getElementById('ccGrab');
    var dim = document.getElementById('screenDim');
    if (!ccx || !sheet) return;

    var SHEET_H = 420;   // ориентировочная высота панели для расчёта хода пальца
    var open = false;

    function show() {
      ccx.hidden = false;
      /* перерисовка нужна, чтобы сработал переход из hidden */
      void ccx.offsetHeight;
      ccx.classList.add('is-open');
      ccx.classList.remove('is-dragging');
      sheet.style.transform = '';
      ccx.style.opacity = '';
      open = true;
    }
    function hide() {
      ccx.classList.remove('is-open', 'is-dragging');
      sheet.style.transform = '';
      ccx.style.opacity = '';
      open = false;
      window.setTimeout(function () { if (!open) ccx.hidden = true; }, 240);
    }
    function toggle() { open ? hide() : show(); }
    /* ЛОТ M: VoiceNav закрывает шторку, открывая свою панель с плитки */
    window.CCX = { hide: hide, show: show };

    /* --- жест: тянем вниз из правого верхнего угла ---
       Тач — через touch events (passive:false + preventDefault):
       iOS Safari иначе отбирает жест (pointercancel) под системную шторку.
       Pointer events — для мыши. --- */
    if (grab) {
      var gy = 0, gActive = false, gTouching = false;
      var gStart = function (y) {
        gActive = true; gy = y;
        ccx.hidden = false;
        ccx.classList.add('is-dragging');
      };
      var gMove = function (y, e) {
        if (!gActive) return;
        var dy = Math.max(0, y - gy);
        var k = Math.min(dy / SHEET_H, 1);
        ccx.style.opacity = k.toFixed(3);
        sheet.style.transform = 'translateY(' + ((k - 1) * 18).toFixed(1) + 'px)';
        if (e && e.cancelable) e.preventDefault();
      };
      var gFinish = function (y) {
        if (!gActive) return;
        gActive = false;
        ccx.classList.remove('is-dragging');
        if (y - gy > 60) show(); else hide();
      };

      grab.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) return;
        gTouching = true;
        gStart(e.touches[0].clientY);
      }, { passive: true });
      grab.addEventListener('touchmove', function (e) {
        if (!gTouching) return;
        gMove(e.touches[0].clientY, e);
      }, { passive: false });
      var gTEnd = function (e) {
        if (!gTouching) return;
        gTouching = false;
        gFinish(e.changedTouches[0].clientY);
      };
      grab.addEventListener('touchend', gTEnd);
      grab.addEventListener('touchcancel', gTEnd);

      grab.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'touch' || gTouching) return;
        gStart(e.clientY);
        try { grab.setPointerCapture(e.pointerId); } catch (err) {}
      });
      grab.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch' || gTouching) return;
        gMove(e.clientY, e);
      });
      var gEnd = function (e) {
        if (e.pointerType === 'touch' || gTouching) return;
        try { grab.releasePointerCapture(e.pointerId); } catch (err) {}
        gFinish(e.clientY);
      };
      grab.addEventListener('pointerup', gEnd);
      grab.addEventListener('pointercancel', gEnd);
    }

    /* --- закрытие: тап по фону, свайп вверх по панели, Esc --- */
    ccx.addEventListener('click', function (e) { if (e.target === ccx) hide(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) hide(); });

    /* свайп вверх по панели — тоже на touch events (см. комментарий выше) */
    var sy = 0, sActive = false, sTouching = false;
    var sStart = function (y, target) {
      if (target.closest('button') || target.closest('.ccx__slider')) return false;
      sActive = true; sy = y;
      ccx.classList.add('is-dragging');
      return true;
    };
    var sMove = function (y, e) {
      if (!sActive) return;
      var dy = Math.min(0, y - sy);
      if (e && e.cancelable) e.preventDefault();
      sheet.style.transform = 'translateY(' + dy + 'px)';
      ccx.style.opacity = String(Math.max(0, 1 + dy / SHEET_H));
    };
    var sFinish = function (y) {
      if (!sActive) return;
      sActive = false;
      ccx.classList.remove('is-dragging');
      if (y - sy < -50) hide();
      else { sheet.style.transform = ''; ccx.style.opacity = ''; }
    };

    sheet.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      sTouching = sStart(e.touches[0].clientY, e.target);
    }, { passive: true });
    sheet.addEventListener('touchmove', function (e) {
      if (!sTouching) return;
      sMove(e.touches[0].clientY, e);
    }, { passive: false });
    var sTEnd = function (e) {
      if (!sTouching) return;
      sTouching = false;
      sFinish(e.changedTouches[0].clientY);
    };
    sheet.addEventListener('touchend', sTEnd);
    sheet.addEventListener('touchcancel', sTEnd);

    sheet.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch' || sTouching) return;
      sStart(e.clientY, e.target);
    });
    sheet.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch' || sTouching) return;
      sMove(e.clientY, e);
    });
    var sEnd = function (e) {
      if (e.pointerType === 'touch' || sTouching) return;
      sFinish(e.clientY);
    };
    sheet.addEventListener('pointerup', sEnd);
    sheet.addEventListener('pointercancel', sEnd);

    var iosCC = document.getElementById('iosCC');
    if (iosCC) iosCC.addEventListener('click', toggle);
    var ccFab = document.getElementById('ccFab');
    if (ccFab) ccFab.addEventListener('click', toggle);

    /* --- тема --- */
    var tTheme = document.getElementById('ccxTheme');
    function syncTheme() {
      if (!tTheme) return;
      var light = currentTheme() === 'light';
      tTheme.classList.toggle('is-on', light);
    }
    if (tTheme) tTheme.addEventListener('click', function () { toggleTheme(); syncTheme(); });
    syncTheme();

    /* --- язык --- */
    var tLang = document.getElementById('ccxLang');
    var lLabel = document.getElementById('ccxLangLabel');
    function syncLang() {
      if (lLabel) lLabel.textContent = (lang() === 'en') ? 'RU' : 'EN';
    }
    if (tLang) tLang.addEventListener('click', function () {
      if (window.I18N && window.I18N.toggle) window.I18N.toggle();
      syncLang();
    });
    syncLang();

    /* --- Wi-Fi: всегда выключен, это и есть продукт --- */
    var tWifi = document.getElementById('ccxWifi');
    if (tWifi) tWifi.addEventListener('click', function () {
      tWifi.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' },
         { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }],
        { duration: 260, easing: 'ease-out' }
      );
    });

    /* --- яркость: затемняем экран поверх всего --- */
    var slider = document.getElementById('ccxBright');
    var fill = document.getElementById('ccxBrightFill');
    if (slider && fill && dim) {
      var MINV = 30;
      var val = 100;

      function apply(v) {
        val = Math.max(MINV, Math.min(100, v));
        fill.style.setProperty('--fill', val + '%');
        /* 100 % → без затемнения; 30 % → 0.55 непрозрачности */
        dim.style.setProperty('--dim', (((100 - val) / 70) * 0.55).toFixed(3));
        slider.setAttribute('aria-valuenow', String(Math.round(val)));
      }
      function fromY(clientY) {
        var r = slider.getBoundingClientRect();
        var k = 1 - (clientY - r.top) / r.height;
        apply(MINV + k * (100 - MINV));
      }

      var sliding = false, slTouching = false;
      slider.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) return;
        slTouching = true; sliding = true;
        fromY(e.touches[0].clientY);
      }, { passive: true });
      slider.addEventListener('touchmove', function (e) {
        if (!slTouching) return;
        if (e.cancelable) e.preventDefault();
        fromY(e.touches[0].clientY);
      }, { passive: false });
      var slTEnd = function () { slTouching = false; sliding = false; };
      slider.addEventListener('touchend', slTEnd);
      slider.addEventListener('touchcancel', slTEnd);

      slider.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'touch' || slTouching) return;
        sliding = true; fromY(e.clientY);
        try { slider.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault();
      });
      slider.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch' || slTouching) return;
        if (sliding) fromY(e.clientY);
      });
      var slEnd = function (e) {
        if (e.pointerType === 'touch' || slTouching) return;
        if (!sliding) return;
        sliding = false;
        try { slider.releasePointerCapture(e.pointerId); } catch (err) {}
      };
      slider.addEventListener('pointerup', slEnd);
      slider.addEventListener('pointercancel', slEnd);
      slider.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { apply(val + 5); e.preventDefault(); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { apply(val - 5); e.preventDefault(); }
      });
      apply(100);
    }

    /* --- полноэкранный режим --- */
    var tFull = document.getElementById('ccxFull');
    if (tFull) tFull.addEventListener('click', function () {
      var el = document.documentElement;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        var req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (req) req.call(el);
      } else {
        var exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) exit.call(document);
      }
      hide();
    });

    /* --- звонок --- */
    var tCall = document.getElementById('ccxCall');
    if (tCall) tCall.addEventListener('click', function () { hide(); openWindow('win-call', tCall); });

    if (DEV) window.__ccx = { show: show, hide: hide, isOpen: function () { return open; } };
  })();

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
    var liveTg = document.getElementById('callLiveTg');
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
      /* «Позвать в Telegram» во время звонка — с реальной ссылкой на комнату,
         иначе кнопка ничего не сообщает о ТЕКУЩЕМ звонке (была статичной) */
      if (liveTg) liveTg.href = 'https://t.me/Shahen_kazaryan?text=' + encodeURIComponent(tr('call.tg.live').replace('{u}', roomUrl()));
    }

    /* Кладём трубку: убираем iframe, иначе микрофон останется включённым. */
    function end() {
      stage.innerHTML = '';
      live.hidden = true;
      home.hidden = false;
      win.classList.remove('is-live');
      room = null;
      if (liveTg) liveTg.href = 'https://t.me/Shahen_kazaryan'; /* сбросить — комнаты больше нет */
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
     КАЛЬКУЛЯТОР ПРОЕКТА (D2) — конфигуратор стоимости

     Формула: ИТОГ = база(услуга) × объём(×1/×1.8/×3/×6) × срочность(×1/×1.3),
     округлённая до тысячи; «Железо под ключ» добавляет 180 000 ₽ разово.
     «Поддержка» (от 15 000 ₽/мес) — отдельной строкой, в разовый итог
     не входит. Курс для второй валюты: 1 $ ≈ 100 ₽ (как в прайсе V5).
     Сумма пересчитывается живьём с «прокруткой» цифр (300ms, tabular-nums).
     ============================================================ */
  (function () {
    var win = document.getElementById('win-calc');
    if (!win) return;

    /* тарифная сетка — чистый JS-объект, цены «от», ₽ */
    var RATES = {
      services: {           // база = цена «от» из окна «Услуги» (V5)
        ai: 150000,         // ИИ-сотрудник / внедрение
        site: 50000,        // сайт под ключ
        bot: 100000,        // AI-бот / агент
        voice: 200000,      // голосовой ассистент
        auto: 80000,        // автоматизация бизнеса
        integr: 150000,     // AI-интеграции
        video: 20000,       // AI-видео (за ролик)
        content: 50000      // контент-фабрика (в месяц)
      },
      rush: 1.3,            // срочность: сжатые сроки = +30%
      hw: 180000,           // железо под ключ: от Станции «Старт»
      supportMo: 15000,     // поддержка, ₽/мес — отдельной строкой
      usd: 100              // 1 $ ≈ 100 ₽, округляем красиво
    };
    /* имя услуги для текста сметы — те же i18n-ключи, что в окне «Услуги» */
    var SVC_KEY = {
      ai: 'calc.svcAi', site: 'svc.s1.h', bot: 'svc.s2.h', voice: 'svc.s4.h',
      auto: 'svc.s5.h', integr: 'svc.s6.h', video: 'svc.s7.h', content: 'svc.s8.h'
    };

    var state = { svc: 'ai', mult: 1, volIdx: 1, rush: false, hw: false, sup: false };

    var elSum = document.getElementById('calcSum');
    var elAlt = document.getElementById('calcAlt');
    var elMo = document.getElementById('calcMo');
    var elCta = document.getElementById('calcCta');

    function total() {
      var x = RATES.services[state.svc] * state.mult;         // база × объём
      if (state.rush) x *= RATES.rush;                        // × срочность
      x = Math.round(x / 1000) * 1000;                        // до тысячи
      if (state.hw) x += RATES.hw;                            // + железо разово
      return x;
    }

    /* 351000 → «351 000» (неразрывные пробелы) / "351,000" */
    function fmtRub(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
    function fmtUsd(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
    function toUsd(rub) { return Math.round(rub / RATES.usd / 10) * 10; }
    /* «Контент-фабрика» — единственная услуга с абонентской (не разовой)
       ценой; суффикс «/мес» должен быть виден везде, где показана сумма —
       не только на карточке услуги, но и в самом расчёте и в смете. */
    function moSuffix() { return (state.svc === 'content') ? (lang() === 'en' ? '/mo' : '/мес') : ''; }

    /* нарисовать сумму (rub) в текущем языке: RU — «от X ₽» + «≈ $Y», EN — наоборот */
    function paint(rub) {
      var usd = toUsd(rub), suf = moSuffix();
      if (lang() === 'en') {
        elSum.textContent = tr('calc.from') + ' $' + fmtUsd(usd) + suf;
        elAlt.textContent = '≈ ' + fmtRub(rub) + ' ₽' + suf;
      } else {
        elSum.textContent = tr('calc.from') + ' ' + fmtRub(rub) + ' ₽' + suf;
        elAlt.textContent = '≈ $' + fmtUsd(usd) + suf;
      }
    }

    /* «прокрутка» цифр: от показанного значения к новому за 300ms */
    var shownRub = total(), rollRaf = null;
    function rollTo(target) {
      if (rollRaf) { cancelAnimationFrame(rollRaf); rollRaf = null; }
      if (reduceMotion || !window.requestAnimationFrame) { shownRub = target; paint(target); return; }
      var from = shownRub, t0 = null;
      rollRaf = requestAnimationFrame(function step(ts) {
        if (t0 === null) t0 = ts;
        var k = Math.min((ts - t0) / 300, 1);
        var e = 1 - Math.pow(1 - k, 3);                       // ease-out cubic
        /* промежуточные значения держим кратными тысяче — цифры «крутятся» ровно */
        var v = Math.round((from + (target - from) * e) / 1000) * 1000;
        paint(v);
        if (k < 1) rollRaf = requestAnimationFrame(step);
        else { shownRub = target; rollRaf = null; }
      });
    }

    /* текст расчёта для Telegram — собирается из тех же i18n-строк */
    function tgHref() {
      var t = total(), suf = moSuffix();
      var sum = (lang() === 'en')
        ? tr('calc.from') + ' $' + fmtUsd(toUsd(t)) + ' (≈ ' + fmtRub(t) + ' ₽)' + suf
        : tr('calc.from') + ' ' + fmtRub(t) + ' ₽' + suf;
      var opts = [];
      if (state.hw) opts.push(tr('calc.optHw').replace(/^\+\s*/, ''));
      if (state.sup) opts.push(tr('calc.optSup').replace(/^\+\s*/, '') + ' (' + tr('calc.moLine') + ')');
      var lines = [
        tr('calc.tg.head'),
        tr('calc.tg.svc') + ': ' + tr(SVC_KEY[state.svc]),
        tr('calc.tg.vol') + ': ' + tr('calc.vol' + state.volIdx) + ' (×' + state.mult + ')',
        tr('calc.tg.rush') + ': ' + tr(state.rush ? 'calc.tg.yes' : 'calc.tg.no'),
        tr('calc.tg.opts') + ': ' + (opts.length ? opts.join(', ') : tr('calc.tg.none')),
        tr('calc.tg.total') + ': ' + sum
      ];
      return 'https://t.me/Shahen_kazaryan?text=' + encodeURIComponent(lines.join('\n'));
    }

    function render(animate) {
      var t = total();
      if (animate === false) { shownRub = t; paint(t); }
      else rollTo(t);
      var mo = state.sup;
      elMo.hidden = !mo;
      if (mo) elMo.textContent = '+ ' + tr('calc.moLine');
      if (elCta) elCta.href = tgHref();
    }

    /* шаг 1: услуга */
    var svcWrap = document.getElementById('calcSvc');
    if (svcWrap) svcWrap.addEventListener('click', function (e) {
      var b = e.target.closest('.calc-svc__btn');
      if (!b) return;
      state.svc = b.dataset.svc;
      var all = svcWrap.querySelectorAll('.calc-svc__btn');
      for (var i = 0; i < all.length; i++) {
        var sel = all[i] === b;
        all[i].classList.toggle('is-sel', sel);
        all[i].setAttribute('aria-checked', sel ? 'true' : 'false');
      }
      render();
    });

    /* шаг 2: объём (сегмент-контрол iOS) */
    var volWrap = document.getElementById('calcVol');
    if (volWrap) volWrap.addEventListener('click', function (e) {
      var b = e.target.closest('.calc-seg__btn');
      if (!b) return;
      state.mult = parseFloat(b.dataset.mult);
      var all = volWrap.querySelectorAll('.calc-seg__btn');
      for (var i = 0; i < all.length; i++) {
        var sel = all[i] === b;
        if (sel) state.volIdx = i + 1;
        all[i].classList.toggle('is-sel', sel);
        all[i].setAttribute('aria-checked', sel ? 'true' : 'false');
      }
      render();
    });

    /* шаг 3: срочность + опции (тумблеры) */
    function bindSwitch(id, key) {
      var b = document.getElementById(id);
      if (!b) return;
      b.addEventListener('click', function () {
        state[key] = !state[key];
        b.classList.toggle('is-on', state[key]);
        b.setAttribute('aria-checked', state[key] ? 'true' : 'false');
        render();
      });
    }
    bindSwitch('calcRush', 'rush');
    bindSwitch('calcHw', 'hw');
    bindSwitch('calcSup', 'sup');

    /* смена языка: перерисовать суммы и ссылку без анимации */
    document.addEventListener('i18n:change', function () { render(false); });

    /* ЛОТ J: снимок сметы для PDF-экспорта (js/lotj.js) */
    window.OSCalc = {
      estimate: function () {
        var t = total();
        var opts = [];
        if (state.hw) opts.push({ key: 'pdf.hw', rub: RATES.hw });
        var o = [];
        if (state.hw) o.push(tr('pdf.hw'));
        return {
          svcKey: SVC_KEY[state.svc],
          volKey: 'calc.vol' + state.volIdx,
          mult: state.mult,
          rush: state.rush,
          hw: state.hw,
          sup: state.sup,
          supportMo: RATES.supportMo,
          optsText: o,
          totalRub: t,
          totalUsd: toUsd(t),
          fmtRub: fmtRub,
          fmtUsd: fmtUsd
        };
      }
    };

    render(false);
  })();

  /* ============================================================
     КАЛЕНДАРЬ ЗАПИСИ НА ДЕМО (E2)

     Сетка месяца (пн–вс, сегодня подсвечен, прошедшие/выходные недоступны),
     навигация ← → в пределах [текущий месяц … +2]. Клик по рабочему дню →
     слоты 11:00–17:30 (шаг 30 мин). Слот + имя → «Записаться»:
     deep-link t.me с prefilled-текстом + автоскачивание .ics (VEVENT 30 мин)
     Blob-ом. Никакой отправки на сервер — только ссылка и файл.
     ============================================================ */
  (function () {
    var win = document.getElementById('win-calendar');
    if (!win) return;

    var monthEl = document.getElementById('calMonth');
    var gridEl = document.getElementById('calGrid');
    var prevBtn = document.getElementById('calPrev');
    var nextBtn = document.getElementById('calNext');
    var panel = document.getElementById('calPanel');
    var slotsEl = document.getElementById('calSlots');
    var pickedDayEl = document.getElementById('calPickedDay');
    var pickedLine = document.getElementById('calPickedLine');
    var form = document.getElementById('calForm');
    var nameEl = document.getElementById('calName');
    var contactEl = document.getElementById('calContact');
    var submitBtn = document.getElementById('calSubmit');
    var errEl = document.getElementById('calErr');
    var okEl = document.getElementById('calOk');

    /* названия месяцев — локальные данные (офлайн, без Intl-сюрпризов) */
    var MONTHS = {
      ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
      en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    };
    var MONTHS_GEN = { // родительный падеж для «10 июля»
      ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
    };

    /* слоты — московское время (МСК, UTC+3, без перехода на летнее) —
       «сегодня»/«прошло» тоже должны считаться по МСК, а не по часовому
       поясу браузера гостя, иначе гость из другого пояса увидит не те
       дни/слоты как «сегодня» и сможет забронировать прошедшее время. */
    function mskNow() { return new Date(Date.now() + 3 * 3600000); } // читать через getUTC*
    var todayMsk = mskNow();
    var today = new Date(todayMsk.getUTCFullYear(), todayMsk.getUTCMonth(), todayMsk.getUTCDate());
    today.setHours(0, 0, 0, 0);
    var RANGE = 2;                                   // навигация до +2 месяцев вперёд
    var minKey = today.getFullYear() * 12 + today.getMonth();
    var maxKey = minKey + RANGE;
    var viewY = today.getFullYear(), viewM = today.getMonth();
    var selDate = null, selTime = null;

    function pad2(n) { return (n < 10 ? '0' : '') + n; }

    /* слоты 11:00–17:30, шаг 30 мин: демо длится 30 минут и завершается к 18:00 */
    var SLOTS = [];
    for (var hh = 11; hh <= 17; hh++) { SLOTS.push(pad2(hh) + ':00'); SLOTS.push(pad2(hh) + ':30'); }
    function isWknd(dt) { var d = dt.getDay(); return d === 0 || d === 6; }
    function sameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

    /* «10 июля 2026» / «July 10, 2026» */
    function humanDate(dt) {
      var d = dt.getDate(), y = dt.getFullYear(), m = dt.getMonth();
      if (lang() === 'en') return MONTHS.en[m] + ' ' + d + ', ' + y;
      return d + ' ' + MONTHS_GEN.ru[m] + ' ' + y;
    }

    function updateNav() {
      var key = viewY * 12 + viewM;
      prevBtn.disabled = key <= minKey;
      nextBtn.disabled = key >= maxKey;
    }

    function renderGrid() {
      monthEl.textContent = MONTHS[lang()][viewM] + ' ' + viewY;
      updateNav();
      gridEl.innerHTML = '';
      var first = new Date(viewY, viewM, 1);
      var lead = (first.getDay() + 6) % 7;            // понедельник = 0
      var days = new Date(viewY, viewM + 1, 0).getDate();
      for (var b = 0; b < lead; b++) {
        var blank = document.createElement('span');
        blank.className = 'calx__day calx__day--blank';
        blank.setAttribute('aria-hidden', 'true');
        gridEl.appendChild(blank);
      }
      for (var d = 1; d <= days; d++) {
        var dt = new Date(viewY, viewM, d); dt.setHours(0, 0, 0, 0);
        var cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'calx__day';
        cell.textContent = d;
        cell.setAttribute('role', 'gridcell');
        var past = dt < today, wknd = isWknd(dt);
        if (sameDay(dt, today)) cell.classList.add('calx__day--today');
        if (wknd) cell.classList.add('calx__day--wknd');
        if (past || wknd) {
          cell.classList.add('calx__day--past');
          cell.disabled = true;
        } else {
          (function (date) {
            cell.addEventListener('click', function () { pickDay(date); });
          })(dt);
        }
        if (selDate && sameDay(dt, selDate)) cell.classList.add('calx__day--sel');
        cell.setAttribute('aria-label', humanDate(dt));
        gridEl.appendChild(cell);
      }
    }

    function pickDay(dt) {
      selDate = dt; selTime = null;
      renderGrid();
      pickedDayEl.textContent = humanDate(dt);
      renderSlots();
      panel.hidden = false;
      pickedLine.hidden = true;
      okEl.hidden = true;
      updateSubmit();
      if (!reduceMotion && panel.scrollIntoView) {
        try { panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
      }
    }

    function renderSlots() {
      slotsEl.innerHTML = '';
      var isToday = sameDay(selDate, today);
      var curH = -1, curM = -1;
      if (isToday) { var mn = mskNow(); curH = mn.getUTCHours(); curM = mn.getUTCMinutes(); }
      var shown = 0;
      SLOTS.forEach(function (tm) {
        if (isToday) {
          var p = tm.split(':'), sh = +p[0], sm = +p[1];
          if (sh < curH || (sh === curH && sm <= curM)) return; // слот уже прошёл (время МСК)
        }
        shown++;
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'calx__slot';
        b.textContent = tm;
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', selTime === tm ? 'true' : 'false');
        if (selTime === tm) b.classList.add('calx__slot--sel');
        b.addEventListener('click', function () {
          selTime = tm;
          var all = slotsEl.querySelectorAll('.calx__slot');
          for (var i = 0; i < all.length; i++) {
            var on = all[i] === b;
            all[i].classList.toggle('calx__slot--sel', on);
            all[i].setAttribute('aria-checked', on ? 'true' : 'false');
          }
          pickedLine.hidden = false;
          pickedLine.textContent = '✓ ' + humanDate(selDate) + ' · ' + selTime + ' ' + (lang() === 'en' ? 'MSK' : 'МСК');
          updateSubmit();
        });
        slotsEl.appendChild(b);
      });
      if (!shown) {
        var empty = document.createElement('p');
        empty.className = 'calx__slotsempty';
        empty.textContent = tr('cal.slots.none');
        slotsEl.appendChild(empty);
      }
    }

    function updateSubmit() {
      var ok = !!selDate && !!selTime && nameEl.value.trim().length > 0;
      submitBtn.disabled = !ok;
    }

    /* deep-link Telegram с расчётом записи */
    function tgHref() {
      var contact = contactEl.value.trim();
      var msg = tr('cal.tg.msg')
        .replace('{d}', humanDate(selDate))
        .replace('{t}', selTime)
        .replace('{n}', nameEl.value.trim())
        .replace('{c}', contact ? (', ' + contact) : '');
      return 'https://t.me/Shahen_kazaryan?text=' + encodeURIComponent(msg);
    }

    /* .ics VEVENT на 30 минут — абсолютное время в UTC (МСК = UTC+3, без
       перехода на летнее), а не «плавающее» локальное: иначе календарь гостя
       из другого часового пояса показал бы встречу в НЕ то время суток. */
    function icsStamp(dt) {
      return dt.getUTCFullYear() + pad2(dt.getUTCMonth() + 1) + pad2(dt.getUTCDate()) +
        'T' + pad2(dt.getUTCHours()) + pad2(dt.getUTCMinutes()) + pad2(dt.getUTCSeconds()) + 'Z';
    }
    function mskToUtcStamp(y, mo, d, h, mi) {
      var dt = new Date(Date.UTC(y, mo, d, h, mi) - 3 * 3600000);
      return icsStamp(dt);
    }
    function downloadIcs() {
      var parts = selTime.split(':');
      var h = +parts[0], mi = +parts[1];
      var y = selDate.getFullYear(), mo = selDate.getMonth(), d = selDate.getDate();
      var startU = mskToUtcStamp(y, mo, d, h, mi);
      var endM = mi + 30, endH = h + Math.floor(endM / 60); endM = endM % 60;
      var endU = mskToUtcStamp(y, mo, d, endH, endM);
      var uid = selDate.getTime() + '-' + h + mi + '-urartu@shahen777.github.io';
      var lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Urartu AI//Demo//RU',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        'UID:' + uid,
        'DTSTAMP:' + icsStamp(new Date()),
        'DTSTART:' + startU,
        'DTEND:' + endU,
        'SUMMARY:' + tr('cal.ics.summary'),
        'DESCRIPTION:' + tr('cal.ics.desc'),
        'END:VEVENT',
        'END:VCALENDAR'
      ];
      var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'urartu-demo.ics';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }

    prevBtn.addEventListener('click', function () {
      var key = viewY * 12 + viewM; if (key <= minKey) return;
      viewM--; if (viewM < 0) { viewM = 11; viewY--; }
      selDate = null; selTime = null; panel.hidden = true; renderGrid();
    });
    nextBtn.addEventListener('click', function () {
      var key = viewY * 12 + viewM; if (key >= maxKey) return;
      viewM++; if (viewM > 11) { viewM = 0; viewY++; }
      selDate = null; selTime = null; panel.hidden = true; renderGrid();
    });

    nameEl.addEventListener('input', updateSubmit);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submitBtn.disabled) return; /* защита от двойного клика/сабмита */
      if (!selDate || !selTime) { errEl.hidden = false; errEl.textContent = tr('cal.err.slot'); return; }
      if (!nameEl.value.trim()) { errEl.hidden = false; errEl.textContent = tr('cal.err.name'); nameEl.focus(); return; }
      errEl.hidden = true;
      downloadIcs();                                 // встреча падает в календарь клиента
      window.open(tgHref(), '_blank', 'noopener');   // и уходит запрос в Telegram
      okEl.hidden = false;
      okEl.textContent = tr('cal.ok').replace('{d}', humanDate(selDate)).replace('{t}', selTime);
      submitBtn.disabled = true;
      setTimeout(function () { updateSubmit(); }, 4000); // разблокировать (если слот/имя всё ещё заполнены)
    });

    document.addEventListener('i18n:change', function () {
      renderGrid();
      if (selDate) { pickedDayEl.textContent = humanDate(selDate); renderSlots(); }
      if (selDate && selTime) pickedLine.textContent = '✓ ' + humanDate(selDate) + ' · ' + selTime;
    });

    renderGrid();
  })();

  /* ============================================================
     PWA-установка (E1) — кнопка «Установить приложение»
     Появляется только если браузер прислал beforeinstallprompt.
     Внешнего ничего не грузит; iOS-инструкция в окне остаётся всегда.
     ============================================================ */
  (function () {
    var btn = document.getElementById('pwaInstall');
    if (!btn) return;
    var deferred = null;
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault(); deferred = e; btn.hidden = false;
    });
    btn.addEventListener('click', function () {
      if (!deferred) return;
      deferred.prompt();
      var done = function () { deferred = null; btn.hidden = true; };
      if (deferred.userChoice && deferred.userChoice.then) deferred.userChoice.then(done, done);
      else done();
    });
    window.addEventListener('appinstalled', function () { deferred = null; btn.hidden = true; });
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

  /* ============================================================
     F1 — МЕССЕНДЖЕР «Сообщения» (чат с ИИ-агентами поверх LocalAI)
     ============================================================ */
  var Messenger = (function () {
    var AVA = {
      documoved: '<svg viewBox="0 0 32 32" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h9l5 5v19H9z"/><path d="M18 4v5h5"/><line x1="12.5" y1="15" x2="19.5" y2="15"/><line x1="12.5" y1="19" x2="19.5" y2="19"/><line x1="12.5" y1="23" x2="17" y2="23"/></svg>',
      lawyer:    '<svg viewBox="0 0 32 32" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4l9 3v7c0 6-4 10-9 13-5-3-9-7-9-13V7z"/><path d="M12 15.5l3 3 5-6"/></svg>',
      support:   '<svg viewBox="0 0 32 32" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17v-2a9 9 0 0 1 18 0v2"/><rect x="4.5" y="16" width="4.5" height="8" rx="1.8"/><rect x="23" y="16" width="4.5" height="8" rx="1.8"/><path d="M25 24v1a4 4 0 0 1-4 4h-3"/></svg>',
      secretary: '<svg viewBox="0 0 32 32" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="11" r="5"/><path d="M6 27a10 10 0 0 1 20 0"/></svg>'
    };
    var CONVS = [
      { id: 'documoved', nameKey: 'msg.n.documoved', time: '9:41', seed: [ { who: 'them', key: 'msg.doc.s1' }, { who: 'them', key: 'msg.doc.s2' } ], prevKey: 'msg.prev.documoved' },
      { id: 'lawyer',    nameKey: 'msg.n.lawyer',    time: '9:38', seed: [ { who: 'them', key: 'msg.greet.lawyer' } ], prevKey: 'msg.prev.lawyer' },
      { id: 'support',   nameKey: 'msg.n.support',   time: '9:15', seed: [ { who: 'them', key: 'msg.greet.support' } ], prevKey: 'msg.prev.support' },
      { id: 'secretary', nameKey: 'msg.n.secretary', time: '8:52', seed: [ { who: 'them', key: 'msg.greet.secretary' } ], prevKey: 'msg.prev.secretary' }
    ];
    var threads = {};   // id -> [ {who, text|key, chips?} ]
    var cur = null, inited = false, typingEl = null;

    function el(id) { return document.getElementById(id); }
    function textOf(m) { return (m.key != null) ? tr(m.key) : m.text; }

    /* ЛОТ L: лицо сотрудника вместо пиктограммы. До первого открытия окна —
       data-src (лениво, hydrateImages подставит src при открытии). */
    function avaHTML(id) {
      if (!window.Avatars) return AVA[id];
      var w = el('win-assistant');
      var attr = (w && w.classList.contains('is-open')) ? 'src' : 'data-src';
      return '<img class="msg__avimg" ' + attr + '="' + window.Avatars.src(id, window.Avatars.sel().style) + '" alt="" width="38" height="38" decoding="async">';
    }

    function buildList() {
      var wrap = el('msgConvs'); if (!wrap) return;
      wrap.innerHTML = '';
      CONVS.forEach(function (c) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'msg__conv'; b.setAttribute('role', 'tab');
        b.dataset.agent = c.id;
        b.innerHTML =
          '<span class="msg__av msg__av--' + c.id + '" aria-hidden="true">' + avaHTML(c.id) + '</span>' +
          '<span class="msg__conv-txt"><span class="msg__conv-top"><span class="msg__conv-name"></span>' +
          '<span class="msg__conv-time">' + c.time + '</span></span>' +
          '<span class="msg__conv-last"></span></span>';
        b.addEventListener('click', function () { select(c.id); });
        wrap.appendChild(b);
        c._btn = b;
      });
      refreshPreviews();
    }

    function refreshPreviews() {
      CONVS.forEach(function (c) {
        if (!c._btn) return;
        c._btn.querySelector('.msg__conv-name').textContent = tr(c.nameKey);
        var t = threads[c.id];
        var last = (c._lastText != null) ? c._lastText : tr(c.prevKey);
        c._btn.querySelector('.msg__conv-last').textContent = last;
        c._btn.classList.toggle('is-active', c.id === cur);
        c._btn.setAttribute('aria-selected', c.id === cur ? 'true' : 'false');
      });
    }

    function bubble(m) {
      var row = document.createElement('div');
      row.className = 'msg__row msg__row--' + (m.who === 'me' ? 'me' : 'them');
      var b = document.createElement('div');
      b.className = 'msg__bubble';
      if (m.html) { b.classList.add('msg__bubble--rich'); b.innerHTML = sanitizeHTML(m.html); } // ЛОТ J: любой html проходит через DOMPurify (mark из BM25 выживает)
      else b.textContent = textOf(m);
      row.appendChild(b);
      if (m.who === 'them' && (m.source === 'agent' || m.source === 'webllm')) {
        var srcTag = document.createElement('span');
        srcTag.className = 'msg__src-tag';
        srcTag.textContent = tr('ai.src.agent');
        row.appendChild(srcTag);
      }
      if (m.chips && m.chips.length) {
        var cr = document.createElement('div');
        cr.className = 'msg__chips';
        m.chips.forEach(function (ch) {
          var cb = document.createElement('button');
          cb.type = 'button'; cb.className = 'msg__chip'; cb.dataset.win = ch.win;
          cb.textContent = ch.label; // открытие окна — через глобальный [data-win] обработчик
          cr.appendChild(cb);
        });
        row.appendChild(cr);
      }
      return row;
    }

    function renderThread() {
      var th = el('msgThread'); if (!th) return;
      th.innerHTML = '';
      (threads[cur] || []).forEach(function (m) { th.appendChild(bubble(m)); });
      scrollDown();
    }
    function scrollDown() { var th = el('msgThread'); if (th) th.scrollTop = th.scrollHeight; }

    function setHead() {
      var c = find(cur); if (!c) return;
      var av = el('msgHeadAv');
      if (av) {
        if (window.Avatars) av.innerHTML = '<img class="msg__avimg" src="' + window.Avatars.src(cur, window.Avatars.sel().style) + '" alt="" width="30" height="30" decoding="async">';
        else av.innerHTML = AVA[cur];
      }
      var nm = el('msgHeadName'); if (nm) nm.textContent = tr(c.nameKey);
    }
    function find(id) { for (var i = 0; i < CONVS.length; i++) if (CONVS[i].id === id) return CONVS[i]; return null; }

    function select(id) {
      cur = id;
      var win = el('msg'); if (win) win.classList.add('is-chat');
      setHead(); renderThread(); refreshPreviews(); updateTools(id);
      var f = el('msgText'); if (f && !isMobile()) { try { f.focus(); } catch (e) {} }
    }

    /* G2/G3/G4 — инструменты, зависящие от агента */
    function updateTools(id) {
      var tools = el('msgTools'); if (!tools) return;
      var d = el('msgDocBtn'), l = el('msgLawBtn'), c = el('msgCallBtn');
      if (d) d.hidden = (id !== 'documoved');
      if (l) l.hidden = (id !== 'lawyer');
      if (c) c.hidden = (id !== 'secretary');
      tools.hidden = !((d && !d.hidden) || (l && !l.hidden) || (c && !c.hidden));
      var dp = el('msgDocPanel'), lp = el('msgLawPanel');
      if (dp && id !== 'documoved') dp.hidden = true;
      if (lp && id !== 'lawyer') lp.hidden = true;
    }

    function showTyping() {
      var th = el('msgThread'); if (!th) return;
      typingEl = document.createElement('div');
      typingEl.className = 'msg__row msg__row--them';
      typingEl.innerHTML = '<div class="msg__bubble msg__typing"><i></i><i></i><i></i></div>';
      th.appendChild(typingEl); scrollDown();
    }
    function clearTyping() { if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl); typingEl = null; }

    /* threadId — куда именно писать (может отличаться от cur, если пользователь
       успел переключиться на другой диалог, пока ответ ещё летел); в видимый
       DOM пузырь добавляется, только если этот тред сейчас открыт — иначе
       ответ молча уходит в чужой (тогдашний) тред и не «протекает» в текущий. */
    function push(m, threadId) {
      var tid = threadId || cur;
      threads[tid] = threads[tid] || [];
      threads[tid].push(m);
      if (tid === cur) {
        var th = el('msgThread'); if (th) { th.appendChild(bubble(m)); scrollDown(); }
      }
      var c = find(tid); if (c) c._lastText = textOf(m);
      refreshPreviews();
    }

    function send(text) {
      // Страховка от гигантской вставки (LocalAI.ask ~O(n²) + layout пузыря):
      // поле и так имеет maxlength=2000, но режем и программные вызовы.
      text = String(text || '').slice(0, 2000).trim(); if (!text || !cur) return;
      var agent = cur;
      push({ who: 'me', text: text }, agent);
      showTyping();
      var delay = reduceMotion ? 0 : (800 + Math.random() * 700); // 0.8–1.5с
      setTimeout(function () {
        var fin = function (res) {
          clearTyping();
          // ЛОТ J: ответ живой модели (WebLLM) приходит markdown-ом — рендерим
          // markdown-it → DOMPurify → DOM. Готовые html-ответы (BM25/юрист) не трогаем.
          if (res && res.source === 'webllm' && res.text && !res.html && window.LotJ && window.LotJ.md) {
            window.LotJ.md(res.text).then(function (html) {
              push({ who: 'them', html: html, text: res.text, chips: res.chips || [], source: res.source }, agent);
            }, function () {
              push({ who: 'them', text: res.text, chips: res.chips || [], source: res.source }, agent);
            });
            return;
          }
          push({ who: 'them', text: res.text, html: res.html, chips: res.chips || [], source: res.source }, agent);
        };
        function localChat() {
          if (window.LocalAI && window.LocalAI.askAsync) {
            // G1: асинхронный уровень (WebLLM, если пользователь её включил)
            window.LocalAI.askAsync(agent, text, lang()).then(fin, function () {
              fin(window.LocalAI.ask(agent, text, lang()));
            });
          } else {
            fin(window.LocalAI ? window.LocalAI.ask(agent, text, lang()) : { text: text, chips: [] });
          }
        }
        /* умный агент (kie.ai LLM), если бэкенд доступен — иначе локально.
           Чипы (Калькулятор/Календарь/FAQ) считаем локальным интентом ПАРАЛЛЕЛЬНО
           реальному ответу — так реальный текст не теряет полезную навигацию. */
        if (window.AgentAPI) {
          var hist = (threads[agent] || []).slice(-8).map(function (m) { return { role: m.who === 'me' ? 'user' : 'assistant', content: m.text || '' }; }).filter(function (m) { return m.content; });
          var hintChips = (window.LocalAI ? (window.LocalAI.ask(agent, text, lang()).chips || []) : []);
          window.AgentAPI.available().then(function (ok) {
            if (!ok) { localChat(); return; }
            window.AgentAPI.reply(agent, text, hist, false).then(function (r) {
              fin({ text: r.text, chips: hintChips, source: 'agent' });
              updateDemoBanner();
            }, function () { localChat(); });
          });
        } else {
          localChat();
        }
      }, delay);
    }

    /* если подключён умный агент — честно меняем плашку «демо» на «настоящая модель» */
    function updateDemoBanner() {
      var t = el('msgDemoText'); if (!t) return;
      if (window.AgentAPI) window.AgentAPI.available().then(function (ok) {
        var el2 = el('msgDemoText'); if (!el2) return;
        var k = ok ? 'msg.demo.live' : 'msg.demo';
        el2.setAttribute('data-i18n', k); el2.textContent = tr(k);
      });
    }

    function init() {
      if (inited) return; inited = true;
      threads = {};
      CONVS.forEach(function (c) { threads[c.id] = c.seed.slice(); });
      buildList();
      updateDemoBanner();
      var form = el('msgForm'), field = el('msgText'), back = el('msgBack');
      if (form) form.addEventListener('submit', function (e) {
        e.preventDefault(); if (!field) return; var v = field.value; field.value = ''; send(v);
      });
      if (back) back.addEventListener('click', function () {
        var win = el('msg'); if (win) win.classList.remove('is-chat');
      });
      document.addEventListener('i18n:change', function () {
        if (!inited) return;
        buildListPreservePrev(); setHead(); renderThread(); updateDemoBanner();
      });
      /* ЛОТ L: смена сотрудника/стиля в звонке обновляет лица в чате */
      document.addEventListener('ava:change', function () {
        if (!inited) return;
        buildListPreservePrev(); setHead();
      });
      initTools();
      cur = 'documoved';
    }

    /* ---------- G2/G3: панели «свой документ» и «проверка договора» ---------- */
    function escG(s) { return (window.LocalAI && window.LocalAI.escape) ? window.LocalAI.escape(s) : String(s); }

    function initTools() {
      var docBtn = el('msgDocBtn'), docPanel = el('msgDocPanel'), lawBtn = el('msgLawBtn'), lawPanel = el('msgLawPanel'), callBtn = el('msgCallBtn');
      var docFileName = '';
      if (docBtn) docBtn.addEventListener('click', function () {
        if (docPanel) { docPanel.hidden = !docPanel.hidden; if (lawPanel) lawPanel.hidden = true; }
      });
      if (lawBtn) lawBtn.addEventListener('click', function () {
        if (lawPanel) { lawPanel.hidden = !lawPanel.hidden; if (docPanel) docPanel.hidden = true; }
      });
      if (callBtn) callBtn.addEventListener('click', function () {
        openWindow('win-call', callBtn);
      });

      /* файл .txt/.md — читается ЛОКАЛЬНО, никуда не отправляется */
      var docFile = el('docFile');
      if (docFile) docFile.addEventListener('change', function () {
        var f = docFile.files && docFile.files[0]; if (!f) return;
        var docOkEl = el('docOk');
        if (!/\.(txt|md|markdown|text)$/i.test(f.name) && !/^text\//.test(f.type || '')) {
          if (docOkEl) { docOkEl.textContent = tr('doc.badfile'); docOkEl.hidden = false; }
          docFile.value = ''; return;
        }
        docFileName = f.name;
        var r = new FileReader();
        r.onload = function () {
          var ta = el('docText');
          if (ta) ta.value = String(r.result || '').slice(0, 300000);
          if (docOkEl) docOkEl.hidden = true;
        };
        r.readAsText(f);
      });

      var docLoad = el('docLoad'), docClear = el('docClear'), docOk = el('docOk');
      if (docLoad) docLoad.addEventListener('click', function () {
        var ta = el('docText'); var txt = ta ? ta.value.trim() : '';
        if (!txt) { if (docOk) { docOk.textContent = tr('doc.empty'); docOk.hidden = false; } if (ta) ta.focus(); return; }
        var n = window.LocalAI.doc.set(txt, docFileName);
        if (docOk) { docOk.textContent = tr('doc.loaded').replace('{n}', n); docOk.hidden = false; }
        if (docClear) docClear.hidden = false;
        if (docPanel) docPanel.hidden = true;
        push({ who: 'them', text: tr('doc.loaded').replace('{n}', n) });
      });
      if (docClear) docClear.addEventListener('click', function () {
        window.LocalAI.doc.clear();
        var ta = el('docText'); if (ta) ta.value = '';
        docFileName = '';
        if (docOk) docOk.hidden = true;
        docClear.hidden = true;
        push({ who: 'them', text: tr('doc.cleared') });
      });

      /* G3 — мгновенная детерминированная проверка договора */
      var lawCheck = el('lawCheck');
      if (lawCheck) lawCheck.addEventListener('click', function () {
        var ta = el('lawText'); var txt = ta ? ta.value.trim() : '';
        if (!txt) { if (ta) ta.focus(); return; }
        var r = window.LocalAI.checkContract(txt);
        if (lawPanel) lawPanel.hidden = true;
        push({ who: 'me', text: tr('law.sent').replace('{n}', r.words) });
        if (r.words < 30) { push({ who: 'them', text: tr('law.short') }); return; }
        push({ who: 'them', text: tr('law.head').replace('{n}', r.items.length), html: lawReportHtml(r) });
      });

      initLlmButton();
    }

    function lawReportHtml(r) {
      var ic = { ok: '✔', warn: '⚠', miss: '✖' };
      var rows = r.items.map(function (it) {
        var note = (it.status === 'ok') ? tr('law.ok')
                 : tr('law.' + it.status) + ': ' + tr('law.' + it.id + '.w');
        return '<li class="law-' + it.status + '"><i>' + ic[it.status] + '</i><span><b>' +
               escG(tr('law.' + it.id + '.n')) + '</b> — ' + escG(note) + '</span></li>';
      }).join('');
      var counts = tr('law.counts').replace('{ok}', r.counts.ok).replace('{warn}', r.counts.warn).replace('{miss}', r.counts.miss);
      return '<div class="law-rep"><b>' + escG(tr('law.head').replace('{n}', r.items.length)) + '</b>' +
             '<span class="law-rep__counts">' + escG(counts) + '</span>' +
             '<ul>' + rows + '</ul>' +
             '<p class="law-rep__final">' + escG(tr('law.final')) + '</p></div>';
    }

    /* ---------- G1: кнопка «Запустить настоящий локальный ИИ» ---------- */
    function initLlmButton() {
      var btn = el('llmBtn'), prog = el('llmProg'), bar = el('llmProgBar'), ptx = el('llmProgText'),
          demo = el('msgDemoText'), hint = el('llmHint'), size = el('llmSize');
      if (!btn || !window.LocalAI || !window.LocalAI.webllm) return;
      var szLabel = function () { return (lang() === 'en') ? '~950 MB' : '~950 МБ'; };
      var refresh = function () {
        if (size) size.textContent = '(' + szLabel() + ')';
        if (hint && !hint.hidden) hint.textContent = tr('ai.llm.hint').replace('{size}', szLabel());
      };
      /* WebLLM — офлайн-резерв. Если настоящий серверный агент уже отвечает
         (window.AgentAPI), не предлагаем скачивать 950 МБ модели параллельно —
         показываем кнопку только когда сервера нет/недоступен. */
      function maybeShowBtn() {
        if (!navigator.gpu || window.LocalAI.webllm.state !== 'idle') return; // без WebGPU честно не показываем
        if (window.AgentAPI) {
          window.AgentAPI.available().then(function (ok) {
            if (!ok) { btn.hidden = false; if (hint) { hint.hidden = false; hint.textContent = tr('ai.llm.hint').replace('{size}', szLabel()); } }
          });
          return;
        }
        btn.hidden = false;
        if (hint) { hint.hidden = false; hint.textContent = tr('ai.llm.hint').replace('{size}', szLabel()); }
      }
      maybeShowBtn();
      document.addEventListener('i18n:change', refresh);
      refresh();
      btn.addEventListener('click', function () {
        btn.hidden = true;
        if (hint) hint.hidden = true;
        if (prog) prog.hidden = false;
        if (demo) demo.textContent = tr('ai.llm.loading');
        window.LocalAI.webllm.load(function (frac) {
          var pc = Math.round(frac * 100);
          if (bar) bar.style.width = pc + '%';
          if (ptx) ptx.textContent = pc + '%';
        }).then(function () {
          if (prog) prog.hidden = true;
          if (demo) demo.textContent = tr('ai.llm.ready');
          var dm = el('msgDemo'); if (dm) dm.classList.add('is-llm');
        }).catch(function () {
          if (prog) prog.hidden = true;
          if (demo) demo.textContent = tr('ai.llm.err');
          btn.hidden = false;
          if (hint) hint.hidden = false;
        });
      });
    }
    /* при смене языка обновляем ярлыки, сохранив динамические превью */
    function buildListPreservePrev() {
      var saved = {};
      CONVS.forEach(function (c) { saved[c.id] = c._lastText; });
      buildList();
      CONVS.forEach(function (c) { c._lastText = saved[c.id]; });
      refreshPreviews();
    }

    function onOpen() {
      init();
      /* ЛОТ J: заранее подгружаем DOMPurify — до первого ответа модели (броня) */
      if (window.LotJ && window.LotJ.ensureArmor) window.LotJ.ensureArmor();
      try { sessionStorage.setItem('msgOpened', '1'); } catch (e) {}
      if (window.Push) window.Push.suppress();
      if (!cur || (isMobile())) { /* мобайл — стартуем со списка */ }
      if (!isMobile()) select(cur || 'documoved');
      else { setHead(); renderThread(); refreshPreviews(); }
    }
    function openConversation(id) {
      init();
      openWindow('win-assistant', document.getElementById('push') || dockApp('win-assistant'));
      select(id);
    }

    return { init: init, onOpen: onOpen, openConversation: openConversation };
  })();
  window.Messenger = Messenger;
  /* стабильный публичный API для ЛОТ J (экскурсия открывает окна) */
  window.OS = { open: openWindow, close: closeWindow };
  Messenger.init();

  /* G6 — делегированный обработчик [data-chat]: открыть диалог агента */
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-chat]') : null;
    if (!b || !window.Messenger) return;
    window.Messenger.openConversation(b.dataset.chat);
  });

  /* ============================================================
     F3 — SPOTLIGHT-ПОИСК (Cmd+K / лупа / мобильная строка)
     Индекс собирается из DOM (живой текст → i18n-паритет автоматом).
     ============================================================ */
  var Spotlight = (function () {
    var overlay, field, results, empty, open = false, idx = [], sel = -1, lastFocus = null;

    function build() {
      idx = [];
      var seen = {};
      // окна из springboard
      Array.prototype.forEach.call(document.querySelectorAll('.springboard .sb-icon[data-win]'), function (b) {
        var win = b.dataset.win, lbl = (b.querySelector('span') || {}).textContent;
        if (win && lbl && !seen[win]) { seen[win] = 1; idx.push({ label: lbl.trim(), win: win, kind: 'win' }); }
      });
      // FAQ вопросы (ищем и по тексту ответа — например, «152-ФЗ»)
      Array.prototype.forEach.call(document.querySelectorAll('#win-faq details'), function (d) {
        var s = d.querySelector('summary');
        if (s) idx.push({ label: s.textContent.trim(), win: 'win-faq', kind: 'faq', detail: d, text: d.textContent });
      });
      // услуги
      Array.prototype.forEach.call(document.querySelectorAll('#win-services .svc-card h4, #win-services .svc-flag__h'), function (h) {
        idx.push({ label: h.textContent.trim(), win: 'win-services', kind: 'svc' });
      });
      // устройства
      Array.prototype.forEach.call(document.querySelectorAll('#win-devices .dev-card__name'), function (h) {
        var t = h.textContent.trim(); if (t) idx.push({ label: t, win: 'win-devices', kind: 'dev' });
      });
      // сотрудники
      Array.prototype.forEach.call(document.querySelectorAll('#win-staff .staff-card__role'), function (h) {
        idx.push({ label: h.textContent.trim(), win: 'win-staff', kind: 'staff' });
      });
    }

    function kindLabel(k) {
      return tr('spot.k.' + k);
    }
    function query(q) {
      q = q.trim().toLowerCase();
      if (!q) return idx.slice(0, 8);
      var out = [];
      for (var i = 0; i < idx.length; i++) {
        var l = idx[i].label.toLowerCase();
        var pos = l.indexOf(q);
        if (pos > -1) { out.push({ e: idx[i], score: (pos === 0 ? 0 : 1) + l.length / 100 }); continue; }
        // совпадение в теле (ответ FAQ) — ниже приоритетом
        if (idx[i].text && idx[i].text.toLowerCase().indexOf(q) > -1) out.push({ e: idx[i], score: 3 });
      }
      out.sort(function (a, b) { return a.score - b.score; });
      return out.slice(0, 10).map(function (o) { return o.e; });
    }

    function render() {
      var q = field.value;
      var list = query(q);
      results.innerHTML = ''; sel = -1;
      empty.hidden = list.length > 0;
      list.forEach(function (e, i) {
        var li = document.createElement('li');
        li.className = 'spot__item'; li.setAttribute('role', 'option'); li.tabIndex = -1;
        li.innerHTML = '<span class="spot__label"></span><span class="spot__kind">' + kindLabel(e.kind) + '</span>';
        li.querySelector('.spot__label').textContent = e.label;
        li.addEventListener('click', function () { choose(e); });
        li.addEventListener('mousemove', function () { setSel(i); });
        results.appendChild(li);
      });
      curList = list;
      if (list.length) setSel(0);
    }
    var curList = [];
    function setSel(i) {
      var items = results.children;
      for (var k = 0; k < items.length; k++) items[k].classList.toggle('is-sel', k === i);
      sel = i;
    }
    function choose(e) {
      hide();
      openWindow(e.win, document.getElementById('spotBtn') || null);
      if (e.detail) {
        setTimeout(function () {
          try { e.detail.open = true; if (!reduceMotion && e.detail.scrollIntoView) e.detail.scrollIntoView({ block: 'nearest' }); } catch (x) {}
        }, 60);
      }
    }

    function show() {
      if (!overlay) return;
      build();
      lastFocus = document.activeElement;
      overlay.hidden = false;
      document.documentElement.classList.add('spot-open');
      requestAnimationFrame(function () { overlay.classList.add('is-open'); });
      field.value = ''; render();
      setTimeout(function () { try { field.focus(); } catch (e) {} }, 30);
      open = true;
    }
    function hide() {
      if (!overlay || !open) return;
      open = false;
      overlay.classList.remove('is-open');
      document.documentElement.classList.remove('spot-open');
      var fin = function () { overlay.hidden = true; };
      if (reduceMotion) fin(); else setTimeout(fin, 180);
      if (lastFocus && document.contains(lastFocus)) { try { lastFocus.focus(); } catch (e) {} }
    }

    function init() {
      overlay = document.getElementById('spot');
      field = document.getElementById('spotField');
      results = document.getElementById('spotResults');
      empty = document.getElementById('spotEmpty');
      if (!overlay || !field) return;
      field.addEventListener('input', render);
      overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) hide(); });
      field.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); hide(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); if (curList.length) setSel(Math.min(sel + 1, curList.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); if (curList.length) setSel(Math.max(sel - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); if (curList[sel]) choose(curList[sel]); }
      });
      // Cmd/Ctrl+K — открыть; повторно — закрыть; Esc — закрыть (даже если поле не в фокусе)
      document.addEventListener('keydown', function (e) {
        if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
          e.preventDefault(); open ? hide() : show();
        } else if (e.key === 'Escape' && open) { e.preventDefault(); hide(); }
      });
      var sb = document.getElementById('spotBtn');
      if (sb) sb.addEventListener('click', show);
      var ios = document.getElementById('iosSearch');
      if (ios) ios.addEventListener('click', function (e) { e.preventDefault(); show(); });
    }
    /* ЛОТ M: голосовая команда «поиск X» открывает Spotlight с запросом */
    function search(q) {
      show();
      if (field) { field.value = q || ''; render(); }
    }
    return { init: init, show: show, hide: hide, search: search };
  })();
  Spotlight.init();
  window.Spotlight = Spotlight; /* стабильный API для VoiceNav (ЛОТ M) */

  /* ============================================================
     F4 — ПУШ-БАННЕР (через 25с, один раз за сессию)
     ============================================================ */
  var Push = (function () {
    var elp, timer = null, suppressed = false;
    function suppress() { suppressed = true; if (timer) { clearTimeout(timer); timer = null; } hide(true); }
    function hide(instant) {
      if (!elp) return;
      elp.classList.remove('is-in');
      if (instant || reduceMotion) elp.hidden = true;
      else setTimeout(function () { elp.hidden = true; }, 260);
    }
    function shownAlready() {
      try { return sessionStorage.getItem('pushShown') === '1' || sessionStorage.getItem('msgOpened') === '1'; } catch (e) { return false; }
    }
    function reveal() {
      if (suppressed || shownAlready() || !elp) return;
      try { sessionStorage.setItem('pushShown', '1'); } catch (e) {}
      elp.hidden = false;
      requestAnimationFrame(function () { elp.classList.add('is-in'); });
    }
    function initSwipe() {
      var y0 = 0, dy = 0, on = false;
      elp.addEventListener('touchstart', function (e) { if (e.touches.length !== 1) return; on = true; y0 = e.touches[0].clientY; dy = 0; elp.style.transition = 'none'; }, { passive: true });
      elp.addEventListener('touchmove', function (e) { if (!on) return; dy = e.touches[0].clientY - y0; if (dy > 0) dy = 0; elp.style.transform = 'translateY(' + dy + 'px)'; }, { passive: true });
      elp.addEventListener('touchend', function () { if (!on) return; on = false; elp.style.transition = ''; if (dy < -30) hide(); else elp.style.transform = ''; });
    }
    function init() {
      elp = document.getElementById('push');
      if (!elp) return;
      elp.addEventListener('click', function () {
        hide();
        if (window.Messenger) window.Messenger.openConversation('documoved');
        else openWindow('win-assistant', elp);
      });
      initSwipe();
      if (!shownAlready()) timer = setTimeout(reveal, 25000);
    }
    return { init: init, suppress: suppress };
  })();
  Push.init();
  window.Push = Push;

  /* ============================================================
     H1 — «ЖИВОЙ ГОЛОС»: нейросетевой русский TTS (Piper/VITS) на
     устройстве посетителя. Модель 60 МБ грузится ТОЛЬКО по явной
     кнопке (экран звонка или Пункт управления) с прогрессом и
     кешируется в CacheStorage — со второго раза офлайн и мгновенно.
     Тяжёлый код (js/voice.js + vendor/vits + vendor/ort) подключается
     лениво: на старте страницы — ноль лишних байтов и запросов.
     ============================================================ */
  var NV = (function () {
    var st = 'off'; // off | loading | ready | error
    var supported = !!(window.WebAssembly && window.caches && ('noModule' in HTMLScriptElement.prototype));
    var scriptP = null;
    var pct = 0, mbL = 0, mbT = 60.3;

    function $(id) { return document.getElementById(id); }
    function flag() { try { return localStorage.getItem('nvOn') === '1'; } catch (e) { return false; } }
    function setFlag(v) { try { localStorage.setItem('nvOn', v ? '1' : '0'); } catch (e) {} }

    function loadScript() {
      if (window.NeuralVoice) return Promise.resolve();
      if (scriptP) return scriptP;
      scriptP = new Promise(function (res, rej) {
        var s = document.createElement('script');
        s.src = 'js/voice.js';
        s.onload = function () { if (window.NeuralVoice) res(); else rej(new Error('voice.js: no NeuralVoice')); };
        s.onerror = function () { scriptP = null; rej(new Error('voice.js load failed')); };
        document.head.appendChild(s);
      });
      return scriptP;
    }

    function setKey(el, key) { if (el) { el.setAttribute('data-i18n', key); el.textContent = tr(key); } }

    function render() {
      var btn = $('nvBtn'), lbl = $('nvBtnLabel'), prog = $('nvProg'), fill = $('nvFill'), pctEl = $('nvPct'), sub = $('ccxVoiceSub');
      if (st === 'loading') {
        if (btn) btn.disabled = true;
        setKey(lbl, 'nv.btn.loading');
        if (prog) prog.hidden = false;
        if (fill) fill.style.width = pct + '%';
        if (pctEl) { pctEl.removeAttribute('data-i18n'); pctEl.textContent = pct + '% · ' + mbL.toFixed(1) + ' / ' + mbT.toFixed(1) + ' ' + tr('nv.mb'); }
        if (sub) { sub.removeAttribute('data-i18n'); sub.textContent = tr('nv.cc.load') + ' ' + pct + '%'; }
      } else if (st === 'ready') {
        if (btn) { btn.disabled = true; btn.classList.add('is-on'); }
        setKey(lbl, 'nv.btn.on');
        if (prog) prog.hidden = false;
        if (fill) fill.style.width = '100%';
        setKey(pctEl, 'nv.done');
        setKey(sub, 'nv.cc.on');
      } else if (st === 'error') {
        if (btn) btn.disabled = false;
        setKey(lbl, 'nv.err');
        if (prog) prog.hidden = true;
        setKey(sub, 'nv.cc.off');
      } else {
        if (btn) btn.disabled = false;
        setKey(lbl, 'nv.btn');
        if (prog) prog.hidden = true;
        setKey(sub, 'nv.cc.off');
      }
    }

    function enable() {
      if (!supported || st === 'loading' || st === 'ready') return;
      st = 'loading'; pct = 0; mbL = 0; render();
      loadScript().then(function () {
        return window.NeuralVoice.enable(function (p) {
          if (p && p.total) {
            mbT = p.total / 1048576; mbL = p.loaded / 1048576;
            pct = Math.min(100, Math.round(p.loaded / p.total * 100));
          }
          if (p && p.phase === 'warm') { pct = 100; mbL = mbT; }
          render();
        });
      }).then(function () {
        st = 'ready'; setFlag(true); render();
        try { document.dispatchEvent(new Event('nv:ready')); } catch (e) {}
      }, function (err) {
        st = 'error'; render();
        try { console.warn('[NV] enable failed:', err); } catch (e) {}
      });
    }

    /* пользователь уже включал голос → тихо поднимаем ИЗ КЕША (офлайн).
       Если кеш вычищен браузером — молча не качаем 60 МБ заново:
       тяжёлое только по явной кнопке. */
    function maybeAuto() {
      if (!supported || st !== 'off' || !flag()) return;
      loadScript().then(function () {
        return window.NeuralVoice.cached();
      }).then(function (c) {
        if (c && st === 'off') enable();
      }, function () {});
    }

    function ready() { return st === 'ready' && !!window.NeuralVoice && window.NeuralVoice.state() === 'ready'; }

    function init() {
      var btn = $('nvBtn'), block = $('nvBlock'), ccx = $('ccxVoice');
      if (supported) {
        if (block) block.hidden = false;
        if (ccx) ccx.hidden = false;
      }
      if (btn) btn.addEventListener('click', enable);
      if (ccx) ccx.addEventListener('click', function () {
        if (st === 'off' || st === 'error') enable();
        else openWindow('win-call', ccx);
      });
      document.addEventListener('i18n:change', render);
      render();
    }
    init();
    return { enable: enable, maybeAuto: maybeAuto, ready: ready, state: function () { return st; }, supported: supported };
  })();
  window.NV = NV;

  /* ============================================================
     G4 — «ПОЗВОНИТЬ ИИ-СЕКРЕТАРЮ»: живой голосовой звонок в браузере
     getUserMedia → гудок → TTS-приветствие → SpeechRecognition →
     LocalAI.ask('secretary') → ответ голосом. Всё локально, кроме
     системных голосов ОС. Честные фолбэки: нет распознавания (Firefox),
     нет микрофона, нет русского голоса (тогда субтитры).

     H1/H2/H3: приоритет речи VITS → системный; ЛОТ L — 2D-аватар
     сотрудника с липсинком (js/avatars.js, лениво); честные индикаторы.
     ============================================================ */
  var VoiceCall = (function () {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var home, live, fb, on = false, muted = false, speakingNow = false, thinking = false;
    var callHist = [], curAudio = null;   // история диалога + текущий аудио-ответ (умный агент)
    var stream = null, actx = null, analyser = null, raf = 0;
    var rec = null, recWanted = false;
    var t0 = 0, tInt = 0, silT = 0, iosT = 0;
    var sysPulse = 0, avaCtl = null;

    function $(id) { return document.getElementById(id); }
    function setStatus(key) {
      var s = $('aiStatus'); if (s) s.textContent = tr(key);
    }

    /* H1/H3 — честные индикаторы: чем говорит и чем слушает демо */
    function syncModes() {
      var vt = $('aiVoiceModeTxt'), vd = $('aiVoiceDot');
      var neural = window.NV && NV.ready() && lang() === 'ru';
      var key = neural ? 'ai.mode.neural' : 'ai.mode.sys';
      if (vt) { vt.setAttribute('data-i18n', key); vt.textContent = tr(key); }
      if (vd) vd.classList.toggle('aicall__dot--ok', !!neural);
    }

    /* H2 — уровень речи 0..1 для липсинка: RMS от VITS,
       сглаженная синусоида + boundary-пульс для системного голоса */
    function faceLevel() {
      if (window.NeuralVoice && window.NeuralVoice.speaking()) return window.NeuralVoice.rms();
      if (speakingNow) {
        sysPulse *= 0.94;
        return Math.max(0, Math.min(1, 0.22 + 0.18 * Math.sin(Date.now() / 90) + sysPulse * 0.5));
      }
      return 0;
    }

    /* ЛОТ L — 2D-аватар сотрудника: монтируем при начале разговора,
       липсинк питается faceLevel() (RMS VITS или пульс системного голоса) */
    function mountAvatar() {
      if (!window.Avatars) return;
      var box = $('aiAvatar'); if (!box) return;
      if (avaCtl) { try { avaCtl.destroy(); } catch (e) {} avaCtl = null; }
      avaCtl = window.Avatars.mount(box, { getLevel: faceLevel });
      var wrap = $('aiAvaWrap'); if (wrap) wrap.classList.add('has-ava');
      var nm = $('aiCallName');
      if (nm) {
        var k = window.Avatars.nameKey(window.Avatars.sel().id);
        nm.setAttribute('data-i18n', k);
        nm.textContent = tr(k);
      }
    }
    function unmountAvatar() {
      if (avaCtl) { try { avaCtl.destroy(); } catch (e) {} avaCtl = null; }
    }

    /* галерея: выбрать сотрудника (5) и стиль (Реалистичный/Рисованный) */
    function initPicker() {
      var btn = $('aiAvaPick'), pop = $('avaPicker'), grid = $('avaPickGrid');
      if (!btn || !pop || !grid) return;
      function build() {
        if (!window.Avatars) return;
        var s = window.Avatars.sel();
        grid.innerHTML = '';
        window.Avatars.list().forEach(function (emp) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'ava-card' + (emp.id === s.id ? ' is-on' : '');
          b.setAttribute('aria-pressed', emp.id === s.id ? 'true' : 'false');
          var im = document.createElement('img');
          im.src = window.Avatars.src(emp.id, s.style);
          im.alt = ''; im.width = 44; im.height = 44; im.decoding = 'async';
          var nm = document.createElement('span');
          nm.setAttribute('data-i18n', emp.nameKey);
          nm.textContent = tr(emp.nameKey);
          b.appendChild(im); b.appendChild(nm);
          b.addEventListener('click', function () {
            window.Avatars.setSel(emp.id, window.Avatars.sel().style);
            build(); mountAvatar();
          });
          grid.appendChild(b);
        });
        var r = $('avaStyleReal'), t = $('avaStyleToon');
        if (r) { r.classList.toggle('is-on', s.style === 'real'); r.setAttribute('aria-checked', s.style === 'real' ? 'true' : 'false'); }
        if (t) { t.classList.toggle('is-on', s.style === 'toon'); t.setAttribute('aria-checked', s.style === 'toon' ? 'true' : 'false'); }
      }
      btn.addEventListener('click', function () {
        pop.hidden = !pop.hidden;
        btn.setAttribute('aria-expanded', pop.hidden ? 'false' : 'true');
        if (!pop.hidden) build();
      });
      function setStyle(st) {
        if (!window.Avatars) return;
        window.Avatars.setSel(window.Avatars.sel().id, st);
        build(); mountAvatar();
      }
      var r = $('avaStyleReal'), t = $('avaStyleToon');
      if (r) r.addEventListener('click', function () { setStyle('real'); });
      if (t) t.addEventListener('click', function () { setStyle('toon'); });
    }
    function fmt(sec) { var m = Math.floor(sec / 60), s = sec % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }

    /* субтитры: держим последние 2 реплики */
    function sub(who, text) {
      var box = $('aiSubs'); if (!box) return;
      var row = document.createElement('div');
      row.className = 'aicall__sub aicall__sub--' + who;
      row.textContent = text;
      box.appendChild(row);
      while (box.children.length > 2) box.removeChild(box.firstChild);
    }

    /* Выбор голоса по «живости».
       Milena — старый системный голос, звучит роботом; ставим его в конец.
       Сетевые голоса Google и улучшенные (Enhanced/Premium/Siri) звучат
       заметно человечнее. Выбор пользователя, если он был, важнее всего. */
    function ruVoices() {
      var want = (lang() === 'en') ? /^en/i : /^ru/i;
      var vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
      return vs.filter(function (v) { return want.test(v.lang); });
    }

    function voiceRank(v) {
      var n = v.name || '';
      if (/enhanced|premium|siri|neural/i.test(n)) return 0;   // улучшенные — лучшие
      if (v.localService === false) return 1;                   // сетевые (Google) — живые
      if (/google/i.test(n)) return 1;
      if (/milena/i.test(n)) return 3;                          // робот — в конец
      return 2;
    }

    function pickVoice() {
      var list = ruVoices();
      if (!list.length) return null;   // системный по умолчанию; субтитры всё равно есть
      var saved = null;
      try { saved = localStorage.getItem('aiVoice'); } catch (e) {}
      if (saved) {
        for (var i = 0; i < list.length; i++) if (list[i].name === saved) return list[i];
      }
      return list.slice().sort(function (a, b) { return voiceRank(a) - voiceRank(b); })[0];
    }

    function speak(text, then) {
      thinking = false;
      sub('ai', text);
      stopRec();

      /* H1 — приоритет речи: нейросетевой VITS (если загружен) → системный */
      if (window.NV && NV.ready() && lang() === 'ru' && window.NeuralVoice) {
        speakingNow = true;
        setStatus('ai.st.speak');
        var wn = $('aiAvaWrap'); if (wn) wn.classList.add('is-talk');
        window.NeuralVoice.speak(text, function () {
          speakingNow = false;
          if (wn) wn.classList.remove('is-talk');
          if (!on) return;
          if (then) then(); else listen();
        });
        return;
      }

      if (!window.speechSynthesis) { setTimeout(function () { if (then) then(); else listen(); }, 900); return; }
      speakingNow = true;
      setStatus('ai.st.speak');
      var w = $('aiAvaWrap'); if (w) w.classList.add('is-talk');

      var finished = false;
      var finish = function () {
        if (finished) return;
        finished = true;
        speakingNow = false;
        if (w) w.classList.remove('is-talk');
        if (!on) return;
        if (then) then(); else listen();
      };

      var say = function () {
        var u = new SpeechSynthesisUtterance(text);
        /* назначение голоса не должно ронять речь: при неудаче говорим
           системным по умолчанию, но говорим */
        var v = pickVoice();
        try { if (v) u.voice = v; } catch (e) { v = null; }
        u.lang = (lang() === 'en') ? 'en-US' : 'ru-RU';
        /* Milena на полной скорости «тарахтит»; чуть медленнее и ниже —
           заметно человечнее. Живые голоса Google оставляем как есть. */
        var robotic = v && /milena/i.test(v.name || '') && !/enhanced|premium|улучш/i.test(v.name || '');
        u.rate = robotic ? 0.92 : 1.0;
        u.pitch = robotic ? 0.95 : 1.0;
        u.onend = u.onerror = finish;
        /* H2 — событие границы слова → пульс рта у 3D-лица */
        u.onboundary = function () { sysPulse = 1; };

        var started = false;
        u.onstart = function () { started = true; };
        try {
          speechSynthesis.resume();   // Chrome иногда «засыпает» в паузе
          speechSynthesis.speak(u);
        } catch (e) { finish(); return; }

        /* Сторож: если фраза не зазвучала за 700 мс (браузер её проглотил) —
           пробуем ещё раз, а затем не бросаем разговор молчащим. */
        setTimeout(function () {
          if (started || finished || !on) return;
          try { speechSynthesis.resume(); speechSynthesis.speak(u); } catch (e) {}
          setTimeout(function () { if (!started && !finished) finish(); }, 1200);
        }, 700);
      };

      /* cancel() вплотную перед speak() в Chrome глотает фразу — даём кадр */
      try { speechSynthesis.cancel(); } catch (e) {}
      setTimeout(say, 60);
    }

    function stopRec() {
      recWanted = false;
      if (rec) { try { rec.onend = null; rec.stop(); } catch (e) {} rec = null; }
      if (silT) { clearTimeout(silT); silT = 0; }
    }

    function listen() {
      if (!on || muted || speakingNow || thinking) return; /* ждём ответ агента — не запускаем распознавание поверх */
      stopRec();   // на случай если предыдущий rec ещё не завершён — максимум один экземпляр
      setStatus('ai.st.listen');
      recWanted = true;
      rec = new SR();
      rec.lang = (lang() === 'en') ? 'en-US' : 'ru-RU';
      rec.interimResults = false;
      rec.continuous = false;
      rec.onresult = function (e) {
        var txt = (e.results[0] && e.results[0][0]) ? e.results[0][0].transcript : '';
        if (txt) { sub('me', txt); handle(txt); }
      };
      rec.onerror = function (e) {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { end(); showFb('voice.denied'); }
      };
      rec.onend = function () { // перезапуск после каждой фразы
        if (on && recWanted && !speakingNow && !muted && !thinking) setTimeout(function () { if (on && recWanted && !speakingNow && !muted && !thinking) listen(); }, 150);
      };
      try { rec.start(); } catch (e) {}
      /* молчание 8с → мягкое приглашение (не во время «думает» — ответ
         умного агента занимает 10-15с, дольше 8с, иначе старая фраза
         «Вы здесь?» звучит ПОВЕРХ настоящего ответа агента) */
      if (silT) clearTimeout(silT);
      silT = setTimeout(function () { if (on && !speakingNow && !muted && !thinking) speak(tr('ai.silence')); }, 8000);
    }

    function handle(txt) {
      if (silT) { clearTimeout(silT); silT = 0; }
      thinking = true;   // ждём ответ (умный агент может занять 10-15с) — не мешаем тишиной/перезапуском
      setStatus('ai.st.think');
      var low = txt.toLowerCase();
      var goodbye = /до свидан|пока\b|прощай|goodbye|bye\b/.test(low);
      var sched = /запиш|демо|встреч|назнач|календар|book|demo|schedule|meeting/.test(low);
      var human = /человек|шаген|живо[йм]|менеджер|оператор|human|shagen|real person/.test(low);

      /* локальный путь (заготовки + локальная модель) — если умного агента нет */
      function localReply() {
        if (goodbye) { speak(tr('ai.bye'), function () { end(); }); return; }
        if (sched) { speak(tr('ai.openCal')); openWindow('win-calendar', $('aiCallBtn')); return; }
        if (human) { speak(tr('ai.human')); try { window.open('https://t.me/Shahen_kazaryan', '_blank', 'noopener'); } catch (e) {} return; }
        var fin = function (res) { if (on) speak(res.text); };
        if (window.LocalAI && window.LocalAI.askAsync) window.LocalAI.askAsync('secretary', txt, lang()).then(fin, function () { fin(window.LocalAI.ask('secretary', txt, lang())); });
        else fin(window.LocalAI ? window.LocalAI.ask('secretary', txt, lang()) : { text: txt });
      }

      /* умный голосовой агент (kie.ai LLM + живой голос) — если сервис доступен.
         Снимок истории ДО push: message и history не должны дублировать
         одну и ту же реплику (сервер сам добавляет message последним ходом). */
      if (window.AgentAPI) {
        var histForReq = callHist.slice();
        callHist.push({ role: 'user', content: txt });
        window.AgentAPI.available().then(function (ok) {
          if (!on) return;               // звонок уже завершили, пока проверяли доступность
          if (!ok) { localReply(); return; }
          window.AgentAPI.reply('secretary', txt, histForReq, true).then(function (r) {
            if (!on) return;             // завершили звонок, пока ждали ответ агента
            callHist.push({ role: 'assistant', content: r.text });
            if (sched) openWindow('win-calendar', $('aiCallBtn'));
            if (human) { try { window.open('https://t.me/Shahen_kazaryan', '_blank', 'noopener'); } catch (e) {} }
            speakAgent(r.text, r.audio, function () { if (goodbye) end(); });
          }, function () { if (on) localReply(); });
        });
        return;
      }
      localReply();
    }

    /* проговорить ответ умного агента: живой mp3 (edge-tts) с липсинком, иначе синтез */
    function speakAgent(text, audioUrl, then) {
      thinking = false;
      stopRec();
      if (!audioUrl) { speak(text, then); return; }
      var w = $('aiAvaWrap');
      /* переиспользуем ОДИН и тот же <audio>, разблокированный в клике
         (unlockAudio) — на iOS Safari разрешение на звук привязано к
         конкретному элементу, а не к домену/странице */
      var a = agentAudioEl || new Audio(); curAudio = a;
      var subbed = false, doneCalled = false;
      var done = function () {
        if (doneCalled) return; doneCalled = true;
        speakingNow = false; if (w) w.classList.remove('is-talk'); curAudio = null;
        if (!on) return; if (then) then(); else listen();
      };
      a.onplay = function () { if (!subbed) { subbed = true; sub('ai', text); speakingNow = true; setStatus('ai.st.speak'); if (w) w.classList.add('is-talk'); } };
      a.onended = done;
      a.onerror = function () { curAudio = null; if (!subbed) speak(text, then); else done(); };
      a.volume = 1;
      a.src = audioUrl;
      var p = a.play(); if (p && p.catch) p.catch(function () { curAudio = null; if (!subbed) speak(text, then); });
    }

    /* гудок 0.6с — тихий синусоидальный тон 425 Гц (как в телефонной сети) */
    function dialTone(then) {
      try {
        var o = actx.createOscillator(), g = actx.createGain();
        o.frequency.value = 425; g.gain.value = 0.045;
        o.connect(g); g.connect(actx.destination);
        o.start(); o.stop(actx.currentTime + 0.6);
        o.onended = then;
      } catch (e) { then(); }
    }

    /* полоска уровня микрофона — посетитель видит, что его слышат */
    function meter() {
      if (!analyser) return;
      var data = new Uint8Array(analyser.frequencyBinCount);
      var el = $('aiMicLevel');
      (function loop() {
        if (!on) return;
        analyser.getByteTimeDomainData(data);
        var max = 0;
        for (var i = 0; i < data.length; i += 4) { var v = Math.abs(data[i] - 128); if (v > max) max = v; }
        if (el) el.style.width = Math.min(100, Math.round(max / 70 * 100)) + '%';
        raf = requestAnimationFrame(loop);
      })();
    }

    /* Синтез речи браузер разрешает ТОЛЬКО внутри пользовательского жеста.
       Наше приветствие звучит позже — после разрешения микрофона и гудка, —
       и Chrome с Safari молча его глушат. Лечение: «разблокировать» синтез
       синхронно в обработчике клика, произнеся пустую фразу. Дальше речь
       работает всю сессию. */
    var ttsUnlocked = false;
    function unlockTTS() {
      if (ttsUnlocked || !window.speechSynthesis) return;
      try {
        var u = new SpeechSynthesisUtterance(' ');
        u.volume = 0; u.rate = 2;
        speechSynthesis.speak(u);
        speechSynthesis.getVoices();   // заодно прогреваем список голосов
        ttsUnlocked = true;
      } catch (e) {}
    }

    /* То же самое для <audio> (голос умного агента, mp3 от бэкенда):
       без этого play() после долгого ожидания ответа (микрофон + kie.ai +
       синтез — секунды) браузер молча блокирует автовоспроизведение со
       звуком, и код тихо откатывается на старый системный голос. Разово
       проигрываем беззвучный WAV строго в обработчике клика — дальше
       воспроизведение звука разрешено всю сессию.
       Safari/iOS строже Chrome: разрешение привязано к КОНКРЕТНОМУ элементу
       <audio>, а не к домену/странице — поэтому переиспользуем ОДИН и тот же
       элемент для разблокировки и для реальной речи агента (не создаём новый). */
    var audioUnlocked = false;
    var agentAudioEl = null;
    function unlockAudio() {
      if (audioUnlocked) return;
      try {
        if (!agentAudioEl) agentAudioEl = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=');
        agentAudioEl.volume = 0;
        var p = agentAudioEl.play();
        /* флаг только при реальном успехе play() — иначе следующий настоящий
           тап сможет повторить попытку разблокировки */
        if (p && p.then) { p.then(function () { audioUnlocked = true; }, function () {}); return; }
        audioUnlocked = true;
      } catch (e) {}
    }

    /* Переключатель голоса: показываем, только если системе есть из чего
       выбирать. Подсказку — когда играет роботизированная Milena.
       V7.2: при активном нейроголосе ходим по дикторам VITS
       (Ирина → Дмитрий → Руслан), а не по системным голосам. */
    function neuralActive() {
      return window.NV && NV.ready() && lang() === 'ru' && window.NeuralVoice && window.NeuralVoice.setVoice;
    }

    function refreshVoiceUI() {
      var btn = $('aiVoice'), nameEl = $('aiVoiceName'), hint = $('aiVoiceHint');
      if (neuralActive()) {
        if (btn) btn.hidden = false;
        if (nameEl) nameEl.textContent = tr(window.NeuralVoice.voice().key);
        if (hint) hint.hidden = true;
        return;
      }
      var list = ruVoices();
      var cur = pickVoice();
      if (btn) btn.hidden = list.length < 2;
      if (nameEl && cur) nameEl.textContent = (cur.name || '').replace(/\s*\(.*\)$/, '').slice(0, 18);
      var robo = cur && /milena/i.test(cur.name || '') && !/enhanced|premium|улучш/i.test(cur.name || '');
      if (hint) hint.hidden = !(robo && lang() === 'ru');
    }

    var nvSwitching = false;
    function cycleNeuralVoice() {
      if (nvSwitching) return;
      var voices = window.NeuralVoice.voices();
      var curId = window.NeuralVoice.voice().id;
      var i = 0;
      for (var k = 0; k < voices.length; k++) if (voices[k].id === curId) i = k;
      var next = voices[(i + 1) % voices.length];
      var nameEl = $('aiVoiceName'), hint = $('aiVoiceHint');
      nvSwitching = true;
      /* честность про вес: модели этого диктора нет в кеше → предупреждаем */
      window.NeuralVoice.voiceCached(next.id).then(function (inCache) {
        if (hint && !inCache) {
          hint.setAttribute('data-i18n', 'nv.sw.dl');
          hint.textContent = tr('nv.sw.dl');
          hint.hidden = false;
        }
        if (nameEl) nameEl.textContent = tr('nv.sw.loading');
        return window.NeuralVoice.setVoice(next.id, function (p) {
          if (nameEl && p && p.total) nameEl.textContent = Math.min(100, Math.round(p.loaded / p.total * 100)) + '%';
        });
      }).then(function () {
        nvSwitching = false;
        refreshVoiceUI();
        if (on) window.NeuralVoice.speak(tr('ai.voicetest'));
      }, function (err) {
        nvSwitching = false;
        refreshVoiceUI();
        try { console.warn('[NV] voice switch failed:', err); } catch (e) {}
      });
    }

    function cycleVoice() {
      if (neuralActive()) { cycleNeuralVoice(); return; }
      var list = ruVoices().slice().sort(function (a, b) { return voiceRank(a) - voiceRank(b); });
      if (list.length < 2) return;
      var cur = pickVoice();
      var i = 0;
      for (var k = 0; k < list.length; k++) if (list[k].name === (cur && cur.name)) i = k;
      var next = list[(i + 1) % list.length];
      try { localStorage.setItem('aiVoice', next.name); } catch (e) {}
      refreshVoiceUI();
      sayOnce(tr('ai.voicetest'));   // сразу слышно, как звучит выбранный
    }

    /* Короткая фраза без разговора: используется в фолбэках, чтобы посетитель
       услышал живой голос, даже если распознавание речи в браузере недоступно. */
    function sayOnce(text) {
      if (!window.speechSynthesis) return;
      try {
        var u = new SpeechSynthesisUtterance(text);
        var v = pickVoice();
        try { if (v) u.voice = v; } catch (e) {}
        u.lang = (lang() === 'en') ? 'en-US' : 'ru-RU';
        speechSynthesis.resume();
        speechSynthesis.speak(u);
      } catch (e) {}
    }

    var starting = false;
    function start() {
      if (on) return;
      unlockTTS();                     // строго синхронно, пока держится жест
      unlockAudio();                   // то же для <audio> живого голоса агента
      if (!SR) {
        showFb('voice.nosr');
        setTimeout(function () { sayOnce(tr('voice.nosr.say')); }, 120);
        return;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { showFb('voice.denied'); return; }
      starting = true;
      var btn = $('aiCallBtn');
      if (btn) { btn.disabled = true; btn.classList.add('is-wait'); } // ждём разрешения микрофона
      var done = function () { if (btn) { btn.disabled = false; btn.classList.remove('is-wait'); } };
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
        done();
        if (!starting) { s.getTracks().forEach(function (t) { t.stop(); }); return; } // окно уже закрыли — не оживать
        starting = false; stream = s; begin();
      }, function () { done(); if (!starting) return; starting = false; showFb('voice.denied'); }); // окно уже закрыли — не показываем «отказано» задним числом
    }

    function begin() {
      on = true; muted = false; callHist = [];
      home.hidden = true; fb.hidden = true; live.hidden = false;
      var mb = $('aiMute'); if (mb) { mb.classList.remove('is-off'); mb.setAttribute('aria-pressed', 'false'); }
      refreshVoiceUI();
      /* H1: голос включали раньше → тихо поднимаем из кеша; индикаторы */
      if (window.NV) NV.maybeAuto();
      syncModes();
      /* ЛОТ L: живой 2D-аватар выбранного сотрудника (вместо старого 3D) */
      mountAvatar();
      var box = $('aiSubs'); if (box) box.innerHTML = '';
      try {
        actx = new (window.AudioContext || window.webkitAudioContext)();
        var src = actx.createMediaStreamSource(stream);
        analyser = actx.createAnalyser(); analyser.fftSize = 512;
        src.connect(analyser);
      } catch (e) { actx = null; analyser = null; }
      t0 = Date.now();
      var tEl = $('aiTimer');
      tInt = setInterval(function () { if (tEl) tEl.textContent = fmt(Math.floor((Date.now() - t0) / 1000)); }, 1000);
      if (tEl) tEl.textContent = '00:00';
      /* iOS Safari: synthesis глохнет — будим resume() по таймеру */
      iosT = setInterval(function () { try { if (window.speechSynthesis && speechSynthesis.speaking) speechSynthesis.resume(); } catch (e) {} }, 5000);
      meter();
      setStatus('ai.st.speak');
      var greetLocal = function () { if (on) speak(tr('ai.greet')); };
      var greet = function () {
        if (!window.AgentAPI) { greetLocal(); return; }
        window.AgentAPI.available().then(function (ok) {
          if (!on) return;               // окно закрыли, пока проверяли доступность
          if (!ok) { greetLocal(); return; }
          window.AgentAPI.reply('secretary', 'Клиент только что подключился к звонку. Поприветствуй его коротко и представься.', [], true).then(function (r) {
            if (!on) return;
            callHist.push({ role: 'assistant', content: r.text });
            speakAgent(r.text, r.audio);
          }, greetLocal);
        });
      };
      if (actx) dialTone(greet); else greet();
    }

    function end() {
      var wasStarting = starting;
      starting = false;
      if (!on && live.hidden && !wasStarting) return;
      on = false; thinking = false;
      stopRec();
      if (curAudio) { try { curAudio.pause(); } catch (e) {} curAudio = null; }
      try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
      try { if (window.NeuralVoice) window.NeuralVoice.stop(); } catch (e) {}
      speakingNow = false; // VITS-путь не дозовёт finish после stop()
      unmountAvatar(); // выключаем рендер аватара; выбор сотрудника — в localStorage
      if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } // ОСВОБОЖДАЕМ микрофон
      if (actx) { try { actx.close(); } catch (e) {} actx = null; analyser = null; }
      if (tInt) { clearInterval(tInt); tInt = 0; }
      if (iosT) { clearInterval(iosT); iosT = 0; }
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      var w = $('aiAvaWrap'); if (w) w.classList.remove('is-talk');
      live.hidden = true; home.hidden = false;
    }

    function showFb(key) {
      var t = $('aiFbText'); if (t) { t.textContent = tr(key); t.dataset.k = key; }
      home.hidden = true; live.hidden = true; fb.hidden = false;
    }

    function init() {
      home = $('callHome'); live = $('aiCall'); fb = $('aiFb');
      var btn = $('aiCallBtn');
      if (!home || !live || !btn) return;
      btn.addEventListener('click', start); // строго по жесту (iOS-автоплей)
      var e1 = $('aiEnd'); if (e1) e1.addEventListener('click', end);
      var vb = $('aiVoice'); if (vb) vb.addEventListener('click', cycleVoice);
      var mb = $('aiMute');
      if (mb) mb.addEventListener('click', function () {
        muted = !muted;
        mb.classList.toggle('is-off', muted);
        mb.setAttribute('aria-pressed', muted ? 'true' : 'false');
        if (muted) { stopRec(); setStatus('ai.st.muted'); }
        else listen();
      });
      var back = $('aiFbBack'); if (back) back.addEventListener('click', function () { fb.hidden = true; home.hidden = false; });
      var fbChat = $('aiFbChat'); if (fbChat) fbChat.addEventListener('click', function () { fb.hidden = true; home.hidden = false; });
      /* ЛОТ L — галерея выбора сотрудника и стиля лица */
      initPicker();
      /* H3 — честный попап про слух */
      var hearBtn = $('aiHearMode'), hearPop = $('aiHearPop');
      if (hearBtn && hearPop) hearBtn.addEventListener('click', function () {
        hearPop.hidden = !hearPop.hidden;
        hearBtn.setAttribute('aria-expanded', hearPop.hidden ? 'false' : 'true');
      });
      /* индикатор голоса обновляется, когда нейроголос догрузился;
         переключатель дикторов тоже (V7.2) */
      document.addEventListener('nv:ready', function () { syncModes(); refreshVoiceUI(); });
      document.addEventListener('i18n:change', syncModes);
      /* закрытие окна «Звонок» завершает разговор и освобождает микрофон */
      var win = document.getElementById('win-call');
      if (win) win.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('[data-act="close"]')) end();
      });
      window.addEventListener('pagehide', end);
      /* перевод фолбэка при смене языка */
      document.addEventListener('i18n:change', function () {
        var t = $('aiFbText'); if (t && !fb.hidden && t.dataset.k) t.textContent = tr(t.dataset.k);
      });
      /* Список голосов приходит асинхронно: без прогрева первая фраза
         озвучивается голосом по умолчанию (часто английским) или не звучит. */
      if (window.speechSynthesis) {
        try {
          speechSynthesis.getVoices();
          speechSynthesis.addEventListener('voiceschanged', function () { speechSynthesis.getVoices(); });
        } catch (e) {}
      }
    }
    init();
    return {
      end: end,
      /* хуки для приёмочных тестов (безвредны в проде) */
      faceLevel: faceLevel,
      avatarCtl: function () { return avaCtl; }
    };
  })();
  window.VoiceCall = VoiceCall;

  /* ============================================================
     G5 — ФАБРИКА КОНТЕНТА: живой генератор (WebLLM или умные шаблоны)
     ============================================================ */
  (function Factory() {
    var fmt = 'post', tone = 'biz', typing = 0;
    function $(id) { return document.getElementById(id); }

    function segInit(boxId, set) {
      var box = $(boxId); if (!box) return;
      box.addEventListener('click', function (e) {
        var b = e.target.closest('.fx-seg'); if (!b) return;
        Array.prototype.forEach.call(box.querySelectorAll('.fx-seg'), function (x) {
          var onx = (x === b);
          x.classList.toggle('is-on', onx);
          x.setAttribute('aria-checked', onx ? 'true' : 'false');
        });
        set(b.dataset.val);
      });
    }

    function typeOut(el, text, done) {
      if (typing) { clearInterval(typing); typing = 0; }
      if (reduceMotion) { el.textContent = text; if (done) done(); return; }
      el.textContent = '';
      var i = 0;
      typing = setInterval(function () {
        i += 2;
        el.textContent = text.slice(0, i);
        if (i >= text.length) { clearInterval(typing); typing = 0; if (done) done(); }
      }, 14);
    }

    var PH = { post: 'fab.ph1', card: 'fab.ph2', review: 'fab.ph3' };
    function setPh() {
      var ta = $('fxTopic'); if (ta) ta.placeholder = tr(PH[fmt] || 'fab.ph1');
    }
    function init() {
      var go = $('fxGo'); if (!go) return;
      segInit('fxFormat', function (v) { fmt = v; setPh(); });
      segInit('fxTone', function (v) { tone = v; });
      setPh();
      document.addEventListener('i18n:change', setPh);
      go.addEventListener('click', function () {
        var ta = $('fxTopic');
        var topic = ta ? ta.value.trim() : '';
        var out = $('fxOut'), txt = $('fxText'), src = $('fxSrc');
        if (!out || !txt) return;
        out.hidden = false;
        if (!topic) { txt.textContent = tr('fab.needTopic'); if (src) src.textContent = ''; if (ta) ta.focus(); return; }
        txt.textContent = '…';
        go.disabled = true;
        /* localai.js теперь ленивый — на случай клика раньше его загрузки */
        ensureLocalAI(function () {
          if (!window.LocalAI || !window.LocalAI.generate) { go.disabled = false; return; }
          window.LocalAI.generate({ format: fmt, tone: tone, topic: topic, lang: lang() }).then(function (r) {
            go.disabled = false;
            if (src) src.textContent = (r.source === 'agent') ? tr('ai.src.agent') : (r.source === 'webllm') ? tr('ai.src.webllm') : tr('ai.src.intent');
            typeOut(txt, r.text);
          }, function () { go.disabled = false; });
        });
      });
      var cp = $('fxCopy');
      if (cp) cp.addEventListener('click', function () {
        var txt = $('fxText'); if (!txt) return;
        var val = txt.textContent;
        var okFlash = function () {
          cp.textContent = tr('fab.copied');
          setTimeout(function () { cp.textContent = tr('fab.copy'); }, 1400);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(val).then(okFlash, okFlash);
        else okFlash();
      });
    }
    init();
  })();

  /* ============================================================
     Экранная клавиатура (iOS/Android): фиксированные листы не сжимаются
     сами, поэтому пишем высоту клавиатуры в --kbh (visualViewport) —
     CSS поджимает открытый лист снизу, композер чата остаётся видимым.
     ============================================================ */
  (function keyboardInset() {
    var vv = window.visualViewport;
    if (!vv) return;
    var root = document.documentElement;
    function apply() {
      var kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty('--kbh', kb > 40 ? kb + 'px' : '0px');
      if (kb > 40) {
        var ae = document.activeElement;
        if (ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName) && ae.closest('.win')) {
          ae.scrollIntoView({ block: 'nearest' });
          var th = document.getElementById('msgThread');
          if (th) th.scrollTop = th.scrollHeight;
        }
      }
    }
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
  })();

  /* ============================================================
     F2 — URL-параметр ?open=<win-id> (белый список id окон)
     Игра ссылается на ?open=win-devices при победе.
     ============================================================ */
  (function handleOpenParam() {
    var m = /[?&]open=([\w-]+)/.exec(location.search);
    if (!m) return;
    var id = m[1];
    if (!document.getElementById(id) || !/^win-[\w-]+$/.test(id)) return; // валидация по белому списку
    setTimeout(function () { openWindow(id, dockApp(id) || null); }, reduceMotion ? 0 : 300);
  })();

  // экспорт для тестов (только локально)
  if (DEV) window.__os = {
    openWindow: openWindow, closeWindow: closeWindow,
    setTheme: setTheme, toggleTheme: toggleTheme, currentTheme: currentTheme
  };
})();
