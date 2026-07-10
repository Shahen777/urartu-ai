/* ============================================================
   ЛОТ J — «Броня, читаемость и продающие мелочи»
   Всё локально (vendor/), тяжёлое грузится ЛЕНИВО по кнопке:
   - markdown-it (ответы живой модели → markdown → DOMPurify → DOM)
   - driver.js «Экскурсия по системе» (8 шагов, автозапуск один раз)
   - jsPDF + Roboto-subset + qrcode-generator — «Скачать смету (PDF)»
   - CountUp.js — слайдер «Человек vs ИИ-сотрудник»
   - счётчик приватности в меню-баре (PerformanceObserver по resource)
   DOMPurify (vendor/purify.min.js) подключён эагерно в index.html.
   ============================================================ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function lang() { return (window.__lang === 'en') ? 'en' : 'ru'; }
  function tr(k) { return (window.I18N && window.I18N.t) ? window.I18N.t(k, lang()) : k; }
  function $(id) { return document.getElementById(id); }

  /* ---------- ленивые загрузчики локальных файлов ---------- */
  var _scripts = {};
  function loadScript(src) {
    if (_scripts[src]) return _scripts[src];
    _scripts[src] = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { res(); };
      s.onerror = function () { _scripts[src] = null; rej(new Error(src + ' failed')); };
      document.head.appendChild(s);
    });
    return _scripts[src];
  }
  function loadStyle(href) {
    if (document.querySelector('link[data-lz="' + href + '"]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-lz', href);
    document.head.appendChild(l);
  }

  /* БРОНЯ: DOMPurify грузится лениво (–28 КБ с первой загрузки) — при открытии
     ассистента, задолго до первого ответа модели (os.js: Messenger.onOpen). */
  window.LotJ = window.LotJ || {};
  var _armorP = null;
  window.LotJ.ensureArmor = function () {
    if (window.DOMPurify) return Promise.resolve();
    if (_armorP) return _armorP;
    _armorP = loadScript('vendor/purify.min.js').catch(function (e) { _armorP = null; throw e; });
    return _armorP;
  };

  /* форматирование чисел */
  function fmtSpace(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function fmtComma(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  /* сумма в валюте текущего языка: RU — «X ₽», EN — «$Y» (1$≈100₽) */
  function money(rub) {
    if (lang() === 'en') return '$' + fmtComma(Math.round(rub / 100));
    return fmtSpace(rub) + ' ₽';
  }

  /* ============================================================
     1) MARKDOWN — ответы живой модели (markdown-it → DOMPurify → DOM)
     ============================================================ */
  var _md = null, _mdP = null;
  function ensureMd() {
    if (_md) return Promise.resolve(_md);
    if (_mdP) return _mdP;
    _mdP = loadScript('vendor/markdown-it.min.js').then(function () {
      /* html:false — сырой HTML из ответа модели экранируется; затем ещё и DOMPurify */
      _md = window.markdownit({ html: false, linkify: true, breaks: true });
      return _md;
    });
    return _mdP;
  }
  window.LotJ = window.LotJ || {};
  window.LotJ.md = function (text) {
    return ensureMd().then(function (md) {
      var html = md.render(String(text || ''));
      return (window.OSSanitize ? window.OSSanitize(html) : html);
    });
  };

  /* ============================================================
     2) СЧЁТЧИК ПРИВАТНОСТИ — «⇡ 0» + попап
     ============================================================ */
  (function privacy() {
    var btn = $('prvcBtn'), numEl = $('prvcNum');
    if (!btn || !numEl) return;
    var count = 0, bytes = 0, hosts = {};
    var pop = null;

    function isExternal(url) {
      try { return new URL(url, location.href).origin !== location.origin; }
      catch (e) { return false; }
    }
    function hostOf(url) { try { return new URL(url, location.href).hostname; } catch (e) { return ''; } }
    function fmtMB(b) {
      if (!b) return '';
      if (b >= 1048576) return (b / 1048576).toFixed(1).replace(/\.0$/, '') + ' МБ';
      return Math.max(1, Math.round(b / 1024)) + ' КБ';
    }

    function render() {
      numEl.textContent = count;
      btn.classList.toggle('is-hot', count > 0);
      if (pop) renderPop();
    }
    function bump(entry) {
      if (!entry || !entry.name || !isExternal(entry.name)) return;
      count++;
      var h = hostOf(entry.name); if (h) hosts[h] = 1;
      if (entry.transferSize) bytes += entry.transferSize;
      render();
    }

    if ('PerformanceObserver' in window) {
      try {
        var po = new PerformanceObserver(function (list) { list.getEntries().forEach(bump); });
        po.observe({ type: 'resource', buffered: true });
      } catch (e) {
        try {
          var po2 = new PerformanceObserver(function (list) { list.getEntries().forEach(bump); });
          po2.observe({ entryTypes: ['resource'] });
        } catch (_) {}
      }
    }

    function renderPop() {
      if (!pop) return;
      pop.classList.toggle('is-hot', count > 0);
      var big = pop.querySelector('.prvc-pop__big');
      var txt = pop.querySelector('.prvc-pop__txt');
      big.textContent = count;
      var small = document.createElement('small'); small.textContent = tr('prvc.count');
      big.appendChild(small);
      if (count === 0) {
        txt.textContent = tr('prvc.zero');
      } else {
        var src = Object.keys(hosts).join(', ') || '—';
        txt.textContent = tr('prvc.some').replace('{n}', count).replace('{mb}', fmtMB(bytes) || '—').replace('{src}', src);
      }
      pop.querySelector('.prvc-pop__h span:last-child').textContent = tr('prvc.title');
      pop.querySelector('.prvc-pop__close').textContent = tr('prvc.close');
    }
    function openPop() {
      pop = document.createElement('div');
      pop.className = 'prvc-pop';
      pop.setAttribute('role', 'dialog');
      pop.innerHTML =
        '<div class="prvc-pop__h"><span class="prvc-pop__dot" aria-hidden="true"></span><span></span></div>' +
        '<div class="prvc-pop__big"></div>' +
        '<p class="prvc-pop__txt"></p>' +
        '<button class="prvc-pop__close" type="button"></button>';
      document.body.appendChild(pop);
      btn.setAttribute('aria-expanded', 'true');
      renderPop();
      pop.querySelector('.prvc-pop__close').addEventListener('click', closePop);
      setTimeout(function () {
        document.addEventListener('click', outside, true);
        document.addEventListener('keydown', esc);
      }, 0);
    }
    function closePop() {
      if (!pop) return;
      document.removeEventListener('click', outside, true);
      document.removeEventListener('keydown', esc);
      pop.parentNode && pop.parentNode.removeChild(pop);
      pop = null;
      btn.setAttribute('aria-expanded', 'false');
    }
    function outside(e) { if (pop && !pop.contains(e.target) && e.target !== btn && !btn.contains(e.target)) closePop(); }
    function esc(e) { if (e.key === 'Escape') closePop(); }

    btn.addEventListener('click', function () { pop ? closePop() : openPop(); });
    document.addEventListener('i18n:change', function () { if (pop) renderPop(); });
    render();
  })();

  /* ============================================================
     3) ЭКСКУРСИЯ ПО СИСТЕМЕ (driver.js) — 8 шагов, автозапуск один раз
     ============================================================ */
  var TOUR_KEY = 'urartu-tour-v1';
  var STEPS = [
    { el: '.menubar', t: 'tour.s1', side: 'bottom' },
    { el: '#win-assistant', win: 'win-assistant', t: 'tour.s2', side: 'left' },
    { el: '#win-staff', win: 'win-staff', t: 'tour.s3', side: 'left' },
    { el: '#win-pulse', win: 'win-pulse', t: 'tour.s4', side: 'left' },
    { el: '#win-calc', win: 'win-calc', t: 'tour.s5', side: 'left' },
    { el: '#win-call', win: 'win-call', t: 'tour.s6', side: 'left' },
    { el: '#prvcBtn', t: 'tour.s7', side: 'bottom' },
    { el: '#win-readme', win: 'win-readme', t: 'tour.s8', side: 'left' }
  ];
  var _tourP = null, _tourRunning = false, _curWin = null;
  function ensureTourLibs() {
    if (window.driver && window.driver.js) return Promise.resolve();
    if (_tourP) return _tourP;
    loadStyle('vendor/driver.css');
    _tourP = loadScript('vendor/driver.iife.js').catch(function (e) { _tourP = null; throw e; });
    return _tourP;
  }
  function openTourWin(id) {
    try {
      if (_curWin && _curWin !== id && window.OS) window.OS.close(_curWin);
      if (window.OS) window.OS.open(id); // без trigger — окно не анимируется, driver меряет корректно
      _curWin = id;
    } catch (e) {}
  }
  function closeTourWin() {
    try { if (_curWin && window.OS) window.OS.close(_curWin); } catch (e) {}
    _curWin = null;
  }
  function startTour() {
    if (_tourRunning) return;
    try { localStorage.setItem(TOUR_KEY, '1'); } catch (e) {}
    ensureTourLibs().then(function () {
      var driver = window.driver.js.driver;
      var steps = STEPS.map(function (s) {
        return {
          element: s.el,
          popover: {
            title: tr(s.t + '.t'),
            description: tr(s.t + '.d'),
            side: s.side || 'bottom',
            align: 'center'
          },
          onHighlightStarted: function () {
            if (s.win) openTourWin(s.win); else closeTourWin();
          }
        };
      });
      var d = driver({
        showProgress: true,
        animate: !reduceMotion,
        allowClose: true,
        overlayColor: 'rgba(0,0,0,.62)',
        stagePadding: 6,
        stageRadius: 12,
        nextBtnText: tr('tour.next'),
        prevBtnText: tr('tour.prev'),
        doneBtnText: tr('tour.done'),
        progressText: tr('tour.progress'),
        steps: steps,
        onDestroyed: function () { _tourRunning = false; closeTourWin(); }
      });
      /* кнопка «Пропустить» = крестик driver.js (allowClose). Плюс закрытие по фону. */
      _tourRunning = true;
      d.drive();
    }, function () { _tourRunning = false; });
  }
  window.LotJ.tour = startTour;

  /* делегированный клик по пунктам «Экскурсия» (меню «Помощь» и кнопка в README) */
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-act="tour"]') : null;
    if (!b) return;
    e.preventDefault();
    /* закрыть открытое выпадающее меню меню-бара, если клик пришёл оттуда */
    var menus = document.querySelectorAll('.mb-menu.is-open');
    for (var i = 0; i < menus.length; i++) {
      menus[i].classList.remove('is-open');
      var t = menus[i].querySelector('.mb-menu__t'); if (t) t.setAttribute('aria-expanded', 'false');
      var d = menus[i].querySelector('.mb-menu__d'); if (d) d.hidden = true;
    }
    startTour();
  });

  /* автозапуск один раз при первом визите */
  function maybeAutoTour() {
    /* не мешаем автоматизации/тестам: интрузивный онбординг только живым посетителям */
    if (navigator.webdriver) return;
    var seen = false;
    try { seen = !!localStorage.getItem(TOUR_KEY); } catch (e) { seen = true; }
    if (seen) return;
    if (/[?&](open|notour)=/.test(location.search)) { try { localStorage.setItem(TOUR_KEY, '1'); } catch (e) {} return; }
    setTimeout(startTour, reduceMotion ? 400 : 1700);
  }

  /* ============================================================
     4) PDF-СМЕТА (jsPDF + Roboto-subset + QR) — ленивая загрузка
     ============================================================ */
  var _pdfP = null;
  function ensurePdfLibs() {
    if (window.jspdf && window.PDF_FONT && window.qrcode) return Promise.resolve();
    if (_pdfP) return _pdfP;
    _pdfP = Promise.all([
      loadScript('vendor/jspdf.umd.min.js'),
      loadScript('vendor/pdf-font.js'),
      loadScript('vendor/qrcode.min.js')
    ]).catch(function (e) { _pdfP = null; throw e; });
    return _pdfP;
  }
  var TG = 'https://t.me/Shahen_kazaryan';
  var CONTACTS = ['@Shahen_kazaryan', '+7 926 333-78-47', 'mos-city@bk.ru'];

  function qrDataUrl(text) {
    try {
      var qr = window.qrcode(0, 'M');
      qr.addData(text); qr.make();
      return qr.createDataURL(6, 0); // cellSize, margin
    } catch (e) { return null; }
  }

  function buildPdf(est) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'a4' });
    var F = window.PDF_FONT;
    if (F) { doc.addFileToVFS('Roboto.ttf', F.b64); doc.addFont('Roboto.ttf', 'Roboto', 'normal'); doc.setFont('Roboto'); }
    var W = 210, M = 18, red = [212, 46, 0], ink = [30, 30, 34], dim = [110, 112, 120], line = [222, 224, 228];
    var en = lang() === 'en';

    /* шапка — красная плашка с логотипом */
    doc.setFillColor(red[0], red[1], red[2]);
    doc.rect(0, 0, W, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20); doc.text('URARTU AI', M, 15);
    doc.setFontSize(9.5); doc.text(tr('pdf.tagline'), M, 22.5);

    var y = 44;
    doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.setFontSize(17); doc.text(tr('pdf.doc'), M, y);
    var dateStr = new Date().toLocaleDateString(en ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.setFontSize(9.5); doc.setTextColor(dim[0], dim[1], dim[2]);
    doc.text(tr('pdf.date') + ': ' + dateStr, M, y + 6);
    y += 16;

    /* строки сметы */
    function row(label, value) {
      doc.setDrawColor(line[0], line[1], line[2]);
      doc.line(M, y, W - M, y);
      y += 7;
      doc.setFontSize(10.5);
      doc.setTextColor(dim[0], dim[1], dim[2]); doc.text(String(label), M, y);
      doc.setTextColor(ink[0], ink[1], ink[2]);
      doc.text(String(value), W - M, y, { align: 'right' });
      y += 4;
    }
    row(tr('pdf.svc'), tr(est.svcKey));
    row(tr('pdf.vol'), tr(est.volKey) + ' (×' + est.mult + ')');
    row(tr('pdf.rush'), est.rush ? tr('pdf.yes') : tr('pdf.no'));
    row(tr('pdf.opts'), est.optsText && est.optsText.length ? est.optsText.join(', ') : tr('pdf.none'));
    if (est.sup) row(tr('pdf.support'), '+ ' + money(est.supportMo) + '/' + (en ? 'mo' : 'мес'));
    doc.setDrawColor(line[0], line[1], line[2]); doc.line(M, y, W - M, y);
    y += 10;

    /* итог — красная рамка */
    var sum = en
      ? '$' + est.fmtUsd(est.totalUsd) + '  (≈ ' + est.fmtRub(est.totalRub) + ' ₽)'
      : est.fmtRub(est.totalRub) + ' ₽  (≈ $' + est.fmtUsd(est.totalUsd) + ')';
    doc.setFillColor(252, 238, 234);
    doc.setDrawColor(red[0], red[1], red[2]);
    doc.roundedRect(M, y, W - 2 * M, 20, 2.5, 2.5, 'FD');
    doc.setTextColor(dim[0], dim[1], dim[2]); doc.setFontSize(10);
    doc.text(tr('pdf.total'), M + 6, y + 8);
    doc.setTextColor(red[0], red[1], red[2]); doc.setFontSize(17);
    doc.text((en ? 'from ' : 'от ') + sum, M + 6, y + 16);
    y += 32;

    /* контакты + QR */
    doc.setTextColor(ink[0], ink[1], ink[2]); doc.setFontSize(12);
    doc.text(tr('pdf.contacts'), M, y);
    doc.setFontSize(10.5); doc.setTextColor(dim[0], dim[1], dim[2]);
    var cy = y + 7;
    CONTACTS.forEach(function (c) { doc.text(c, M, cy); cy += 6; });
    doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.textWithLink(en ? 'Write on Telegram →' : 'Написать в Telegram →', M, cy, { url: TG });

    var qr = qrDataUrl(TG);
    if (qr) {
      doc.addImage(qr, 'PNG', W - M - 30, y - 2, 30, 30);
      doc.setFontSize(8); doc.setTextColor(dim[0], dim[1], dim[2]);
      doc.text('Telegram', W - M - 15, y + 32, { align: 'center' });
    }

    /* дисклеймер */
    doc.setFontSize(8.5); doc.setTextColor(dim[0], dim[1], dim[2]);
    var dl = doc.splitTextToSize(tr('pdf.disclaimer'), W - 2 * M);
    doc.text(dl, M, 280);
    doc.setTextColor(dim[0], dim[1], dim[2]); doc.setFontSize(8.5);
    doc.text(tr('pdf.company'), M, 290);

    doc.save((en ? 'Urartu-AI-estimate' : 'Urartu-AI-smeta') + '.pdf');
  }

  function onPdfClick(btn) {
    if (!window.OSCalc || !window.OSCalc.estimate) return;
    var prev = btn.textContent;
    btn.disabled = true; btn.textContent = '…';
    ensurePdfLibs().then(function () {
      try { buildPdf(window.OSCalc.estimate()); } catch (e) { if (window.console) console.warn('pdf', e); }
      btn.disabled = false; btn.textContent = prev;
    }, function () { btn.disabled = false; btn.textContent = prev; });
  }
  (function bindPdf() {
    var btn = $('calcPdf');
    if (btn) btn.addEventListener('click', function () { onPdfClick(btn); });
  })();

  /* ============================================================
     5) СЛАЙДЕР «ЧЕЛОВЕК vs ИИ-СОТРУДНИК» (CountUp)
     ============================================================ */
  (function humanVsAi() {
    var range = $('hvaiRange');
    if (!range) return;
    var IMPL = 200000, SUPPORT = 15000, TAX = 1.302;
    var els = {
      salary: $('hvaiSalary'), human: $('hvaiHuman'), ai: $('hvaiAi'),
      save: $('hvaiSave'), pay: $('hvaiPay')
    };
    var cu = {}; // CountUp-инстансы по id
    var cuReady = false, cuAsked = false;
    function ensureCountUp() { // лениво: только при взаимодействии со слайдером
      if (cuAsked) return; cuAsked = true;
      loadScript('vendor/countup.umd.js').then(function () { cuReady = true; }).catch(function () {});
    }

    function setMoney(el, key, rub, animate) {
      if (!el) return;
      if (cuReady && !reduceMotion && animate !== false && window.countUp && window.countUp.CountUp) {
        var target = (lang() === 'en') ? Math.round(rub / 100) : Math.round(rub);
        var opts = { duration: 0.5, formattingFn: function (v) { return (lang() === 'en') ? '$' + fmtComma(v) : fmtSpace(v) + ' ₽'; } };
        if (cu[key]) { cu[key].update(target); return; }
        var inst = new window.countUp.CountUp(el, target, opts);
        if (!inst.error) { cu[key] = inst; inst.start(); return; }
      }
      el.textContent = money(rub);
    }

    function compute(animate) {
      var s = parseInt(range.value, 10) || 150000;
      var human = Math.round(s * 12 * TAX);
      var ai = IMPL + 12 * SUPPORT;
      var save = human - ai;
      var monthlySave = s * TAX - SUPPORT;
      var pay = monthlySave > 0 ? Math.max(1, Math.ceil(IMPL / monthlySave)) : 0;
      if (els.salary) els.salary.textContent = money(s) + '/' + (lang() === 'en' ? 'mo' : 'мес');
      setMoney(els.human, 'human', human, animate);
      setMoney(els.ai, 'ai', ai, animate);
      setMoney(els.save, 'save', Math.max(0, save), animate);
      if (els.pay) els.pay.textContent = pay;
    }

    range.addEventListener('input', function () { ensureCountUp(); compute(true); });
    range.addEventListener('pointerdown', ensureCountUp);
    document.addEventListener('i18n:change', function () { cu = {}; compute(false); });
    compute(false);
  })();

  /* ---------- старт ---------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybeAutoTour);
  } else {
    maybeAutoTour();
  }
})();
