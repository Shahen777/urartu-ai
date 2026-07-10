/* ============================================================
   voice.js — «Живой голос»: управление нейросетевым TTS (VITS).
   Загружается ЛЕНИВО (только после явной кнопки) — на старте
   страницы этого файла нет. Синтез идёт в module-worker
   (vendor/vits/vits-worker.mjs); если браузер не умеет module-worker —
   фолбэк на главный поток через dynamic import.

   Наружу: window.NeuralVoice
     state()   → 'off' | 'loading' | 'ready' | 'error'
     cached()  → Promise<bool>  (модель уже в CacheStorage?)
     enable(onProgress) → Promise (скачивание + прогрев)
     speak(text, onEnd) → очередь по предложениям, стриминг
     stop() · speaking() · rms()  (огибающая 0..1 для липсинка)
   ============================================================ */
(function () {
  'use strict';
  if (window.NeuralVoice) return;

  /* V7.2: выбор диктора — женский по умолчанию + два мужских дикторских
     (обучены на корпусе RUSLAN, чистая лицензия). Каждый — своя модель
     ~60 МБ, качается по явному действию и кешируется отдельно. */
  var VOICES = [
    { id: 'irina',  model: 'ru_RU-irina-medium',  key: 'nv.v.irina' },
    { id: 'dmitri', model: 'ru_RU-dmitri-medium', key: 'nv.v.dmitri' },
    { id: 'ruslan', model: 'ru_RU-ruslan-medium', key: 'nv.v.ruslan' }
  ];
  function savedVoice() {
    var v = null;
    try { v = localStorage.getItem('nvVoice'); } catch (e) {}
    for (var i = 0; i < VOICES.length; i++) if (VOICES[i].id === v) return VOICES[i];
    return VOICES[0];
  }
  var CUR = savedVoice();
  var VOICE_RU = CUR.model;

  var base = document.currentScript ? document.currentScript.src : location.href;
  var WORKER_URL = new URL('../vendor/vits/vits-worker.mjs', base).href;
  var ENGINE_URL = new URL('../vendor/vits/vits-engine.mjs', base).href;

  var state = 'off';
  var worker = null;      // транспорт №1: module-worker
  var engine = null;      // транспорт №2: движок в главном потоке
  var seq = 0;
  var pending = {};       // id → {resolve, reject, onProgress}

  var ctx = null, analyser = null, gainNode = null;
  var curSrc = null, playToken = 0, isSpeaking = false;
  var tdBuf = null;

  /* ---------- транспорт ---------- */
  function onWorkerMessage(e) {
    var m = e.data || {};
    var p = pending[m.id];
    if (!p) return;
    if (m.type === 'progress') { if (p.onProgress) p.onProgress(m); return; }
    delete pending[m.id];
    if (m.type === 'error') p.reject(new Error(m.message));
    else p.resolve(m);
  }

  function rpc(msg, onProgress, transfer) {
    return new Promise(function (resolve, reject) {
      var id = ++seq;
      pending[id] = { resolve: resolve, reject: reject, onProgress: onProgress };
      msg.id = id;
      try { worker.postMessage(msg, transfer || []); }
      catch (err) { delete pending[id]; reject(err); }
    });
  }

  function dynImport(u) {
    /* обёртка, чтобы старые парсеры не спотыкались об import() */
    return (new Function('u', 'return import(u)'))(u);
  }

  var transportReady = null;
  function initTransport() {
    if (transportReady) return transportReady;
    transportReady = new Promise(function (resolve) {
      var w = null;
      try { w = new Worker(WORKER_URL, { type: 'module' }); } catch (e) { w = null; }
      if (!w) { resolve(false); return; }
      var ok = false;
      var t = setTimeout(function () { if (!ok) { try { w.terminate(); } catch (e) {} resolve(false); } }, 6000);
      w.onerror = function () { if (!ok) { clearTimeout(t); try { w.terminate(); } catch (e) {} resolve(false); } };
      w.onmessage = function (e) {
        if (e.data && e.data.type === 'pong' && !ok) {
          ok = true; clearTimeout(t);
          worker = w;
          worker.onmessage = onWorkerMessage;
          worker.onerror = null;
          resolve(true);
        }
      };
      w.postMessage({ type: 'ping', id: 0 });
    }).then(function (hasWorker) {
      if (hasWorker) return true;
      /* фолбэк: главный поток */
      return dynImport(ENGINE_URL).then(function (mod) { engine = mod; return true; });
    });
    return transportReady;
  }

  /* ---------- операции ---------- */
  function cached() {
    return initTransport().then(function () {
      if (worker) return rpc({ type: 'cached', voice: VOICE_RU }).then(function (m) { return !!m.value; });
      return engine.isCached(VOICE_RU);
    }).catch(function () { return false; });
  }

  function ensureAudio() {
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('No AudioContext');
    ctx = new AC();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    gainNode = ctx.createGain();
    analyser.connect(gainNode);
    gainNode.connect(ctx.destination);
    tdBuf = new Float32Array(analyser.fftSize);
  }

  var enabling = null;
  function enable(onProgress) {
    if (state === 'ready') return Promise.resolve();
    if (enabling) return enabling;
    state = 'loading';
    try { ensureAudio(); } catch (e) { /* без липсинк-анализа тоже можно */ }
    enabling = initTransport().then(function () {
      var prog = function (m) { if (onProgress) onProgress(m); };
      if (worker) return rpc({ type: 'ensure', voice: VOICE_RU }, prog);
      return engine.ensure(VOICE_RU, prog);
    }).then(function () {
      state = 'ready'; enabling = null;
    }, function (err) {
      state = 'error'; enabling = null;
      throw err;
    });
    return enabling;
  }

  function synthOne(text) {
    if (worker) return rpc({ type: 'synth', text: text });
    return engine.synth(text).then(function (r) { return { pcm: r.pcm, sampleRate: r.sampleRate }; });
  }

  function splitSentences(t) {
    var m = String(t).match(/[^.!?…]+[.!?…]+["»)\]]?\s*|[^.!?…]+$/g);
    var out = [];
    (m || [String(t)]).forEach(function (s) { s = s.trim(); if (s) out.push(s); });
    return out.length ? out : [String(t)];
  }

  function playChunk(a, tok) {
    return new Promise(function (res) {
      if (!ctx || tok !== playToken || !a || !a.pcm || !a.pcm.length) { res(); return; }
      var buf = ctx.createBuffer(1, a.pcm.length, a.sampleRate);
      buf.getChannelData(0).set(a.pcm);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(analyser);
      curSrc = src;
      src.onended = function () { if (curSrc === src) curSrc = null; res(); };
      try { if (ctx.state === 'suspended') ctx.resume(); } catch (e) {}
      try { src.start(); } catch (e) { res(); }
    });
  }

  /* очередь: пока звучит предложение N, N+1 уже синтезируется */
  function speak(text, onEnd) {
    if (state !== 'ready') { if (onEnd) onEnd(); return Promise.resolve(); }
    stop();
    var tok = ++playToken;
    isSpeaking = true;
    var parts = splitSentences(text);
    var i = 0;
    var next = synthOne(parts[0]);

    function step() {
      if (tok !== playToken) return Promise.resolve();
      return next.then(function (audio) {
        if (tok !== playToken) return;
        i++;
        next = (i < parts.length) ? synthOne(parts[i]) : null;
        return playChunk(audio, tok).then(function () {
          if (tok !== playToken) return;
          if (next) return step();
        });
      });
    }

    return step().catch(function (e) {
      console.warn('[NeuralVoice]', e);
    }).then(function () {
      if (tok === playToken) {
        isSpeaking = false;
        if (onEnd) onEnd();
      }
    });
  }

  function stop() {
    playToken++;
    isSpeaking = false;
    if (curSrc) { try { curSrc.stop(); } catch (e) {} curSrc = null; }
  }

  /* RMS-огибающая проигрываемого звука — для липсинка и анимации */
  function rms() {
    if (!analyser || !isSpeaking) return 0;
    analyser.getFloatTimeDomainData(tdBuf);
    var s = 0;
    for (var i = 0; i < tdBuf.length; i += 2) s += tdBuf[i] * tdBuf[i];
    var v = Math.sqrt(s / (tdBuf.length / 2));
    return Math.min(1, v * 4.5);
  }

  /* смена диктора: тянем (или берём из кеша) модель нового голоса и
     переключаемся; при ошибке остаёмся на прежнем */
  var switching = null;
  function setVoice(id, onProgress) {
    var v = null;
    for (var i = 0; i < VOICES.length; i++) if (VOICES[i].id === id) v = VOICES[i];
    if (!v) return Promise.reject(new Error('Unknown voice: ' + id));
    if (v.model === VOICE_RU && state === 'ready') return Promise.resolve();
    if (switching) return switching;
    stop();
    switching = initTransport().then(function () {
      var prog = function (m) { if (onProgress) onProgress(m); };
      if (worker) return rpc({ type: 'ensure', voice: v.model }, prog);
      return engine.ensure(v.model, prog);
    }).then(function () {
      CUR = v; VOICE_RU = v.model;
      try { localStorage.setItem('nvVoice', v.id); } catch (e) {}
      if (state !== 'ready') state = 'ready';
      switching = null;
    }, function (err) {
      switching = null;
      throw err;
    });
    return switching;
  }

  function voiceCached(id) {
    var v = null;
    for (var i = 0; i < VOICES.length; i++) if (VOICES[i].id === id) v = VOICES[i];
    if (!v) return Promise.resolve(false);
    return initTransport().then(function () {
      if (worker) return rpc({ type: 'cached', voice: v.model }).then(function (m) { return !!m.value; });
      return engine.isCached(v.model);
    }).catch(function () { return false; });
  }

  window.NeuralVoice = {
    state: function () { return state; },
    cached: cached,
    enable: enable,
    speak: speak,
    stop: stop,
    speaking: function () { return isSpeaking; },
    rms: rms,
    voices: function () { return VOICES.slice(); },
    voice: function () { return CUR; },
    setVoice: setVoice,
    voiceCached: voiceCached,
    get voiceId() { return VOICE_RU; }
  };
})();
