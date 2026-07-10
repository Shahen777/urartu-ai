/* ============================================================
   ЛОТ U — Полноценная CRM-панель ООО «Вектор» (окно win-pulse).
   5 разделов: Обзор (gridstack-виджеты) / Задачи (канбан +
   FullCalendar) / Сотрудники / Финансы / Активы.
   Подключается ЛЕНИВО из os.js при первом открытии окна.
   Сам дотягивает vendor/echarts.min.js (Apache-2.0),
   vendor/gridstack/* (MIT), vendor/fullcalendar/* (MIT),
   vendor/countup.umd.js (MIT), vendor/tabler/tabler-crm.css
   (сабсет Tabler, MIT) — локально, никаких CDN.
   Данные — детерминированный генератор с сидом:
   ни одного Math.random в отрисовке (повторяемость для тестов).
   ============================================================ */
(function () {
  'use strict';

  var DEV = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  function lang() { return (window.__lang === 'en') ? 'en' : 'ru'; }
  function loc() { return lang() === 'en' ? 'en-US' : 'ru-RU'; }
  function tr(key) { return (window.I18N && window.I18N.t) ? window.I18N.t(key, lang()) : key; }
  function T(key, map) {
    var s = tr(key);
    Object.keys(map).forEach(function (k) { s = s.replace('{' + k + '}', map[k]); });
    return s;
  }
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isTouch = window.matchMedia('(pointer:coarse)').matches;

  /* ---------- ФОРМАТИРОВАНИЕ: рубли + русские даты, EN → $ + en-US ---------- */
  var USD_RATE = 90; // фикс. курс демо-данных: детерминизм важнее точности
  function fmtMoney(rub) {
    var en = lang() === 'en';
    return new Intl.NumberFormat(loc(), { style: 'currency', currency: en ? 'USD' : 'RUB', maximumFractionDigits: 0 })
      .format(en ? rub / USD_RATE : rub);
  }
  function fmtMoneyC(rub) { // компакт: «4,8 млн ₽» / "$53K"
    var en = lang() === 'en';
    return new Intl.NumberFormat(loc(), { style: 'currency', currency: en ? 'USD' : 'RUB', notation: 'compact', maximumFractionDigits: 1 })
      .format(en ? rub / USD_RATE : rub);
  }
  function fmtInt(v) { return new Intl.NumberFormat(loc(), { maximumFractionDigits: 0 }).format(Math.round(v)); }
  function fmtPct1(v) { return new Intl.NumberFormat(loc(), { maximumFractionDigits: 1 }).format(v); }
  function fmtDate(d) { return new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'short' }).format(d); }
  function fmtMonth(d) { return new Intl.DateTimeFormat(loc(), { month: 'short' }).format(d); }
  function weekdayName(i) { // i: 0=Пн … 6=Вс
    var mon = new Date(Date.UTC(2026, 0, 5)); // понедельник
    return new Intl.DateTimeFormat(loc(), { weekday: 'short', timeZone: 'UTC' })
      .format(new Date(mon.getTime() + i * 86400000));
  }
  function today0() { var d = new Date(); d.setHours(12, 0, 0, 0); return d; }
  function dayOff(off) { return new Date(today0().getTime() + off * 86400000); }
  function isoDay(d) {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /* ---------- ДЕТЕРМИНИРОВАННЫЙ ГЕНЕРАТОР (mulberry32, сид фиксирован) ---------- */
  var SEED = 20260401;
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  var N = 90;              // дней истории
  var AVG_CHECK = 42500;   // средний чек сделки, ₽

  var D = null;
  function buildData() {
    if (D) return D;
    var rnd = mulberry32(SEED);
    var today = today0();
    var days = [], leads = [], deals = [], rev = [], ai = [];
    var wdLeadK = [1.0, 1.12, 1.06, 1.0, 0.94, 0.42, 0.34]; // Пн…Вс
    for (var i = 0; i < N; i++) {
      var d = new Date(today.getTime() - (N - 1 - i) * 86400000);
      days.push(d);
      var wd = (d.getDay() + 6) % 7;
      var growth = 1 + i * 0.0035;
      var season = 1 + 0.06 * Math.sin(i / 8.5);
      var L = Math.round(26 * wdLeadK[wd] * growth * season * (0.86 + 0.28 * rnd()));
      var conv = 0.145 + i * 0.0004 + (rnd() * 0.05 - 0.025);
      var dl = Math.max(0, Math.round(L * conv));
      leads.push(L);
      deals.push(dl);
      rev.push(Math.round(dl * AVG_CHECK * (0.88 + 0.24 * rnd())));
      ai.push(Math.round(88 * (wd < 5 ? 1 : 0.72) * growth * (0.8 + 0.4 * rnd())));
    }
    /* тепловая карта 24×7: люди днём в будни, ИИ — круглосуточно */
    var rnd2 = mulberry32(SEED ^ 0x9E3779B9);
    var heat = [];
    for (var w = 0; w < 7; w++) {
      var row = [];
      for (var h = 0; h < 24; h++) {
        var human = (w < 5 && h >= 9 && h <= 18) ? 1 : 0.05;
        var aiK = (h >= 9 && h <= 19) ? 1 : (h >= 20 || h <= 1 ? 0.62 : 0.4);
        if (w >= 5) aiK *= 0.8;
        row.push(+(2.4 * human + 3.4 * aiK * (0.82 + 0.36 * rnd2())).toFixed(1));
      }
      heat.push(row);
    }
    D = { days: days, leads: leads, deals: deals, rev: rev, ai: ai, heat: heat };
    return D;
  }
  function sum(arr, from, to) { var s = 0; for (var i = from; i < to; i++) s += arr[i]; return s; }

  /* ---------- ФИНАНСЫ: 12 месяцев (детерминированно) ---------- */
  var FIN = null;
  function buildFin() {
    if (FIN) return FIN;
    var rnd = mulberry32(SEED ^ 0x51AB);
    var t = today0();
    var months = [], rev = [], cogs = [], fot = [], ai = [], rent = [], mkt = [], other = [], exp = [], profit = [];
    for (var i = 0; i < 12; i++) {
      var m = new Date(t.getFullYear(), t.getMonth() - 11 + i, 1);
      months.push(m);
      var r = Math.round(3250000 * (1 + i * 0.028) * (1 + 0.05 * Math.sin(i / 2.1)) * (0.94 + 0.12 * rnd()));
      rev.push(r);
      var f = i < 10 ? 690000 : 540000;      // с ИИ часть рутины ушла из ФОТ
      var a = i < 10 ? 0 : 75000;            // ИИ-штат появился 2 месяца назад
      var cg = Math.round(r * 0.43);
      var ot = Math.round(118000 + r * 0.018);
      cogs.push(cg); fot.push(f); ai.push(a); rent.push(160000); mkt.push(310000); other.push(ot);
      var e = cg + f + a + 160000 + 310000 + ot;
      exp.push(e); profit.push(r - e);
    }
    FIN = { months: months, rev: rev, cogs: cogs, fot: fot, ai: ai, rent: rent, mkt: mkt, other: other, exp: exp, profit: profit };
    return FIN;
  }

  /* ---------- ШТАТ ООО «ВЕКТОР»: люди + ИИ вперемешку ---------- */
  /* humanEq — сколько стоила бы та же рутина живой ставкой (для экономии) */
  var EMP = [
    { id: 'h1', nameKey: 'crm.n1', roleKey: 'crm.rl.mgr',  pay: 90000,  done: 47,   unit: 'crm.u.deals', load: 82, kpi: 92, st: 'work', hue: 210, aboutKey: 'crm.ah.1' },
    { id: 'documoved', ai: true, nameKey: 'msg.n.documoved', roleKey: 'crm.rl.docs', pay: 15000, done: 1240, unit: 'crm.u.reqs',  load: 71, kpi: 99, st: 'a247', humanEq: 55000, aboutKey: 'crm.a.doc' },
    { id: 'h2', nameKey: 'crm.n2', roleKey: 'crm.rl.head', pay: 150000, done: 26,   unit: 'crm.u.deals', load: 74, kpi: 88, st: 'work', hue: 262, aboutKey: 'crm.ah.2' },
    { id: 'support', ai: true, nameKey: 'msg.n.support', roleKey: 'crm.rl.sup', pay: 15000, done: 890, unit: 'crm.u.tick', load: 64, kpi: 97, st: 'a247', humanEq: 50000, aboutKey: 'crm.a.sup' },
    { id: 'h3', nameKey: 'crm.n3', roleKey: 'crm.rl.law',  pay: 120000, done: 34,   unit: 'crm.u.cont',  load: 76, kpi: 90, st: 'vac',  hue: 16, aboutKey: 'crm.ah.3' },
    { id: 'secretary', ai: true, nameKey: 'msg.n.secretary', roleKey: 'crm.rl.rec', pay: 15000, done: 320, unit: 'crm.u.call', load: 51, kpi: 98, st: 'a247', humanEq: 40000, aboutKey: 'crm.a.sec' },
    { id: 'h4', nameKey: 'crm.n4', roleKey: 'crm.rl.acc',  pay: 85000,  done: 210,  unit: 'crm.u.docs',  load: 68, kpi: 94, st: 'work', hue: 130, aboutKey: 'crm.ah.4' },
    { id: 'lawyer', ai: true, nameKey: 'msg.n.lawyer', roleKey: 'crm.rl.legal', pay: 15000, done: 156, unit: 'crm.u.cont', load: 58, kpi: 96, st: 'a247', humanEq: 45000, aboutKey: 'crm.a.law' },
    { id: 'h5', nameKey: 'crm.n5', roleKey: 'crm.rl.mkt',  pay: 95000,  done: 18,   unit: 'crm.u.camp',  load: 61, kpi: 86, st: 'work', hue: 330, aboutKey: 'crm.ah.5' },
    { id: 'content', ai: true, nameKey: 'staff.e5.role', roleKey: 'crm.rl.content', pay: 15000, done: 96, unit: 'crm.u.post', load: 46, kpi: 95, st: 'a247', humanEq: 35000, aboutKey: 'crm.a.con' }
  ];
  function empById(id) {
    for (var i = 0; i < EMP.length; i++) if (EMP[i].id === id) return EMP[i];
    return EMP[0];
  }
  function totals() {
    var h = 0, a = 0, eq = 0;
    EMP.forEach(function (e) { if (e.ai) { a += e.pay; eq += e.humanEq; } else h += e.pay; });
    return { human: h, ai: a, eq: eq, saveMo: eq - a }; // 540 000 / 75 000 / 225 000 / 150 000
  }
  var IMPL_COST = 300000; // внедрение ИИ-штата, ₽ → окупаемость 2 мес

  /* ---------- ЗАДАЧИ: канбан + календарь (детерминированный набор) ---------- */
  var COLS = ['new', 'work', 'review', 'done'];
  var TASKS = [
    { id: 't1',  k: 'crm.tk.1',  who: 'lawyer',    col: 'done',   due: -1, pr: 'mid', aiMin: 12 },
    { id: 't2',  k: 'crm.tk.2',  who: 'support',   col: 'done',   due: -1, pr: 'hi',  aiMin: 4 },
    { id: 't3',  k: 'crm.tk.3',  who: 'h1',        col: 'work',   due: 1,  pr: 'hi' },
    { id: 't4',  k: 'crm.tk.4',  who: 'documoved', col: 'review', due: 1,  pr: 'mid', aiMin: 9 },
    { id: 't5',  k: 'crm.tk.5',  who: 'h2',        col: 'work',   due: 2,  pr: 'hi' },
    { id: 't6',  k: 'crm.tk.6',  who: 'h1',        col: 'new',    due: 2,  pr: 'mid' },
    { id: 't7',  k: 'crm.tk.7',  who: 'content',   col: 'done',   due: 0,  pr: 'lo',  aiMin: 6 },
    { id: 't8',  k: 'crm.tk.8',  who: 'h5',        col: 'new',    due: 3,  pr: 'hi' },
    { id: 't9',  k: 'crm.tk.9',  who: 'h4',        col: 'done',   due: -2, pr: 'mid' },
    { id: 't10', k: 'crm.tk.10', who: 'lawyer',    col: 'review', due: 1,  pr: 'hi',  aiMin: 15 },
    { id: 't11', k: 'crm.tk.11', who: 'secretary', col: 'done',   due: -1, pr: 'mid', aiMin: 18 },
    { id: 't12', k: 'crm.tk.12', who: 'support',   col: 'work',   due: 0,  pr: 'mid' },
    { id: 't13', k: 'crm.tk.13', who: 'h4',        col: 'work',   due: 4,  pr: 'mid' },
    { id: 't14', k: 'crm.tk.14', who: 'content',   col: 'new',    due: 5,  pr: 'mid' },
    { id: 't15', k: 'crm.tk.15', who: 'h2',        col: 'new',    due: 6,  pr: 'lo' },
    { id: 't16', k: 'crm.tk.16', who: 'documoved', col: 'done',   due: 0,  pr: 'lo',  aiMin: 22 },
    { id: 't17', k: 'crm.tk.17', who: 'h2',        col: 'new',    due: 3,  pr: 'hi' },
    { id: 't18', k: 'crm.tk.18', who: 'h5',        col: 'review', due: 2,  pr: 'mid' }
  ];
  var MEET = [ // встречи только для календаря
    { id: 'm1', k: 'crm.ev.plan', off: 1, time: '09:30' },
    { id: 'm2', k: 'crm.ev.demo', off: 3, time: '14:00' },
    { id: 'm3', k: 'crm.ev.plan', off: 8, time: '09:30' }
  ];
  function taskById(id) {
    for (var i = 0; i < TASKS.length; i++) if (TASKS[i].id === id) return TASKS[i];
    return null;
  }

  /* ---------- АКТИВЫ ---------- */
  var ASSETS = [
    { n: 'crm.as1.n', cat: 'ai',  gpu: 64,   up: 99.9, st: 'on',  val: 450000 },
    { n: 'crm.as2.n', cat: 'ai',  gpu: 41,   up: 99.7, st: 'on',  val: 180000 },
    { n: 'crm.as3.n', cat: 'ai',  gpu: 23,   up: 100,  st: 'on',  val: 450000 },
    { n: 'crm.as4.n', cat: 'it',  gpu: null, up: 99.9, st: 'on',  val: 210000 },
    { n: 'crm.as5.n', cat: 'car', gpu: null, up: null, st: 'out', val: 1850000 },
    { n: 'crm.as6.n', cat: 'eq',  gpu: null, up: null, st: 'use', val: 540000 },
    { n: 'crm.as7.n', cat: 'eq',  gpu: null, up: null, st: 'on',  val: 85000 }
  ];

  /* ---------- ПЛАТЕЖИ (демо, детерминированно) ---------- */
  var PAYS = [
    { off: -1, who: 'crm.p1.who', what: 'crm.p1.what', sum:  386000, st: 'ok' },
    { off: -1, who: 'crm.p2.who', what: 'crm.p2.what', sum: -160000, st: 'ok' },
    { off: -2, who: 'crm.p3.who', what: 'crm.p3.what', sum:  512000, st: 'ok' },
    { off: -3, who: 'crm.p4.who', what: 'crm.p4.what', sum: -540000, st: 'ok' },
    { off: -4, who: 'crm.p5.who', what: 'crm.p5.what', sum:   85000, st: 'wait' },
    { off: -5, who: 'crm.p6.who', what: 'crm.p6.what', sum: -120000, st: 'ok' },
    { off: -6, who: 'crm.p7.who', what: 'crm.p7.what', sum:  -38500, st: 'ok' },
    { off: -7, who: 'crm.p8.who', what: 'crm.p8.what', sum:  250000, st: 'wait' }
  ];

  /* ---------- ЛЕНТА ИИ-АКТИВНОСТИ (Обзор) ---------- */
  var FEED = [
    { t: '13:12', k: 'crm.fd.1', who: 'lawyer' },
    { t: '12:38', k: 'crm.fd.2', who: 'support' },
    { t: '11:26', k: 'crm.fd.3', who: 'secretary' },
    { t: '10:03', k: 'crm.fd.4', who: 'documoved' },
    { t: '09:17', k: 'crm.fd.5', who: 'content' },
    { t: '07:45', k: 'crm.fd.6', who: 'support' }
  ];

  /* ---------- ПАЛИТРА ПОД ТЕМУ ---------- */
  function isLight() { return document.documentElement.classList.contains('theme-light'); }
  function pal() {
    var l = isLight();
    return {
      txt: l ? 'rgba(0,0,0,.66)' : 'rgba(255,255,255,.72)',
      txtDim: l ? 'rgba(0,0,0,.45)' : 'rgba(255,255,255,.45)',
      split: l ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.09)',
      axis: l ? 'rgba(0,0,0,.16)' : 'rgba(255,255,255,.18)',
      tipBg: l ? 'rgba(255,255,255,.96)' : 'rgba(30,30,34,.96)',
      tipTxt: l ? '#1D1D1F' : '#F5F5F7',
      heatLo: l ? '#e8eef7' : '#12203a',
      blue: '#0A84FF', green: '#2fb344', violet: '#5E5CE6', purple: '#BF5AF2',
      amber: '#f59f00', red: '#d63939',
      gray: l ? 'rgba(0,0,0,.28)' : 'rgba(255,255,255,.30)'
    };
  }
  function baseText(o) {
    var p = pal();
    o.textStyle = { color: p.txt, fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,system-ui,sans-serif' };
    o.tooltip = o.tooltip || {};
    o.tooltip.backgroundColor = p.tipBg;
    o.tooltip.borderWidth = 0;
    o.tooltip.textStyle = { color: p.tipTxt, fontSize: 12 };
    return o;
  }

  var charts = {};
  function chart(elId) {
    var el = document.getElementById(elId);
    if (!el || !window.echarts) return null;
    if (!charts[elId]) charts[elId] = window.echarts.init(el, null, { renderer: 'canvas' });
    return charts[elId];
  }
  var TABCHARTS = {
    over: ['crmChRev12', 'crmChFunnel'],
    tasks: [],
    staff: [],
    fin: ['crmChFin', 'crmChExp', 'crmChBefore'],
    assets: ['crmChGpu', 'crmChHeat']
  };

  /* ---------- СОСТОЯНИЕ ---------- */
  var state = { tab: 'over', view: 'kb', sort: null, dir: 1, open: null, filter: 'all' };
  var rendered = { over: false, tasks: false, staff: false, fin: false, assets: false };

  /* ================= РАЗДЕЛ 1: ОБЗОР ================= */
  function spark(vals, color) {
    var n = vals.length, min = Infinity, max = -Infinity, i;
    for (i = 0; i < n; i++) { if (vals[i] < min) min = vals[i]; if (vals[i] > max) max = vals[i]; }
    var span = (max - min) || 1, pts = [];
    for (i = 0; i < n; i++) {
      pts.push((i / (n - 1) * 100).toFixed(1) + ',' + (24 - (vals[i] - min) / span * 20).toFixed(1));
    }
    return '<svg class="crm-kpi__spark" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">' +
      '<polygon class="sp-fill" fill="' + color + '" stroke="none" points="0,26 ' + pts.join(' ') + ' 100,26"></polygon>' +
      '<polyline stroke="' + color + '" points="' + pts.join(' ') + '"></polyline></svg>';
  }
  var cuInst = {};
  function setVal(id, value, fmt) {
    var el = document.getElementById(id);
    if (!el) return;
    var opts = { duration: reduceMotion ? 0 : 1.1, formattingFn: fmt };
    if (window.countUp && window.countUp.CountUp && !reduceMotion) {
      var cu = new window.countUp.CountUp(el, Math.round(value), opts);
      if (!cu.error) { cuInst[id] = cu; cu.start(); return; }
    }
    el.textContent = fmt(Math.round(value));
  }
  function activeTasksToday() {
    var n = 0;
    TASKS.forEach(function (t) { if (t.col !== 'done' && t.due <= 1) n++; });
    return n;
  }
  function renderKpis() {
    var box = document.getElementById('crmKpis');
    if (!box) return;
    var d = buildData(), f = buildFin(), p = pal(), t = totals();
    var rev30 = sum(d.rev, 60, 90), revP = sum(d.rev, 30, 60);
    var leads30 = sum(d.leads, 60, 90);
    var act = Math.round(leads30 * 0.58 * 0.55); // сделки в работе (квал.→КП)
    var actP = Math.round(sum(d.leads, 30, 60) * 0.58 * 0.55);
    var ai30 = sum(d.ai, 60, 90), aiP = sum(d.ai, 30, 60);
    var savePrev = t.saveMo * (aiP / ai30);
    var K = [
      { id: 'rev',    l: 'crm.k.rev',       v: rev30,          prev: revP,          money: 1, s: d.rev.slice(60),    c: p.blue },
      { id: 'profit', l: 'crm.k.profit',    v: f.profit[11],   prev: f.profit[10],  money: 1, s: f.profit,           c: p.violet },
      { id: 'deal',   l: 'crm.k.deals.act', v: act,            prev: actP,          money: 0, s: d.deals.slice(60),  c: p.purple },
      { id: 'task',   l: 'crm.k.tasks',     v: activeTasksToday(), prev: null,      money: 0, s: d.ai.slice(60),     c: p.amber },
      { id: 'save',   l: 'crm.k.save',      v: t.saveMo,       prev: savePrev,      money: 1, s: d.ai.slice(60),     c: p.green }
    ];
    var html = '';
    K.forEach(function (k) {
      var delta = '';
      if (k.prev) {
        var pct = Math.round((k.v - k.prev) / k.prev * 100);
        delta = '<span class="crm-kpi__d ' + (pct >= 0 ? 'is-up' : 'is-down') + '" title="' + tr('crm.vs') + '">' +
          (pct >= 0 ? '▲ +' : '▼ ') + pct + '%</span>';
      }
      html += '<div class="crm-kpi"><span class="crm-kpi__l">' + tr(k.l) + '</span>' +
        '<span class="crm-kpi__row"><b class="crm-kpi__v" id="crmK-' + k.id + '">—</b>' + delta + '</span>' +
        spark(k.s, k.c) + '</div>';
    });
    box.innerHTML = html;
    K.forEach(function (k) {
      setVal('crmK-' + k.id, k.v, k.money ? fmtMoneyC : fmtInt);
    });
  }
  function renderRev12() {
    var c = chart('crmChRev12'); if (!c) return;
    var f = buildFin(), p = pal();
    var labels = f.months.map(fmtMonth);
    c.setOption(baseText({
      grid: { left: 52, right: 12, top: 30, bottom: 24 },
      legend: { top: 0, textStyle: { color: p.txt, fontSize: 11 }, itemWidth: 14, itemHeight: 9 },
      tooltip: { trigger: 'axis', valueFormatter: function (v) { return fmtMoney(v); } },
      xAxis: { type: 'category', data: labels, axisLine: { lineStyle: { color: p.axis } }, axisLabel: { color: p.txtDim, fontSize: 10 } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: p.split } },
        axisLabel: { color: p.txtDim, fontSize: 10, formatter: function (v) { return fmtMoneyC(v); } } },
      series: [
        { name: tr('crm.s.rev'), type: 'bar', data: f.rev, barMaxWidth: 14,
          itemStyle: { color: p.blue, opacity: 0.85, borderRadius: [3, 3, 0, 0] } },
        { name: tr('crm.s.exp'), type: 'bar', data: f.exp, barMaxWidth: 14,
          itemStyle: { color: p.gray, opacity: 0.8, borderRadius: [3, 3, 0, 0] } },
        { name: tr('crm.s.profit'), type: 'line', data: f.profit, smooth: true, showSymbol: false,
          lineStyle: { color: p.green, width: 2.2 }, itemStyle: { color: p.green } }
      ]
    }), true);
  }
  function renderFunnel() {
    var c = chart('crmChFunnel'); if (!c) return;
    var d = buildData(), p = pal();
    var leads = sum(d.leads, 60, 90);
    var qual = Math.round(leads * 0.58);
    var kp = Math.round(qual * 0.55);
    var pay = sum(d.deals, 60, 90);
    var st = [
      { name: tr('crm.f.lead'), value: leads, itemStyle: { color: p.blue } },
      { name: tr('crm.f.qual'), value: qual,  itemStyle: { color: p.violet } },
      { name: tr('crm.f.kp'),   value: kp,    itemStyle: { color: p.purple } },
      { name: tr('crm.f.pay'),  value: pay,   itemStyle: { color: p.green } }
    ];
    c.setOption(baseText({
      tooltip: {
        trigger: 'item',
        formatter: function (ev) {
          var i = ev.dataIndex, prev = i > 0 ? st[i - 1].value : null;
          var s = ev.name + ': <b>' + fmtInt(ev.value) + '</b>';
          if (prev) s += '<br>' + tr('crm.f.conv') + ': ' + Math.round(ev.value / prev * 100) + '%';
          if (i === st.length - 1) s += '<br>' + tr('crm.f.total') + ': ' + Math.round(ev.value / st[0].value * 100) + '%';
          return s;
        }
      },
      series: [{
        type: 'funnel', sort: 'descending', gap: 4,
        left: '4%', width: '92%', top: 6, bottom: 6, minSize: '24%',
        label: { show: true, position: 'inside', color: '#fff', fontSize: 11.5, fontWeight: 600,
          formatter: function (ev) { return ev.name + '  ·  ' + fmtInt(ev.value); } },
        itemStyle: { borderColor: 'transparent', borderRadius: 4 },
        emphasis: { label: { fontSize: 12.5 } },
        data: st
      }]
    }), true);
  }
  function miniAva(e) {
    var name = tr(e.nameKey);
    return e.ai
      ? '<img class="crm-ava crm-ava--xs" src="avatars/' + e.id + '-real.webp" alt="" width="20" height="20" loading="lazy">'
      : '<span class="crm-ava crm-ava--xs crm-ava--ini" style="--h:' + e.hue + '" aria-hidden="true">' + initials(name) + '</span>';
  }
  /* сводка «что ИИ сделал за неделю» — детерминированно из данных */
  function renderWeek() {
    var el = document.getElementById('crmWeekBody');
    if (!el) return;
    var d = buildData(), t = totals();
    var reqs = sum(d.ai, N - 7, N);          // заявок/задач, закрытых ИИ за 7 дней
    var hours = Math.round(reqs * 3.5 / 60); // ~3,5 мин рабочего времени на заявку
    var money = Math.round(t.saveMo * 7 / 30 / 500) * 500; // округляем до 500 для чистой цифры
    el.innerHTML = T('crm.week.body', { t: fmtInt(reqs), h: fmtInt(hours), m: fmtMoney(money) });
  }
  function nextList() {
    var list = TASKS.filter(function (t) { return t.col !== 'done'; });
    if (state.filter !== 'all') list = list.filter(function (t) { return t.who === state.filter; });
    return list.sort(function (a, b) { return a.due - b.due; }).slice(0, 6);
  }
  function renderNext() {
    var box = document.getElementById('crmNext');
    if (!box) return;
    var list = nextList();
    var html = '';
    list.forEach(function (t) {
      var e = empById(t.who);
      var d = dayOff(t.due);
      html += '<li class="crm-next__i">' +
        '<span class="crm-next__d' + (t.due <= 1 ? ' is-soon' : '') + '">' + fmtDate(d) + '</span>' +
        '<span class="crm-next__t">' + tr(t.k) + '</span>' +
        '<span class="crm-next__w">' + miniAva(e) + (e.ai ? '<i class="crm-aitag">🤖</i>' : '') + '</span></li>';
    });
    if (!list.length) html = '<li class="crm-next__i crm-empty">' + tr('crm.filt.none') + '</li>';
    box.innerHTML = html;
  }
  function renderFeed() {
    var box = document.getElementById('crmFeed');
    if (!box) return;
    var list = FEED.filter(function (f) { return state.filter === 'all' || f.who === state.filter; });
    var html = '';
    list.forEach(function (f) {
      var e = empById(f.who);
      html += '<li class="crm-feed__i">' + miniAva(e) +
        '<div><span class="crm-feed__t">' + f.t + ' · ' + tr(e.nameKey) + '</span>' +
        '<p>' + tr(f.k) + '</p></div></li>';
    });
    if (!list.length) html = '<li class="crm-feed__i crm-empty">' + tr('crm.filt.none') + '</li>';
    box.innerHTML = html;
  }
  /* заполнение и логика фильтра по сотруднику (Обзор) */
  function fillFilter() {
    var sel = document.getElementById('crmEmpFilter');
    if (!sel) return;
    var opts = '<option value="all">' + tr('crm.filt.all') + '</option>';
    EMP.forEach(function (e) {
      opts += '<option value="' + e.id + '"' + (state.filter === e.id ? ' selected' : '') + '>' +
        (e.ai ? '🤖 ' : '') + empName(e) + '</option>';
    });
    sel.innerHTML = opts;
    sel.value = state.filter;
    var rst = document.getElementById('crmFilterReset');
    if (rst) rst.hidden = (state.filter === 'all');
  }
  function bindFilter() {
    var sel = document.getElementById('crmEmpFilter');
    if (sel) sel.addEventListener('change', function () {
      state.filter = sel.value || 'all';
      var rst = document.getElementById('crmFilterReset');
      if (rst) rst.hidden = (state.filter === 'all');
      renderNext(); renderFeed();
    });
    var rst = document.getElementById('crmFilterReset');
    if (rst) rst.addEventListener('click', function () {
      state.filter = 'all';
      fillFilter(); renderNext(); renderFeed();
    });
  }

  /* ---------- GRIDSTACK: перетаскиваемые виджеты Обзора ---------- */
  var grid = null;
  var GRID_KEY = 'vectorCrmGrid.v1';
  var GRID_DEF = [
    { id: 'rev12',  x: 0, y: 0, w: 7, h: 5 },
    { id: 'funnel', x: 7, y: 0, w: 5, h: 5 },
    { id: 'next',   x: 0, y: 5, w: 7, h: 5 },
    { id: 'feed',   x: 7, y: 5, w: 5, h: 5 }
  ];
  function gridCharts() {
    ['crmChRev12', 'crmChFunnel'].forEach(function (id) {
      if (charts[id]) { try { charts[id].resize(); } catch (e) {} }
    });
  }
  function saveGrid() {
    if (!grid) return;
    try {
      if (grid.getColumn && grid.getColumn() !== 12) return; // не сохранять мобильную раскладку
      var lay = grid.save(false, false);
      var slim = (lay || []).map(function (n) { return { id: n.id, x: n.x, y: n.y, w: n.w, h: n.h }; });
      localStorage.setItem(GRID_KEY, JSON.stringify(slim));
    } catch (e) {}
  }
  function initGrid() {
    var el = document.getElementById('crmGrid');
    if (!el || !window.GridStack || grid) return;
    grid = window.GridStack.init({
      column: 12,
      cellHeight: 60,
      margin: 6,
      float: false,
      handle: '.crm-card__h',
      staticGrid: isTouch,
      columnOpts: { breakpointForWindow: true, breakpoints: [{ w: 760, c: 1 }] }
    }, el);
    try {
      var saved = JSON.parse(localStorage.getItem(GRID_KEY) || 'null');
      if (saved && saved.length === GRID_DEF.length) grid.load(saved);
    } catch (e) {}
    grid.on('change', function () { saveGrid(); gridCharts(); });
    grid.on('resizestop', function () { setTimeout(gridCharts, 60); });
    var reset = document.getElementById('crmGridReset');
    if (reset) reset.addEventListener('click', function () {
      try { localStorage.removeItem(GRID_KEY); } catch (e) {}
      grid.load(GRID_DEF);
      setTimeout(gridCharts, 60);
    });
  }

  /* ================= РАЗДЕЛ 2: ЗАДАЧИ (канбан + календарь) ================= */
  function prBadge(pr) {
    return '<span class="kb-pr kb-pr--' + pr + '">' + tr('crm.pr.' + pr) + '</span>';
  }
  function renderKanban() {
    var box = document.getElementById('crmKanban');
    if (!box) return;
    var html = '';
    COLS.forEach(function (col) {
      var list = TASKS.filter(function (t) { return t.col === col; })
        .sort(function (a, b) { return a.due - b.due; });
      html += '<div class="kb-col kb-col--' + col + '" data-col="' + col + '">' +
        '<header class="kb-col__h"><span>' + tr('crm.col.' + col) + '</span><b>' + list.length + '</b></header>' +
        '<div class="kb-col__list" data-col="' + col + '">';
      list.forEach(function (t) {
        var e = empById(t.who);
        var d = dayOff(t.due);
        var ai = e.ai;
        var doneAi = ai && t.col === 'done' && t.aiMin;
        html += '<article class="kb-card' + (ai ? ' is-ai' : '') + '" draggable="' + (!isTouch) + '" data-task="' + t.id + '" tabindex="0">' +
          '<div class="kb-card__top">' + prBadge(t.pr) +
          '<span class="kb-due' + (t.due <= 1 && t.col !== 'done' ? ' is-soon' : '') + '">' +
          (t.col === 'done' ? '✓ ' : tr('crm.tk.due') + ' ') + fmtDate(d) + '</span></div>' +
          '<h4>' + tr(t.k) + '</h4>' +
          '<div class="kb-card__who">' + miniAva(e) + '<span>' + tr(e.nameKey) + '</span>' +
          (ai ? '<i class="crm-aitag" title="' + tr('crm.tk.ai') + '">🤖</i>' : '') + '</div>' +
          (doneAi ? '<div class="kb-card__ai">' + T('crm.tk.aiMin', { m: t.aiMin }) + '</div>' : '') +
          '</article>';
      });
      html += '</div></div>';
    });
    box.innerHTML = html;
  }
  var dragId = null;
  function bindKanban() {
    var box = document.getElementById('crmKanban');
    if (!box) return;
    box.addEventListener('dragstart', function (ev) {
      var card = ev.target.closest('.kb-card');
      if (!card) return;
      dragId = card.getAttribute('data-task');
      card.classList.add('is-drag');
      try { ev.dataTransfer.setData('text/plain', dragId); ev.dataTransfer.effectAllowed = 'move'; } catch (e) {}
    });
    box.addEventListener('dragend', function (ev) {
      var card = ev.target.closest('.kb-card');
      if (card) card.classList.remove('is-drag');
      Array.prototype.forEach.call(box.querySelectorAll('.kb-col.is-over'), function (c) { c.classList.remove('is-over'); });
    });
    box.addEventListener('dragover', function (ev) {
      var col = ev.target.closest('.kb-col');
      if (!col || !dragId) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      Array.prototype.forEach.call(box.querySelectorAll('.kb-col.is-over'), function (c) { if (c !== col) c.classList.remove('is-over'); });
      col.classList.add('is-over');
    });
    box.addEventListener('drop', function (ev) {
      var col = ev.target.closest('.kb-col');
      if (!col || !dragId) return;
      ev.preventDefault();
      var t = taskById(dragId);
      if (t) { t.col = col.getAttribute('data-col'); }
      dragId = null;
      renderKanban();
      if (rendered.over) { renderKpis(); renderNext(); }
      if (cal) rebuildCalEvents();
    });
  }

  /* ---------- FullCalendar ---------- */
  var cal = null;
  function calEvents() {
    var evs = [];
    var p = pal();
    var colColor = { new: p.blue, work: p.amber, review: p.violet, done: p.gray };
    TASKS.forEach(function (t) {
      var e = empById(t.who);
      evs.push({
        id: t.id,
        title: (e.ai ? '🤖 ' : '') + tr(t.k),
        start: isoDay(dayOff(t.due)),
        allDay: true,
        color: colColor[t.col],
        editable: true
      });
    });
    MEET.forEach(function (m) {
      evs.push({
        id: m.id,
        title: '📅 ' + tr(m.k),
        start: isoDay(dayOff(m.off)) + 'T' + m.time + ':00',
        color: p.green,
        editable: false
      });
    });
    return evs;
  }
  function buildCal() {
    var el = document.getElementById('crmCal');
    if (!el || !window.FullCalendar) return;
    if (cal) { try { cal.destroy(); } catch (e) {} cal = null; }
    cal = new window.FullCalendar.Calendar(el, {
      initialView: 'dayGridMonth',
      locale: lang() === 'en' ? 'en' : 'ru',
      firstDay: 1,
      height: 'auto',
      headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
      buttonText: lang() === 'en' ? undefined : { today: 'сегодня' },
      dayMaxEventRows: 3,
      editable: !reduceMotion,
      eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
      events: calEvents(),
      eventDrop: function (info) {
        var t = taskById(info.event.id);
        if (!t) return;
        var nd = info.event.start;
        t.due = Math.round((new Date(nd.getFullYear(), nd.getMonth(), nd.getDate(), 12) - today0()) / 86400000);
        renderKanban();
        if (rendered.over) renderNext();
      }
    });
    cal.render();
  }
  function rebuildCalEvents() {
    if (!cal) return;
    try {
      cal.removeAllEvents();
      calEvents().forEach(function (e) { cal.addEvent(e); });
    } catch (e) {}
  }
  function showView(v) {
    state.view = v;
    var kb = document.getElementById('crmKanban');
    var cw = document.getElementById('crmCalWrap');
    var chips = document.querySelectorAll('#crmView .pchip');
    Array.prototype.forEach.call(chips, function (b) {
      var sel = b.dataset.view === v;
      b.classList.toggle('is-sel', sel);
      b.setAttribute('aria-checked', sel ? 'true' : 'false');
    });
    if (kb) kb.hidden = (v !== 'kb');
    if (cw) cw.hidden = (v !== 'cal');
    if (v === 'cal') {
      if (!cal) buildCal();
      else requestAnimationFrame(function () { try { cal.updateSize(); } catch (e) {} });
    }
  }
  function bindTasks() {
    var vc = document.getElementById('crmView');
    if (vc) vc.addEventListener('click', function (e) {
      var b = e.target.closest('[data-view]');
      if (b) showView(b.dataset.view);
    });
    bindKanban();
  }

  /* ================= РАЗДЕЛ 3: СОТРУДНИКИ ================= */
  function empName(e) { return tr(e.nameKey); }
  function initials(name) {
    var w = name.split(/\s+/), s = '';
    for (var i = 0; i < w.length && s.length < 2; i++) if (w[i]) s += w[i][0].toUpperCase();
    return s;
  }
  function stBadge(st) {
    if (st === 'vac') return '<span class="crm-badge crm-badge--vac">' + tr('crm.st.vac') + '</span>';
    if (st === 'a247') return '<span class="crm-badge crm-badge--247">' + tr('crm.st.247') + '</span>';
    return '<span class="crm-badge crm-badge--ok">' + tr('crm.st.work') + '</span>';
  }
  var SORT_VAL = {
    name: function (e) { return empName(e); },
    role: function (e) { return tr(e.roleKey); },
    type: function (e) { return e.ai ? 1 : 0; },
    pay:  function (e) { return e.pay; },
    done: function (e) { return e.done; },
    load: function (e) { return e.load; },
    kpi:  function (e) { return e.kpi; },
    st:   function (e) { return e.st === 'work' ? 0 : e.st === 'a247' ? 1 : 2; }
  };
  function sortedEmp() {
    var list = EMP.slice();
    if (!state.sort) return list;
    var get = SORT_VAL[state.sort], dir = state.dir;
    list.sort(function (a, b) {
      var x = get(a), y = get(b);
      if (typeof x === 'string') return x.localeCompare(y, loc()) * dir;
      return (x - y) * dir;
    });
    return list;
  }
  function detailRow(e) {
    var ava = e.ai
      ? '<img class="crm-ava" src="avatars/' + e.id + '-real.webp" alt="" width="52" height="52" loading="lazy">'
      : '<span class="crm-ava crm-ava--ini crm-ava--big" style="--h:' + e.hue + '" aria-hidden="true">' + initials(empName(e)) + '</span>';
    var metr = T('crm.d.metrics', { d: fmtInt(e.done) + ' ' + tr(e.unit), l: e.load, k: e.kpi });
    var save = e.ai ? '<span class="crm-dcard__save">' + T('crm.d.save', { v: fmtMoney(e.humanEq - e.pay) }) + '</span>' : '';
    var btn = e.ai ? '<button type="button" class="wbtn wbtn--primary" data-win="win-staff">' + tr('crm.hire') + '</button>' : '';
    /* лента задач сотрудника — «кто что сделал» */
    var mine = TASKS.filter(function (t) { return t.who === e.id; })
      .sort(function (a, b) { return a.due - b.due; });
    var feed = '<ul class="crm-dtasks">';
    if (!mine.length) feed += '<li class="crm-empty">' + tr('crm.d.notasks') + '</li>';
    mine.forEach(function (t) {
      var done = t.col === 'done';
      var extra = done && t.aiMin ? ' · ' + T('crm.tk.aiMin', { m: t.aiMin }) : '';
      feed += '<li class="crm-dtask crm-dtask--' + t.col + '">' +
        '<span class="crm-dtask__st" aria-hidden="true">' + (done ? '✓' : '•') + '</span>' +
        '<span class="crm-dtask__t">' + tr(t.k) + '</span>' +
        '<span class="crm-dtask__d">' + (done ? '' : tr('crm.tk.due') + ' ') + fmtDate(dayOff(t.due)) + extra + '</span></li>';
    });
    feed += '</ul>';
    return '<tr class="crm-drow"><td colspan="8"><div class="crm-dcard">' + ava +
      '<div class="crm-dcard__b"><h4>' + empName(e) + ' — ' + tr(e.roleKey) + '</h4>' +
      '<p>' + tr(e.aboutKey) + '</p>' +
      '<span class="crm-dcard__m">' + metr + '</span> ' + save +
      '<div class="crm-dcard__feed"><span class="crm-dcard__feedh">' + tr('crm.d.tasks') + '</span>' + feed + '</div>' +
      '</div>' + btn +
      '</div></td></tr>';
  }
  function renderStaff() {
    var box = document.getElementById('crmStaff');
    if (!box) return;
    var cols = [
      { k: 'name', l: 'crm.t.emp' }, { k: 'role', l: 'crm.t.role' }, { k: 'type', l: 'crm.t.type' },
      { k: 'pay', l: 'crm.t.pay' }, { k: 'done', l: 'crm.t.done' }, { k: 'load', l: 'crm.t.load' },
      { k: 'kpi', l: 'crm.t.kpi' }, { k: 'st', l: 'crm.t.status' }
    ];
    var html = '<table class="crm-table"><thead><tr>';
    cols.forEach(function (c) {
      var arr = state.sort === c.k ? '<span class="sort">' + (state.dir > 0 ? '▲' : '▼') + '</span>' : '';
      var as = state.sort === c.k ? (state.dir > 0 ? 'ascending' : 'descending') : 'none';
      html += '<th scope="col" data-sort="' + c.k + '" aria-sort="' + as + '">' + tr(c.l) + arr + '</th>';
    });
    html += '</tr></thead><tbody>';
    sortedEmp().forEach(function (e) {
      var name = empName(e);
      var ava = e.ai
        ? '<img class="crm-ava" src="avatars/' + e.id + '-real.webp" alt="" width="28" height="28" loading="lazy">'
        : '<span class="crm-ava crm-ava--ini" style="--h:' + e.hue + '" aria-hidden="true">' + initials(name) + '</span>';
      html += '<tr class="crm-row' + (e.ai ? ' is-ai' : '') + '" data-emp="' + e.id + '" tabindex="0" aria-expanded="' + (state.open === e.id) + '">' +
        '<td class="crm-td-emp"><span class="crm-emp">' + ava + '<b>' + name + '</b></span></td>' +
        '<td data-l="' + tr('crm.t.role') + '">' + tr(e.roleKey) + '</td>' +
        '<td data-l="' + tr('crm.t.type') + '"><span class="crm-type' + (e.ai ? ' crm-type--ai' : '') + '">' +
          (e.ai ? '🤖 ' + tr('crm.type.ai') : '👤 ' + tr('crm.type.h')) + '</span></td>' +
        '<td class="num" data-l="' + tr('crm.t.pay') + '">' + fmtMoney(e.pay) + '</td>' +
        '<td class="num" data-l="' + tr('crm.t.done') + '">' + fmtInt(e.done) + ' ' + tr(e.unit) + '</td>' +
        '<td data-l="' + tr('crm.t.load') + '"><span class="crm-load"><span class="crm-load__bar">' +
          '<i' + (e.load >= 80 ? ' class="hi"' : '') + ' style="width:' + e.load + '%"></i></span>' + e.load + '%</span></td>' +
        '<td class="num" data-l="' + tr('crm.t.kpi') + '"><b class="crm-kv' + (e.kpi >= 95 ? ' is-top' : '') + '">' + e.kpi + '%</b></td>' +
        '<td data-l="' + tr('crm.t.status') + '">' + stBadge(e.st) + '</td></tr>';
      if (state.open === e.id) html += detailRow(e);
    });
    html += '</tbody></table>';
    box.innerHTML = html;

    var t = totals();
    var sumEl = document.getElementById('crmTsum');
    if (sumEl) {
      sumEl.innerHTML = T('crm.sum', { h: '<b>' + fmtMoney(t.human) + '</b>', a: '<b>' + fmtMoney(t.ai) + '</b>' }) +
        ' · <span class="ai">' + tr('crm.sum.ai') + '</span>';
    }
  }
  function bindStaff() {
    var box = document.getElementById('crmStaff');
    if (!box) return;
    function toggle(tr) {
      var id = tr.getAttribute('data-emp');
      state.open = (state.open === id) ? null : id;
      renderStaff();
    }
    box.addEventListener('click', function (ev) {
      var th = ev.target.closest('th[data-sort]');
      if (th) {
        var k = th.getAttribute('data-sort');
        if (state.sort === k) state.dir = -state.dir; else { state.sort = k; state.dir = 1; }
        renderStaff();
        return;
      }
      if (ev.target.closest('button')) return; // «Нанять такого» — обрабатывает os.js (data-win)
      var row = ev.target.closest('tr.crm-row');
      if (row) toggle(row);
    });
    box.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      var row = ev.target.closest('tr.crm-row');
      if (row) { ev.preventDefault(); toggle(row); }
    });
  }

  /* ================= РАЗДЕЛ 4: ФИНАНСЫ ================= */
  function renderFin() {
    var c = chart('crmChFin'); if (!c) return;
    var f = buildFin(), p = pal();
    c.setOption(baseText({
      grid: { left: 52, right: 12, top: 30, bottom: 24 },
      legend: { top: 0, textStyle: { color: p.txt, fontSize: 11 }, itemWidth: 14, itemHeight: 9 },
      tooltip: { trigger: 'axis', valueFormatter: function (v) { return fmtMoney(v); } },
      xAxis: { type: 'category', data: f.months.map(fmtMonth), axisLine: { lineStyle: { color: p.axis } }, axisLabel: { color: p.txtDim, fontSize: 10 } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: p.split } },
        axisLabel: { color: p.txtDim, fontSize: 10, formatter: function (v) { return fmtMoneyC(v); } } },
      series: [
        { name: tr('crm.s.rev'), type: 'line', data: f.rev, smooth: true, showSymbol: false,
          lineStyle: { color: p.blue, width: 2.2 }, itemStyle: { color: p.blue }, areaStyle: { opacity: 0.10, color: p.blue } },
        { name: tr('crm.s.exp'), type: 'line', data: f.exp, smooth: true, showSymbol: false,
          lineStyle: { color: p.red, width: 1.8 }, itemStyle: { color: p.red } },
        { name: tr('crm.s.profit'), type: 'bar', data: f.profit, barMaxWidth: 12,
          itemStyle: { color: p.green, opacity: 0.75, borderRadius: [3, 3, 0, 0] } }
      ]
    }), true);
  }
  function renderExp() {
    var c = chart('crmChExp'); if (!c) return;
    var f = buildFin(), p = pal();
    var i = 11;
    var cats = [
      { name: tr('crm.e.fot'),   value: f.fot[i],   color: p.gray },
      { name: tr('crm.e.mkt'),   value: f.mkt[i],   color: p.violet },
      { name: tr('crm.e.rent'),  value: f.rent[i],  color: p.blue },
      { name: tr('crm.e.other'), value: f.other[i], color: p.amber },
      { name: tr('crm.e.ai'),    value: f.ai[i],    color: p.green }
    ];
    var total = cats.reduce(function (s, x) { return s + x.value; }, 0);
    c.setOption(baseText({
      tooltip: { trigger: 'item', valueFormatter: function (v) { return fmtMoney(v); } },
      legend: { bottom: 0, textStyle: { color: p.txt, fontSize: 11 }, itemWidth: 14, itemHeight: 9 },
      series: [{
        type: 'pie', radius: ['58%', '80%'], center: ['50%', '42%'],
        label: { show: false },
        itemStyle: { borderColor: 'transparent', borderWidth: 2 },
        data: cats.map(function (x) { return { name: x.name, value: x.value, itemStyle: { color: x.color } }; })
      }],
      graphic: [{
        type: 'text', left: 'center', top: '36%',
        style: {
          text: fmtMoneyC(total) + '\n' + tr('crm.e.mo'),
          textAlign: 'center', fill: p.txt, fontSize: 13, fontWeight: 700, lineHeight: 19
        }
      }]
    }), true);
    var note = document.getElementById('crmExpNote');
    if (note) note.textContent = T('crm.e.note', { p: Math.round(f.ai[i] / total * 100) });
  }
  function renderPl() {
    var box = document.getElementById('crmPl');
    if (!box) return;
    var f = buildFin(), i = 11;
    var rows = [
      { l: 'crm.pl.rev',   v: f.rev[i],    plus: true, b: true },
      { l: 'crm.pl.cogs',  v: -f.cogs[i] },
      { l: 'crm.pl.fot',   v: -f.fot[i] },
      { l: 'crm.pl.ai',    v: -f.ai[i],    ai: true },
      { l: 'crm.pl.rent',  v: -f.rent[i] },
      { l: 'crm.pl.mkt',   v: -f.mkt[i] },
      { l: 'crm.pl.other', v: -f.other[i] }
    ];
    var html = '<table class="crm-pl">';
    rows.forEach(function (r) {
      html += '<tr' + (r.b ? ' class="is-b"' : '') + '><td>' + tr(r.l) + (r.ai ? ' <i class="crm-aitag">🤖</i>' : '') + '</td>' +
        '<td class="num' + (r.v >= 0 ? ' is-in' : '') + '">' + (r.v >= 0 ? '' : '−') + fmtMoney(Math.abs(r.v)) + '</td></tr>';
    });
    var margin = Math.round(f.profit[i] / f.rev[i] * 100);
    html += '<tr class="is-total"><td>' + tr('crm.pl.profit') + ' <span class="crm-pl__m">' + tr('crm.pl.margin') + ' ' + margin + '%</span></td>' +
      '<td class="num is-in">' + fmtMoney(f.profit[i]) + '</td></tr></table>';
    box.innerHTML = html;
  }
  function renderRoiSum() {
    var el = document.getElementById('crmRoiSum');
    if (!el) return;
    var t = totals();
    var payback = Math.round(IMPL_COST / t.saveMo);
    el.innerHTML = T('crm.roi.sum', {
      s: '<b>' + fmtMoney(t.saveMo) + '</b>',
      y: '<b>−' + fmtMoneyC(t.saveMo * 12) + tr('crm.yr') + '</b>'
    }) + ' · ' + T('crm.roi.pb', { m: payback });
  }
  function renderBefore() {
    var c = chart('crmChBefore'); if (!c) return;
    var p = pal();
    var M = [
      { l: tr('crm.b.hrs'),  b: 58,  a: 14, f: function (v) { return fmtInt(v) + ' ' + tr('crm.b.hrs.u'); } },
      { l: tr('crm.b.cost'), b: 640, a: 90, f: function (v) { return fmtMoney(v); } },
      { l: tr('crm.b.resp'), b: 42,  a: 2,  f: function (v) { return fmtInt(v) + ' ' + tr('crm.b.min'); } }
    ];
    c.setOption(baseText({
      grid: { left: 8, right: 14, top: 30, bottom: 8, containLabel: true },
      legend: { top: 0, textStyle: { color: p.txt, fontSize: 11 }, itemWidth: 14, itemHeight: 9 },
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: function (evs) {
          var m = M[evs[0].dataIndex];
          return m.l + '<br>' + tr('crm.s.before') + ': <b>' + m.f(m.b) + '</b><br>' +
            tr('crm.s.after') + ': <b>' + m.f(m.a) + '</b>';
        }
      },
      xAxis: { type: 'value', max: 105, axisLabel: { show: false }, splitLine: { show: false } },
      yAxis: { type: 'category', data: M.map(function (m) { return m.l; }),
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: p.txt, fontSize: 11 } },
      series: [
        { name: tr('crm.s.before'), type: 'bar', barWidth: 12,
          itemStyle: { color: p.gray, borderRadius: 3 },
          label: { show: true, position: 'insideRight', color: isLight() ? '#fff' : 'rgba(0,0,0,.75)', fontSize: 10,
            formatter: function (ev) { return M[ev.dataIndex].f(M[ev.dataIndex].b); } },
          data: M.map(function () { return 100; }) },
        { name: tr('crm.s.after'), type: 'bar', barWidth: 12,
          itemStyle: { color: p.green, borderRadius: 3 },
          label: { show: true, position: 'right', color: p.txt, fontSize: 10, fontWeight: 700,
            formatter: function (ev) { return M[ev.dataIndex].f(M[ev.dataIndex].a); } },
          data: M.map(function (m) { return Math.max(4, Math.round(m.a / m.b * 100)); }) }
      ]
    }), true);
  }
  function renderPays() {
    var box = document.getElementById('crmPays');
    if (!box) return;
    var html = '<table class="crm-table crm-table--pays"><thead><tr>' +
      '<th scope="col">' + tr('crm.p.date') + '</th><th scope="col">' + tr('crm.p.who') + '</th>' +
      '<th scope="col">' + tr('crm.p.what') + '</th><th scope="col" class="num">' + tr('crm.p.sum') + '</th>' +
      '<th scope="col">' + tr('crm.p.st') + '</th></tr></thead><tbody>';
    PAYS.forEach(function (p) {
      html += '<tr><td data-l="' + tr('crm.p.date') + '">' + fmtDate(dayOff(p.off)) + '</td>' +
        '<td data-l="' + tr('crm.p.who') + '">' + tr(p.who) + '</td>' +
        '<td data-l="' + tr('crm.p.what') + '" class="crm-dim">' + tr(p.what) + '</td>' +
        '<td data-l="' + tr('crm.p.sum') + '" class="num"><b class="' + (p.sum >= 0 ? 'crm-in' : 'crm-out') + '">' +
        (p.sum >= 0 ? '+' : '−') + fmtMoney(Math.abs(p.sum)) + '</b></td>' +
        '<td data-l="' + tr('crm.p.st') + '"><span class="crm-badge ' + (p.st === 'ok' ? 'crm-badge--ok' : 'crm-badge--vac') + '">' +
        tr(p.st === 'ok' ? 'crm.p.ok' : 'crm.p.wait') + '</span></td></tr>';
    });
    html += '</tbody></table>';
    box.innerHTML = html;
  }

  /* ================= РАЗДЕЛ 5: АКТИВЫ ================= */
  function catBadge(cat) {
    var cls = cat === 'ai' ? ' crm-type--ai' : '';
    var ico = { ai: '🖥️', it: '🗄️', car: '🚚', eq: '💻' }[cat] || '';
    return '<span class="crm-type' + cls + '">' + ico + ' ' + tr('crm.ac.' + cat) + '</span>';
  }
  function assetSt(st) {
    if (st === 'out') return '<span class="crm-badge crm-badge--vac">' + tr('crm.as.st.out') + '</span>';
    if (st === 'use') return '<span class="crm-badge crm-badge--ok">' + tr('crm.as.st.use') + '</span>';
    return '<span class="crm-badge crm-badge--ok">' + tr('crm.as.st.on') + '</span>';
  }
  function renderAssets() {
    var box = document.getElementById('crmAssets');
    if (!box) return;
    var html = '<table class="crm-table crm-table--assets"><thead><tr>' +
      '<th scope="col">' + tr('crm.at.name') + '</th><th scope="col">' + tr('crm.at.cat') + '</th>' +
      '<th scope="col">' + tr('crm.at.load') + '</th><th scope="col">' + tr('crm.at.up') + '</th>' +
      '<th scope="col">' + tr('crm.at.st') + '</th><th scope="col" class="num">' + tr('crm.at.val') + '</th></tr></thead><tbody>';
    var total = 0;
    ASSETS.forEach(function (a) {
      total += a.val;
      var gpu = a.gpu == null ? '<span class="crm-dim">—</span>' :
        '<span class="crm-load"><span class="crm-load__bar"><i' + (a.gpu >= 80 ? ' class="hi"' : '') +
        ' style="width:' + a.gpu + '%"></i></span>' + a.gpu + '%</span>';
      var up = a.up == null ? '<span class="crm-dim">—</span>' : fmtPct1(a.up) + '%';
      html += '<tr' + (a.cat === 'ai' ? ' class="is-ai-asset"' : '') + '>' +
        '<td class="crm-td-emp" data-l="' + tr('crm.at.name') + '"><b>' + tr(a.n) + '</b></td>' +
        '<td data-l="' + tr('crm.at.cat') + '">' + catBadge(a.cat) + '</td>' +
        '<td data-l="' + tr('crm.at.load') + '">' + gpu + '</td>' +
        '<td class="num" data-l="' + tr('crm.at.up') + '">' + up + '</td>' +
        '<td data-l="' + tr('crm.at.st') + '">' + assetSt(a.st) + '</td>' +
        '<td class="num" data-l="' + tr('crm.at.val') + '">' + fmtMoney(a.val) + '</td></tr>';
    });
    html += '</tbody></table>';
    box.innerHTML = html;
    var sumEl = document.getElementById('crmAsSum');
    if (sumEl) sumEl.innerHTML = T('crm.as.total', { v: '<b>' + fmtMoney(total) + '</b>' });
  }
  /* «живой» GPU-спидометр: детерминированная функция времени, без Math.random */
  function gpuNow(ts) {
    var gpu = 58 + 14 * Math.sin(ts / 5200) + 7 * Math.sin(ts / 1300);
    var req = 44 + 10 * Math.sin(ts / 2600 + 1.3);
    var tok = 36 + 6 * Math.sin(ts / 1900 + 0.4);
    var tmp = 58 + 5 * Math.sin(ts / 7100);
    return { gpu: Math.round(gpu), req: Math.round(req), tok: Math.round(tok), tmp: Math.round(tmp) };
  }
  function gpuOption(v) {
    var p = pal();
    return baseText({
      series: [{
        type: 'gauge',
        startAngle: 205, endAngle: -25,
        min: 0, max: 100, radius: '100%', center: ['50%', '60%'],
        progress: { show: true, width: 12, itemStyle: { color: p.blue } },
        axisLine: { lineStyle: { width: 12, color: [[1, isLight() ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.10)']] } },
        axisTick: { show: false }, splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        anchor: { show: false },
        title: { show: true, offsetCenter: [0, '32%'], color: p.txtDim, fontSize: 11 },
        detail: { valueAnimation: false, offsetCenter: [0, '-4%'], color: p.txt, fontSize: 26, fontWeight: 800, formatter: '{value}%' },
        data: [{ value: v, name: tr('crm.as.gpu.l') }]
      }]
    });
  }
  var gpuTimer = null;
  function renderGpu() {
    var c = chart('crmChGpu'); if (!c) return;
    var v = gpuNow(reduceMotion ? 0 : Date.now());
    c.setOption(gpuOption(v.gpu), true);
    updGpuStats(v);
    if (reduceMotion || gpuTimer) return;
    gpuTimer = setInterval(function () {
      var pane = document.getElementById('crmPane-assets');
      var win = document.getElementById('win-pulse');
      if (document.hidden || !pane || pane.hidden || !win || !win.classList.contains('is-open')) return;
      var nv = gpuNow(Date.now());
      try { c.setOption({ series: [{ data: [{ value: nv.gpu, name: tr('crm.as.gpu.l') }] }] }); } catch (e) {}
      updGpuStats(nv);
    }, 1400);
  }
  function updGpuStats(v) {
    var el = document.getElementById('crmGpuStats');
    if (!el) return;
    el.innerHTML =
      '<span class="crm-gstat"><b>' + fmtInt(v.req) + '</b>' + tr('crm.as.req') + '</span>' +
      '<span class="crm-gstat"><b>' + fmtInt(v.tok) + '</b>' + tr('crm.as.tok') + '</span>' +
      '<span class="crm-gstat"><b>' + v.tmp + '°C</b>' + tr('crm.as.temp') + '</span>';
  }
  function renderHeat() {
    var c = chart('crmChHeat'); if (!c) return;
    var d = buildData(), p = pal();
    var data = [], max = 0;
    for (var w = 0; w < 7; w++) for (var h = 0; h < 24; h++) {
      var v = d.heat[w][h];
      if (v > max) max = v;
      data.push([h, w, v]);
    }
    var hours = []; for (var i = 0; i < 24; i++) hours.push(i);
    var wdays = []; for (var j = 0; j < 7; j++) wdays.push(weekdayName(j));
    c.setOption(baseText({
      grid: { left: 44, right: 10, top: 8, bottom: 42 },
      tooltip: {
        position: 'top',
        formatter: function (ev) {
          return wdays[ev.value[1]] + ' · ' + ev.value[0] + ':00 — <b>' + ev.value[2] + '</b> ' + tr('pulse.heat.u');
        }
      },
      xAxis: { type: 'category', data: hours, axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: p.txtDim, fontSize: 9, interval: 2, formatter: function (v) { return v + ':00'; } } },
      yAxis: { type: 'category', data: wdays, axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: p.txtDim, fontSize: 10 } },
      visualMap: {
        min: 0, max: Math.max(4, max), calculable: false, orient: 'horizontal', left: 'center', bottom: 0,
        itemWidth: 10, itemHeight: 90, textStyle: { color: p.txtDim, fontSize: 9 },
        inRange: { color: [p.heatLo, p.blue] },
        text: [tr('pulse.heat.hi'), tr('pulse.heat.lo')]
      },
      series: [{
        type: 'heatmap', data: data,
        itemStyle: { borderColor: isLight() ? '#fff' : 'rgba(6,11,28,.7)', borderWidth: 1, borderRadius: 2 },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(10,132,255,.5)' } }
      }]
    }), true);
  }

  /* ================= ВКЛАДКИ / СБОРКА ================= */
  function renderTab(t) {
    if (t === 'over') { renderWeek(); renderKpis(); fillFilter(); renderRev12(); renderFunnel(); renderNext(); renderFeed(); }
    else if (t === 'tasks') {
      renderKanban();
      if (cal && state.view === 'cal') { buildCal(); }
    }
    else if (t === 'staff') { renderStaff(); }
    else if (t === 'fin') { renderFin(); renderExp(); renderPl(); renderBefore(); renderRoiSum(); renderPays(); }
    else { renderAssets(); renderGpu(); renderHeat(); }
  }
  function resizeActive() {
    (TABCHARTS[state.tab] || []).forEach(function (id) {
      if (charts[id]) { try { charts[id].resize(); } catch (e) {} }
    });
    if (state.tab === 'tasks' && cal && state.view === 'cal') { try { cal.updateSize(); } catch (e) {} }
  }
  function showTab(t) {
    state.tab = t;
    var tabs = document.querySelectorAll('#crmTabs .crm-tab');
    Array.prototype.forEach.call(tabs, function (b) {
      var sel = b.dataset.tab === t;
      b.classList.toggle('is-sel', sel);
      b.setAttribute('aria-selected', sel ? 'true' : 'false');
    });
    ['over', 'tasks', 'staff', 'fin', 'assets'].forEach(function (x) {
      var pane = document.getElementById('crmPane-' + x);
      if (pane) pane.hidden = (x !== t);
    });
    requestAnimationFrame(function () {
      if (!rendered[t]) { rendered[t] = true; renderTab(t); }
      else resizeActive();
    });
  }
  function rerenderAll() {
    Object.keys(rendered).forEach(function (t) { if (rendered[t]) renderTab(t); });
    if (cal) { // календарь: локаль/тема — проще пересобрать
      var visible = state.tab === 'tasks' && state.view === 'cal';
      if (visible) buildCal();
      else { try { cal.destroy(); } catch (e) {} cal = null; }
    }
  }

  var built = false;
  function build() {
    if (built) return;
    built = true;
    var loading = document.getElementById('pulseLoading');
    var root = document.getElementById('crmRoot');
    if (loading) loading.hidden = true;
    if (root) root.hidden = false;

    var tabs = document.getElementById('crmTabs');
    if (tabs) tabs.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tab]');
      if (b) showTab(b.dataset.tab);
    });
    bindStaff();
    bindTasks();
    bindFilter();
    initGrid();

    rendered.over = true;
    renderTab('over');

    /* ресайз окна (drag-resize / развернуть) → перерисовать графики */
    var body = document.querySelector('#win-pulse .win__body');
    if (body && 'ResizeObserver' in window) {
      var t = null;
      new ResizeObserver(function () {
        clearTimeout(t); t = setTimeout(function () { resizeActive(); gridCharts(); }, 120);
      }).observe(body);
    }
    window.addEventListener('resize', function () { setTimeout(resizeActive, 180); });

    /* смена темы: перерисовать графики с палитрой новой темы */
    var wasLight = isLight();
    new MutationObserver(function () {
      if (isLight() !== wasLight) {
        wasLight = isLight();
        rerenderAll();
      }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    /* смена языка: подписи, валюта, даты */
    document.addEventListener('i18n:change', function () {
      cuInst = {};
      rerenderAll();
    });
  }

  /* ---------- ЛЕНИВАЯ ЗАГРУЗКА БИБЛИОТЕК (локальные файлы) ---------- */
  var libsP = null;
  function script(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = function () { rej(new Error(src + ' failed')); };
      document.head.appendChild(s);
    });
  }
  function styles(href, mark) {
    return new Promise(function (res, rej) {
      if (document.querySelector('link[data-' + mark + ']')) { res(); return; }
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-' + mark, '1');
      l.onload = res;
      l.onerror = function () { l.remove(); rej(new Error(href + ' failed')); };
      document.head.appendChild(l);
    });
  }
  function ensureLibs() {
    if (window.echarts && window.GridStack && window.FullCalendar && document.querySelector('link[data-tabler]')) return Promise.resolve();
    if (libsP) return libsP;
    libsP = Promise.all([
      window.echarts ? Promise.resolve() : script('vendor/echarts.min.js'),
      window.GridStack ? Promise.resolve() : script('vendor/gridstack/gridstack-all.js'),
      window.FullCalendar ? Promise.resolve()
        : script('vendor/fullcalendar/index.global.min.js').then(function () {
            return script('vendor/fullcalendar/ru.global.min.js').catch(function () {});
          }),
      styles('vendor/tabler/tabler-crm.css', 'tabler'),
      styles('vendor/gridstack/gridstack.min.css', 'gridstack')
    ])
      .then(function () { return script('vendor/countup.umd.js').catch(function () {}); })
      .catch(function (e) { libsP = null; throw e; });
    return libsP;
  }

  function showError() {
    var loading = document.getElementById('pulseLoading');
    if (!loading) return;
    loading.hidden = false;
    loading.classList.add('is-err');
    loading.innerHTML = '';
    var msg = document.createElement('span');
    msg.textContent = tr('pulse.err');
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'wbtn';
    btn.textContent = tr('pulse.retry');
    btn.addEventListener('click', function () {
      loading.classList.remove('is-err');
      loading.innerHTML = '<span class="pulse-spin" aria-hidden="true"></span><span>' + tr('pulse.loading') + '</span>';
      open();
    });
    loading.appendChild(msg); loading.appendChild(btn);
  }

  /* вызывается os.js при каждом открытии окна */
  function open() {
    if (built) {
      /* окно было закрыто/свёрнуто — размеры могли обнулиться */
      requestAnimationFrame(function () { resizeActive(); gridCharts(); });
      return;
    }
    ensureLibs().then(build, showError);
  }

  window.Pulse = { open: open };
  if (DEV) {
    window.__pulse = {
      data: buildData,
      fin: buildFin,
      staff: EMP,
      tasks: TASKS,
      assets: ASSETS,
      totals: totals,
      state: state,
      charts: function () { return Object.keys(charts); },
      inst: function (id) { return charts[id]; },
      grid: function () { return grid; },
      cal: function () { return cal; },
      showTab: showTab,
      showView: showView
    };
  }
})();
