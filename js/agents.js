/* ============================================================
   agents.js — панель «Команда ИИ-агентов».
   Те же сотрудники, что в CRM «Пульс» (documoved / support / secretary
   / lawyer / content) — общий штат, общие имена/роли (i18n), общие аватары.
   Три вкладки: Команда (карточки + создать агента), Задачи (живая лента),
   3D-офис (ленивый WebGPU-стенд The Delegation).
   Мобильно: одна колонка, крупные тапы, липкие вкладки.
   Наружу: window.AgentsPanel { ensure() }
   ============================================================ */
(function () {
  'use strict';
  if (window.AgentsPanel) return;

  function lang() { return (window.__lang === 'en') ? 'en' : 'ru'; }
  function tr(k) { return (window.I18N && window.I18N.t) ? window.I18N.t(k, lang()) : k; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function avaSrc(id) { return (window.Avatars && window.Avatars.src) ? window.Avatars.src(id, 'real') : ('avatars/' + id + '-real.webp'); }

  /* Двуязычные динамические строки (не через словарь — держим рядом) */
  function L(ru, en) { return lang() === 'en' ? en : ru; }

  /* ---------- ШТАТ: 5 ИИ, синхронизирован с CRM (js/pulse.js EMP) ---------- */
  var ROSTER = [
    {
      id: 'documoved', hue: 210, done: 1240,
      model: 'Qwen 14–32B', speed: L('~1 сек', '~1 s'),
      equiv: L('уровень GPT-4o для документов', 'GPT-4o level for documents'),
      demo: { chat: 'documoved' },
      tasks: [
        L('Проверил договор №442 — риск в п. 4.2', 'Checked contract #442 — risk in cl. 4.2'),
        L('Нашёл ответ в регламенте закупок', 'Found the answer in the procurement policy'),
        L('Сверил приложение с базой знаний', 'Matched the annex against the knowledge base'),
        L('Ответил на вопрос по документообороту', 'Answered a document-flow question')
      ]
    },
    {
      id: 'lawyer', hue: 16, done: 156,
      model: 'Qwen 32–70B', speed: L('~2 сек', '~2 s'),
      equiv: L('уровень Claude Sonnet для проверки договоров', 'Claude Sonnet level for contract review'),
      demo: { chat: 'lawyer' },
      tasks: [
        L('Проверил договор поставки по чек-листу', 'Reviewed a supply contract by checklist'),
        L('Выделил 3 рискованных пункта с цитатами', 'Flagged 3 risky clauses with quotes'),
        L('Сравнил редакцию с типовой формой', 'Compared the draft to the standard form'),
        L('Подготовил протокол разногласий', 'Drafted a protocol of disagreements')
      ]
    },
    {
      id: 'support', hue: 150, done: 890,
      model: 'Qwen 8–14B', speed: L('~0,8 сек', '~0.8 s'),
      equiv: L('уровень раннего GPT-4 для типовой поддержки', 'early GPT-4 level for routine support'),
      demo: { chat: 'support' },
      tasks: [
        L('Ответил клиенту в чате за 6 секунд', 'Answered a customer in chat in 6 seconds'),
        L('Закрыл 12 обращений без оператора', 'Closed 12 tickets without an operator'),
        L('Передал сложный случай человеку', 'Escalated a hard case to a human'),
        L('Собрал заявку и завёл её в CRM', 'Captured a lead and logged it in the CRM')
      ]
    },
    {
      id: 'secretary', hue: 262, done: 320,
      model: L('малая LLM + локальная речь', 'small LLM + on-device speech'),
      speed: L('в реальном времени', 'real time'),
      equiv: L('принимает звонки и говорит голосом', 'answers calls and talks by voice'),
      demo: { win: 'win-call' }, canCall: true,
      tasks: [
        L('Приняла входящий звонок и записала обращение', 'Took an inbound call and logged the request'),
        L('Назначила 3 демо на завтра', 'Booked 3 demos for tomorrow'),
        L('Перезвонила по пропущенному', 'Called back a missed call'),
        L('Отправила подтверждение встречи', 'Sent a meeting confirmation')
      ]
    },
    {
      id: 'content', hue: 330, done: 96,
      model: 'Qwen 32B', speed: L('~3 сек', '~3 s'),
      equiv: L('уровень GPT-4o для текстов', 'GPT-4o level for copy'),
      demo: { win: 'win-factory' },
      tasks: [
        L('Написал пост в стиле бренд-гайда', 'Wrote a post in the brand-guide voice'),
        L('Подготовил рассылку по базе', 'Drafted a newsletter for the base'),
        L('Собрал статью по 4 источникам', 'Assembled an article from 4 sources'),
        L('Сделал 5 вариантов заголовка', 'Produced 5 headline options')
      ]
    }
  ];

  /* SVG-глифы ролей (единый штрих, как у карточек сотрудников) */
  var GLYPH = {
    documoved: '<svg viewBox="0 0 32 32" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h9l5 5v19H9z"/><path d="M18 4v5h5"/><line x1="12.5" y1="15" x2="19.5" y2="15"/><line x1="12.5" y1="19" x2="19.5" y2="19"/><line x1="12.5" y1="23" x2="17" y2="23"/></svg>',
    lawyer: '<svg viewBox="0 0 32 32" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4l9 3v7c0 6-4 10-9 13-5-3-9-7-9-13V7z"/><path d="M12 15.5l3 3 5-6"/></svg>',
    support: '<svg viewBox="0 0 32 32" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18v-2a9 9 0 0 1 18 0v2"/><path d="M7 18h2.5v6H8a3 3 0 0 1-3-3v0a3 3 0 0 1 2-2.8z"/><path d="M25 18h-2.5v6H24a3 3 0 0 0 3-3v0a3 3 0 0 0-2-2.8z"/><path d="M22.5 24v1a3 3 0 0 1-3 3H16"/></svg>',
    secretary: '<svg viewBox="0 0 32 32" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="12.5" y="4" width="7" height="13" rx="3.5"/><path d="M9 14a7 7 0 0 0 14 0"/><line x1="16" y1="21" x2="16" y2="25"/><line x1="12" y1="25" x2="20" y2="25"/></svg>',
    content: '<svg viewBox="0 0 32 32" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22l14-14 4 4-14 14-5 1z"/><path d="M17 11l4 4"/></svg>'
  };

  /* Шаблоны ролей для «Создать агента» */
  function templates() {
    return [
      { role: 'documoved', hue: 210, icon: GLYPH.documoved, title: L('Документовед', 'Document expert'), model: 'Qwen 14–32B', desc: L('отвечает по регламентам и базе', 'answers from your policies') },
      { role: 'lawyer', hue: 16, icon: GLYPH.lawyer, title: L('Юрист-проверяющий', 'Contract reviewer'), model: 'Qwen 32–70B', desc: L('проверяет договоры по чек-листу', 'reviews contracts by checklist') },
      { role: 'support', hue: 150, icon: GLYPH.support, title: L('Оператор поддержки', 'Support operator'), model: 'Qwen 8–14B', desc: L('отвечает клиентам 24/7', 'answers customers 24/7') },
      { role: 'secretary', hue: 262, icon: GLYPH.secretary, title: L('Секретарь-голос', 'Voice secretary'), model: L('малая + речь', 'small + speech'), desc: L('принимает звонки голосом', 'answers calls by voice') },
      { role: 'content', hue: 330, icon: GLYPH.content, title: L('Контент-менеджер', 'Content manager'), model: 'Qwen 32B', desc: L('пишет тексты в вашем стиле', 'writes copy in your voice') }
    ];
  }

  var custom = [];   // созданные пользователем агенты (сессия)
  var built = false;

  /* ---------- карточка агента ---------- */
  function card(a) {
    var isCustom = !!a.custom;
    var name = isCustom ? esc(a.name) : esc(tr(a.nameKey || nameKeyOf(a.id)));
    var role = esc(isCustom ? a.roleTitle : tr(roleKeyOf(a.id)));
    var c = el('article', 'agc');
    c.style.setProperty('--hue', a.hue);
    var callBtn = a.canCall
      ? '<button type="button" class="agc__act agc__act--call" data-agc-call="1"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24 11 11 0 0 0 3.4.55 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.3a1 1 0 0 1 1 1 11 11 0 0 0 .55 3.4 1 1 0 0 1-.25 1z"/></svg><span>' + esc(tr('agents.call')) + '</span></button>'
      : '';
    var chatBtn = (a.demo && (a.demo.chat || a.demo.win))
      ? '<button type="button" class="agc__act agc__act--chat" data-agc-demo="1">' + esc(a.demo.chat ? tr('agents.chat') : tr('try.now') || 'Открыть') + '</button>'
      : '';
    c.innerHTML =
      '<div class="agc__top">' +
        '<span class="agc__ava"><img src="' + avaSrc(a.id) + '" alt="" width="96" height="96" loading="lazy" decoding="async"><i class="agc__pulse"></i></span>' +
        '<div class="agc__id">' +
          '<h3 class="agc__name">' + name + (isCustom ? ' <span class="agc__badge">' + esc(tr('agents.custom')) + '</span>' : '') + '</h3>' +
          '<p class="agc__role">' + role + '</p>' +
          '<span class="agc__status"><i></i>' + esc(tr('agents.online')) + '</span>' +
        '</div>' +
      '</div>' +
      '<p class="agc__now"><span class="agc__nowdot"></span><span class="agc__nowtxt"></span></p>' +
      '<div class="agc__meta">' +
        '<div class="agc__mrow"><span class="agc__mk">' + esc(tr('agents.model')) + '</span><b>' + esc(a.model) + '</b></div>' +
        '<div class="agc__mrow"><span class="agc__mk">' + esc(tr('agents.equiv')) + '</span><span class="agc__equiv">' + esc(a.equiv) + '</span></div>' +
      '</div>' +
      '<div class="agc__stats">' +
        '<div class="agc__stat"><b>' + a.done.toLocaleString(lang() === 'en' ? 'en-US' : 'ru-RU') + '</b><span>' + esc(tr('agents.done.lbl')) + '</span></div>' +
        '<div class="agc__stat"><b>' + esc(a.speed) + '</b><span>' + esc(tr('agents.speed.lbl')) + '</span></div>' +
      '</div>' +
      '<div class="agc__acts">' + callBtn + chatBtn + '</div>';
    /* «сейчас в работе» строка — крутим задачи */
    var nowtxt = c.querySelector('.agc__nowtxt');
    var i = 0;
    nowtxt.textContent = a.tasks[0];
    c.__tick = function () { i = (i + 1) % a.tasks.length; nowtxt.textContent = a.tasks[i]; };
    /* действия */
    var demo = c.querySelector('[data-agc-demo]');
    if (demo) demo.addEventListener('click', function () { runDemo(a); });
    var call = c.querySelector('[data-agc-call]');
    if (call) call.addEventListener('click', function () { if (window.OS) window.OS.open('win-call', call); });
    return c;
  }

  function nameKeyOf(id) { return ({ documoved: 'msg.n.documoved', lawyer: 'msg.n.lawyer', support: 'msg.n.support', secretary: 'msg.n.secretary', content: 'staff.e5.role' })[id]; }
  function roleKeyOf(id) { return ({ documoved: 'crm.rl.docs', lawyer: 'crm.rl.legal', support: 'crm.rl.sup', secretary: 'crm.rl.rec', content: 'crm.rl.content' })[id]; }

  function runDemo(a) {
    if (!a.demo) return;
    if (a.demo.win) { if (window.OS) window.OS.open(a.demo.win, null); return; }
    if (a.demo.chat) {
      if (window.OS) window.OS.open('win-assistant', null);
      setTimeout(function () { if (window.Messenger && window.Messenger.openConversation) window.Messenger.openConversation(a.demo.chat); }, 320);
    }
  }

  /* ---------- вкладка «Команда» ---------- */
  var cards = [];
  function renderTeam() {
    var pane = document.getElementById('agpTeam');
    if (!pane) return;
    pane.innerHTML = '';
    cards = [];
    var head = el('div', 'agp__head');
    head.innerHTML = '<div><h2 class="agp__h2">' + esc(tr('agents.h1')) + '</h2><p class="agp__lead">' + esc(tr('agents.p')) + '</p></div>';
    pane.appendChild(head);
    var grid = el('div', 'agp__grid');
    ROSTER.concat(custom).forEach(function (a) { var c = card(a); grid.appendChild(c); cards.push(c); });
    /* карточка «создать агента» */
    var add = el('button', 'agc agc--add');
    add.type = 'button';
    add.innerHTML = '<span class="agc-add__plus" aria-hidden="true">+</span><span class="agc-add__t">' + esc(tr('agents.new')) + '</span>';
    add.addEventListener('click', openCreate);
    grid.appendChild(add);
    pane.appendChild(grid);
  }

  /* ---------- «Создать агента» ---------- */
  function openCreate() {
    var pane = document.getElementById('agpTeam');
    if (!pane) return;
    var ov = el('div', 'agcreate');
    var opts = templates().map(function (t, i) {
      return '<button type="button" class="agcreate__role' + (i === 0 ? ' is-on' : '') + '" data-role="' + t.role + '" style="--hue:' + t.hue + '">' +
        '<span class="agcreate__ic">' + t.icon + '</span><b>' + esc(t.title) + '</b><span class="agcreate__rd">' + esc(t.desc) + '</span><span class="agcreate__rm">' + esc(t.model) + '</span></button>';
    }).join('');
    ov.innerHTML =
      '<div class="agcreate__box" role="dialog" aria-modal="true" aria-label="' + esc(tr('agents.create.title')) + '">' +
        '<span class="agcreate__grab" aria-hidden="true"></span>' +
        '<h3 class="agcreate__h">' + esc(tr('agents.create.title')) + '</h3>' +
        '<p class="agcreate__sub">' + esc(tr('agents.create.sub')) + '</p>' +
        '<label class="agcreate__lbl">' + esc(tr('agents.create.role')) + '</label>' +
        '<div class="agcreate__roles">' + opts + '</div>' +
        '<label class="agcreate__lbl" for="agName">' + esc(tr('agents.create.name')) + '</label>' +
        '<input id="agName" class="agcreate__inp" type="text" placeholder="' + esc(tr('agents.create.name.ph')) + '" maxlength="24" autocomplete="off">' +
        '<label class="agcreate__lbl" for="agKb">' + esc(tr('agents.create.kb')) + '</label>' +
        '<input id="agKb" class="agcreate__inp" type="text" value="' + esc(L('Регламенты и база знаний', 'Policies and knowledge base')) + '" maxlength="40" autocomplete="off">' +
        '<div class="agcreate__foot">' +
          '<button type="button" class="agcreate__cancel">' + esc(tr('agents.create.cancel')) + '</button>' +
          '<button type="button" class="agcreate__go">' + esc(tr('agents.create.go')) + '</button>' +
        '</div>' +
      '</div>';
    pane.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('is-in'); });
    var chosen = templates()[0];
    ov.querySelectorAll('.agcreate__role').forEach(function (b) {
      b.addEventListener('click', function () {
        ov.querySelectorAll('.agcreate__role').forEach(function (x) { x.classList.remove('is-on'); });
        b.classList.add('is-on');
        chosen = templates().filter(function (t) { return t.role === b.dataset.role; })[0];
      });
    });
    function close() { ov.classList.remove('is-in'); setTimeout(function () { if (ov.parentNode) ov.remove(); }, 220); }
    ov.querySelector('.agcreate__cancel').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('.agcreate__go').addEventListener('click', function () {
      var nm = (ov.querySelector('#agName').value || '').trim() || chosen.title;
      var kb = (ov.querySelector('#agKb').value || '').trim();
      hire(chosen, nm, kb);
      close();
    });
    setTimeout(function () { var n = ov.querySelector('#agName'); if (n) n.focus(); }, 260);
  }

  function hire(tpl, name, kb) {
    var src = ROSTER.filter(function (r) { return r.id === tpl.role; })[0] || ROSTER[0];
    var a = {
      custom: true, id: tpl.role, hue: tpl.hue, name: name,
      roleTitle: tpl.title, model: tpl.model || src.model, speed: src.speed,
      equiv: src.equiv, done: 0, canCall: tpl.role === 'secretary',
      demo: src.demo, tasks: src.tasks.slice(),
      kb: kb
    };
    custom.push(a);
    renderTeam();
    /* «разворачиваем на сервере» → лента */
    pushFeed(a, tr('agents.deploying'), 'deploy');
    setTimeout(function () {
      pushFeed(a, (a.name) + ' — ' + tr('agents.hired'), 'hire');
      /* лёгкая подсветка новой карточки */
      var grid = document.querySelectorAll('#agpTeam .agc');
      var last = grid[grid.length - 2]; // перед кнопкой «создать»
      if (last) { last.classList.add('agc--fresh'); setTimeout(function () { last.classList.remove('agc--fresh'); }, 1600); }
    }, 1400);
    toast(name + ' — ' + tr('agents.hired'));
  }

  /* ---------- вкладка «Задачи» (живая лента) ---------- */
  var feed = [];   // {agent, text, kind, t(ms since epoch-ish, relative counter)}
  var feedSeed = 0;
  function seedFeed() {
    if (feed.length) return;
    /* стартовые события: по 2 на агента, «раскиданы» во времени */
    var mins = [1, 3, 6, 9, 12, 17, 22, 28, 35, 44];
    var k = 0;
    ROSTER.forEach(function (a) {
      for (var j = 0; j < 2; j++) {
        feed.push({ agent: a, text: a.tasks[j % a.tasks.length], kind: 'done', ago: mins[k % mins.length] });
        k++;
      }
    });
    feed.sort(function (x, y) { return x.ago - y.ago; });
  }
  function pushFeed(a, text, kind) {
    feed.unshift({ agent: a, text: text, kind: kind || 'done', ago: 0 });
    renderTasks();
  }
  var feedFilter = 'all';
  function renderTasks() {
    var pane = document.getElementById('agpTasks');
    if (!pane) return;
    seedFeed();
    pane.innerHTML = '';
    var head = el('div', 'agp__head');
    head.innerHTML = '<div><h2 class="agp__h2">' + esc(tr('agents.feed.title')) + '</h2><p class="agp__lead">' + esc(tr('agents.feed.hint')) + '</p></div>';
    pane.appendChild(head);
    /* фильтры */
    var chips = el('div', 'agfeed__chips');
    var all = el('button', 'agfeed__chip' + (feedFilter === 'all' ? ' is-on' : ''), esc(tr('agents.filter.all')));
    all.addEventListener('click', function () { feedFilter = 'all'; renderTasks(); });
    chips.appendChild(all);
    ROSTER.concat(custom).forEach(function (a) {
      var nm = a.custom ? a.name : tr(nameKeyOf(a.id));
      var chip = el('button', 'agfeed__chip' + (feedFilter === a ? ' is-on' : ''), esc(nm));
      chip.style.setProperty('--hue', a.hue);
      chip.addEventListener('click', function () { feedFilter = a; renderTasks(); });
      chips.appendChild(chip);
    });
    pane.appendChild(chips);
    /* список */
    var list = el('div', 'agfeed');
    var shown = feed.filter(function (f) { return feedFilter === 'all' || f.agent === feedFilter; });
    if (!shown.length) { list.appendChild(el('p', 'agfeed__empty', esc(tr('agents.empty.tasks')))); }
    shown.forEach(function (f) {
      var a = f.agent;
      var nm = a.custom ? esc(a.name) : esc(tr(nameKeyOf(a.id)));
      var row = el('div', 'agfeed__row');
      row.style.setProperty('--hue', a.hue);
      var when = f.ago <= 0 ? tr('agents.online').split('·')[0].trim() : (f.ago + ' ' + L('мин назад', 'min ago'));
      if (f.kind === 'deploy') when = '…';
      row.innerHTML =
        '<span class="agfeed__ava"><img src="' + avaSrc(a.id) + '" alt="" width="40" height="40" loading="lazy" decoding="async"></span>' +
        '<div class="agfeed__body"><p class="agfeed__t"><b>' + nm + '</b> ' + esc(f.text) + '</p>' +
        '<span class="agfeed__when">' + esc(when) + '</span></div>' +
        (f.kind === 'deploy' ? '<span class="agfeed__spin" aria-hidden="true"></span>' : '<span class="agfeed__ok" aria-hidden="true">✓</span>');
      list.appendChild(row);
    });
    pane.appendChild(list);
  }

  /* ---------- вкладка «Руководитель»: пишете задачу — он распределяет ---------- */
  var officeBuilt = false, officeRO = null, officeTick = null, dispatching = false;
  var POS = ['tl', 'tr', 'ml', 'mr', 'bc']; // раскладка сотрудников вокруг руководителя (десктоп)

  function EXAMPLES() {
    return [
      { label: L('Проверить договор', 'Review a contract'), q: L('Проверьте договор поставки на риски', 'Review the supply contract for risks') },
      { label: L('Ответить клиенту', 'Answer a client'), q: L('Ответьте клиенту на вопрос по заказу', 'Answer a client question about an order') },
      { label: L('Записать на встречу', 'Book a meeting'), q: L('Запишите клиента на встречу и подтвердите', 'Book a client meeting and confirm it') },
      { label: L('Написать пост', 'Write a post'), q: L('Напишите пост для соцсетей о новой услуге', 'Write a social post about a new service') }
    ];
  }

  /* маршрутизация задачи руководителем → нужные сотрудники + шаг + результат.
     Разбор по словам с совпадением по НАЧАЛУ слова (не подстрокой), чтобы
     «поставки»≠«пост» и «запишите»≠«пиши». */
  function route(text) {
    var words = (text || '').toLowerCase().split(/[^a-zа-яё0-9]+/i).filter(Boolean);
    function has(stems) {
      for (var i = 0; i < words.length; i++) for (var j = 0; j < stems.length; j++) if (words[i].indexOf(stems[j]) === 0) return true;
      return false;
    }
    var picks = [];
    function add(id, sub, res) { for (var i = 0; i < picks.length; i++) if (picks[i].id === id) return; picks.push({ id: id, sub: sub, res: res }); }
    if (has(['договор', 'контракт', 'риск', 'соглашен', 'претенз', 'contract', 'risk', 'agreement'])) {
      add('documoved', L('найти нужные пункты и приложения', 'find the relevant clauses and annexes'), L('нашёл пункт 4.2 и приложение №2', 'found clause 4.2 and annex 2'));
      add('lawyer', L('проверить риски по чек-листу', 'check risks against the checklist'), L('отметил 2 риска, готовит протокол разногласий', 'flagged 2 risks, drafting a protocol'));
    }
    if (has(['клиент', 'поддержк', 'ответ', 'обращен', 'заказ', 'жалоб', 'client', 'support', 'reply', 'ticket', 'order', 'complaint'])) {
      add('support', L('ответить клиенту и оформить заявку', 'answer the client and log the request'), L('ответил за 6 сек и завёл заявку в CRM', 'replied in 6s and logged the lead in CRM'));
    }
    if (has(['звон', 'встреч', 'запиш', 'назнач', 'перезвон', 'календар', 'ресепш', 'call', 'meeting', 'schedul', 'book', 'calendar', 'appointment'])) {
      add('secretary', L('назначить встречу и подтвердить', 'book the meeting and confirm'), L('назначила демо на завтра, отправила подтверждение', 'booked a demo for tomorrow, sent confirmation'));
    }
    if (has(['напиш', 'публикац', 'соцсет', 'текст', 'стать', 'рассылк', 'контент', 'копирайт', 'пресс', 'post', 'article', 'newsletter', 'content', 'caption', 'copywrit'])) {
      add('content', L('подготовить текст в стиле бренда', 'draft copy in the brand voice'), L('сделал 3 варианта и рассылку', 'produced 3 variants and a newsletter'));
    }
    if (has(['регламент', 'документ', 'инструкц', 'политик', 'приказ', 'policy', 'document', 'knowledge', 'manual', 'regulation'])) {
      add('documoved', L('найти ответ в регламентах', 'find the answer in the policies'), L('ответил со ссылкой на пункт', 'answered with a clause reference'));
    }
    if (!picks.length) {
      add('documoved', L('разобрать задачу по базе знаний', 'study the task against the knowledge base'), L('собрал вводные и контекст', 'gathered the inputs and context'));
      add('support', L('подготовить черновик ответа', 'prepare a draft reply'), L('подготовил черновик ответа', 'drafted a reply'));
    }
    return picks;
  }

  function renderOffice() {
    var pane = document.getElementById('agpOfficeScene');
    if (!pane) return;
    if (officeBuilt) { drawWires(); return; }
    officeBuilt = true;
    pane.innerHTML = '';
    var head = el('div', 'agp__head');
    head.innerHTML = '<div><h2 class="agp__h2">' + esc(L('Руководитель ИИ-команды', 'AI team lead')) + '</h2>' +
      '<p class="agp__lead">' + esc(L('Напишите задачу руководителю — он сам разберёт её на шаги и раздаст нужным сотрудникам. Все работают на вашем сервере.', 'Write a task to the lead — it breaks it into steps and hands them to the right employees. Everyone runs on your server.')) + '</p></div>';
    pane.appendChild(head);

    /* консоль руководителя */
    var cons = el('div', 'lead');
    cons.innerHTML =
      '<div class="lead__row">' +
        '<span class="lead__ico" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a4 4 0 0 1 4 4v1a4 4 0 0 1-1 7.9V17a3 3 0 0 1-6 0v-1.1A4 4 0 0 1 8 8V7a4 4 0 0 1 4-4z"/><path d="M9 21h6"/></svg></span>' +
        '<input class="lead__inp" id="leadInp" type="text" autocomplete="off" placeholder="' + esc(L('Опишите задачу — распределю по команде…', 'Describe a task — I’ll delegate it…')) + '">' +
        '<button class="lead__send" id="leadSend" type="button" aria-label="' + esc(L('Отправить руководителю', 'Send to lead')) + '"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>' +
      '</div>' +
      '<div class="lead__ex" id="leadEx"></div>';
    pane.appendChild(cons);
    var exWrap = cons.querySelector('#leadEx');
    EXAMPLES().forEach(function (x) {
      var c = el('button', 'lead__chip', esc(x.label)); c.type = 'button';
      c.addEventListener('click', function () { runDispatch(x.q); });
      exWrap.appendChild(c);
    });
    var inp = cons.querySelector('#leadInp'), send = cons.querySelector('#leadSend');
    function go() { var v = (inp.value || '').trim(); if (v && !dispatching) { runDispatch(v); inp.value = ''; } }
    send.addEventListener('click', go);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });

    /* сцена: руководитель в центре, сотрудники вокруг */
    var office = el('div', 'office');
    office.innerHTML = '<div class="office__floor" aria-hidden="true"></div>' +
      '<svg class="office__wires" aria-hidden="true"></svg>' +
      '<div class="office__hub office__hub--lead"><span class="office__hubglow"></span>' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a4 4 0 0 1 4 4v1a4 4 0 0 1-1 7.9V17a3 3 0 0 1-6 0v-1.1A4 4 0 0 1 8 8V7a4 4 0 0 1 4-4z"/><path d="M9 21h6"/></svg>' +
        '<b>' + esc(L('Руководитель', 'Team lead')) + '</b><span>' + esc(L('на вашем сервере', 'on your server')) + '</span></div>';
    ROSTER.forEach(function (a, i) {
      var nm = esc(tr(nameKeyOf(a.id)));
      var pod = el('div', 'office__pod office__pod--' + POS[i]);
      pod.style.setProperty('--hue', a.hue);
      pod.setAttribute('data-pod', a.id);
      pod.innerHTML =
        '<div class="office__bubble"><span></span></div>' +
        '<div class="office__seat">' +
          '<span class="office__ava"><img src="' + avaSrc(a.id) + '" alt="" width="76" height="76" loading="lazy" decoding="async"><i class="office__live"></i></span>' +
          '<b class="office__name">' + nm + '</b>' +
          '<span class="office__role">' + esc(tr(roleKeyOf(a.id))) + '</span>' +
        '</div>' +
        '<span class="office__desk" aria-hidden="true"></span>';
      office.appendChild(pod);
      var sp = pod.querySelector('.office__bubble span');
      var bub = pod.querySelector('.office__bubble');
      var ix = 0; sp.textContent = a.tasks[0];
      pod.__idle = function () { if (pod.classList.contains('is-active') || pod.classList.contains('is-done')) return; ix = (ix + 1) % a.tasks.length; sp.textContent = a.tasks[ix]; };
      pod.__assign = function (txt) { pod.classList.remove('is-done'); pod.classList.add('is-active'); bub.classList.add('is-live'); sp.textContent = txt; };
      pod.__done = function (txt) { pod.classList.remove('is-active'); pod.classList.add('is-done'); bub.classList.remove('is-live'); sp.textContent = txt; };
      pod.__reset = function () { pod.classList.remove('is-active', 'is-done'); bub.classList.remove('is-live'); ix = 0; sp.textContent = a.tasks[0]; };
    });
    pane.appendChild(office);

    /* лог распределения */
    var log = el('div', 'leadlog'); log.id = 'leadLog';
    pane.appendChild(log);

    requestAnimationFrame(drawWires);
    if (window.ResizeObserver && !officeRO) {
      officeRO = new ResizeObserver(function () { drawWires(); });
      officeRO.observe(office);
    }
    if (!officeTick) officeTick = setInterval(function () {
      var win = document.getElementById('win-agents');
      var op = document.getElementById('agpOffice');
      if (dispatching || !win || !win.classList.contains('is-open') || document.hidden || !op || !op.classList.contains('is-on')) return;
      pane.querySelectorAll('.office__pod').forEach(function (p) { if (p.__idle) p.__idle(); });
    }, 3400);
  }

  function logLine(log, kind, html, id, ok, spin) {
    var row = el('div', 'leadlog__row leadlog__row--' + kind);
    if (id) { var a = ROSTER.filter(function (r) { return r.id === id; })[0]; if (a) row.style.setProperty('--hue', a.hue); }
    var ava = id ? '<span class="leadlog__ava"><img src="' + avaSrc(id) + '" alt="" width="26" height="26" loading="lazy" decoding="async"></span>'
                 : '<span class="leadlog__lead" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a4 4 0 0 1 4 4v1a4 4 0 0 1-1 7.9V17a3 3 0 0 1-6 0v-1.1A4 4 0 0 1 8 8V7a4 4 0 0 1 4-4z"/><path d="M9 21h6"/></svg></span>';
    var mark = spin ? '<span class="leadlog__spin" aria-hidden="true"></span>' : (ok ? '<span class="leadlog__ok" aria-hidden="true">✓</span>' : '');
    row.innerHTML = ava + '<p class="leadlog__t">' + html + '</p>' + mark;
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return row;
  }

  /* Единый движок: синхронно управляет 2D-диаграммой и 3D-сценой + оба лога */
  function dispatchAll(text) {
    if (dispatching || !text) return;
    dispatching = true;
    var picks = route(text);
    var office = document.querySelector('#agpOfficeScene .office');   // 2D (может отсутствовать)
    var log = document.getElementById('leadLog');
    var sceneLog = document.getElementById('o3dLog');
    var has3d = window.Office3D && window.Office3D.ready && window.Office3D.ready();
    if (office) { office.classList.add('is-dispatch'); office.querySelectorAll('.office__pod').forEach(function (p) { if (p.__reset) p.__reset(); }); }
    if (has3d) window.Office3D.reset();
    if (log) log.innerHTML = ''; if (sceneLog) sceneLog.innerHTML = '';
    var thinkRows = [];
    function logBoth(kind, html, id, ok, spin) {
      var rows = [];
      if (log) rows.push(logLine(log, kind, html, id, ok, spin));
      if (sceneLog) rows.push(logLine(sceneLog, kind, html, id, ok, spin));
      return rows;
    }
    logBoth('me', '<b>' + esc(L('Вы', 'You')) + ':</b> ' + esc(text));
    thinkRows = logBoth('lead', esc(L('Разбираю задачу на шаги и распределяю…', 'Breaking the task into steps and delegating…')), null, false, true);
    var base = reduceMotion() ? 0 : 750, step = reduceMotion() ? 0 : 620;

    /* Кто участвует — быстрый локальный разбор (route, работает всегда,
       даже без бэкенда). А ЧТО именно сотрудник сделал — если умный агент
       доступен, реальный ответ от LLM (своя роль/промпт), иначе — прежняя
       заготовка pk.res (честный офлайн-фолбэк). Запрашиваем сразу для всех
       picks параллельно, чтобы не копить задержку. */
    var resolvers = picks.map(function (pk) {
      if (!window.AgentAPI) return Promise.resolve(pk.res);
      return window.AgentAPI.available().then(function (ok) {
        if (!ok) return pk.res;
        var prompt = L(
          'Задача от руководителя: «' + text + '». Одним предложением, в прошедшем времени, конкретно опиши, что именно ты только что сделал(а) по этой задаче.',
          'Task from the lead: "' + text + '". In one sentence, past tense, describe specifically what you just did about this task.'
        );
        return window.AgentAPI.reply(pk.id, prompt, [], false).then(
          function (r) { return (r && r.text) ? r.text : pk.res; },
          function () { return pk.res; }
        );
      }, function () { return pk.res; });
    });

    picks.forEach(function (pk, i) {
      setTimeout(function () {
        if (office) { var pod = office.querySelector('.office__pod[data-pod="' + pk.id + '"]'); if (pod && pod.__assign) pod.__assign(pk.sub); }
        if (has3d) window.Office3D.assign(pk.id, pk.sub);
        logBoth('assign', '<b>' + esc(tr(nameKeyOf(pk.id))) + '</b> — ' + esc(pk.sub), pk.id, false, true);
      }, base + i * step);
    });
    var after = base + picks.length * step + step;
    var doneAt = picks.map(function (pk, i) {
      var minDelay = after + i * step;
      var timerP = new Promise(function (res) { setTimeout(res, minDelay); });
      return Promise.all([timerP, resolvers[i]]).then(function (arr) {
        var realRes = arr[1];
        if (office) { var pod = office.querySelector('.office__pod[data-pod="' + pk.id + '"]'); if (pod && pod.__done) pod.__done(realRes); }
        if (has3d) window.Office3D.done(pk.id, realRes);
        logBoth('done', '<b>' + esc(tr(nameKeyOf(pk.id))) + '</b> — ' + esc(realRes), pk.id, true);
      });
    });
    Promise.all(doneAt).then(function () {
      thinkRows.forEach(function (r) { if (r && r.parentNode) r.remove(); });
      logBoth('lead', esc(L('Готово. Свёл результат — можно проверить и подтвердить.', 'Done. I combined the result — review and confirm.')), null, true);
      if (office) office.classList.remove('is-dispatch');
      dispatching = false;
    });
  }
  var runDispatch = dispatchAll;

  /* ---------- вкладка «3D-офис»: наша сцена на three.js ---------- */
  var sceneBuilt = false;
  function rosterForScene() {
    return ROSTER.map(function (a) { return { id: a.id, name: tr(nameKeyOf(a.id)), role: tr(roleKeyOf(a.id)), hue: a.hue, img: avaSrc(a.id) }; });
  }
  function renderScene() {
    var pane = document.getElementById('agpScene');
    if (!pane) return;
    if (!sceneBuilt) {
      sceneBuilt = true;
      pane.innerHTML = '';
      var head = el('div', 'agp__head');
      head.innerHTML = '<div><h2 class="agp__h2">' + esc(L('3D-офис', '3D office')) + '</h2>' +
        '<p class="agp__lead">' + esc(L('Ваша ИИ-команда за работой на вашем сервере. Дайте задачу — нужный сотрудник за столом подсветится и на его мониторе появится задача. Крутите сцену мышью.', 'Your AI team at work on your server. Give a task — the right employee’s desk lights up and the task shows on their monitor. Drag to rotate.')) + '</p></div>';
      pane.appendChild(head);
      /* консоль */
      var cons = el('div', 'lead');
      cons.innerHTML =
        '<div class="lead__row">' +
          '<span class="lead__ico" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a4 4 0 0 1 4 4v1a4 4 0 0 1-1 7.9V17a3 3 0 0 1-6 0v-1.1A4 4 0 0 1 8 8V7a4 4 0 0 1 4-4z"/><path d="M9 21h6"/></svg></span>' +
          '<input class="lead__inp" id="o3dInp" type="text" autocomplete="off" placeholder="' + esc(L('Дайте задачу команде…', 'Give the team a task…')) + '">' +
          '<button class="lead__send" id="o3dSend" type="button" aria-label="' + esc(L('Отправить', 'Send')) + '"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>' +
        '</div>' +
        '<div class="lead__ex" id="o3dEx"></div>';
      pane.appendChild(cons);
      var exWrap = cons.querySelector('#o3dEx');
      EXAMPLES().forEach(function (x) { var c = el('button', 'lead__chip', esc(x.label)); c.type = 'button'; c.addEventListener('click', function () { dispatchAll(x.q); }); exWrap.appendChild(c); });
      var inp = cons.querySelector('#o3dInp'), send = cons.querySelector('#o3dSend');
      function go() { var v = (inp.value || '').trim(); if (v && !dispatching) { dispatchAll(v); inp.value = ''; } }
      send.addEventListener('click', go);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
      /* контейнер сцены */
      var box = el('div', 'o3d'); box.id = 'o3dBox';
      box.innerHTML = '<div class="o3d__loading">' + esc(L('Загружаем 3D-офис…', 'Loading the 3D office…')) + '</div>';
      pane.appendChild(box);
      var log = el('div', 'leadlog'); log.id = 'o3dLog';
      pane.appendChild(log);
    }
    if (window.Office3D) {
      window.Office3D.ensure(document.getElementById('o3dBox'), rosterForScene()).then(function () {
        var box = document.getElementById('o3dBox');
        var ld = box && box.querySelector('.o3d__loading'); if (ld) ld.remove();
      });
    }
  }

  function reduceMotion() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function drawWires() {
    var office = document.querySelector('#agpOfficeScene .office');
    var svg = office && office.querySelector('.office__wires');
    var hub = office && office.querySelector('.office__hub');
    if (!svg || !hub) return;
    var ob = office.getBoundingClientRect();
    if (!ob.width) return;
    svg.setAttribute('viewBox', '0 0 ' + ob.width + ' ' + ob.height);
    var hb = hub.getBoundingClientRect();
    var hx = hb.left - ob.left + hb.width / 2, hy = hb.top - ob.top + hb.height / 2;
    var paths = '';
    office.querySelectorAll('.office__pod').forEach(function (p) {
      var pb = p.getBoundingClientRect();
      var px = pb.left - ob.left + pb.width / 2, py = pb.top - ob.top + pb.height / 2;
      var hue = p.style.getPropertyValue('--hue') || '220';
      var mx = (px + hx) / 2, my = (py + hy) / 2 - 14;
      paths += '<path d="M' + px + ' ' + py + ' Q' + mx + ' ' + my + ' ' + hx + ' ' + hy + '" ' +
        'fill="none" stroke="hsl(' + hue + ' 80% 60%)" stroke-width="1.6" stroke-linecap="round" ' +
        'stroke-dasharray="4 8" opacity=".5" class="office__wire"/>';
    });
    svg.innerHTML = paths;
  }

  /* ---------- лёгкий тост ---------- */
  function toast(msg) {
    var t = el('div', 'agtoast', esc(msg));
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('is-in'); });
    setTimeout(function () { t.classList.remove('is-in'); setTimeout(function () { if (t.parentNode) t.remove(); }, 300); }, 2600);
  }

  /* ---------- вкладки ---------- */
  function initTabs() {
    var panel = document.getElementById('agentsPanel');
    if (!panel || panel.__tabs) return;
    panel.__tabs = true;
    var tabs = Array.prototype.slice.call(panel.querySelectorAll('.agp__tab'));
    tabs.forEach(function (tab, i) {
      var name = tab.dataset.agpTab;
      tab.id = 'agpTab-' + name;
      tab.setAttribute('aria-controls', 'agp' + name.charAt(0).toUpperCase() + name.slice(1));
      tab.setAttribute('aria-selected', tab.classList.contains('is-on') ? 'true' : 'false');
      tab.tabIndex = tab.classList.contains('is-on') ? 0 : -1;
      function activate() {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.classList.toggle('is-on', on);
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          t.tabIndex = on ? 0 : -1;
        });
        panel.querySelectorAll('.agp__pane').forEach(function (p) { p.classList.toggle('is-on', p.dataset.agpPane === name); });
        if (name === 'tasks') renderTasks();
        if (name === 'office') renderOffice();
        if (name === 'scene') renderScene();
      }
      tab.addEventListener('click', activate);
      tab.addEventListener('keydown', function (e) {
        var idx = tabs.indexOf(tab), n = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = tabs[(idx + 1) % tabs.length];
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = tabs[(idx - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') n = tabs[0];
        else if (e.key === 'End') n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); n.click(); n.focus(); }
      });
    });
  }

  /* тик «сейчас в работе» на карточках */
  var timer = null;
  function startTick() {
    if (timer) return;
    timer = setInterval(function () {
      var win = document.getElementById('win-agents');
      if (!win || !win.classList.contains('is-open') || document.hidden) return;
      cards.forEach(function (c) { if (c.__tick) c.__tick(); });
    }, 3200);
  }

  function ensure() {
    if (!built) { built = true; initTabs(); renderTeam(); startTick(); }
  }

  document.addEventListener('i18n:change', function () {
    if (!built) return;
    renderTeam();
    var tasksPane = document.getElementById('agpTasks');
    if (tasksPane && tasksPane.classList.contains('is-on')) renderTasks();
    var op = document.getElementById('agpOffice');
    if (officeBuilt) { officeBuilt = false; if (op && op.classList.contains('is-on')) renderOffice(); }
    if (sceneBuilt) {
      sceneBuilt = false;
      if (window.Office3D && window.Office3D.dispose) window.Office3D.dispose();
      var sp = document.getElementById('agpScene');
      if (sp) { sp.innerHTML = ''; if (sp.classList.contains('is-on')) renderScene(); }
    }
  });

  window.AgentsPanel = { ensure: ensure };
})();
