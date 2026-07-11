/* ============================================================
   Urartu AI — ЛОТ M: голосовое управление сайтом
   window.VoiceNav: кнопка-микрофон в меню-баре, плавающая панель,
   детерминированный парсер команд ru+en (открыть окно, закрыть,
   тема, язык, сценарии), фолбэк-диалог через LocalAI.
   Слух — webkitSpeechRecognition (честно: звук уходит в Google),
   включается ТОЛЬКО по клику. До клика — ноль внешних запросов.
   Чистый ES5, без зависимостей; ~13 КБ.
   ============================================================ */
(function () {
  'use strict';
  if (window.VoiceNav) return;

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function lang() { return (window.__lang === 'en') ? 'en' : 'ru'; }
  function tr(k) { return (window.I18N && window.I18N.t) ? window.I18N.t(k, lang()) : k; }
  function $(id) { return document.getElementById(id); }
  function isMobile() { return window.matchMedia('(max-width: 1023px)').matches; }

  /* ============================================================
     K2 — ГРАММАТИКА: таблица окон с синонимами.
     Строка — подстрока-стем ('тариф' ловит «тарифы»);
     префикс '=' — совпадение целого слова ('=демо').
     Порядок важен: специфичные окна выше общих.
     ============================================================ */
  var WINS = [
    { id: 'win-how',       k: 'menu.how',       ru: ['как работает', 'как устроен', 'как это работает'], en: ['how it works', 'how does it work'] },
    { id: 'win-kb',        k: 'kb.title',       ru: ['база знаний', 'базу знаний', '=знания'], en: ['knowledge'] },
    { id: 'win-pricing',   k: 'menu.pricing',   ru: ['тариф', 'прайс', 'стоимост', 'расценк', '=цены', '=цену', '=цена'], en: ['pricing', 'price', 'tariff', '=plans', '=cost', '=costs'] },
    { id: 'win-pulse',     k: 'sb.pulse',       ru: ['дашборд', 'пульс', 'аналитик', 'метрик'], en: ['dashboard', 'pulse', 'analytic', 'metric'] },
    { id: 'win-call',      k: 'call.short',     ru: ['звонок', 'звонит', 'позвон', 'секретар'], en: ['=call', 'phone', 'secretary'] },
    { id: 'win-calendar',  k: 'mb.calendar',    ru: ['календар', '=демо', 'встреч'], en: ['calendar', '=demo', 'meeting', 'appointment'] },
    { id: 'win-assistant', k: 'menu.assistant', ru: ['ассистент', 'сообщени', '=чат', 'мессенджер', 'переписк'], en: ['assistant', 'message', '=chat', 'messenger'] },
    { id: 'win-staff',     k: 'mb.staff',       ru: ['сотрудник', '=штат', 'команд'], en: ['staff', 'employee', '=team'] },
    { id: 'win-services',  k: 'menu.services',  ru: ['услуг', 'сервис'], en: ['service'] },
    { id: 'win-devices',   k: 'mb.devices',     ru: ['устройств', 'железо', 'компьютер', 'сервер', 'оборудован'], en: ['device', 'hardware', 'computer', 'server'] },
    { id: 'win-portfolio', k: 'menu.portfolio', ru: ['портфолио', 'кейс', '=работы'], en: ['portfolio', '=cases', '=works'] },
    { id: 'win-faq',       k: 'menu.faq',       ru: ['вопрос', '=faq'], en: ['question', '=faq'] },
    { id: 'win-appstore',  k: 'mb.appstore',    ru: ['приложени', 'магазин', 'апстор'], en: ['app store', '=apps', '=store'] },
    { id: 'win-factory',   k: 'fab.title',      ru: ['фабрик', 'контент', 'генератор'], en: ['factory', 'content', 'generator'] },
    { id: 'win-game',      k: 'mb.game',        ru: ['=игра', '=игру', 'сыгра', 'поигра'], en: ['=game', '=play'] },
    { id: 'win-agents',    k: 'agents.short',   ru: ['агент', '=3d', '=офис'], en: ['agent', '=3d', '=office'] },
    { id: 'win-about',     k: 'menu.about',     ru: ['о нас', 'о компани', 'гарант'], en: ['about', 'guarantee'] },
    { id: 'win-mail',      k: 'menu.mail',      ru: ['контакт', 'почт', 'связ'], en: ['contact', '=mail', 'email'] },
    { id: 'win-terminal',  k: 'sb.terminal',    ru: ['терминал', 'консол'], en: ['terminal', 'console'] },
    { id: 'win-calc',      k: 'mb.calc',        ru: ['калькулятор', 'смет'], en: ['calculator', 'estimate'] },
    { id: 'win-reg',       k: 'reg.title',      ru: ['регламент'], en: ['regulation', 'policies'] },
    { id: 'win-who',       k: 'menu.who',       ru: ['=кому', 'подходит'], en: ['who it', 'who is it for'] },
    { id: 'win-trash',     k: 'trash.title',    ru: ['корзин'], en: ['trash', '=bin'] },
    { id: 'win-readme',    k: null,             ru: ['=readme', 'главную', 'главная'], en: ['=readme', '=home'] }
  ];

  /* глаголы и системные шаблоны */
  var RE = {
    stop:     /(выключи микрофон|выключи прослушивание|хватит слушать|перестань слушать|стоп прослушивани|stop listening|turn off the mic|mute yourself)/,
    search:   /(?:^|\s)(?:поиск|найди|поищи|search for|search|find)\s+(.+)$/,
    verb:     /(открой|открыть|покажи|показать|запусти|запустить|включи|включить|перейди|перейти|зайди|open|show me|show|launch|go to)/,
    close:    /(закрой|закрыть|close)/,
    min:      /(сверни|свернуть|minimi[sz]e)/,
    max:      /(весь экран|полный экран|разверни|развернуть|maximi[sz]e|full ?screen)/,
    dark:     /(темн|ночн|dark|night)/,
    light:    /(светл|дневн|light)/,
    themeSw:  /(смени|переключи|поменяй|toggle|switch|change)/,
    langEn:   /(по.английски|на английск|английский|english)/,
    langRu:   /(по.русски|на русск|русский|russian)/,
    cc:       /(пункт управления|центр управления|control cent)/,
    callSec:  /(позвони|соедини|набери|call|connect me|dial)/,
    secr:     /(секретар|secretary)/,
    demoVerb: /(запиши|запишите|записаться|запись на|book|schedule|sign me up)/,
    contract: /(провер|check|review)/,
    contrObj: /(договор|контракт|документ|contract|agreement)/,
    howMuch:  /(сколько стоит|сколько это стоит|почем|how much|what does it cost|what's the price)/,
    next:     /(следующ\S* страниц|страницу дальше|листай дальше|next page)/,
    prev:     /(предыдущ\S* страниц|страницу назад|previous page)/,
    up:       /(наверх|в начало|to the top|scroll up|go up)/,
    help:     /(что ты умеешь|что умеешь|список команд|голосовые команды|help|what can you do|list commands)/,
    repeat:   /(повтори|что ты сказал|скажи ещё раз|repeat that|say that again|what did you say)/,
    timeQ:    /(который час|сколько времени|скажи время|what time is it|current time)/,
    dateQ:    /(какое сегодня число|какой сегодня день|what.?s the date|today.?s date)/,
    reload:   /(обнови страницу|перезагрузи страницу|перезапусти сайт|refresh the page|reload the page)/,
    interrupt:/(замолчи|тихо|хватит говорить|stop talking|shut up|cancel that)/
  };

  /* списки токенов там, где нужна граница слова у кириллицы (regex \b
     работает только с латиницей) */
  var TOK_ALL   = ['=все', '=all', 'everything'];
  var TOK_THEME = ['=тема', '=тему', '=темы', '=теме', 'theme', '=mode', 'режим'];
  var TOK_DEMO  = ['=демо', 'встреч', '=время', '=demo', 'meeting', '=time', '=slot'];

  function norm(s) {
    s = String(s || '').toLowerCase().replace(/ё/g, 'е');
    return s.replace(/[.,!?;:«»„“"()’']/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function hasTok(text, tok) {
    if (tok.charAt(0) === '=') return (' ' + text + ' ').indexOf(' ' + tok.slice(1) + ' ') > -1;
    return text.indexOf(tok) > -1;
  }
  function hasList(text, list) {
    for (var i = 0; i < list.length; i++) if (hasTok(text, list[i])) return true;
    return false;
  }

  function findWin(text) {
    var order = (lang() === 'ru') ? ['ru', 'en'] : ['en', 'ru'];
    for (var p = 0; p < 2; p++) {
      for (var i = 0; i < WINS.length; i++) {
        var syns = WINS[i][order[p]] || [];
        for (var j = 0; j < syns.length; j++) if (hasTok(text, syns[j])) return WINS[i];
      }
    }
    return null;
  }
  function winName(entry) { return entry.k ? tr(entry.k) : 'README'; }

  /* ---------- ПАРСЕР: текст → команда (детерминированно) ---------- */
  function parse(raw) {
    var t = norm(raw).replace(/\b(пожалуйста|please)\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t) return null;
    var m;

    if (RE.interrupt.test(t)) return { t: 'interrupt' };
    if (RE.stop.test(t)) return { t: 'stopListen' };
    if (RE.help.test(t)) return { t: 'help' };
    if (RE.repeat.test(t)) return { t: 'repeat' };
    if (RE.timeQ.test(t)) return { t: 'time' };
    if (RE.dateQ.test(t)) return { t: 'date' };
    if (RE.reload.test(t)) return { t: 'reload' };

    /* прямые сценарии — раньше открытия окон */
    if (RE.callSec.test(t) && RE.secr.test(t)) return { t: 'call' };
    if (RE.demoVerb.test(t) && (hasList(t, TOK_DEMO) || /запиши меня|запишите меня|book me/.test(t))) return { t: 'demo' };
    if (RE.contract.test(t) && RE.contrObj.test(t)) return { t: 'contract' };
    if (RE.howMuch.test(t)) return { t: 'open', w: byId('win-pricing') };
    if ((m = RE.search.exec(t))) return { t: 'search', q: m[1].trim() };

    /* система */
    if (hasList(t, TOK_THEME)) {
      if (RE.dark.test(t)) return { t: 'theme', v: 'dark' };
      if (RE.light.test(t)) return { t: 'theme', v: 'light' };
      if (RE.themeSw.test(t)) return { t: 'theme', v: 'toggle' };
    }
    if (RE.langEn.test(t)) return { t: 'lang', v: 'en' };
    if (RE.langRu.test(t)) return { t: 'lang', v: 'ru' };
    if (RE.cc.test(t)) return { t: 'cc' };

    /* действия с окнами */
    if (RE.close.test(t)) {
      if (hasList(t, TOK_ALL)) return { t: 'closeAll' };
      return { t: 'close', w: findWin(t) };
    }
    if (RE.min.test(t)) return { t: 'min', w: findWin(t) };
    if (RE.max.test(t)) return { t: 'max', w: findWin(t) };
    if (RE.next.test(t)) return { t: 'page', v: 1 };
    if (RE.prev.test(t) || RE.up.test(t)) return { t: 'page', v: 0 };

    /* открыть окно: глагол + имя, либо просто имя (короткая фраза) */
    var w = findWin(t);
    if (w && (RE.verb.test(t) || t.split(' ').length <= 4)) return { t: 'open', w: w };

    return null; /* → диалог-фолбэк */
  }
  function byId(id) {
    for (var i = 0; i < WINS.length; i++) if (WINS[i].id === id) return WINS[i];
    return null;
  }

  /* ============================================================
     ГОЛОС ПОДТВЕРЖДЕНИЯ: нейроголос (если загружен) → системный
     ============================================================ */
  var speaking = false, unlocked = false;
  function unlockTTS() {
    if (unlocked || !window.speechSynthesis) return;
    try {
      var u = new SpeechSynthesisUtterance(' ');
      u.volume = 0; u.rate = 2;
      speechSynthesis.speak(u);
      speechSynthesis.getVoices();
      unlocked = true;
    } catch (e) {}
  }
  /* тот же живой голос (edge-tts), что в звонке — только озвучка без «мозга»
     LLM (короткие подтверждения команд, не нужен разговор). Safari/iOS: звук
     разрешён только для элемента, разблокированного в жесте — переиспользуем
     ОДИН <audio>, разблокированный синхронно по клику на кнопку микрофона. */
  var agentAudioEl = null, agentAudioUnlocked = false;
  function unlockAgentAudio() {
    if (agentAudioUnlocked) return;
    try {
      if (!agentAudioEl) agentAudioEl = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=');
      agentAudioEl.volume = 0;
      var p = agentAudioEl.play();
      /* флаг только при реальном успехе — иначе следующий настоящий тап
         сможет повторить попытку (иначе автоплей молча остаётся заблокирован
         на всю сессию, а код думает, что звук разрешён) */
      if (p && p.then) p.then(function () { agentAudioUnlocked = true; }, function () {});
      else agentAudioUnlocked = true;
    } catch (e) {}
  }
  function rank(v) {
    var n = v.name || '';
    if (/enhanced|premium|siri|neural/i.test(n)) return 0;
    if (v.localService === false || /google/i.test(n)) return 1;
    if (/milena/i.test(n)) return 3;
    return 2;
  }
  function pickVoice() {
    if (!window.speechSynthesis) return null;
    var want = (lang() === 'en') ? /^en/i : /^ru/i;
    var vs = speechSynthesis.getVoices().filter(function (v) { return want.test(v.lang); });
    if (!vs.length) return null;
    var saved = null;
    try { saved = localStorage.getItem('aiVoice'); } catch (e) {}
    if (saved) for (var i = 0; i < vs.length; i++) if (vs[i].name === saved) return vs[i];
    return vs.slice().sort(function (a, b) { return rank(a) - rank(b); })[0];
  }

  function speak(text, then) {
    /* сперва настоящий живой голос (edge-tts, тот же, что в звонке) —
       если бэкенд-агент доступен; иначе — прежний VITS/системный путь */
    if (window.AgentAPI && lang() === 'ru') {
      window.AgentAPI.available().then(function (ok) {
        if (!ok) { speakFallback(text, then); return; }
        pauseRec(); speaking = true; syncDot();
        var finished = false;
        var done = function () {
          if (finished) return; finished = true;
          speaking = false; syncDot();
          if (then) { try { then(); } catch (e) {} }
          resumeRec();
        };
        window.AgentAPI.tts(text, 'ru-RU-SvetlanaNeural').then(function (r) {
          if (!r || !r.audio) { finished = true; speaking = false; syncDot(); speakFallback(text, then); return; }
          var a = agentAudioEl || new Audio(); a.volume = 1;
          a.onended = done; a.onerror = function () { finished = true; speaking = false; syncDot(); speakFallback(text, then); };
          a.src = r.audio;
          var p = a.play(); if (p && p.catch) p.catch(function () { finished = true; speaking = false; syncDot(); speakFallback(text, then); });
        }, function () { finished = true; speaking = false; syncDot(); speakFallback(text, then); });
      });
      return;
    }
    speakFallback(text, then);
  }

  /* прежний путь: нейроголос VITS (если загружен) → системный синтез */
  function speakFallback(text, then) {
    pauseRec(); /* K3 — не ловить собственный TTS */
    speaking = true; syncDot();
    var finished = false;
    var done = function () {
      if (finished) return;
      finished = true;
      speaking = false; syncDot();
      if (then) { try { then(); } catch (e) {} }
      resumeRec();
    };
    /* нейроголос VITS — если загружен и язык русский */
    if (window.NV && window.NV.ready && window.NV.ready() && lang() === 'ru' && window.NeuralVoice) {
      window.NeuralVoice.speak(text, done);
      return;
    }
    if (!window.speechSynthesis) { setTimeout(done, 250); return; }
    try { speechSynthesis.cancel(); } catch (e) {}
    var u = new SpeechSynthesisUtterance(text);
    u.lang = (lang() === 'en') ? 'en-US' : 'ru-RU';
    var v = pickVoice();
    try { if (v) u.voice = v; } catch (e) {}
    u.onend = u.onerror = done;
    setTimeout(function () {
      try { speechSynthesis.resume(); speechSynthesis.speak(u); } catch (e) { done(); }
    }, 60);
    /* сторож: фраза не зазвучала / браузер проглотил */
    setTimeout(function () { if (!finished && !speechSynthesis.speaking) done(); }, 2500);
    setTimeout(function () { if (!finished) done(); }, 15000);
  }

  /* ============================================================
     СЛУХ: webkitSpeechRecognition, continuous + interim
     ============================================================ */
  var on = false, rec = null;
  function startRec() {
    if (!SR || rec) return;
    var r = new SR();
    r.lang = (lang() === 'en') ? 'en-US' : 'ru-RU';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = function (e) {
      var interim = '', fin = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var res = e.results[i];
        if (res.isFinal) fin += res[0].transcript; else interim += res[0].transcript;
      }
      if (interim && !speaking) setHeard(interim, false);
      if (fin && !speaking) { setHeard(fin, true); handle(fin); } /* K3 — исполняем только isFinal */
    };
    r.onerror = function (e) {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        stopListen();
        note('vn.denied');
      }
    };
    r.onend = function () {
      if (rec === r) rec = null;
      if (on && !speaking) setTimeout(function () { if (on && !speaking) startRec(); }, 200);
    };
    rec = r;
    try { r.start(); } catch (e) { rec = null; }
  }
  function pauseRec() {
    if (rec) { var r = rec; rec = null; try { r.onend = null; r.stop(); } catch (e) {} }
  }
  function resumeRec() {
    if (on && !speaking) setTimeout(function () { if (on && !speaking && !rec) startRec(); }, 250);
  }

  /* ============================================================
     ПАНЕЛЬ (K3): статус, распознанный текст, примеры, стоп, ввод
     ============================================================ */
  var panel, heardEl, actEl, noteEl;
  function panelOpen() { return panel && !panel.hidden; }
  function showPanel() {
    if (!panel || panelOpen()) return;
    panel.hidden = false;
    void panel.offsetHeight;
    panel.classList.add('is-in');
    if (!SR) { note('vn.nosr'); var inp = $('vnInput'); if (inp) setTimeout(function () { try { inp.focus(); } catch (e) {} }, 80); }
  }
  function hidePanel() {
    if (!panelOpen()) return;
    panel.classList.remove('is-in');
    var fin = function () { if (!panel.classList.contains('is-in')) panel.hidden = true; };
    if (reduceMotion) fin(); else setTimeout(fin, 240);
  }
  function setHeard(text, isFinal) {
    if (!heardEl) return;
    heardEl.textContent = text;
    heardEl.classList.toggle('is-final', !!isFinal);
  }
  function setAct(text) {
    if (actEl) actEl.textContent = text || '';
  }
  function note(key) {
    if (!noteEl) return;
    if (!key) { noteEl.hidden = true; noteEl.textContent = ''; return; }
    noteEl.hidden = false;
    noteEl.setAttribute('data-i18n', key);
    noteEl.textContent = tr(key);
  }
  function syncDot() {
    if (!panel) return;
    panel.classList.toggle('is-listening', on && !speaking);
    panel.classList.toggle('is-speaking', speaking);
    var st = $('vnState');
    if (st) {
      var key = speaking ? 'vn.speak' : (on ? 'vn.listen' : 'vn.off');
      st.setAttribute('data-i18n', key);
      st.textContent = tr(key);
    }
    var b = $('vnBtn'); if (b) { b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    var sb = $('vnStop');
    if (sb) {
      var sk = on ? 'vn.stop' : 'vn.start';
      sb.setAttribute('data-i18n', sk);
      sb.textContent = tr(sk);
      sb.hidden = !SR;
    }
  }

  /* подсветка цели (K2): короткий пульс окна */
  function flash(el) {
    if (!el) return;
    el.classList.remove('vn-hi');
    void el.offsetWidth;
    el.classList.add('vn-hi');
    setTimeout(function () { el.classList.remove('vn-hi'); }, 1300);
  }

  /* ---------- ленивый localai.js для диалога-фолбэка ---------- */
  var aiQ = [], aiState = 0;
  function ensureAI(cb) {
    if (window.LocalAI) { try { cb(); } catch (e) {} return; }
    aiQ.push(cb);
    if (aiState === 1) return;
    aiState = 1;
    var s = document.createElement('script');
    s.src = 'js/localai.js';
    s.onload = s.onerror = function () {
      aiState = 2;
      var q = aiQ; aiQ = [];
      q.forEach(function (f) { try { f(); } catch (e) {} });
    };
    document.head.appendChild(s);
  }

  function localAskFallback(text) {
    ensureAI(function () {
      if (!window.LocalAI) return;
      var fin = function (res) {
        var t = (res && res.text) ? String(res.text) : '';
        t = t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (!t) return;
        setAct(t);
        speak(t);
      };
      if (window.LocalAI.askAsync) {
        window.LocalAI.askAsync('secretary', text, lang()).then(fin, function () { fin(window.LocalAI.ask('secretary', text, lang())); });
      } else fin(window.LocalAI.ask('secretary', text, lang()));
    });
  }

  /* свободный вопрос голосом: сначала настоящий агент (kie.ai LLM), тот же
     паттерн, что уже используется в чате/звонке — иначе честный офлайн-фолбэк */
  function fallbackAsk(text) {
    setAct(tr('vn.think'));
    if (window.AgentAPI) {
      window.AgentAPI.available().then(function (ok) {
        if (!ok) { localAskFallback(text); return; }
        window.AgentAPI.reply('secretary', text, [], false).then(function (r) {
          var t = (r && r.text) ? String(r.text).trim() : '';
          if (!t) { localAskFallback(text); return; }
          setAct(t);
          speak(t);
        }, function () { localAskFallback(text); });
      });
      return;
    }
    localAskFallback(text);
  }

  /* ============================================================
     ИСПОЛНЕНИЕ КОМАНД
     ============================================================ */
  function topWin() {
    var open = Array.prototype.slice.call(document.querySelectorAll('.win.is-open:not(.is-closing)'));
    if (!open.length) return null;
    open.sort(function (a, b) { return (+b.style.zIndex || 0) - (+a.style.zIndex || 0); });
    return open[0];
  }
  var lastSaid = '';
  function say(text) { lastSaid = text; setAct(text); speak(text); }

  function exec(cmd) {
    if (!cmd) return false;
    var el, name;
    switch (cmd.t) {
      case 'stopListen':
        stopListen();
        return true;

      case 'open':
        if (!cmd.w) return false;
        if (window.OS) window.OS.open(cmd.w.id, $('vnBtn'));
        flash($(cmd.w.id));
        say(tr('vn.open') + ' ' + winName(cmd.w));
        return true;

      case 'close':
        el = cmd.w ? $(cmd.w.id) : topWin();
        if (!el || !el.classList.contains('is-open')) { say(tr('vn.none')); return true; }
        name = cmd.w ? winName(cmd.w) : (byId(el.id) ? winName(byId(el.id)) : '');
        if (window.OS) window.OS.close(el.id);
        say(tr('vn.close.win') + (name ? ' ' + name : ''));
        return true;

      case 'closeAll':
        var opened = Array.prototype.slice.call(document.querySelectorAll('.win.is-open:not(.is-closing)'));
        if (!opened.length) { say(tr('vn.none')); return true; }
        opened.forEach(function (w) { if (window.OS) window.OS.close(w.id); });
        say(tr('vn.close.all'));
        return true;

      case 'min':
        el = cmd.w ? $(cmd.w.id) : topWin();
        if (!el || !el.classList.contains('is-open')) { say(tr('vn.none')); return true; }
        var mbtn = el.querySelector('[data-act="min"]');
        if (mbtn) mbtn.click();
        say(tr('vn.min'));
        return true;

      case 'max':
        el = cmd.w ? $(cmd.w.id) : topWin();
        if (!el || !el.classList.contains('is-open')) { say(tr('vn.none')); return true; }
        var xbtn = el.querySelector('[data-act="max"]');
        if (xbtn && !isMobile()) { xbtn.click(); flash(el); }
        say(tr('vn.max'));
        return true;

      case 'theme':
        var cur = document.documentElement.classList.contains('theme-light') ? 'light' : 'dark';
        var want = (cmd.v === 'toggle') ? (cur === 'light' ? 'dark' : 'light') : cmd.v;
        if (want !== cur) { var tb = $('themeToggle'); if (tb) tb.click(); }
        say(tr(want === 'dark' ? 'vn.theme.dark' : 'vn.theme.light'));
        return true;

      case 'lang':
        if (window.I18N && window.I18N.setLang) window.I18N.setLang(cmd.v);
        /* перезапустить распознавание с новым языком */
        if (on) { pauseRec(); resumeRec(); }
        say(tr(cmd.v === 'en' ? 'vn.lang.en' : 'vn.lang.ru'));
        return true;

      case 'cc':
        var ccBtn = isMobile() ? $('iosCC') : $('ccToggle');
        if (ccBtn) ccBtn.click();
        say(tr('vn.cc'));
        return true;

      case 'search':
        if (window.Spotlight && window.Spotlight.search) window.Spotlight.search(cmd.q);
        say(tr('vn.search') + ' ' + cmd.q);
        return true;

      case 'call':
        /* сценарий: звонок с автозапуском; своё прослушивание выключаем,
           чтобы не отбирать микрофон у звонка */
        say(tr('vn.call'));
        stopListen(true);
        if (window.OS) window.OS.open('win-call', $('vnBtn'));
        flash($('win-call'));
        setTimeout(function () {
          var cb = $('aiCallBtn');
          var live = $('aiCall');
          if (cb && (!live || live.hidden)) cb.click();
        }, 700);
        hidePanel();
        return true;

      case 'demo':
        if (window.OS) window.OS.open('win-calendar', $('vnBtn'));
        flash($('win-calendar'));
        say(tr('vn.demo'));
        return true;

      case 'contract':
        if (window.Messenger && window.Messenger.openConversation) window.Messenger.openConversation('lawyer');
        else if (window.OS) window.OS.open('win-assistant', $('vnBtn'));
        flash($('win-assistant'));
        say(tr('vn.contract'));
        return true;

      case 'page':
        var dots = document.querySelectorAll('#pagerDots button');
        if (dots.length) {
          var idx = (cmd.v === 1) ? dots.length - 1 : 0;
          dots[idx].click();
        }
        say(tr('vn.page'));
        return true;

      case 'help':
        say(tr('vn.help'));
        return true;

      case 'repeat':
        if (lastSaid) { setAct(lastSaid); speak(lastSaid); } else say(tr('vn.norepeat'));
        return true;

      case 'time':
        say(new Date().toLocaleTimeString(lang() === 'en' ? 'en-US' : 'ru-RU', { hour: '2-digit', minute: '2-digit' }));
        return true;

      case 'date':
        say(new Date().toLocaleDateString(lang() === 'en' ? 'en-US' : 'ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }));
        return true;

      case 'reload':
        say(tr('vn.reload'));
        setTimeout(function () { location.reload(); }, 600);
        return true;

      case 'interrupt':
        try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
        try { if (agentAudioEl) agentAudioEl.pause(); } catch (e) {}
        speaking = false; syncDot();
        resumeRec();
        return true;
    }
    return false;
  }

  /* полный цикл: текст → парсер → исполнение | фолбэк-диалог */
  function handle(text) {
    text = String(text || '').trim();
    if (!text) return;
    var cmd = parse(text);
    if (cmd) { exec(cmd); return; }
    fallbackAsk(text);
  }

  /* ============================================================
     СТАРТ / СТОП
     ============================================================ */
  function startListen() {
    unlockTTS(); unlockAgentAudio(); /* строго в жесте пользователя */
    showPanel();
    note(null);
    if (!SR) { note('vn.nosr'); syncDot(); return; }
    if (on) return;
    on = true;
    setHeard('', false);
    setAct('');
    startRec();
    syncDot();
  }
  function stopListen() {
    /* панель остаётся открытой: в ней текстовый ввод и примеры */
    on = false;
    pauseRec();
    syncDot();
  }
  function toggle() {
    if (on) { stopListen(); return; }
    if (panelOpen() && !SR) { hidePanel(); return; }
    startListen();
  }
  function closeAll() {
    stopListen();
    hidePanel();
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
  }

  /* ============================================================
     ИНИЦИАЛИЗАЦИЯ UI
     ============================================================ */
  function init() {
    panel = $('vnPanel');
    heardEl = $('vnHeard');
    actEl = $('vnAct');
    noteEl = $('vnNote');
    if (!panel) return;

    var btn = $('vnBtn');
    if (btn) btn.addEventListener('click', function (e) { e.stopPropagation(); unlockTTS(); unlockAgentAudio(); toggle(); });

    /* README-чип, карточка App Store, плитка Пункта управления iOS */
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-act="vn-open"]') : null;
      if (!t) return;
      e.preventDefault();
      unlockTTS();
      if (window.CCX && window.CCX.hide) window.CCX.hide(); /* закрыть шторку, если открыта */
      startListen();
    });

    var x = $('vnClose');
    if (x) x.addEventListener('click', closeAll);
    var st = $('vnStop');
    if (st) st.addEventListener('click', function () {
      if (on) stopListen(); else startListen();
    });

    /* примеры-чипы: клик = сказать команду */
    panel.addEventListener('click', function (e) {
      var c = e.target.closest ? e.target.closest('.vnp__chip') : null;
      if (!c) return;
      var cmdText = c.textContent.replace(/[«»"“”]/g, '').trim();
      setHeard(cmdText, true);
      handle(cmdText);
    });

    /* K3 — фолбэк текстом (тот же парсер) + клавиатура */
    var form = $('vnForm'), inp = $('vnInput');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!inp || !inp.value.trim()) return;
      var v = inp.value.trim();
      inp.value = '';
      setHeard(v, true);
      handle(v);
    });
    panel.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); closeAll(); }
    });

    /* смена языка: перезапустить слух, обновить подписи */
    document.addEventListener('i18n:change', function () {
      if (on) { pauseRec(); resumeRec(); }
      syncDot();
      var b = $('vnBtn');
      if (b) b.setAttribute('aria-label', tr('vn.btn'));
    });

    /* вкладка скрыта → пауза слуха (батарея) */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pauseRec();
      else if (on) resumeRec();
    });

    /* пользователь сам начал звонок → освободить микрофон */
    document.addEventListener('click', function (e) {
      if (on && e.target.closest && e.target.closest('#aiCallBtn')) stopListen(true);
    });

    syncDot();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* публичный API (+ хуки приёмки: парсер проверяется 12 фразами) */
  window.VoiceNav = {
    parse: parse,
    exec: exec,
    handle: handle,
    start: startListen,
    stop: stopListen,
    close: closeAll,
    listening: function () { return on; }
  };
})();
