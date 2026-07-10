/* ============================================================
   ЛОТ I — Дашборд «Пульс компании» (демо-легенда: ООО «Вектор»)
   Подключается ЛЕНИВО из os.js при первом открытии окна win-pulse.
   Сам дотягивает vendor/echarts.min.js (Apache-2.0) и
   vendor/countup.umd.js (MIT) — локально, никаких CDN.
   Данные — детерминированный генератор с сидом:
   ни одного Math.random в отрисовке (повторяемость для тестов).
   ============================================================ */
(function () {
  'use strict';

  var DEV = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  function lang() { return (window.__lang === 'en') ? 'en' : 'ru'; }
  function loc() { return lang() === 'en' ? 'en-US' : 'ru-RU'; }
  function tr(key) { return (window.I18N && window.I18N.t) ? window.I18N.t(key, lang()) : key; }
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- ФОРМАТИРОВАНИЕ: рубли + русские даты, EN → $ + en-US ---------- */
  var USD_RATE = 90; // фикс. курс демо-данных: детерминизм важнее точности
  function fmtMoney(rub) {
    var en = lang() === 'en';
    var v = en ? rub / USD_RATE : rub;
    return new Intl.NumberFormat(loc(), { style: 'currency', currency: en ? 'USD' : 'RUB', maximumFractionDigits: 0 }).format(v);
  }
  function fmtInt(v) { return new Intl.NumberFormat(loc(), { maximumFractionDigits: 0 }).format(Math.round(v)); }
  function fmtDate(d) { return new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'short' }).format(d); }
  function weekdayName(i, style) { // i: 0=Пн … 6=Вс
    var mon = new Date(Date.UTC(2026, 0, 5)); // понедельник
    return new Intl.DateTimeFormat(loc(), { weekday: style || 'short', timeZone: 'UTC' })
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

  var N = 90; // дней истории
  var ROLES = [
    { id: 'doc', key: 'pulse.role.doc', base: 44, min: 4,  w: { sales: 0.30, legal: 0.35, support: 0.35 }, color: '#0A84FF' },
    { id: 'law', key: 'pulse.role.law', base: 11, min: 15, w: { sales: 0.15, legal: 0.85, support: 0    }, color: '#BF5AF2' },
    { id: 'op',  key: 'pulse.role.op',  base: 78, min: 3,  w: { sales: 0.20, legal: 0,    support: 0.80 }, color: '#32D74B' },
    { id: 'sec', key: 'pulse.role.sec', base: 17, min: 4,  w: { sales: 0.60, legal: 0.10, support: 0.30 }, color: '#FFD60A' }
  ];
  var AVG_CHECK = 42500;   // средний чек сделки, ₽
  var FOT_RATE = 900;      // ₽/час специалиста (ФОТ-эквивалент, с налогами скромно)
  var SUPPORT_MO = 45000;  // поддержка ИИ, ₽/мес
  var IMPL_COST = 600000;  // проект целиком: внедрение + станция, ₽ (честная окупаемость ~2,5 мес)

  /* профиль нагрузки по часам: оператор работает и ночью — график сам продаёт */
  function hourK(roleId, h) {
    switch (roleId) {
      case 'op':  return h >= 9 && h <= 19 ? 1 : (h >= 20 || h <= 1 ? 0.55 : 0.35); // 24/7
      case 'sec': return h >= 9 && h <= 19 ? 1 : (h >= 20 && h <= 23 ? 0.3 : 0.04);
      case 'law': return h >= 10 && h <= 18 ? 1 : (h >= 19 && h <= 22 ? 0.25 : 0.05);
      default:    return h >= 9 && h <= 18 ? 1 : (h >= 19 && h <= 23 ? 0.4 : 0.08);  // doc
    }
  }
  function wdRoleK(roleId, wd) { // wd: 0=Пн … 6=Вс
    if (wd < 5) return 1;
    return roleId === 'op' ? 0.72 : 0.22; // выходные: поддержка почти не проседает
  }

  var D = null; // данные, генерируются один раз
  function buildData() {
    if (D) return D;
    var rnd = mulberry32(SEED);
    var today = new Date(); today.setHours(12, 0, 0, 0);
    var days = [], leads = [], conv = [], roles = {};
    ROLES.forEach(function (r) { roles[r.id] = []; });
    var wdLeadK = [1.0, 1.12, 1.06, 1.0, 0.94, 0.42, 0.34]; // Пн…Вс

    for (var i = 0; i < N; i++) {
      var d = new Date(today.getTime() - (N - 1 - i) * 86400000);
      days.push(d);
      var wd = (d.getDay() + 6) % 7; // 0=Пн
      var growth = 1 + i * 0.0035;
      var season = 1 + 0.06 * Math.sin(i / 8.5);
      leads.push(Math.round(26 * wdLeadK[wd] * growth * season * (0.86 + 0.28 * rnd())));
      conv.push(+((19.5 + i * 0.028 + 2.2 * Math.sin(i / 11) + (rnd() * 3 - 1.5))).toFixed(1));
      ROLES.forEach(function (r) {
        roles[r.id].push(Math.round(r.base * wdRoleK(r.id, wd) * growth * (0.8 + 0.4 * rnd())));
      });
    }

    /* тепловая карта: по каждой роли своя матрица 7×24 (для фильтра отделов) */
    var heat = {};
    ROLES.forEach(function (r) {
      var m = [];
      for (var w = 0; w < 7; w++) {
        var row = [];
        for (var h = 0; h < 24; h++) {
          row.push(+(r.base / 10 * hourK(r.id, h) * wdRoleK(r.id, w) * (0.82 + 0.36 * rnd())).toFixed(2));
        }
        m.push(row);
      }
      heat[r.id] = m;
    });

    D = { days: days, leads: leads, conv: conv, roles: roles, heat: heat };
    return D;
  }

  /* ---------- СОСТОЯНИЕ ФИЛЬТРОВ ---------- */
  var state = { dept: 'all', range: 30, role: null };
  function deptW(r) { return state.dept === 'all' ? 1 : (r.w[state.dept] || 0); }

  /* суммы по окну [from, to) с учётом отдела */
  function sumRole(r, from, to) {
    var d = buildData(), s = 0, w = deptW(r);
    for (var i = from; i < to; i++) s += d.roles[r.id][i] * w;
    return s;
  }
  function kpis(from, to) {
    var d = buildData();
    var lead = 0, rev = 0, ans = 0, hrs = 0;
    var dw = state.dept === 'all' ? 1 : (state.dept === 'sales' ? 0.62 : state.dept === 'support' ? 0.23 : 0.15);
    for (var i = from; i < to; i++) {
      lead += d.leads[i] * dw;
      rev += d.leads[i] * dw * d.conv[i] / 100 * AVG_CHECK;
    }
    ROLES.forEach(function (r) {
      var s = sumRole(r, from, to);
      ans += s; hrs += s * r.min / 60;
    });
    return { leads: lead, rev: rev, ans: ans, hrs: hrs };
  }

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
      heatHi: '#0A84FF',
      leads: '#0A84FF',
      conv: '#32D74B',
      fot: '#32D74B',
      sup: l ? 'rgba(0,0,0,.22)' : 'rgba(255,255,255,.28)'
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

  /* ---------- ГРАФИКИ ---------- */
  var charts = {}; // id → инстанс echarts
  function chart(elId) {
    var el = document.getElementById(elId);
    if (!el || !window.echarts) return null;
    if (!charts[elId]) charts[elId] = window.echarts.init(el, null, { renderer: 'canvas' });
    return charts[elId];
  }
  function slice(arr) { return arr.slice(N - state.range); }

  /* Б2 — заявки и конверсия: бар + линия, зум-брашинг, период = dataZoom */
  function renderLeads() {
    var c = chart('pChLeads'); if (!c) return;
    var d = buildData(), p = pal();
    var dates = d.days.map(fmtDate);
    var zoomStart = (1 - state.range / N) * 100;
    c.setOption(baseText({
      grid: { left: 44, right: 44, top: 26, bottom: 40 },
      legend: { top: 0, textStyle: { color: p.txt, fontSize: 11 }, itemWidth: 14, itemHeight: 9 },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: p.axis } }, axisLabel: { color: p.txtDim, fontSize: 10 } },
      yAxis: [
        { type: 'value', splitLine: { lineStyle: { color: p.split } }, axisLabel: { color: p.txtDim, fontSize: 10 } },
        { type: 'value', splitLine: { show: false }, axisLabel: { color: p.txtDim, fontSize: 10, formatter: '{value}%' }, min: 0, max: 40 }
      ],
      dataZoom: [
        { type: 'inside', start: zoomStart, end: 100 },
        { type: 'slider', start: zoomStart, end: 100, height: 14, bottom: 4, borderColor: 'transparent',
          backgroundColor: p.split, fillerColor: isLight() ? 'rgba(10,132,255,.18)' : 'rgba(10,132,255,.28)',
          handleStyle: { color: p.leads }, textStyle: { color: p.txtDim, fontSize: 9 } }
      ],
      series: [
        { name: tr('pulse.s.leads'), type: 'bar', data: d.leads, itemStyle: { color: p.leads, borderRadius: [3, 3, 0, 0] }, barMaxWidth: 14 },
        { name: tr('pulse.s.conv'), type: 'line', yAxisIndex: 1, data: d.conv, smooth: true, showSymbol: false,
          lineStyle: { color: p.conv, width: 2 }, itemStyle: { color: p.conv },
          tooltip: { valueFormatter: function (v) { return v + '%'; } } }
      ]
    }), true);
  }

  /* Б3 — работа ИИ-сотрудников: стек-бары по ролям; клик по роли → вклад в KPI */
  function renderRoles() {
    var c = chart('pChRoles'); if (!c) return;
    var d = buildData(), p = pal();
    var dates = slice(d.days).map(fmtDate);
    var series = ROLES.map(function (r) {
      var w = deptW(r);
      var dim = state.role && state.role !== r.id;
      return {
        name: tr(r.key), type: 'bar', stack: 'ai',
        data: slice(d.roles[r.id]).map(function (v) { return Math.round(v * w); }),
        itemStyle: { color: r.color, opacity: dim ? 0.22 : 1 },
        emphasis: { focus: 'series' },
        barMaxWidth: 16
      };
    });
    c.setOption(baseText({
      grid: { left: 40, right: 10, top: 44, bottom: 24 },
      legend: { top: 0, textStyle: { color: p.txt, fontSize: 11 }, itemWidth: 14, itemHeight: 9 },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: p.axis } }, axisLabel: { color: p.txtDim, fontSize: 10 } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: p.split } }, axisLabel: { color: p.txtDim, fontSize: 10 } },
      series: series
    }), true);
    c.off('click');
    c.on('click', function (ev) {
      var r = null;
      ROLES.forEach(function (x) { if (tr(x.key) === ev.seriesName) r = x.id; });
      state.role = (state.role === r) ? null : r;
      renderRoles(); renderKpis(false);
    });
  }

  /* Б4 — «Экономия»: донат ФОТ-эквивалент vs поддержка + окупаемость в центре */
  function renderEcon() {
    var c = chart('pChEcon'); if (!c) return;
    var p = pal();
    var k = kpis(N - 30, N);
    var fot = Math.round(k.hrs * FOT_RATE);
    var gain = Math.max(1, fot - SUPPORT_MO);
    var payback = Math.max(0.5, IMPL_COST / gain);
    var pbTxt = (lang() === 'en')
      ? tr('pulse.e.pay') + '\n' + payback.toFixed(1) + ' ' + tr('pulse.e.mo')
      : tr('pulse.e.pay') + '\n' + payback.toFixed(1).replace('.', ',') + ' ' + tr('pulse.e.mo');
    c.setOption(baseText({
      tooltip: { trigger: 'item', valueFormatter: function (v) { return fmtMoney(v); } },
      legend: { bottom: 0, textStyle: { color: p.txt, fontSize: 11 }, itemWidth: 14, itemHeight: 9 },
      series: [{
        type: 'pie', radius: ['58%', '80%'], center: ['50%', '44%'],
        avoidLabelOverlap: true,
        label: { show: false },
        itemStyle: { borderColor: 'transparent', borderWidth: 2 },
        data: [
          { name: tr('pulse.e.fot'), value: fot, itemStyle: { color: p.fot } },
          { name: tr('pulse.e.sup'), value: SUPPORT_MO, itemStyle: { color: p.sup } }
        ]
      }],
      graphic: [{
        type: 'text', left: 'center', top: '36%',
        style: { text: pbTxt, textAlign: 'center', fill: p.txt, fontSize: 13, fontWeight: 700, lineHeight: 18 }
      }]
    }), true);
  }

  /* Б5 — тепловая карта нагрузки 24×7: видно работу ночью */
  function renderHeat() {
    var c = chart('pChHeat'); if (!c) return;
    var d = buildData(), p = pal();
    var data = [], max = 0;
    for (var w = 0; w < 7; w++) {
      for (var h = 0; h < 24; h++) {
        var v = 0;
        ROLES.forEach(function (r) { v += d.heat[r.id][w][h] * deptW(r); });
        v = +v.toFixed(1);
        if (v > max) max = v;
        data.push([h, w, v]);
      }
    }
    var hours = []; for (var i = 0; i < 24; i++) hours.push(i);
    var wdays = []; for (var j = 0; j < 7; j++) wdays.push(weekdayName(j, 'short'));
    c.setOption(baseText({
      grid: { left: 44, right: 10, top: 8, bottom: 42 },
      tooltip: {
        position: 'top',
        formatter: function (ev) {
          return wdays[ev.value[1]] + ' · ' + ev.value[0] + ':00 — <b>' + ev.value[2] + '</b> ' + tr('pulse.heat.u');
        }
      },
      xAxis: { type: 'category', data: hours, splitArea: { show: false }, axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: p.txtDim, fontSize: 9, interval: 2, formatter: function (v) { return v + ':00'; } } },
      yAxis: { type: 'category', data: wdays, axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: p.txtDim, fontSize: 10 } },
      visualMap: {
        min: 0, max: Math.max(4, max), calculable: false, orient: 'horizontal', left: 'center', bottom: 0,
        itemWidth: 10, itemHeight: 90, textStyle: { color: p.txtDim, fontSize: 9 },
        inRange: { color: [p.heatLo, p.heatHi] },
        text: [tr('pulse.heat.hi'), tr('pulse.heat.lo')]
      },
      series: [{
        type: 'heatmap', data: data,
        itemStyle: { borderColor: isLight() ? '#fff' : 'rgba(6,11,28,.7)', borderWidth: 1, borderRadius: 2 },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(10,132,255,.5)' } }
      }]
    }), true);
  }

  /* ---------- KPI-СТРОКА (CountUp) ---------- */
  var cuInst = {};
  function setVal(id, value, moneyFmt) {
    var el = document.getElementById(id);
    if (!el) return;
    var opts = {
      duration: reduceMotion ? 0 : 1.1,
      formattingFn: moneyFmt ? function (v) { return fmtMoney(v); } : function (v) { return fmtInt(v); }
    };
    if (window.countUp && window.countUp.CountUp && !reduceMotion) {
      if (cuInst[id]) { cuInst[id].update(Math.round(value)); return; }
      var cu = new window.countUp.CountUp(el, Math.round(value), opts);
      if (!cu.error) { cuInst[id] = cu; cu.start(); return; }
    }
    el.textContent = opts.formattingFn(Math.round(value));
  }
  function setDelta(id, cur, prev) {
    var el = document.getElementById(id);
    if (!el) return;
    if (!prev) { el.textContent = ''; return; }
    var pct = Math.round((cur - prev) / prev * 100);
    var up = pct >= 0;
    el.textContent = (up ? '▲ +' : '▼ ') + pct + '%';
    el.className = 'pkpi__d ' + (up ? 'is-up' : 'is-down');
  }
  function renderKpis(animate) {
    var cur = kpis(N - 30, N), prev = kpis(N - 60, N - 30);
    setVal('pkV-rev', cur.rev, true);
    setVal('pkV-leads', cur.leads, false);
    setVal('pkV-ans', cur.ans, false);
    setVal('pkV-hrs', cur.hrs, false);
    setDelta('pkD-rev', cur.rev, prev.rev);
    setDelta('pkD-leads', cur.leads, prev.leads);
    setDelta('pkD-ans', cur.ans, prev.ans);
    setDelta('pkD-hrs', cur.hrs, prev.hrs);

    /* вклад выбранной роли в KPI (клик по стек-бару) */
    var hlA = document.getElementById('pkH-ans'), hlH = document.getElementById('pkH-hrs');
    var cardA = hlA && hlA.closest('.pkpi'), cardH = hlH && hlH.closest('.pkpi');
    if (state.role) {
      var r = null; ROLES.forEach(function (x) { if (x.id === state.role) r = x; });
      var s = sumRole(r, N - 30, N);
      var shareA = cur.ans ? Math.round(s / cur.ans * 100) : 0;
      var hrsR = s * r.min / 60;
      var shareH = cur.hrs ? Math.round(hrsR / cur.hrs * 100) : 0;
      if (hlA) { hlA.hidden = false; hlA.textContent = tr(r.key) + ': ' + fmtInt(s) + ' · ' + shareA + '%'; hlA.style.color = r.color; }
      if (hlH) { hlH.hidden = false; hlH.textContent = tr(r.key) + ': ' + fmtInt(hrsR) + ' ' + tr('pulse.h') + ' · ' + shareH + '%'; hlH.style.color = r.color; }
      if (cardA) cardA.classList.add('is-hl');
      if (cardH) cardH.classList.add('is-hl');
    } else {
      if (hlA) hlA.hidden = true;
      if (hlH) hlH.hidden = true;
      if (cardA) cardA.classList.remove('is-hl');
      if (cardH) cardH.classList.remove('is-hl');
    }
  }

  /* ---------- ЛЕНТА «ИИ-ИНСАЙТОВ» с печатью ---------- */
  var feedGen = 0;
  function insightTexts() {
    var d = buildData();
    /* пик нагрузки */
    var bw = 0, bh = 0, bv = -1;
    for (var w = 0; w < 5; w++) for (var h = 8; h < 20; h++) {
      var v = 0; ROLES.forEach(function (r) { v += d.heat[r.id][w][h]; });
      if (v > bv) { bv = v; bw = w; bh = h; }
    }
    var all = kpis(N - 30, N);
    var opS = 0; ROLES.forEach(function (r) { if (r.id === 'op') opS = sumRole(r, N - 30, N); });
    var opPct = all.ans ? Math.round(opS / all.ans * 100) : 0;
    /* доля ночи и выходных */
    var night = 0, total = 0;
    for (var w2 = 0; w2 < 7; w2++) for (var h2 = 0; h2 < 24; h2++) {
      var vv = 0; ROLES.forEach(function (r) { vv += d.heat[r.id][w2][h2]; });
      total += vv;
      if (w2 >= 5 || h2 >= 22 || h2 < 7) night += vv;
    }
    var nightPct = Math.round(night / total * 100);
    var lawWeek = Math.round(sumRole(ROLES[1], N - 7, N));
    var risks = Math.max(2, Math.round(lawWeek * 0.09));
    var convA = 0, convB = 0;
    for (var i = 0; i < 30; i++) { convA += d.conv[i]; convB += d.conv[N - 30 + i]; }
    convA = (convA / 30).toFixed(1); convB = (convB / 30).toFixed(1);
    var fte = (all.hrs / 160).toFixed(1);
    var fot = Math.round(all.hrs * FOT_RATE);
    var payback = Math.max(0.5, IMPL_COST / Math.max(1, fot - SUPPORT_MO)).toFixed(1);
    if (lang() !== 'en') { convA = convA.replace('.', ','); convB = convB.replace('.', ','); fte = fte.replace('.', ','); payback = payback.replace('.', ','); }

    function T(key, map) {
      var s = tr(key);
      Object.keys(map).forEach(function (k) { s = s.replace('{' + k + '}', map[k]); });
      return s;
    }
    return [
      T('pulse.i1', { d: weekdayName(bw, 'long'), h: bh + ':00', p: opPct }),
      T('pulse.i2', { n: risks }),
      T('pulse.i3', { p: nightPct }),
      T('pulse.i4', { h: fmtInt(all.hrs), f: fte }),
      T('pulse.i5', { a: convA, b: convB }),
      T('pulse.i6', { m: payback })
    ];
  }
  function renderFeed(retype) {
    var ul = document.getElementById('pFeed');
    if (!ul) return;
    var items = insightTexts();
    feedGen += 1;
    var gen = feedGen;
    ul.innerHTML = '';
    if (reduceMotion || document.hidden || !retype) {
      items.forEach(function (t) {
        var li = document.createElement('li'); li.textContent = t; ul.appendChild(li);
      });
      return;
    }
    var i = 0;
    (function nextItem() {
      if (gen !== feedGen || i >= items.length) return;
      var li = document.createElement('li');
      li.className = 'is-typing';
      ul.appendChild(li);
      var text = items[i], ci = 0;
      (function ch() {
        if (gen !== feedGen) return;
        if (ci <= text.length) {
          li.textContent = text.slice(0, ci);
          ci += 2;
          setTimeout(ch, 14);
        } else {
          li.textContent = text;
          li.classList.remove('is-typing');
          i += 1;
          setTimeout(nextItem, 260);
        }
      })();
    })();
  }

  /* ---------- СБОРКА ---------- */
  var built = false;
  function renderAll(retypeFeed) {
    renderKpis(true);
    renderLeads();
    renderRoles();
    renderEcon();
    renderHeat();
    renderFeed(retypeFeed);
  }
  function resizeAll() {
    Object.keys(charts).forEach(function (k) { try { charts[k].resize(); } catch (e) {} });
  }

  function bindFilters() {
    var dp = document.getElementById('pulseDept');
    if (dp) dp.addEventListener('click', function (e) {
      var b = e.target.closest('[data-dept]'); if (!b) return;
      state.dept = b.dataset.dept;
      Array.prototype.forEach.call(dp.querySelectorAll('.pchip'), function (x) {
        var sel = x === b;
        x.classList.toggle('is-sel', sel);
        x.setAttribute('aria-checked', sel ? 'true' : 'false');
      });
      renderKpis(false); renderRoles(); renderEcon(); renderHeat();
    });
    var rp = document.getElementById('pulseRange');
    if (rp) rp.addEventListener('click', function (e) {
      var b = e.target.closest('[data-range]'); if (!b) return;
      state.range = +b.dataset.range;
      Array.prototype.forEach.call(rp.querySelectorAll('.pchip'), function (x) {
        var sel = x === b;
        x.classList.toggle('is-sel', sel);
        x.setAttribute('aria-checked', sel ? 'true' : 'false');
      });
      renderLeads(); renderRoles();
    });
  }

  function build() {
    if (built) return;
    built = true;
    var loading = document.getElementById('pulseLoading');
    var grid = document.getElementById('pulseGrid');
    if (loading) loading.hidden = true;
    if (grid) grid.hidden = false;
    bindFilters();
    renderAll(true);

    /* ресайз окна (drag-resize / развернуть) → перерисовать графики */
    var body = document.querySelector('#win-pulse .win__body');
    if (body && 'ResizeObserver' in window) {
      var t = null;
      new ResizeObserver(function () {
        clearTimeout(t); t = setTimeout(resizeAll, 120);
      }).observe(body);
    }
    window.addEventListener('resize', function () { setTimeout(resizeAll, 180); });

    /* смена темы: перерисовать с палитрой новой темы */
    var wasLight = isLight();
    new MutationObserver(function () {
      if (isLight() !== wasLight) {
        wasLight = isLight();
        renderAll(false);
      }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    /* смена языка: подписи, валюта, даты, инсайты */
    document.addEventListener('i18n:change', function () {
      cuInst = {}; // форматтер валюты сменился — пересоздать счётчики
      renderAll(true);
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
  function ensureLibs() {
    if (window.echarts) return Promise.resolve();
    if (libsP) return libsP;
    libsP = script('vendor/echarts.min.js')
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
      requestAnimationFrame(resizeAll);
      return;
    }
    ensureLibs().then(build, showError);
  }

  window.Pulse = { open: open };
  if (DEV) {
    window.__pulse = {
      data: buildData,
      kpis: function () { return kpis(N - 30, N); },
      state: state,
      charts: function () { return Object.keys(charts); },
      inst: function (id) { return charts[id]; },
      insights: insightTexts
    };
  }
})();
