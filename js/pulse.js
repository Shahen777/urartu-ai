/* ============================================================
   ЛОТ N — CRM-панель ООО «Вектор» (окно win-pulse).
   Полноценная панель руководителя: Обзор / Сотрудники / ROI.
   Подключается ЛЕНИВО из os.js при первом открытии окна.
   Сам дотягивает vendor/echarts.min.js (Apache-2.0),
   vendor/countup.umd.js (MIT) и vendor/tabler/tabler-crm.css
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
  function fmtDate(d) { return new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'short' }).format(d); }
  function weekdayName(i) { // i: 0=Пн … 6=Вс
    var mon = new Date(Date.UTC(2026, 0, 5)); // понедельник
    return new Intl.DateTimeFormat(loc(), { weekday: 'short', timeZone: 'UTC' })
      .format(new Date(mon.getTime() + i * 86400000));
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
    var today = new Date(); today.setHours(12, 0, 0, 0);
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

  /* ---------- ШТАТ ООО «ВЕКТОР»: люди + ИИ вперемешку ---------- */
  /* humanEq — сколько стоила бы та же рутина живой ставкой (для экономии) */
  var EMP = [
    { id: 'h1', nameKey: 'crm.n1', roleKey: 'crm.rl.mgr',  pay: 90000,  done: 47,   unit: 'crm.u.deals', load: 82, st: 'work', hue: 210 },
    { id: 'documoved', ai: true, nameKey: 'msg.n.documoved', roleKey: 'crm.rl.docs', pay: 15000, done: 1240, unit: 'crm.u.reqs',  load: 71, st: 'a247', humanEq: 55000, aboutKey: 'crm.a.doc' },
    { id: 'h2', nameKey: 'crm.n2', roleKey: 'crm.rl.head', pay: 150000, done: 26,   unit: 'crm.u.deals', load: 74, st: 'work', hue: 262 },
    { id: 'support', ai: true, nameKey: 'msg.n.support', roleKey: 'crm.rl.sup', pay: 15000, done: 890, unit: 'crm.u.tick', load: 64, st: 'a247', humanEq: 50000, aboutKey: 'crm.a.sup' },
    { id: 'h3', nameKey: 'crm.n3', roleKey: 'crm.rl.law',  pay: 120000, done: 34,   unit: 'crm.u.cont',  load: 76, st: 'vac',  hue: 16 },
    { id: 'secretary', ai: true, nameKey: 'msg.n.secretary', roleKey: 'crm.rl.rec', pay: 15000, done: 320, unit: 'crm.u.call', load: 51, st: 'a247', humanEq: 40000, aboutKey: 'crm.a.sec' },
    { id: 'h4', nameKey: 'crm.n4', roleKey: 'crm.rl.acc',  pay: 85000,  done: 210,  unit: 'crm.u.docs',  load: 68, st: 'work', hue: 130 },
    { id: 'lawyer', ai: true, nameKey: 'msg.n.lawyer', roleKey: 'crm.rl.legal', pay: 15000, done: 156, unit: 'crm.u.cont', load: 58, st: 'a247', humanEq: 45000, aboutKey: 'crm.a.law' },
    { id: 'h5', nameKey: 'crm.n5', roleKey: 'crm.rl.mkt',  pay: 95000,  done: 18,   unit: 'crm.u.camp',  load: 61, st: 'work', hue: 330 },
    { id: 'content', ai: true, nameKey: 'staff.e5.role', roleKey: 'crm.rl.content', pay: 15000, done: 96, unit: 'crm.u.post', load: 46, st: 'a247', humanEq: 35000, aboutKey: 'crm.a.con' }
  ];
  function totals() {
    var h = 0, a = 0, eq = 0;
    EMP.forEach(function (e) { if (e.ai) { a += e.pay; eq += e.humanEq; } else h += e.pay; });
    return { human: h, ai: a, eq: eq, saveMo: eq - a }; // 540 000 / 75 000 / 225 000 / 150 000
  }
  var IMPL_COST = 300000; // внедрение ИИ-штата, ₽ → окупаемость 2 мес

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
  var TABCHARTS = { over: ['crmChMain', 'crmChFunnel'], staff: [], roi: ['crmChDonut', 'crmChBefore', 'crmChHeat'] };

  /* ---------- СОСТОЯНИЕ ---------- */
  var state = { tab: 'over', range: 90, sort: null, dir: 1, open: null };
  var rendered = { over: false, staff: false, roi: false };

  /* ================= ВКЛАДКА 1: ОБЗОР ================= */
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
  function renderKpis() {
    var box = document.getElementById('crmKpis');
    if (!box) return;
    var d = buildData(), p = pal(), t = totals();
    var rev30 = sum(d.rev, 60, 90), revP = sum(d.rev, 30, 60);
    var dl30 = sum(d.deals, 60, 90), dlP = sum(d.deals, 30, 60);
    var ai30 = sum(d.ai, 60, 90), aiP = sum(d.ai, 30, 60);
    var savePrev = t.saveMo * (aiP / ai30);
    var K = [
      { id: 'rev',  l: 'crm.k.rev',   v: rev30,    prev: revP,    money: 1, s: d.rev,   c: p.blue },
      { id: 'deal', l: 'crm.k.deals', v: dl30,     prev: dlP,     money: 0, s: d.deals, c: p.violet },
      { id: 'ai',   l: 'crm.k.ai',    v: ai30,     prev: aiP,     money: 0, s: d.ai,    c: p.purple },
      { id: 'save', l: 'crm.k.save',  v: t.saveMo, prev: savePrev, money: 1, s: d.ai,   c: p.green }
    ];
    var html = '';
    K.forEach(function (k) {
      var pct = Math.round((k.v - k.prev) / k.prev * 100);
      html += '<div class="crm-kpi"><span class="crm-kpi__l">' + tr(k.l) + '</span>' +
        '<span class="crm-kpi__row"><b class="crm-kpi__v" id="crmK-' + k.id + '">—</b>' +
        '<span class="crm-kpi__d ' + (pct >= 0 ? 'is-up' : 'is-down') + '" title="' + tr('crm.vs') + '">' +
        (pct >= 0 ? '▲ +' : '▼ ') + pct + '%</span></span>' +
        spark(k.s.slice(60), k.c) + '</div>';
    });
    box.innerHTML = html;
    K.forEach(function (k) {
      setVal('crmK-' + k.id, k.v, k.money ? fmtMoneyC : fmtInt);
    });
  }
  function renderMain() {
    var c = chart('crmChMain'); if (!c) return;
    var d = buildData(), p = pal();
    var from = N - state.range;
    var dates = d.days.slice(from).map(fmtDate);
    c.setOption(baseText({
      grid: { left: 52, right: 44, top: 30, bottom: 26 },
      legend: { top: 0, textStyle: { color: p.txt, fontSize: 11 }, itemWidth: 14, itemHeight: 9 },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: p.axis } }, axisLabel: { color: p.txtDim, fontSize: 10 } },
      yAxis: [
        { type: 'value', splitLine: { lineStyle: { color: p.split } },
          axisLabel: { color: p.txtDim, fontSize: 10, formatter: function (v) { return fmtMoneyC(v); } } },
        { type: 'value', splitLine: { show: false }, axisLabel: { color: p.txtDim, fontSize: 10 } }
      ],
      series: [
        { name: tr('crm.s.rev'), type: 'line', data: d.rev.slice(from), smooth: true, showSymbol: false,
          lineStyle: { color: p.blue, width: 2 }, itemStyle: { color: p.blue },
          areaStyle: { opacity: 0.12, color: p.blue },
          tooltip: { valueFormatter: function (v) { return fmtMoney(v); } } },
        { name: tr('crm.s.deals'), type: 'bar', yAxisIndex: 1, data: d.deals.slice(from),
          itemStyle: { color: p.green, opacity: 0.75, borderRadius: [2, 2, 0, 0] }, barMaxWidth: 10 }
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
        left: '6%', width: '88%', top: 6, bottom: 6, minSize: '24%',
        label: { show: true, position: 'inside', color: '#fff', fontSize: 11.5, fontWeight: 600,
          formatter: function (ev) { return ev.name + '  ·  ' + fmtInt(ev.value); } },
        itemStyle: { borderColor: 'transparent', borderRadius: 4 },
        emphasis: { label: { fontSize: 12.5 } },
        data: st
      }]
    }), true);
  }

  /* ================= ВКЛАДКА 2: СОТРУДНИКИ ================= */
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
    var save = e.humanEq - e.pay;
    return '<tr class="crm-drow"><td colspan="7"><div class="crm-dcard">' +
      '<img class="crm-ava" src="avatars/' + e.id + '-real.webp" alt="" width="52" height="52" loading="lazy">' +
      '<div class="crm-dcard__b"><h4>' + empName(e) + ' — ' + tr(e.roleKey) + '</h4>' +
      '<p>' + tr(e.aboutKey) + '</p>' +
      '<span class="crm-dcard__save">' + T('crm.d.save', { v: fmtMoney(save) }) + '</span></div>' +
      '<button type="button" class="wbtn wbtn--primary" data-win="win-staff">' + tr('crm.hire') + '</button>' +
      '</div></td></tr>';
  }
  function renderStaff() {
    var box = document.getElementById('crmStaff');
    if (!box) return;
    var cols = [
      { k: 'name', l: 'crm.t.emp' }, { k: 'role', l: 'crm.t.role' }, { k: 'type', l: 'crm.t.type' },
      { k: 'pay', l: 'crm.t.pay' }, { k: 'done', l: 'crm.t.done' }, { k: 'load', l: 'crm.t.load' }, { k: 'st', l: 'crm.t.status' }
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
      html += '<tr' + (e.ai ? ' class="is-ai" data-emp="' + e.id + '" tabindex="0" aria-expanded="' + (state.open === e.id) + '"' : '') + '>' +
        '<td class="crm-td-emp"><span class="crm-emp">' + ava + '<b>' + name + '</b></span></td>' +
        '<td data-l="' + tr('crm.t.role') + '">' + tr(e.roleKey) + '</td>' +
        '<td data-l="' + tr('crm.t.type') + '"><span class="crm-type' + (e.ai ? ' crm-type--ai' : '') + '">' +
          (e.ai ? '🤖 ' + tr('crm.type.ai') : '👤 ' + tr('crm.type.h')) + '</span></td>' +
        '<td class="num" data-l="' + tr('crm.t.pay') + '">' + fmtMoney(e.pay) + '</td>' +
        '<td class="num" data-l="' + tr('crm.t.done') + '">' + fmtInt(e.done) + ' ' + tr(e.unit) + '</td>' +
        '<td data-l="' + tr('crm.t.load') + '"><span class="crm-load"><span class="crm-load__bar">' +
          '<i' + (e.load >= 80 ? ' class="hi"' : '') + ' style="width:' + e.load + '%"></i></span>' + e.load + '%</span></td>' +
        '<td data-l="' + tr('crm.t.status') + '">' + stBadge(e.st) + '</td></tr>';
      if (e.ai && state.open === e.id) html += detailRow(e);
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
      var row = ev.target.closest('tr.is-ai');
      if (row) toggle(row);
    });
    box.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      var row = ev.target.closest('tr.is-ai');
      if (row) { ev.preventDefault(); toggle(row); }
    });
  }

  /* ================= ВКЛАДКА 3: ЭКОНОМИЯ / ROI ================= */
  function renderDonut() {
    var c = chart('crmChDonut'); if (!c) return;
    var p = pal(), t = totals();
    var yr = t.saveMo * 12; // 1 800 000 ₽/год
    var payback = Math.round(IMPL_COST / t.saveMo); // 2 мес
    c.setOption(baseText({
      tooltip: { trigger: 'item', valueFormatter: function (v) { return fmtMoney(v); } },
      legend: { bottom: 0, textStyle: { color: p.txt, fontSize: 11 }, itemWidth: 14, itemHeight: 9 },
      series: [{
        type: 'pie', radius: ['60%', '82%'], center: ['50%', '42%'],
        label: { show: false },
        itemStyle: { borderColor: 'transparent', borderWidth: 2 },
        data: [
          { name: tr('crm.roi.d.h'), value: t.human, itemStyle: { color: p.gray } },
          { name: tr('crm.roi.d.a'), value: t.ai, itemStyle: { color: p.green } }
        ]
      }],
      graphic: [{
        type: 'text', left: 'center', top: '31%',
        style: {
          text: '−' + fmtMoneyC(yr) + tr('crm.yr') + '\n' + T('crm.roi.pb', { m: payback }),
          textAlign: 'center', fill: p.txt, fontSize: 13, fontWeight: 700, lineHeight: 19
        }
      }]
    }), true);
  }
  function renderRoiSum() {
    var el = document.getElementById('crmRoiSum');
    if (!el) return;
    var t = totals();
    el.innerHTML = T('crm.roi.sum', {
      s: '<b>' + fmtMoney(t.saveMo) + '</b>',
      y: '<b>−' + fmtMoneyC(t.saveMo * 12) + tr('crm.yr') + '</b>'
    });
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
    if (t === 'over') { renderKpis(); renderMain(); renderFunnel(); }
    else if (t === 'staff') { renderStaff(); }
    else { renderDonut(); renderRoiSum(); renderBefore(); renderHeat(); }
  }
  function resizeActive() {
    (TABCHARTS[state.tab] || []).forEach(function (id) {
      if (charts[id]) { try { charts[id].resize(); } catch (e) {} }
    });
  }
  function showTab(t) {
    state.tab = t;
    var tabs = document.querySelectorAll('#crmTabs .crm-tab');
    Array.prototype.forEach.call(tabs, function (b) {
      var sel = b.dataset.tab === t;
      b.classList.toggle('is-sel', sel);
      b.setAttribute('aria-selected', sel ? 'true' : 'false');
    });
    ['over', 'staff', 'roi'].forEach(function (x) {
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
    var rp = document.getElementById('crmRange');
    if (rp) rp.addEventListener('click', function (e) {
      var b = e.target.closest('[data-range]'); if (!b) return;
      state.range = +b.dataset.range;
      Array.prototype.forEach.call(rp.querySelectorAll('.pchip'), function (x) {
        var sel = x === b;
        x.classList.toggle('is-sel', sel);
        x.setAttribute('aria-checked', sel ? 'true' : 'false');
      });
      renderMain();
    });
    bindStaff();

    rendered.over = true;
    renderTab('over');

    /* ресайз окна (drag-resize / развернуть) → перерисовать графики */
    var body = document.querySelector('#win-pulse .win__body');
    if (body && 'ResizeObserver' in window) {
      var t = null;
      new ResizeObserver(function () {
        clearTimeout(t); t = setTimeout(resizeActive, 120);
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
  function styles(href) {
    return new Promise(function (res, rej) {
      if (document.querySelector('link[data-tabler]')) { res(); return; }
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-tabler', '1');
      l.onload = res;
      l.onerror = function () { l.remove(); rej(new Error(href + ' failed')); };
      document.head.appendChild(l);
    });
  }
  function ensureLibs() {
    if (window.echarts && document.querySelector('link[data-tabler]')) return Promise.resolve();
    if (libsP) return libsP;
    libsP = Promise.all([
      window.echarts ? Promise.resolve() : script('vendor/echarts.min.js'),
      styles('vendor/tabler/tabler-crm.css')
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
      requestAnimationFrame(resizeActive);
      return;
    }
    ensureLibs().then(build, showError);
  }

  window.Pulse = { open: open };
  if (DEV) {
    window.__pulse = {
      data: buildData,
      staff: EMP,
      totals: totals,
      state: state,
      charts: function () { return Object.keys(charts); },
      inst: function (id) { return charts[id]; },
      showTab: showTab
    };
  }
})();
