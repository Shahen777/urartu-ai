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

  function probe(b) {
    return fetch(b + '/api/health', { method: 'GET' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return !!(j && j.ok && j.has_key); })
      .catch(function () { return false; });
  }

  function available() {
    if (healthy !== null && (Date.now() - checkedAt) < 60000) return Promise.resolve(healthy);
    if (base !== null) {
      return probe(base).then(function (ok) { healthy = ok; checkedAt = Date.now(); return ok; });
    }
    /* без явного адреса: если сайт и агент опубликованы на одном хосте
       (напр. сайт-ОС и агент развёрнуты вместе на VPS), находим агента
       рядом — на том же домене, без ручной настройки. */
    if (!sameOriginTried) {
      sameOriginTried = true;
      return probe('').then(function (ok) {
        healthy = ok; checkedAt = Date.now();
        if (ok) base = '';
        return ok;
      });
    }
    healthy = false; checkedAt = Date.now();
    return Promise.resolve(false);
  }

  function reply(agent, message, history, voice) {
    if (base === null) return Promise.reject('no-api');
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 55000) : 0;
    return fetch(base + '/api/voice', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl && ctrl.signal,
      body: JSON.stringify({
        agent: agent || 'secretary', message: message || '', history: (history || []).slice(-10),
        voice: voice !== false, lang: (window.__lang === 'en') ? 'en' : 'ru'
      })
    }).then(function (r) { if (t) clearTimeout(t); if (!r.ok) throw r.status; return r.json(); });
  }

  window.AgentAPI = {
    base: function () { return base; },
    setBase: function (u) { base = norm(u); healthy = null; try { localStorage.setItem('urartu_agent_api', base); } catch (e) {} },
    available: available,
    reply: reply
  };
})();
