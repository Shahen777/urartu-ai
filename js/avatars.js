/* ============================================================
   avatars.js — ЛОТ L: сменные 2D-аватары сотрудников с липсинком.
   Никакого 3D: «говорящее фото» (canvas-деформация рта по JSON-разметке)
   и «рисованный» стиль (морф SVG-рта). Изображения в avatars/ грузятся
   ЛЕНИВО — только при первом показе лица (mount) или открытии чата.

   Наружу: window.Avatars
     list()            → [{id, nameKey}]
     sel() / setSel()  → выбранный сотрудник и стиль (localStorage)
     src(id, style)    → путь к картинке ('real' → webp, 'toon' → svg)
     nameKey(id)       → i18n-ключ имени роли
     mount(box, opts)  → контроллер {destroy(), visemeIndex(), ready}
       opts.getLevel   — функция 0..1 (амплитуда голоса, RMS)
   Анимация: 5 позиций рта под амплитуду, моргание, дыхание (CSS).
   prefers-reduced-motion: только смена позиции рта, без сглаживания,
   без моргания и покачивания. Пауза при скрытой вкладке.
   ============================================================ */
(function () {
  'use strict';
  if (window.Avatars) return;

  var EMP = [
    { id: 'secretary', nameKey: 'msg.n.secretary' },
    { id: 'documoved', nameKey: 'msg.n.documoved' },
    { id: 'lawyer',    nameKey: 'msg.n.lawyer' },
    { id: 'support',   nameKey: 'msg.n.support' },
    { id: 'content',   nameKey: 'staff.e5.role' }
  ];

  /* 5 позиций рта «рисованного» стиля — морф path.d (центр 100,130) */
  var TOON_VIS = [
    'M86,128 Q100,134 114,128 Q100,138 86,128 Z',
    'M87,127 Q100,124 113,127 Q100,141 87,127 Z',
    'M88,126 Q100,121 112,126 Q100,147 88,126 Z',
    'M90,125 Q100,119 110,125 Q100,153 90,125 Z',
    'M89,124 Q100,116 111,124 Q100,159 89,124 Z'
  ];

  var BASE = 'avatars/';
  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function find(id) { for (var i = 0; i < EMP.length; i++) if (EMP[i].id === id) return EMP[i]; return null; }

  function sel() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem('avaSel')); } catch (e) {}
    if (!s || !find(s.id) || (s.style !== 'real' && s.style !== 'toon')) return { id: 'secretary', style: 'real' };
    return s;
  }
  function setSel(id, style) {
    var s = { id: find(id) ? id : 'secretary', style: style === 'toon' ? 'toon' : 'real' };
    try { localStorage.setItem('avaSel', JSON.stringify(s)); } catch (e) {}
    try { document.dispatchEvent(new CustomEvent('ava:change', { detail: s })); } catch (e) {}
    return s;
  }
  function src(id, style) { return BASE + id + (style === 'toon' ? '-toon.svg' : '-real.webp'); }
  function nameKey(id) { var e = find(id); return e ? e.nameKey : 'msg.n.secretary'; }

  /* ---------- реалистичный движок: canvas-деформация фото ---------- */
  var W = 384;                       // внутреннее разрешение кадра
  var OPEN = [0, 0.3, 0.55, 0.78, 1];
  var frameCache = {};               // id -> {frames, lids} (готовые кадры)

  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }

  function loadImage(url) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = rej;
      im.src = url;
    });
  }

  /* мягкая «вырезка»: кусок base с растушёванными краями, сдвинутый на dy */
  function strip(dst, base, sx, sy, sw, sh, dy) {
    var t = mk(sw, sh), tc = t.getContext('2d');
    tc.drawImage(base, sx, sy, sw, sh, 0, 0, sw, sh);
    var fv = Math.min(sh * 0.32, 12) / sh, fh = Math.min(sw * 0.22, 12) / sw;
    var g = tc.createLinearGradient(0, 0, 0, sh);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(fv, '#000');
    g.addColorStop(1 - fv, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
    tc.globalCompositeOperation = 'destination-in';
    tc.fillStyle = g; tc.fillRect(0, 0, sw, sh);
    var g2 = tc.createLinearGradient(0, 0, sw, 0);
    g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(fh, '#000');
    g2.addColorStop(1 - fh, '#000'); g2.addColorStop(1, 'rgba(0,0,0,0)');
    tc.fillStyle = g2; tc.fillRect(0, 0, sw, sh);
    dst.drawImage(t, sx, sy + dy);
  }

  /* кадр с приоткрытым ртом: тёмная полость + губы врозь (челюсть вниз) */
  function buildFrame(base, m, o) {
    var c = mk(W, W), x = c.getContext('2d');
    x.drawImage(base, 0, 0);
    if (o <= 0) return c;
    var s = o * m.h * 0.55;
    var cx = m.x + m.w / 2, cy = m.y + m.h / 2;
    x.beginPath();
    x.ellipse(cx, cy + s * 0.3, m.w * 0.32, m.h * 0.16 + s * 0.5, 0, 0, Math.PI * 2);
    x.fillStyle = '#47191d'; x.fill();
    x.beginPath();
    x.ellipse(cx, cy + s * 0.55, m.w * 0.20, m.h * 0.09 + s * 0.24, 0, 0, Math.PI * 2);
    x.fillStyle = '#6e2b31'; x.fill();
    /* верхняя губа приподнимается, нижняя губа с подбородком опускаются */
    strip(x, base, m.x - m.w * 0.25, m.y - m.h * 1.15, m.w * 1.5, m.h * 1.6, -s * 0.35);
    strip(x, base, m.x - m.w * 0.25, m.y + m.h * 0.45, m.w * 1.5, m.h * 2.0, s * 0.75);
    return c;
  }

  /* веко: кожа над глазом, растянутая вниз, с растушёвкой — «глаз закрыт» */
  function buildLid(base, e) {
    var pad = e.w * 0.3;
    var dx = e.x - pad, dw = e.w + pad * 2;
    var dy = e.y - e.h * 0.4, dh = e.h * 2.0;
    var t = mk(dw, dh), tc = t.getContext('2d');
    /* полоса кожи ВЕКА сразу над глазом (не выше — там бровь), растянутая вниз */
    tc.drawImage(base, dx, e.y - e.h * 0.5, dw, e.h * 0.55, 0, 0, dw, dh);
    var g = tc.createLinearGradient(0, 0, 0, dh);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.28, '#000');
    g.addColorStop(0.72, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
    tc.globalCompositeOperation = 'destination-in';
    tc.fillStyle = g; tc.fillRect(0, 0, dw, dh);
    var g2 = tc.createLinearGradient(0, 0, dw, 0);
    g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(0.22, '#000');
    g2.addColorStop(0.78, '#000'); g2.addColorStop(1, 'rgba(0,0,0,0)');
    tc.fillStyle = g2; tc.fillRect(0, 0, dw, dh);
    return { c: t, x: dx, y: dy };
  }

  function prepareReal(id) {
    if (frameCache[id]) return frameCache[id];
    frameCache[id] = Promise.all([
      loadImage(src(id, 'real')),
      fetch(BASE + id + '-real.json').then(function (r) { return r.json(); })
    ]).then(function (rr) {
      var img = rr[0], meta = rr[1];
      var base = mk(W, W);
      base.getContext('2d').drawImage(img, 0, 0, W, W);
      function R(r) { return { x: r.x * W, y: r.y * W, w: r.w * W, h: r.h * W }; }
      var m = R(meta.mouth);
      var frames = [];
      for (var i = 0; i < OPEN.length; i++) frames.push(buildFrame(base, m, OPEN[i]));
      var lids = [buildLid(base, R(meta.eyeL)), buildLid(base, R(meta.eyeR))];
      return { frames: frames, lids: lids };
    }, function (err) { frameCache[id] = null; throw err; });
    return frameCache[id];
  }

  /* ---------- рисованный движок: инлайн-SVG, морф рта ---------- */
  var svgCache = {};
  function prepareToon(id) {
    if (svgCache[id]) return svgCache[id];
    svgCache[id] = fetch(src(id, 'toon')).then(function (r) { return r.text(); },
      function (err) { svgCache[id] = null; throw err; });
    return svgCache[id];
  }

  /* ---------- общий контроллер ---------- */
  function mount(box, opts) {
    opts = opts || {};
    var s = sel();
    var id = opts.id || s.id, style = opts.style || s.style;
    var ctl = { alive: true, idx: -1, blink: false, _raf: 0, _draw: null };

    box.innerHTML = '';
    box.classList.add('ava-box');
    if (!reduced && opts.animate !== false) box.classList.add('ava-breathe');

    if (style === 'toon') {
      ctl.ready = prepareToon(id).then(function (txt) {
        if (!ctl.alive) return;
        box.innerHTML = txt;
        var sv = box.querySelector('svg');
        if (sv) { sv.style.width = '100%'; sv.style.height = '100%'; sv.style.display = 'block'; }
        var mouth = box.querySelector('.av-mouth');
        var eyes = box.querySelectorAll('.av-eye');
        ctl._draw = function (i, blink) {
          if (mouth) mouth.setAttribute('d', TOON_VIS[i]);
          for (var k = 0; k < eyes.length; k++) eyes[k].style.transform = blink ? 'scaleY(0.12)' : '';
        };
        ctl._draw(0, false);
      }).catch(function (e) { try { console.warn('[Avatars]', e); } catch (_) {} });
    } else {
      ctl.ready = prepareReal(id).then(function (kit) {
        if (!ctl.alive) return;
        var c = mk(W, W), x = c.getContext('2d');
        c.style.width = '100%'; c.style.height = '100%'; c.style.display = 'block';
        box.appendChild(c);
        ctl._draw = function (i, blink) {
          x.drawImage(kit.frames[i], 0, 0);
          if (blink) { x.drawImage(kit.lids[0].c, kit.lids[0].x, kit.lids[0].y); x.drawImage(kit.lids[1].c, kit.lids[1].x, kit.lids[1].y); }
        };
        ctl._draw(0, false);
      }).catch(function (e) { try { console.warn('[Avatars]', e); } catch (_) {} });
    }

    /* цикл: амплитуда → позиция рта; моргание; пауза при скрытой вкладке */
    var lvl = 0, nextBlink = Date.now() + 1600 + Math.random() * 2600, blinkEnd = 0;
    function tick() {
      if (!ctl.alive) return;
      if (document.hidden) { ctl._raf = 0; return; }
      var t = opts.getLevel ? (opts.getLevel() || 0) : 0;
      lvl = reduced ? t : lvl + (t - lvl) * (t > lvl ? 0.55 : 0.28);
      var ni = lvl < 0.05 ? 0 : lvl < 0.13 ? 1 : lvl < 0.24 ? 2 : lvl < 0.40 ? 3 : 4;
      var b = false;
      if (!reduced) {
        var now = Date.now();
        if (now >= nextBlink) { blinkEnd = now + 150; nextBlink = now + 2600 + Math.random() * 3400; }
        b = now < blinkEnd;
      }
      if (ni !== ctl.idx || b !== ctl.blink) { ctl.idx = ni; ctl.blink = b; if (ctl._draw) ctl._draw(ni, b); }
      ctl._raf = requestAnimationFrame(tick);
    }
    function onVis() { if (!document.hidden && ctl.alive && !ctl._raf) ctl._raf = requestAnimationFrame(tick); }

    if (opts.animate !== false) {
      document.addEventListener('visibilitychange', onVis);
      ctl._raf = requestAnimationFrame(tick);
    }

    ctl.visemeIndex = function () { return ctl.idx < 0 ? 0 : ctl.idx; };
    ctl.destroy = function () {
      if (!ctl.alive) return;
      ctl.alive = false;
      if (ctl._raf) { cancelAnimationFrame(ctl._raf); ctl._raf = 0; }
      document.removeEventListener('visibilitychange', onVis);
      box.classList.remove('ava-breathe');
      box.innerHTML = '';
    };
    return ctl;
  }

  window.Avatars = {
    list: function () { return EMP.slice(); },
    sel: sel,
    setSel: setSel,
    src: src,
    nameKey: nameKey,
    mount: mount
  };
})();
