/* ============================================================
   scan.js — мобильное демо «Сканер документов».
   Чистый getUserMedia + canvas, БЕЗ зависимостей. Камера → снимок →
   «локальный ИИ обрабатывает на устройстве» → результат от Документоведа
   и Юриста. Фото никуда не отправляется (в памяти браузера).
   iOS: playsinline/muted/autoplay, facingMode environment, HTTPS, user-gesture.
   Наружу: window.Scanner { onOpen(), stop() }
   ============================================================ */
(function () {
  'use strict';
  if (window.Scanner) return;

  function lang() { return (window.__lang === 'en') ? 'en' : 'ru'; }
  function tr(k) { return (window.I18N && window.I18N.t) ? window.I18N.t(k, lang()) : k; }
  function L(ru, en) { return lang() === 'en' ? en : ru; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function root() { return document.getElementById('scanRoot'); }

  var stream = null, video = null, timers = [];
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function stop() {
    clearTimers();
    if (stream) { try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} stream = null; }
    video = null;
  }

  /* ---------- экран 1: интро ---------- */
  function renderIntro() {
    stop();
    var r = root(); if (!r) return;
    r.innerHTML =
      '<div class="scan__intro">' +
        '<div class="scan__ill" aria-hidden="true">' +
          '<svg width="120" height="120" viewBox="0 0 120 120" fill="none"><rect x="30" y="18" width="52" height="70" rx="7" fill="#fff" opacity=".08"/><rect x="30" y="18" width="52" height="70" rx="7" stroke="rgba(255,255,255,.35)" stroke-width="2"/><line x1="40" y1="36" x2="72" y2="36" stroke="rgba(255,255,255,.5)" stroke-width="3" stroke-linecap="round"/><line x1="40" y1="48" x2="72" y2="48" stroke="rgba(255,255,255,.5)" stroke-width="3" stroke-linecap="round"/><line x1="40" y1="60" x2="60" y2="60" stroke="rgba(255,255,255,.5)" stroke-width="3" stroke-linecap="round"/><g><path d="M70 78h10a9 9 0 0 1 9 9v13a5 5 0 0 1-5 5H66a5 5 0 0 1-5-5V87a9 9 0 0 1 9-9z" fill="#0a84ff"/><circle cx="75" cy="94" r="8" fill="none" stroke="#fff" stroke-width="3"/><rect x="66" y="75" width="12" height="6" rx="3" fill="#0a84ff"/></g></svg>' +
        '</div>' +
        '<h2 class="scan__h">' + esc(L('Сфотографируйте документ', 'Scan a document')) + '</h2>' +
        '<p class="scan__p">' + esc(L('Наведите камеру на договор или регламент — ИИ-Документовед и Юрист обработают его прямо на вашем телефоне.', 'Point your camera at a contract or policy — the AI Document expert and Lawyer process it right on your phone.')) + '</p>' +
        '<div class="scan__badge"><span class="scan__lock" aria-hidden="true">🔒</span>' + esc(L('Фото не покидает устройство — никакого облака.', 'The photo never leaves your device — no cloud.')) + '</div>' +
        '<button class="scan__go" id="scanGo" type="button">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8a2 2 0 0 1 2-2h1.5l1-2h5l1 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.5"/></svg>' +
          '<span>' + esc(L('Открыть камеру', 'Open camera')) + '</span></button>' +
      '</div>';
    var go = document.getElementById('scanGo');
    if (go) go.addEventListener('click', startCamera);
  }

  /* ---------- экран 2: камера ---------- */
  function startCamera() {
    var r = root(); if (!r) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { renderDenied('nocam'); return; }
    r.innerHTML =
      '<div class="scan__cam">' +
        '<video class="scan__video" id="scanVideo" playsinline muted autoplay></video>' +
        '<div class="scan__frame" aria-hidden="true"><i class="scan__c scan__c--tl"></i><i class="scan__c scan__c--tr"></i><i class="scan__c scan__c--bl"></i><i class="scan__c scan__c--br"></i><span class="scan__scan"></span></div>' +
        '<p class="scan__hint">' + esc(L('Наведите на документ и держите ровно', 'Aim at the document, hold steady')) + '</p>' +
        '<div class="scan__bar">' +
          '<button class="scan__x" id="scanBack" type="button" aria-label="' + esc(L('Назад', 'Back')) + '">✕</button>' +
          '<button class="scan__shoot" id="scanShoot" type="button" aria-label="' + esc(L('Снять', 'Capture')) + '"><span></span></button>' +
          '<span class="scan__sp"></span>' +
        '</div>' +
      '</div>';
    video = document.getElementById('scanVideo');
    document.getElementById('scanBack').addEventListener('click', renderIntro);
    document.getElementById('scanShoot').addEventListener('click', capture);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then(function (s) {
        stream = s;
        if (!video) { stop(); return; }
        video.srcObject = s;
        video.setAttribute('playsinline', ''); video.muted = true;
        var pl = video.play(); if (pl && pl.catch) pl.catch(function () {});
      })
      .catch(function () { renderDenied('denied'); });
  }

  function renderDenied(kind) {
    stop();
    var r = root(); if (!r) return;
    var msg = kind === 'nocam'
      ? L('Камера недоступна на этом устройстве. Откройте страницу на смартфоне.', 'Camera is unavailable on this device. Open the page on a phone.')
      : L('Нет доступа к камере. Разрешите камеру в настройках браузера и попробуйте снова.', 'No camera access. Allow the camera in your browser settings and try again.');
    r.innerHTML =
      '<div class="scan__intro">' +
        '<div class="scan__ill" aria-hidden="true"><svg width="90" height="90" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8a2 2 0 0 1 2-2h1.5l1-2h5l1 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.5"/><line x1="3" y1="3" x2="21" y2="21" stroke="#F3350C"/></svg></div>' +
        '<h2 class="scan__h">' + esc(L('Камера не открылась', 'Camera didn’t open')) + '</h2>' +
        '<p class="scan__p">' + esc(msg) + '</p>' +
        '<button class="scan__go" id="scanRetry" type="button"><span>' + esc(L('Попробовать снова', 'Try again')) + '</span></button>' +
      '</div>';
    var b = document.getElementById('scanRetry'); if (b) b.addEventListener('click', renderIntro);
  }

  /* ---------- снимок ---------- */
  function capture() {
    if (!video || !video.videoWidth) return;
    var vw = video.videoWidth, vh = video.videoHeight;
    /* кроп по «рамке документа»: центр, портрет ~3:4, 84% ширины */
    var cw = vw * 0.84, ch = cw * 1.32; if (ch > vh * 0.9) { ch = vh * 0.9; cw = ch / 1.32; }
    var sx = (vw - cw) / 2, sy = (vh - ch) / 2;
    var c = document.createElement('canvas'); c.width = Math.round(cw); c.height = Math.round(ch);
    var ctx = c.getContext('2d');
    ctx.drawImage(video, sx, sy, cw, ch, 0, 0, c.width, c.height);
    var url = c.toDataURL('image/jpeg', 0.85);
    stop();
    renderProcessing(url);
  }

  function renderProcessing(url) {
    var r = root(); if (!r) return;
    r.innerHTML =
      '<div class="scan__proc">' +
        '<div class="scan__shot"><img src="' + url + '" alt=""><span class="scan__laser"></span></div>' +
        '<div class="scan__procmsg"><span class="scan__dot"></span>' + esc(L('ИИ обрабатывает на устройстве…', 'AI is processing on-device…')) + '</div>' +
      '</div>';
    timers.push(setTimeout(function () { renderResult(url); }, 1900));
  }

  /* ---------- результат (демо: договор поставки) ---------- */
  function renderResult(url) {
    var r = root(); if (!r) return;
    var docName = tr('msg.n.documoved'), lawName = tr('msg.n.lawyer');
    var extract = [
      [L('Тип документа', 'Document type'), L('Договор поставки', 'Supply contract')],
      [L('Стороны', 'Parties'), L('2 — Поставщик и Покупатель', '2 — Supplier and Buyer')],
      [L('Срок оплаты', 'Payment term'), L('5 рабочих дней', '5 business days')],
      [L('Сумма', 'Amount'), L('1 250 000 ₽', '$14,900')]
    ];
    var risks = [
      ['warn', L('п. 4.2 — односторонний штраф в пользу поставщика', 'cl. 4.2 — one-sided penalty favouring the supplier')],
      ['warn', L('п. 7.1 — автопролонгация без уведомления', 'cl. 7.1 — auto-renewal without notice')],
      ['ok', L('Реквизиты и подписи на месте', 'Details and signatures are in order')]
    ];
    var exHtml = extract.map(function (e) { return '<div class="scan__row"><span>' + esc(e[0]) + '</span><b>' + esc(e[1]) + '</b></div>'; }).join('');
    var rkHtml = risks.map(function (x) {
      var ic = x[0] === 'ok' ? '<span class="scan__ok">✓</span>' : '<span class="scan__warn">!</span>';
      return '<li class="scan__risk scan__risk--' + x[0] + '">' + ic + '<span>' + esc(x[1]) + '</span></li>';
    }).join('');
    r.innerHTML =
      '<div class="scan__res">' +
        '<div class="scan__reshead"><img class="scan__resthumb" src="' + url + '" alt=""><div><h2 class="scan__h2">' + esc(L('Готово — вот что увидел ИИ', 'Done — here’s what the AI saw')) + '</h2><p class="scan__ressub">' + esc(L('Разобрано за 2 секунды, на вашем устройстве', 'Parsed in 2 seconds, on your device')) + '</p></div></div>' +
        '<div class="scan__card scan__card--doc">' +
          '<div class="scan__cardh"><img src="' + (window.Avatars ? window.Avatars.src('documoved', 'real') : 'avatars/documoved-real.webp') + '" alt=""><div><b>' + esc(docName) + '</b><span>' + esc(L('распознал документ', 'recognised the document')) + '</span></div></div>' +
          '<div class="scan__ex">' + exHtml + '</div>' +
        '</div>' +
        '<div class="scan__card scan__card--law">' +
          '<div class="scan__cardh"><img src="' + (window.Avatars ? window.Avatars.src('lawyer', 'real') : 'avatars/lawyer-real.webp') + '" alt=""><div><b>' + esc(lawName) + '</b><span>' + esc(L('проверил риски', 'checked for risks')) + '</span></div></div>' +
          '<ul class="scan__risks">' + rkHtml + '</ul>' +
        '</div>' +
        '<div class="scan__badge scan__badge--res"><span class="scan__lock" aria-hidden="true">🔒</span>' + esc(L('Всё посчитано на вашем телефоне. Фото не отправлено в интернет.', 'All computed on your phone. The photo was not sent anywhere.')) + '</div>' +
        '<div class="scan__acts">' +
          '<button class="scan__again" id="scanAgain" type="button">' + esc(L('Сканировать ещё', 'Scan again')) + '</button>' +
          '<button class="scan__cta" id="scanCta" type="button">' + esc(L('Записаться на пилот', 'Book a pilot')) + '</button>' +
        '</div>' +
      '</div>';
    var again = document.getElementById('scanAgain'); if (again) again.addEventListener('click', renderIntro);
    var cta = document.getElementById('scanCta'); if (cta) cta.addEventListener('click', function () { if (window.OS) window.OS.open('win-calendar', cta); });
  }

  function onOpen() { renderIntro(); }

  /* остановить камеру, если окно закрыли/спрятали или вкладку скрыли */
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });
  document.addEventListener('i18n:change', function () {
    var r = root(); if (r && r.querySelector('.scan__intro, .scan__cam, .scan__proc, .scan__res')) {
      if (r.querySelector('.scan__cam')) return; // не рвём активную камеру
      renderIntro();
    }
  });

  window.Scanner = { onOpen: onOpen, stop: stop };
})();
