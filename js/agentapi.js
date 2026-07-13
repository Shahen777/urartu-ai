/* ============================================================
   agentapi.js — клиент «умного голосового агента» (бэкенд Urartu Voice Agent).
   Мозг: kie.ai LLM (свободный разговор + продажи). Голос: edge-tts.
   Ключ живёт на сервере — в браузер не попадает.
   Если сервис не задан/недоступен — сайт откатывается на локальную модель
   и заготовки (сайт всегда работает).

   Адрес API: ?agent=<url> в ссылке, либо localStorage 'urartu_agent_api',
   либо по умолчанию http://<host>:8787 при локальном (http) запуске сайта.
   На публичном https-сайте localhost недоступен → авто-fallback.

   Наружу: window.AgentAPI { base(), setBase(url), available()→Promise<bool>,
            reply(agent,message,history,voice)→Promise<{text,audio}> }
   ============================================================ */
(function () {
  'use strict';
  if (window.AgentAPI) return;

  function norm(u) { return (u || '').replace(/\/+$/, ''); }
  var base = (function () {
    try {
      var q = new URLSearchParams(location.search).get('agent');
      if (q) { localStorage.setItem('urartu_agent_api', q); return norm(q); }
    } catch (e) {}
    try { var s = localStorage.getItem('urartu_agent_api'); if (s) return norm(s); } catch (e) {}
    /* дефолт только для локального (http) запуска — иначе mixed-content на https */
    if (location.protocol === 'http:') return 'http://' + (location.hostname || 'localhost') + ':8787';
    return null;
  })();

  var healthy = null;         // null=неизвестно, true, false
  var checkedAt = 0;
  var sameOriginTried = false;
  var pendingProbe = null;    // in-flight промис — гасит параллельные дубли /api/health

  /* Статический хостинг (GitHub Pages) — бэкенда рядом заведомо нет: искать его
     бессмысленно, а 404 всё равно попадёт в консоль (fetch логирует его до
     нашего .catch). Сразу идём в fallback на локальную модель. */
  function staticHost() { return /(^|\.)github\.io$/i.test(location.hostname); }

  /* Адрес агента «рядом» — от папки сайта, а не от корня домена: сайт может
     жить в подпути (/urartu-ai/), и тогда агент публикуется там же. */
  function sameOriginBase() {
    return norm(location.origin + location.pathname.replace(/[^/]*$/, ''));
  }

  function probe(b) {
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 7000) : 0;
    return fetch(b + '/api/health', { method: 'GET', signal: ctrl && ctrl.signal })
      .then(function (r) { if (t) clearTimeout(t); return r.ok ? r.json() : null; })
      .then(function (j) { return !!(j && j.ok && j.has_key); })
      .catch(function () { if (t) clearTimeout(t); return false; });
  }

  /* pendingProbe освобождается ВСЕГДА — и при успехе, и при обрыве по
     таймауту — иначе повисший /api/health навсегда блокирует available()
     (и все места сайта, которые её вызывают) до перезагрузки страницы. */
  function available() {
    if (healthy !== null && (Date.now() - checkedAt) < 60000) return Promise.resolve(healthy);
    if (pendingProbe) return pendingProbe;
    if (base !== null) {
      pendingProbe = probe(base).then(function (ok) { healthy = ok; checkedAt = Date.now(); pendingProbe = null; return ok; });
      return pendingProbe;
    }
    /* без явного адреса: если сайт и агент опубликованы на одном хосте
       (напр. сайт-ОС и агент развёрнуты вместе на VPS), находим агента
       рядом — на том же домене, без ручной настройки. */
    if (!sameOriginTried && !staticHost()) {
      sameOriginTried = true;
      var origin = sameOriginBase();
      pendingProbe = probe(origin).then(function (ok) {
        healthy = ok; checkedAt = Date.now(); pendingProbe = null;
        if (ok) base = origin;
        return ok;
      });
      return pendingProbe;
    }
    healthy = false; checkedAt = Date.now();
    return Promise.resolve(false);
  }

  function reply(agent, message, history, voice, extSignal) {
    if (base === null) return Promise.reject('no-api');
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 55000) : 0;
    /* extSignal — необязательный внешний сигнал отмены (напр. диспетчер
       агентов хочет реально прервать fetch, когда его локальный таймаут
       выигрывает гонку, а не просто игнорировать результат впустую тратя
       платный запрос к kie.ai) — компонуем вручную (без AbortSignal.any,
       не везде поддерживается) поверх внутреннего 55с-таймера. */
    var onExtAbort = null;
    if (ctrl && extSignal) {
      if (extSignal.aborted) { try { ctrl.abort(); } catch (e) {} }
      else { onExtAbort = function () { try { ctrl.abort(); } catch (e) {} }; extSignal.addEventListener('abort', onExtAbort); }
    }
    function cleanup() { if (t) clearTimeout(t); if (onExtAbort) { try { extSignal.removeEventListener('abort', onExtAbort); } catch (e) {} } }
    return fetch(base + '/api/voice', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl && ctrl.signal,
      body: JSON.stringify({
        agent: agent || 'secretary', message: message || '', history: (history || []).slice(-10),
        voice: voice !== false, lang: (window.__lang === 'en') ? 'en' : 'ru'
      })
    }).then(function (r) { cleanup(); if (!r.ok) throw r.status; return r.json(); },
            function (err) { cleanup(); throw err; });
  }

  function tts(text, voice) {
    if (base === null) return Promise.reject('no-api');
    return fetch(base + '/api/tts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text || '', voice: voice || 'ru-RU-SvetlanaNeural' })
    }).then(function (r) { if (!r.ok) throw r.status; return r.json(); });
  }

  window.AgentAPI = {
    base: function () { return base; },
    setBase: function (u) { base = norm(u); healthy = null; try { localStorage.setItem('urartu_agent_api', base); } catch (e) {} },
    available: available,
    reply: reply,
    tts: tts
  };
})();
