/* ============================================================
   Urartu AI — LocalAI: локальный движок ответов агентов
   window.LocalAI.ask(agent, text[, lang]) -> { text, chips?, source? }
   Чистый ES5, ноль внешних ресурсов, ничего не грузит при старте.

   Уровни (лот F реализует «Интенты»; лот G надстроит WebLLM/BM25 выше —
   точка расширения: LocalAI.levels = [ ...fn(agent,text,lang) ], первый
   вернувший результат выигрывает; интенты — последний фолбэк и «личность»).
   ============================================================ */
(function () {
  'use strict';

  /* --- чип-кнопка под пузырём: открывает окно --- */
  function chip(win, ru, en) { return { win: win, label: null, ru: ru, en: en }; }
  var CHIP = {
    calc:    function () { return chip('win-calc', 'Калькулятор', 'Calculator'); },
    devices: function () { return chip('win-devices', 'Устройства', 'Devices'); },
    faq:     function () { return chip('win-faq', 'Вопросы', 'FAQ'); },
    cal:     function () { return chip('win-calendar', 'Календарь', 'Calendar'); }
  };
  function loc(chips, lang) {
    return (chips || []).map(function (c) {
      return { win: c.win, label: (lang === 'en') ? c.en : c.ru };
    });
  }

  /* --- приветствия по ролям (свой тон у каждого агента) --- */
  var GREET = {
    documoved: { ru: 'Здравствуйте! Я Документовед. Спросите про срок согласования, сумму сделки или пункт регламента — отвечу со ссылкой на документ.',
                 en: 'Hello! I am the Document Clerk. Ask about approval timelines, deal amounts or a regulation clause — I answer with a source reference.' },
    lawyer:    { ru: 'Здравствуйте. Юрист-проверяющий на связи. Пришлите текст договора или спросите про пункт — проверю по чек-листу.',
                 en: 'Good day. Legal Reviewer here. Send a contract text or ask about a clause — I check it against the checklist.' },
    support:   { ru: 'Привет! Оператор поддержки. Опишите, что случилось, — помогу разобраться быстро.',
                 en: 'Hi! Support operator. Tell me what happened — I will help you sort it out fast.' },
    secretary: { ru: 'Здравствуйте! Секретарь Урарту. Могу рассказать про ИИ-сотрудников, цены или записать вас на демо.',
                 en: 'Hello! Urartu secretary. I can tell you about AI employees, prices, or book you a demo.' }
  };

  /* --- интенты: массив [regex, ключ] (регистронезависимо, ru+en) --- */
  var INTENTS = [
    ['greeting', /привет|здравств|добр(ый|ое|ый день)|доброе утро|hello|hi\b|hey\b/i],
    ['price',    /цен|стоим|сколько стоит|скольк.*ст|прайс|тариф|бюджет|price|cost|how much|budget/i],
    ['deadline', /срок|как долго|сколько.*(времен|занима)|когда.*(будет|готов|запуск)|deadline|how long|timeline|when.*(ready|start|launch)/i],
    ['hardware', /желез|сервер|оборудован|станци|видеокарт|компьютер|gpu|hardware|server|machine|rig/i],
    ['contract', /договор|контракт|провер(ь|ить|ка|яю)|соглашен|неустой|подсуд|contract|agreement|review|check.*(doc|contract)/i],
    ['privacy',  /152|перс.*данн|пдн|безопасн|облак|утеч|конфиденц|данн(ые|ых)|gdpr|privacy|data.*(safe|leak|cloud)|secur|cloud/i],
    ['human',    /человек|живой|шаген|оператор.*(живой|человек)|менеджер\b|позов|соедини|human|real person|manager|talk to (a )?human/i],
    ['schedule', /демо\b|запиш|записать|встреч|назнач|созвон|консультаци|demo\b|schedule|meeting|book|appointment/i],
    ['problem',  /не работает|ошибк|проблем|сломал|не открыва|завис|not work|error\b|issue|broken|bug|fail/i]
  ];

  function detect(text) {
    for (var i = 0; i < INTENTS.length; i++) {
      if (INTENTS[i][1].test(text)) return INTENTS[i][0];
    }
    return 'default';
  }

  /* --- база ответов: RESP[intent] = { ru, en, chips } или fn(agent) --- */
  var RESP = {
    price: {
      ru: 'Ориентиры: внедрение ИИ-сотрудника — от 200 000 ₽, сайт — от 80 000 ₽, бот — от 60 000 ₽, поддержка — от 15 000 ₽/мес. Точную смету удобно собрать в калькуляторе.',
      en: 'Ballpark: AI-employee rollout from 200,000 ₽, website from 80,000 ₽, bot from 60,000 ₽, support from 15,000 ₽/mo. Best to build an exact quote in the calculator.',
      chips: function () { return [CHIP.calc()]; }
    },
    deadline: {
      ru: 'Пилот на вашем процессе — 2 недели: неделя на сбор базы и настройку, неделя на обучение сотрудников и приёмку по вашим вопросам. Полное внедрение — 4–6 недель.',
      en: 'A pilot on your process takes 2 weeks: one week to collect the knowledge base and configure, one week for staff training and acceptance on your questions. Full rollout — 4–6 weeks.',
      chips: function () { return [CHIP.cal()]; }
    },
    hardware: {
      ru: 'Модель работает на вашем сервере. Обычно ставим станцию с видеокартой (от 180 000 ₽) или используем ваш сервер. Данные не покидают контур — посмотрите варианты в «Устройствах».',
      en: 'The model runs on your own server. We usually deploy a workstation with a GPU (from 180,000 ₽) or use your server. Data never leaves your perimeter — see the options in Devices.',
      chips: function () { return [CHIP.devices()]; }
    },
    privacy: {
      ru: 'Всё работает в вашем контуре: модель на вашем сервере, интернет ей не нужен, данные не уходят в облако. Это соответствует 152-ФЗ. Подробности — в разделе «Вопросы».',
      en: 'Everything runs inside your perimeter: the model on your server, no internet needed, data never goes to the cloud. This complies with Russian data-protection law (152-FZ). Details in the FAQ.',
      chips: function () { return [CHIP.faq()]; }
    },
    'default': {
      ru: 'Хороший вопрос — точный ответ дам на демо, там покажу на вашем процессе. Выберите удобное время в календаре.',
      en: 'Good question — I will give a precise answer on the demo, on your own process. Pick a convenient time in the calendar.',
      chips: function () { return [CHIP.cal()]; }
    }
  };

  /* --- ответы, зависящие от роли агента --- */
  function roleAnswer(agent, intent, lang) {
    var en = (lang === 'en');

    if (intent === 'greeting') {
      var g = GREET[agent] || GREET.secretary;
      return { text: en ? g.en : g.ru };
    }

    if (intent === 'contract') {
      if (agent === 'lawyer') {
        return {
          text: en
            ? 'Quick check of a typical draft: ✔ subject and price present; ⚠ penalty is one-sided — clause 2.1 protects only the customer, worth making it symmetric; ✖ jurisdiction not specified. On a real review I go clause by clause against your checklist.'
            : 'Быстрая проверка типового черновика: ✔ предмет и цена на месте; ⚠ неустойка односторонняя — п. 2.1 защищает только заказчика, стоит сделать симметричной; ✖ подсудность не указана. На реальной проверке иду по вашему чек-листу пункт за пунктом.',
          chips: [CHIP.cal()]
        };
      }
      return {
        text: en
          ? 'Contract review is the Legal Reviewer\'s job — open that chat and paste the text. I can help with regulations and document search.'
          : 'Проверка договоров — это к Юристу-проверяющему: откройте его диалог и вставьте текст. Я помогу с регламентами и поиском по документам.'
      };
    }

    if (intent === 'deadline' && agent === 'documoved') {
      return {
        text: en
          ? 'By the regulation: a contract up to 300,000 ₽ is approved within 3 business days (clause 4.2); above that — up to 5 days with the head\'s sign-off (clause 4.3). On a pilot I answer from YOUR documents.'
          : 'По регламенту: договор до 300 000 ₽ согласуется за 3 рабочих дня (п. 4.2); свыше — до 5 дней с визой руководителя (п. 4.3). На пилоте отвечаю по ВАШИМ документам.',
        chips: [CHIP.cal()]
      };
    }

    if (intent === 'problem') {
      if (agent === 'support') {
        return {
          text: en
            ? 'Got it. Tell me the exact step where it breaks and what you see on screen — I will walk you through it. If it needs a human, I can connect you to Shagen right away.'
            : 'Понял. Опишите точный шаг, где ломается, и что видите на экране — проведу по шагам. Если нужен человек — сразу соединю с Шагеном.'
        };
      }
      return {
        text: en
          ? 'Sounds like a support question — the Support operator will help fastest. Or I can book you a call.'
          : 'Похоже на вопрос в поддержку — быстрее поможет Оператор поддержки. Или запишу вас на звонок.',
        chips: [CHIP.cal()]
      };
    }

    if (intent === 'schedule') {
      var chipsS = [CHIP.cal()];
      if (agent === 'secretary') {
        return {
          text: en
            ? 'With pleasure — a demo is 30 minutes online, no obligations. Open the calendar and pick a slot, I will confirm in Telegram.'
            : 'С удовольствием — демо 30 минут онлайн, без обязательств. Откройте календарь и выберите слот, подтверждение придёт в Telegram.',
          chips: chipsS
        };
      }
      return {
        text: en
          ? 'Let\'s set up a demo — pick a time in the calendar.'
          : 'Давайте назначим демо — выберите время в календаре.',
        chips: chipsS
      };
    }

    if (intent === 'human') {
      return {
        text: en
          ? 'I will connect you with Shagen (a real human) in Telegram — tap “Shagen (live)” at the bottom of the chat list.'
          : 'Соединяю с Шагеном (живой человек) в Telegram — нажмите «Шаген (живой)» внизу списка диалогов.'
      };
    }

    return null; // общий ответ ниже
  }

  /* --- главный вход интент-уровня --- */
  function intentLevel(agent, text, lang) {
    var intent = detect(text || '');
    var r = roleAnswer(agent, intent, lang);
    if (r) return { text: r.text, chips: loc(r.chips, lang), source: 'intent' };
    var base = RESP[intent] || RESP['default'];
    var chips = base.chips ? loc(base.chips(), lang) : [];
    return { text: (lang === 'en') ? base.en : base.ru, chips: chips, source: 'intent' };
  }

  var LocalAI = {
    /* лот G добавит сюда WebLLM/BM25 перед интентами */
    levels: [intentLevel],
    intentLevel: intentLevel,
    greet: function (agent, lang) {
      var g = GREET[agent] || GREET.secretary;
      return (lang === 'en') ? g.en : g.ru;
    },
    ask: function (agent, text, lang) {
      var l = (lang || window.__lang) === 'en' ? 'en' : 'ru';
      for (var i = 0; i < this.levels.length; i++) {
        var out = this.levels[i](agent, text, l);
        if (out) return out;
      }
      return intentLevel(agent, text, l);
    }
  };

  window.LocalAI = LocalAI;
})();

/* ============================================================
   G1 — ЯДРО LocalAI: BM25-поиск + свой документ + чек-лист юриста
        + генератор контента + загрузчик WebLLM (только по кнопке).
   Ничего не грузится при старте страницы: WebLLM — динамический
   import ТОЛЬКО после явного клика пользователя.
   ============================================================ */
(function () {
  'use strict';
  var AI = window.LocalAI;
  if (!AI) return;

  /* ---------- токенизатор с грубым русским стеммером ---------- */
  var RU_END = /(иями|ями|ами|ыми|ими|ует|уют|ится|ться|тся|ешь|ете|ите|ала|или|ила|ать|ять|еть|ить|ыва|ива|ого|его|ому|ему|ые|ый|ой|ая|яя|ое|ее|ов|ев|ам|ям|ах|ях|ом|ем|ей|ью|ии|ия|ие|ых|их|ут|ют|ат|ят|ет|ит|ен|на|но|ны|ть|ы|и|а|я|о|е|у|ю|ь)$/;
  function tokens(s) {
    return String(s || '').toLowerCase()
      .replace(/ё/g, 'е')
      .split(/[^a-zа-я0-9]+/)
      .filter(function (t) { return t.length > 1; })
      .map(function (t) { return (t.length > 4 && /[а-я]/.test(t)) ? t.replace(RU_END, '') : t; });
  }

  /* ---------- BM25 (классическая формула, k1=1.5, b=0.75) ---------- */
  function BM25() {
    this.docs = [];   // {tokens, tf, len, meta}
    this.df = {};     // term -> docs containing
    this.avg = 0;
  }
  BM25.prototype.add = function (text, meta) {
    var tk = tokens(text), tf = {};
    tk.forEach(function (t) { tf[t] = (tf[t] || 0) + 1; });
    for (var t in tf) this.df[t] = (this.df[t] || 0) + 1;
    this.docs.push({ tf: tf, len: tk.length, meta: meta });
    this.avg = this.docs.reduce(function (s, d) { return s + d.len; }, 0) / this.docs.length;
  };
  BM25.prototype.search = function (query) {
    var q = tokens(query), N = this.docs.length, self = this;
    if (!N || !q.length) return null;
    var best = null;
    this.docs.forEach(function (d) {
      var score = 0, matched = 0;
      q.forEach(function (t) {
        var f = d.tf[t]; if (!f) return;
        matched++;
        var idf = Math.log(1 + (N - self.df[t] + 0.5) / (self.df[t] + 0.5));
        score += idf * (f * 2.5) / (f + 1.5 * (0.25 + 0.75 * d.len / self.avg));
      });
      if (score > 0 && (!best || score > best.score)) best = { score: score, matched: matched, meta: d.meta, qTokens: q.length };
    });
    return best;
  };

  /* ---------- подсветка найденных слов (безопасный HTML) ---------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function highlight(text, query) {
    var q = tokens(query).filter(function (t) { return t.length > 2; });
    var out = esc(text);
    q.forEach(function (t) {
      out = out.replace(new RegExp('(^|[^a-zа-яё])(' + t + '[a-zа-яё]*)', 'gi'), '$1<mark>$2</mark>');
    });
    return out;
  }
  AI.highlight = highlight;
  AI.escape = esc;

  /* ---------- демо-база: регламенты юрфирмы «Вектор Права» ---------- */
  var BASE = new BM25();
  [
    ['dog', 'п. 4.1', 'Договор на сумму до 100 000 ₽ согласует руководитель отдела в течение 1 рабочего дня.'],
    ['dog', 'п. 4.2', 'Договор на сумму до 300 000 ₽ согласуют юрист и финансовый директор в течение 3 рабочих дней.'],
    ['dog', 'п. 4.3', 'Договор на сумму свыше 300 000 ₽ согласуется до 5 рабочих дней с визой генерального директора.'],
    ['dog', 'п. 4.4', 'Новый контрагент: к сроку согласования добавляется 1 день на проверку службой безопасности.'],
    ['pdn', 'п. 5.1', 'Отзыв согласия на обработку персональных данных: обработка прекращается в течение 10 рабочих дней с даты получения отзыва.'],
    ['pdn', 'п. 5.2', 'Об утечке персональных данных компания уведомляет Роскомнадзор в течение 24 часов, результаты внутреннего расследования направляет в течение 72 часов.'],
    ['pdn', 'п. 5.3', 'Ответ на запрос субъекта персональных данных направляется в течение 10 рабочих дней.'],
    ['pret', 'п. 2.1', 'Претензия регистрируется в день поступления; ответ направляется в течение 10 календарных дней; спор свыше 500 000 ₽ эскалируется управляющему партнёру.'],
    ['pret', 'п. 2.2', 'Досудебный порядок обязателен: иск подаётся не ранее чем через 30 календарных дней с даты направления претензии.'],
    ['tar', 'п. 3.1', 'Абонентское обслуживание — от 40 000 ₽/мес; час управляющего партнёра — 12 000 ₽; час юриста — 6 000 ₽.'],
    ['tar', 'п. 3.2', 'Счета выставляются до 5 числа месяца; срок оплаты — 10 рабочих дней; пеня за просрочку — 0,1% в день.']
  ].forEach(function (r) {
    BASE.add(r[2] + ' ' + r[1], { src: r[0], clause: r[1], text: r[2] });
  });
  var SRC = {
    dog:  { ru: 'Регламент договорной работы', en: 'Contract workflow regulation' },
    pdn:  { ru: 'Положение о персональных данных', en: 'Personal data policy' },
    pret: { ru: 'Претензионный регламент', en: 'Claims handling regulation' },
    tar:  { ru: 'Тарифы и биллинг', en: 'Rates & billing' }
  };

  /* уровень BM25: отвечает, если запрос уверенно попал в демо-базу */
  function bm25Level(agent, text, lang) {
    var hit = BASE.search(text);
    if (!hit) return null;
    if (hit.matched < 2 && !(hit.qTokens <= 2 && hit.score > 1.6)) return null; // не уверен — пропускаем к интентам
    var en = (lang === 'en');
    var srcName = (SRC[hit.meta.src] || {})[en ? 'en' : 'ru'] || '';
    var head = en
      ? 'Found in the demo base (' + srcName + ', ' + hit.meta.clause + '):'
      : 'Нашёл в демо-базе (' + srcName + ', ' + hit.meta.clause + '):';
    return {
      text: head + ' «' + hit.meta.text + '»',
      html: esc(head) + '<blockquote>«' + highlight(hit.meta.text, text) + '»</blockquote>' +
            '<span class="msg__src">' + esc(en ? 'Source: ' : 'Источник: ') + esc(srcName + ', ' + hit.meta.clause) + '</span>',
      chips: [{ win: 'win-reg', label: en ? 'Regulations' : 'Регламенты' }],
      source: 'bm25'
    };
  }

  /* ---------- G2: СВОЙ документ пользователя (не покидает браузер) ---------- */
  var userDoc = null; // {name, chunks:BM25}
  AI.doc = {
    set: function (text, name) {
      var idx = new BM25();
      // режем на абзацы; длинные абзацы — на куски ~400 символов по предложениям
      String(text).split(/\n\s*\n|\r\n\s*\r\n/).forEach(function (p) {
        p = p.trim(); if (!p) return;
        if (p.length <= 420) { idx.add(p, { text: p }); return; }
        var buf = '';
        (p.match(/[^.!?;]+[.!?;]*\s*/g) || [p]).forEach(function (s) {
          s = s.trim(); if (!s) return;
          if ((buf + ' ' + s).length > 420) { if (buf) idx.add(buf, { text: buf }); buf = s; }
          else buf = buf ? buf + ' ' + s : s;
        });
        if (buf) idx.add(buf, { text: buf });
      });
      userDoc = { name: name || '', idx: idx, size: idx.docs.length };
      return userDoc.size;
    },
    clear: function () { userDoc = null; },
    active: function () { return !!userDoc; },
    name: function () { return userDoc ? userDoc.name : ''; }
  };
  function userDocLevel(agent, text, lang) {
    if (agent !== 'documoved' || !userDoc) return null;
    var hit = userDoc.idx.search(text);
    if (!hit || hit.matched < 1) return null;
    if (hit.matched < 2 && hit.qTokens > 2) return null;
    var en = (lang === 'en');
    var head = en ? 'In your document I found:' : 'В вашем документе нашёл:';
    var srcLine = en ? 'Source: your document' : 'Источник: ваш документ';
    if (userDoc.name) srcLine += ' «' + userDoc.name + '»';
    var quote = hit.meta.text.length > 500 ? hit.meta.text.slice(0, 480) + '…' : hit.meta.text;
    return {
      text: head + ' «' + quote + '»',
      html: esc(head) + '<blockquote>«' + highlight(quote, text) + '»</blockquote>' +
            '<span class="msg__src">' + esc(srcLine) + '</span>',
      source: 'userdoc'
    };
  }

  /* порядок уровней: свой документ → BM25-база → интенты (личность) */
  AI.levels = [userDocLevel, bm25Level, AI.intentLevel];

  /* ---------- G3: детерминированная проверка договора (15 правил) ---------- */
  /* Каждое правило: id, поиск (regex), уровень при отсутствии, доп. эвристика. */
  var CONTRACT_RULES = [
    { id: 'r1',  re: /предмет\s+(настоящего\s+)?договора|исполнитель\s+обязуется|подрядчик\s+обязуется|поставщик\s+обязуется|subject\s+of\s+the\s+(agreement|contract)/i, miss: 'miss' },
    { id: 'r2',  re: /цена|стоимость|вознаграждени|сумма\s+договора|порядок\s+расч[её]тов|price|cost|remuneration/i, miss: 'miss' },
    { id: 'r3',  re: /ндс|налог\s+на\s+добавленную|vat\b/i, miss: 'warn' },
    { id: 'r4',  re: /неустойк|пен[яию]\b|штраф|penalt|liquidated\s+damages/i, miss: 'miss' },
    /* r5 — симметрия неустойки: смотрим, кого защищают санкции */
    { id: 'r5',  special: 'penaltySym' },
    { id: 'r6',  re: /подсудност|арбитражн\w+\s+суд|споры?[\s\S]{0,60}?суд|jurisdiction|arbitration/i, miss: 'miss' },
    { id: 'r7',  re: /(срок|порядок)\s+оплаты|оплат[аыу][\s\S]{0,80}?\d+\s*(рабоч|банковск|календарн)?\w*\s*дн|предоплат|аванс|payment\s+(term|within)/i, miss: 'warn' },
    { id: 'r8',  re: /срок\s+(выполнени|оказани|поставки|работ)|календарн\w+\s+план|график\s+работ|deadline|completion\s+date/i, miss: 'miss' },
    { id: 'r9',  re: /при[её]м[кс]|акт\s+(сдачи|при[её]м|выполненных|оказанных)|acceptance\s+(act|certificate)/i, miss: 'miss' },
    { id: 'r10', re: /форс-?мажор|непреодолимой\s+силы|force\s+majeure/i, miss: 'warn' },
    { id: 'r11', re: /персональн\w+\s+данн|152-?фз|personal\s+data|gdpr/i, miss: 'warn' },
    { id: 'r12', re: /конфиденциальн|коммерческ\w+\s+тайн|неразглашени|confidential|non-?disclosure/i, miss: 'warn' },
    { id: 'r13', re: /односторонн\w+[\s\S]{0,30}?(отказ|расторжени)|расторгнут\w+\s+в\s+одностороннем|unilateral\s+(termination|withdrawal)/i, miss: 'warn' },
    { id: 'r14', re: /срок\s+действия|вступает\s+в\s+силу|действует\s+до|term\s+of\s+validity|comes\s+into\s+force/i, miss: 'miss' },
    { id: 'r15', re: /инн|огрн|кпп|р\/с|расч[её]тн\w+\s+сч[её]т|реквизит|bank\s+details/i, miss: 'warn' }
  ];
  var PENALTY_RE = /неустойк|пен[яию]\b|штраф|penalt/i;
  /* симметрия неустойки: санкции должны быть у ОБЕИХ сторон.
     Сначала ищем, КТО именно платит («Исполнитель уплачивает неустойку…»):
     если плательщик назван явно — «ok» только когда платят обе стороны.
     Если конструкция «X уплачивает» не найдена — прежняя эвристика
     (обе стороны упомянуты в предложениях про санкции). */
  var CUST_RE = /заказчик|покупател|клиент|customer|client|buyer/i;
  var EXEC_RE = /исполнител|подрядчик|поставщик|contractor|supplier|seller/i;
  var PAYER_RE = /(заказчик\w*|покупател\w*|клиент\w*|исполнител\w*|подрядчик\w*|поставщик\w*|customer|client|buyer|contractor|supplier|seller)[^.\n]{0,50}?(уплачива|выплачива|возмеща|обязан\w*\s+(?:у|вы)плат|(?:shall|must|will)\s+pay)/ig;
  function penaltySym(text) {
    if (!PENALTY_RE.test(text)) return 'miss';
    var segs = text.split(/\n|\./).filter(function (x) { return PENALTY_RE.test(x); });
    var payCust = false, payExec = false, anyPayer = false, m;
    segs.forEach(function (s) {
      PAYER_RE.lastIndex = 0;
      while ((m = PAYER_RE.exec(s))) {
        anyPayer = true;
        if (CUST_RE.test(m[1])) payCust = true;
        if (EXEC_RE.test(m[1])) payExec = true;
      }
    });
    if (anyPayer) return (payCust && payExec) ? 'ok' : 'warn';
    var seg = segs.join('. ');
    return (CUST_RE.test(seg) && EXEC_RE.test(seg)) ? 'ok' : 'warn';
  }
  /* checkContract(text) -> { items: [{id, status: ok|warn|miss}], counts, words } */
  AI.checkContract = function (text) {
    text = String(text || '');
    var items = [], counts = { ok: 0, warn: 0, miss: 0 };
    CONTRACT_RULES.forEach(function (r) {
      var status;
      if (r.special === 'penaltySym') status = penaltySym(text);
      else status = r.re.test(text) ? 'ok' : r.miss;
      counts[status]++;
      items.push({ id: r.id, status: status });
    });
    return { items: items, counts: counts, words: tokens(text).length };
  };

  /* ---------- G5: генератор контента (умные шаблоны + WebLLM при наличии) ----------
     3 заготовки на формат×тон, вращение счётчиком + случайные обороты:
     повторные генерации дают РАЗНЫЙ текст. */
  var SPIN = {
    ru: {
      hook:   ['Коротко о главном:', 'Честно и по делу:', 'Всё просто:', 'Смотрите сами:'],
      cta:    ['Напишите нам — расскажем детали.', 'Ответим на вопросы в личных сообщениях.', 'Забронируйте — займёт минуту.', 'Подробности — по ссылке в профиле.'],
      thanks: ['Спасибо, что нашли время написать отзыв!', 'Благодарим за развёрнутый отзыв!', 'Спасибо за обратную связь!']
    },
    en: {
      hook:   ['Here is the short version:', 'Honestly and to the point:', 'It is simple:', 'See for yourself:'],
      cta:    ['Message us for details.', 'We answer questions in DMs.', 'Book now — it takes a minute.', 'Details via the link in bio.'],
      thanks: ['Thank you for taking the time to write a review!', 'Thanks for the detailed review!', 'Thank you for your feedback!']
    }
  };
  var TPL = {
    post: {
      biz: {
        ru: ['{hook}\n{topic} — теперь в нашей компании. Что это даёт вам: меньше рутины, быстрее ответы, прозрачные сроки.\n\n{cta}',
             '{topic}: три факта, которые стоит знать.\n1. Работает уже сегодня.\n2. Считается в деньгах, а не в обещаниях.\n3. Внедряется за недели, не месяцы.\n\n{cta}',
             'Мы запустили: {topic}.\nЗачем: чтобы клиенты получали ответ за минуты, а не дни.\nЧто дальше: масштабируем на все отделы.\n\n{cta}'],
        en: ['{hook}\n{topic} — now live at our company. What it means for you: less routine, faster answers, transparent timelines.\n\n{cta}',
             '{topic}: three facts worth knowing.\n1. It works today.\n2. Measured in money, not promises.\n3. Deployed in weeks, not months.\n\n{cta}',
             'We launched: {topic}.\nWhy: so clients get answers in minutes, not days.\nNext: scaling it to every department.\n\n{cta}']
      },
      fun: {
        ru: ['Угадайте, что у нас нового? {topic}! 🎉\nДа-да, теперь и у нас. Заходите посмотреть, пока горячее.\n\n{cta}',
             '{topic} — звучит серьёзно, а на деле просто удобно. Попробуйте и расскажите, как вам!\n\n{cta}',
             'Мы тут немного похвастаемся: {topic}. Получилось честно круто — сами не ожидали 😄\n\n{cta}'],
        en: ['Guess what is new? {topic}! 🎉\nYes, we finally have it too. Come take a look while it is hot.\n\n{cta}',
             '{topic} — sounds serious, but it is simply convenient. Try it and tell us what you think!\n\n{cta}',
             'A little brag: {topic}. It turned out honestly great — we did not expect it ourselves 😄\n\n{cta}']
      }
    },
    card: {
      biz: {
        ru: ['{topic}\n\nЧто внутри: проверенное качество, понятная комплектация, гарантия.\nДля кого: для тех, кто выбирает по делу, а не по картинке.\nСрок: отгрузка 1–2 дня.\n\n{cta}',
             '{topic} — характеристики без воды:\n· назначение: ежедневная работа;\n· гарантия: 12 месяцев;\n· доставка: по всей РФ.\n\n{cta}',
             '{topic}.\nКоротко: делает своё дело и не требует внимания. Именно то, за что платят.\n\n{cta}'],
        en: ['{topic}\n\nInside: proven quality, clear package, warranty.\nFor whom: people who choose by substance, not pictures.\nShipping: 1–2 days.\n\n{cta}',
             '{topic} — specs without fluff:\n· purpose: daily work;\n· warranty: 12 months;\n· delivery: nationwide.\n\n{cta}',
             '{topic}.\nIn short: does its job and needs no babysitting. Exactly what you pay for.\n\n{cta}']
      },
      fun: {
        ru: ['{topic} — вещь, которую вы удивитесь, как раньше не купили 😏\nБерите, пока есть. Потом расскажете спасибо.\n\n{cta}',
             'Знакомьтесь: {topic}. Маленькая радость для больших задач.\n\n{cta}',
             '{topic}! Красивое? Красивое. Полезное? Ещё какое. Ну вы поняли 😉\n\n{cta}'],
        en: ['{topic} — the thing you will wonder why you did not buy earlier 😏\nGet it while it lasts.\n\n{cta}',
             'Meet {topic}. A small joy for big tasks.\n\n{cta}',
             '{topic}! Pretty? Yes. Useful? Very. You get the idea 😉\n\n{cta}']
      }
    },
    review: {
      biz: {
        ru: ['{thanks}\nМы разобрали ситуацию: «{topic}». Вы правы, так быть не должно. Уже скорректировали процесс и вернёмся к вам с решением в течение дня.\n\nС уважением, команда.',
             '{thanks}\nПо сути замечания «{topic}»: приняли в работу, ответственный назначен, срок — 2 рабочих дня. Держим вас в курсе.',
             '{thanks}\nНам важно, что вы отметили: «{topic}». Передали руководителю направления; предложим компенсацию и исправим причину.'],
        en: ['{thanks}\nWe reviewed the situation: "{topic}". You are right, it should not be like that. The process is already corrected and we will get back to you within a day.\n\nBest regards, the team.',
             '{thanks}\nRegarding "{topic}": accepted, an owner is assigned, ETA — 2 business days. We will keep you posted.',
             '{thanks}\nIt matters that you flagged "{topic}". Forwarded to the department head; we will offer compensation and fix the root cause.']
      },
      fun: {
        ru: ['{thanks}\n«{topic}» — ох, это было не по плану 🙈 Уже чиним и очень хотим реабилитироваться: загляните к нам ещё раз, сделаем всё как надо!',
             'Ух, спасибо за честность! «{topic}» — записали, посыпали голову пеплом, исправляем. Возвращайтесь — удивим в хорошем смысле 🙌',
             '{thanks}\nЗа «{topic}» — отдельное спасибо: без таких отзывов мы бы не стали лучше. Исправимся и докажем делом!'],
        en: ['{thanks}\n"{topic}" — that was not the plan 🙈 We are fixing it and would love a second chance: come by again!',
             'Wow, thanks for the honesty! "{topic}" — noted, ashes on our heads, fixing it. Come back — we will surprise you in a good way 🙌',
             '{thanks}\nSpecial thanks for "{topic}": without reviews like this we would not improve. We will prove it with action!']
      }
    }
  };
  var genCounter = 0;
  function pick(arr, n) { return arr[n % arr.length]; }
  function fillTpl(format, tone, topic, lang) {
    var en = (lang === 'en');
    var t = ((TPL[format] || TPL.post)[tone] || TPL[format].biz)[en ? 'en' : 'ru'];
    var n = genCounter++;
    var sp = SPIN[en ? 'en' : 'ru'];
    return pick(t, n)
      .replace(/\{topic\}/g, topic)
      .replace(/\{hook\}/g, pick(sp.hook, n + 1))
      .replace(/\{cta\}/g, pick(sp.cta, n + 2))
      .replace(/\{thanks\}/g, pick(sp.thanks, n + 1));
  }
  /* generate -> Promise<{text, source:'webllm'|'template'}> */
  AI.generate = function (opts) {
    var lang = opts.lang === 'en' ? 'en' : 'ru';
    if (AI.webllm.state === 'ready') {
      var sys = lang === 'en'
        ? 'You are a marketing copywriter. Write in English. Be concise (up to 120 words), no markdown headings.'
        : 'Ты маркетинговый копирайтер. Пиши по-русски. Коротко (до 120 слов), без markdown-заголовков.';
      var kinds = { post: { ru: 'пост для соцсетей', en: 'a social media post' }, card: { ru: 'карточку товара', en: 'a product card' }, review: { ru: 'вежливый ответ на отзыв клиента', en: 'a polite reply to a customer review' } };
      var tones = { biz: { ru: 'деловой тон', en: 'business tone' }, fun: { ru: 'дружелюбный тон', en: 'friendly tone' } };
      var user = (lang === 'en')
        ? 'Write ' + kinds[opts.format].en + ' (' + tones[opts.tone].en + ') about: ' + opts.topic
        : 'Напиши ' + kinds[opts.format].ru + ' (' + tones[opts.tone].ru + ') на тему: ' + opts.topic;
      return AI.webllm.chat([{ role: 'system', content: sys }, { role: 'user', content: user }])
        .then(function (text) { return { text: text, source: 'webllm' }; })
        .catch(function () { return { text: fillTpl(opts.format, opts.tone, opts.topic, lang), source: 'template' }; });
    }
    return Promise.resolve({ text: fillTpl(opts.format, opts.tone, opts.topic, lang), source: 'template' });
  };

  /* ---------- WebLLM: настоящая локальная модель, ТОЛЬКО по кнопке ---------- */
  AI.webllm = {
    state: 'idle',            // idle | loading | ready | error | nogpu
    engine: null,
    model: null,
    sizeLabel: '~950 МБ',
    /* load(onProgress(frac, note)) -> Promise; вызывается ТОЛЬКО кликом */
    load: function (onProgress) {
      var self = this;
      if (self.state === 'ready') return Promise.resolve();
      if (self._p) return self._p;
      if (!navigator.gpu) { self.state = 'nogpu'; return Promise.reject(new Error('nogpu')); }
      self.state = 'loading';
      // модель поменьше для устройств со скромной памятью
      var small = navigator.deviceMemory && navigator.deviceMemory < 8;
      self.model = small ? 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC' : 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
      self._p = import('https://esm.run/@mlc-ai/web-llm').then(function (m) {
        return m.CreateMLCEngine(self.model, {
          initProgressCallback: function (p) {
            if (onProgress) onProgress(Math.max(0, Math.min(1, p.progress || 0)), p.text || '');
          }
        });
      }).then(function (engine) {
        self.engine = engine; self.state = 'ready';
      }).catch(function (e) {
        self.state = 'error'; self._p = null; throw e;
      });
      return self._p;
    },
    chat: function (messages) {
      if (this.state !== 'ready' || !this.engine) return Promise.reject(new Error('not ready'));
      return this.engine.chat.completions.create({ messages: messages, temperature: 0.7, max_tokens: 260 })
        .then(function (r) { return (r.choices[0].message.content || '').trim(); });
    }
  };

  /* персоны агентов для WebLLM-уровня чата */
  var PERSONA = {
    documoved: { ru: 'Ты Документовед компании Урарту: отвечаешь по регламентам кратко и со ссылкой на пункт.', en: 'You are the Document Clerk at Urartu: answer briefly, referencing clauses.' },
    lawyer:    { ru: 'Ты Юрист-проверяющий: сдержанный тон, отвечаешь про договоры и риски.', en: 'You are the Legal Reviewer: reserved tone, contracts and risks.' },
    support:   { ru: 'Ты Оператор поддержки: дружелюбно помогаешь разобраться с проблемами.', en: 'You are the Support operator: friendly, helping resolve problems.' },
    secretary: { ru: 'Ты Секретарь компании Урарту (внедрение локального ИИ): вежливо рассказываешь об услугах, ценах (ИИ-сотрудник от 200 000 ₽), записываешь на демо.', en: 'You are the Secretary of Urartu (local AI deployment): politely explain services and prices (AI employee from 200,000 ₽), book demos.' }
  };
  /* askAsync: если WebLLM загружена — настоящая генерация; иначе синхронные уровни */
  AI.askAsync = function (agent, text, lang) {
    var l = (lang || window.__lang) === 'en' ? 'en' : 'ru';
    /* свой документ и демо-база важнее свободной генерации — они с источником */
    var sync = AI.ask(agent, text, l);
    if (sync.source === 'userdoc' || sync.source === 'bm25') return Promise.resolve(sync);
    if (AI.webllm.state === 'ready') {
      var p = (PERSONA[agent] || PERSONA.secretary)[l];
      var extra = l === 'en' ? ' Reply in English, up to 80 words.' : ' Отвечай по-русски, до 80 слов.';
      return AI.webllm.chat([{ role: 'system', content: p + extra }, { role: 'user', content: text }])
        .then(function (t) { return { text: t, chips: sync.chips || [], source: 'webllm' }; })
        .catch(function () { return sync; });
    }
    return Promise.resolve(sync);
  };
})();
