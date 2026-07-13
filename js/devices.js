/* devices.js — интерактив окна «Устройства» (LOT T2).
   Детерминированно, без Math.random. Цифры — честный порядок величины из research/models-v8.md.
   Лениво: подключается при первом открытии win-devices (ensureDevices в os.js). */
(function () {
  'use strict';
  if (window.Devices) return;

  /* Данные станций. tps/wps/resp — из research (Q4, короткий контекст).
     wps/resp зафиксированы, чтобы совпадать с таблицей в разметке. */
  var META = {
    start:  { kp: 'd1', model: 'Qwen3 14B',          tps: 35, wps: 26, resp: 5,  rub: 180000,  usd: 1800,  empMax: 10,  rep: 6,  ladder: true },
    pro:    { kp: 'd2', model: 'Qwen3 32B',          tps: 38, wps: 28, resp: 4,  rub: 450000,  usd: 4500,  empMax: 30,  rep: 22, ladder: true },
    max:    { kp: 'd3', model: 'Qwen3 32B / 70B',    tps: 20, wps: 15, resp: 8,  rub: 650000,  usd: 6500,  empMax: 50,  rep: 42, ladder: true },
    mac:    { kp: 'd4', model: 'Qwen 70B',           tps: 8,  wps: 6,  resp: 20, rub: 450000,  usd: 4500,  empMax: 40,  rep: 38, ladder: false, altKey: 'dev.ix.macAlt' },
    server: { kp: 'd5', model: 'GLM-5 · DeepSeek V4', tps: 50, wps: 37, resp: 3,  rub: 1500000, usd: 15000, empMax: 100, rep: 80, ladder: true },
    /* Готовые устройства NVIDIA (не наша сборка) — честные цифры из офиц. спеков:
       Spark ограничен пропускной способностью памяти (273 ГБ/с) — держит огромные
       модели, но не самый быстрый; Station — реальный ~$85-100тыс, только через
       OEM-партнёров (Dell/ASUS/Supermicro), энтерпрайз-класс, не для типового МСБ. */
    dgxspark:   { kp: 'd6', model: 'Qwen/Llama до 200B (FP4)',        tps: 12, wps: 9,  resp: 10, rub: 400000,  usd: 4000,  empMax: 35,  rep: 25,  ladder: false, altKey: 'dev.ix.sparkAlt' },
    /* rep ≤ 0.8·empMax, иначе выбор карточки сразу показывал бы «впритык —
       присмотритесь к следующей», хотя следующей за Station уже нет */
    dgxstation: { kp: 'd7', model: 'GLM-5 · DeepSeek V4 (до 1 трлн)', tps: 55, wps: 41, resp: 3,  rub: 8000000, usd: 80000, empMax: 150, rep: 100, ladder: false, altKey: 'dev.ix.stationAlt' }
  };
  var ORDER = ['start', 'pro', 'max', 'mac', 'server', 'dgxspark', 'dgxstation'];

  /* Матрица возможностей: 2 = с запасом, 1 = тянет, 0 = нужна мощнее. */
  var CAP = {
    start:  { support: 2, rag: 1, summary: 1, generate: 1, contracts: 0, voice: 1 },
    pro:    { support: 2, rag: 2, summary: 2, generate: 2, contracts: 1, voice: 2 },
    max:    { support: 2, rag: 2, summary: 2, generate: 2, contracts: 2, voice: 1 },
    mac:    { support: 2, rag: 2, summary: 2, generate: 2, contracts: 2, voice: 0 },
    server: { support: 2, rag: 2, summary: 2, generate: 2, contracts: 2, voice: 2 },
    /* Spark: огромная модель влезает, но узкое место по памяти бьёт по генерации/голосу */
    dgxspark:   { support: 2, rag: 2, summary: 2, generate: 1, contracts: 2, voice: 1 },
    dgxstation: { support: 2, rag: 2, summary: 2, generate: 2, contracts: 2, voice: 2 }
  };

  var CLOUD_PER_EMP = { rub: 2500, usd: 28 }; /* ориентировочная абонплата облака на 1 пользователя/мес */

  /* Кастомный конфигуратор кластера (T3) — формула, не lookup по фиксированной
     станции. Точка отсчёта (2 GPU) согласована с существующей карточкой
     «Сервер Multi-GPU» (от 1,5 млн ₽), дальше растёт линейно — честный порядок
     величины для планирования, не биржевая цена конкретных карт. */
  function customCalc(gpus) {
    var rub = 1500000 + (gpus - 2) * 500000;
    var usd = 15000 + (gpus - 2) * 5000;
    var tps = 50 + (gpus - 2) * 8;
    var wps = Math.round(tps * 0.74);
    var model;
    if (gpus <= 2) model = '70B';
    else if (gpus <= 4) model = '200B (MoE)';
    else if (gpus <= 6) model = '400B (MoE)';
    else model = '671B+ (GLM-5 / DeepSeek целиком)';
    return { rub: rub, usd: usd, tps: tps, wps: wps, model: model };
  }
  var CUSTOM_MODEL_EN = { '70B': '70B', '200B (MoE)': '200B (MoE)', '400B (MoE)': '400B (MoE)', '671B+ (GLM-5 / DeepSeek целиком)': '671B+ (full GLM-5 / DeepSeek)' };

  var state = { emp: 6, station: 'start', task: 'support', side: 'own', pinned: false, gpu: 4 };
  var bound = false;

  function t(k) { return (window.I18N && window.I18N.t) ? window.I18N.t(k) : k; }
  function isEn() { return window.I18N && window.I18N.lang === 'en'; }
  function grp(n, sep) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep); }
  function money(m) {
    return isEn() ? '$' + grp(m.usd, ',') : grp(m.rub, ' ') + ' ₽';
  }
  function perMonth(rub, usd) {
    return isEn() ? '$' + grp(usd, ',') + '/mo' : grp(rub, ' ') + ' ₽/мес';
  }

  function ladder(emp) {
    if (emp <= 10) return 'start';
    if (emp <= 30) return 'pro';
    if (emp <= 50) return 'max';
    return 'server';
  }

  function comfort(station, emp) {
    var m = META[station];
    if (emp > m.empMax) return { key: 'dev.ix.tight', warn: true };
    if (emp >= Math.round(m.empMax * 0.8)) return { key: 'dev.ix.nearTop', warn: true };
    /* у каждой станции вне «лестницы» — своё сообщение (altKey), а не общее
       на всех — иначе NVIDIA-устройства унаследовали бы текст про Mac Studio */
    if (!m.ladder) return { key: m.altKey || 'dev.ix.macAlt', warn: false };
    return { key: 'dev.ix.comfy', warn: false };
  }

  var $ = function (id) { return document.getElementById(id); };

  function render() {
    var st = state.station, m = META[st], cap = CAP[st];
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ползунок */
    var empN = $('dvxEmpN'); if (empN) empN.textContent = state.emp;
    var slider = $('dvxEmp'); if (slider && +slider.value !== state.emp) slider.value = state.emp;

    /* карточки */
    var cards = document.querySelectorAll('#devGrid .dev-card');
    Array.prototype.forEach.call(cards, function (c) {
      var on = c.getAttribute('data-station') === st;
      c.classList.toggle('is-active', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    /* рекомендация */
    var rn = $('dvxRecName'); if (rn) rn.textContent = t('dev.' + m.kp + '.name');
    var rm = $('dvxRecModel'); if (rm) rm.textContent = m.model + ' ≈ ' + t('dev.' + m.kp + '.equiv');
    var rp = $('dvxRecPrice'); if (rp) rp.textContent = t('dev.' + m.kp + '.price');
    var cf = comfort(st, state.emp);
    var cb = $('dvxComfort');
    if (cb) { cb.textContent = t(cf.key); cb.classList.toggle('is-warn', cf.warn); }
    var showRec = $('dvxShowRec');
    if (showRec) showRec.hidden = !(state.pinned && cf.warn);

    /* задачи: перекраска по способностям станции */
    var tiles = document.querySelectorAll('#dvxTasks .dvx-task');
    Array.prototype.forEach.call(tiles, function (b) {
      var lv = cap[b.getAttribute('data-task')];
      b.classList.remove('dvx-task--ok2', 'dvx-task--ok1', 'dvx-task--warn');
      b.classList.add(lv === 2 ? 'dvx-task--ok2' : (lv === 1 ? 'dvx-task--ok1' : 'dvx-task--warn'));
      b.classList.toggle('is-sel', b.getAttribute('data-task') === state.task);
      b.setAttribute('aria-pressed', b.getAttribute('data-task') === state.task ? 'true' : 'false');
    });
    var lv = cap[state.task];
    var vKey = lv === 2 ? 'dev.ix.cap2' : (lv === 1 ? 'dev.ix.cap1' : 'dev.ix.cap0');
    var hint = $('dvxTaskHint');
    if (hint) {
      hint.textContent = t('dev.task.' + state.task) + ' · ' + t('dev.' + m.kp + '.name') + ': ' + t(vKey);
      hint.classList.toggle('is-warn', lv === 0);
    }

    /* спидометр */
    var g = $('dvxGauge');
    if (g) {
      g.style.transition = reduce ? 'none' : '';
      g.style.width = Math.min(100, Math.round(m.tps / 55 * 100)) + '%';
    }
    var wps = $('dvxWps'); if (wps) wps.textContent = m.wps;
    var resp = $('dvxResp'); if (resp) resp.textContent = '~' + m.resp + ' ' + t('dev.ix.sec');

    /* станция vs облако */
    var ownBig = $('dvxOwnBig'); if (ownBig) ownBig.textContent = money(m);
    var perR = state.emp * CLOUD_PER_EMP.rub, perU = state.emp * CLOUD_PER_EMP.usd;
    var cloudBig = $('dvxCloudBig'); if (cloudBig) cloudBig.textContent = perMonth(perR, perU);
    var months = Math.max(1, Math.round((isEn() ? m.usd / perU : m.rub / perR)));
    var pay = $('dvxPayback');
    if (pay) pay.textContent = t('dev.ix.payTpl').replace('{n}', months).replace('{station}', t('dev.' + m.kp + '.name'));
    var cols = document.querySelectorAll('#dvx .dvx-vs__col');
    Array.prototype.forEach.call(cols, function (c) {
      c.classList.toggle('is-active', c.getAttribute('data-col') === state.side);
    });
    var segs = document.querySelectorAll('#dvx .dvx-vs__seg-b');
    Array.prototype.forEach.call(segs, function (b) {
      var on = b.getAttribute('data-side') === state.side;
      b.classList.toggle('is-sel', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    renderCustom();
  }

  function renderCustom() {
    var gpuN = $('dvxGpuN'); if (gpuN) gpuN.textContent = state.gpu;
    var slider = $('dvxGpu'); if (slider && +slider.value !== state.gpu) slider.value = state.gpu;
    var c = customCalc(state.gpu);
    var modelEl = $('dvxCustomModel');
    if (modelEl) modelEl.textContent = isEn() ? (CUSTOM_MODEL_EN[c.model] || c.model) : c.model;
    var speedEl = $('dvxCustomSpeed'); if (speedEl) speedEl.textContent = '~' + c.wps + ' ' + t('dev.ix.wps');
    var priceEl = $('dvxCustomPrice'); if (priceEl) priceEl.textContent = '≈ ' + money(c);
  }

  function bind() {
    if (bound) return; bound = true;

    var slider = $('dvxEmp');
    if (slider) slider.addEventListener('input', function () {
      state.emp = Math.max(1, Math.min(100, parseInt(slider.value, 10) || 1));
      /* если станция закреплена явным выбором карточки — НЕ переключаем её
         автоматически, иначе директор никогда не увидит реальную перегрузку
         (UI сам «самоисцелялся», меняя станцию раньше, чем численность её
         превысит) */
      if (!state.pinned) state.station = ladder(state.emp);
      render();
    });

    var gpuSlider = $('dvxGpu');
    if (gpuSlider) gpuSlider.addEventListener('input', function () {
      state.gpu = Math.max(2, Math.min(8, parseInt(gpuSlider.value, 10) || 2));
      renderCustom();
    });

    var grid = $('devGrid');
    if (grid) grid.addEventListener('click', function (e) {
      var c = e.target.closest ? e.target.closest('.dev-card') : null;
      if (!c) return;
      /* клик по фото — увеличить, не выбирать станцию (два разных действия) */
      var shot = e.target.closest ? e.target.closest('.dev-card__shot') : null;
      if (shot && window.Lightbox) {
        var img = shot.querySelector('img');
        var nm = c.querySelector('.dev-card__name');
        if (img && img.src) window.Lightbox.open(img.currentSrc || img.src, nm ? nm.textContent : '');
        return;
      }
      var id = c.getAttribute('data-station');
      if (!META[id]) return;
      state.station = id;
      state.emp = META[id].rep;
      state.pinned = true;
      render();
    });

    var showRec = $('dvxShowRec');
    if (showRec) showRec.addEventListener('click', function () {
      state.pinned = false;
      state.station = ladder(state.emp);
      render();
    });

    var tasks = $('dvxTasks');
    if (tasks) tasks.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.dvx-task') : null;
      if (!b) return;
      state.task = b.getAttribute('data-task');
      render();
    });

    var vs = document.querySelector('#dvx .dvx-vs__seg');
    if (vs) vs.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.dvx-vs__seg-b') : null;
      if (!b) return;
      state.side = b.getAttribute('data-side');
      render();
    });

    document.addEventListener('i18n:change', function () { render(); });
  }

  window.Devices = {
    open: function () { bind(); render(); },
    refresh: function () { render(); }
  };
  /* если разметка уже в DOM — сразу инициализируемся */
  if (document.getElementById('dvx')) window.Devices.open();
})();
