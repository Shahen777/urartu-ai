/* ============================================================
   office3d.js — свой 3D-офис на three.js (r160, MIT, локально).
   Наши 5 агентов сидят за столами вокруг центрального «локального
   сервера». Диспетчер назначает задачу → нужный агент подсвечивается,
   на его мониторе появляется задача. Полная синхронизация с командой.
   Ленивая загрузка three.js по первому открытию вкладки.
   Наружу: window.Office3D { ensure(box, roster), assign(id, text),
            done(id), reset(), dispose() }
   roster: [{ id, name, role, hue, img }]
   ============================================================ */
(function () {
  'use strict';
  if (window.Office3D) return;

  var THREE = null, mounted = false, disposed = false;
  var renderer, scene, camera, group, raf = 0, clock0 = 0;
  var box = null, ROS = [], stations = {}, core = null;
  var autoRot = true, dragging = false, lastX = 0, yaw = 0.5, targetYaw = 0.5;
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function hsl(h, s, l) { return new THREE.Color().setHSL(((h % 360) + 360) % 360 / 360, s, l); }

  /* ---------- нейм-плейт (canvas → sprite): фото + имя + роль ---------- */
  function makePlate(a) {
    var W = 420, H = 150, c = document.createElement('canvas'); c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    var img = new Image(); img.decoding = 'async';
    var loaded = false;
    img.onload = function () { loaded = true; draw(a.role || '', false, false); };
    img.onerror = function () { draw(a.role || '', false, false); };
    img.src = a.img;
    function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function draw(sub, active, doneOk) {
      ctx.clearRect(0, 0, W, H);
      var col = a.hue;
      /* карточка-стекло */
      ctx.save();
      rr(6, 6, W - 12, H - 12, 26);
      ctx.fillStyle = active ? 'rgba(24,26,34,0.96)' : 'rgba(24,26,34,0.86)';
      ctx.fill();
      ctx.lineWidth = active ? 5 : 2.5;
      ctx.strokeStyle = doneOk ? 'rgba(48,209,88,0.95)' : ('hsla(' + col + ',80%,62%,' + (active ? '0.95' : '0.5') + ')');
      ctx.stroke();
      ctx.restore();
      /* фото по кругу */
      var cx = 66, cy = H / 2, r = 44;
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.closePath(); ctx.clip();
      if (loaded) ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
      else { ctx.fillStyle = 'hsl(' + col + ',40%,40%)'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); }
      ctx.restore();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.lineWidth = 3; ctx.strokeStyle = 'hsla(' + col + ',80%,62%,0.9)'; ctx.stroke();
      /* статус-точка */
      ctx.beginPath(); ctx.arc(cx + 32, cy + 32, 9, 0, 7); ctx.fillStyle = doneOk ? '#30d158' : (active ? 'hsl(' + col + ',85%,60%)' : '#30d158'); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(24,26,34,1)'; ctx.stroke();
      /* текст */
      ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
      ctx.font = '700 30px -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillText(a.name, 126, sub ? cy - 24 : cy - 6, W - 140);
      ctx.fillStyle = active ? ('hsl(' + col + ',85%,72%)') : 'rgba(255,255,255,0.62)';
      ctx.font = (active ? '600 ' : '500 ') + '22px -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillText(sub || a.role || '', 126, cy + (sub ? 12 : 22), W - 140);
      tex.needsHTMLImageElementNeedsUpdate = true; tex.needsUpdate = true;
    }
    var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, depthWrite: false });
    var sp = new THREE.Sprite(mat);
    sp.scale.set(2.1, 0.75, 1);
    sp.userData.draw = draw;
    return sp;
  }

  /* ---------- монитор: canvas со «текущей задачей» ---------- */
  function makeScreen(a) {
    var W = 256, H = 160, c = document.createElement('canvas'); c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    var tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    function draw(txt, active) {
      var col = a.hue;
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'hsl(' + col + ',' + (active ? '55%,22%' : '30%,14%') + ')');
      g.addColorStop(1, 'hsl(' + col + ',' + (active ? '60%,12%' : '30%,8%') + ')');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = active ? 'rgba(255,255,255,0.95)' : 'hsla(' + col + ',70%,70%,0.5)';
      ctx.font = '600 18px -apple-system, Segoe UI, Roboto, sans-serif'; ctx.textBaseline = 'top';
      if (txt) {
        wrap(txt, 14, 16, W - 28, 22);
      } else {
        ctx.font = '700 40px monospace'; ctx.fillText('•••', 14, H / 2 - 22);
      }
      tex.needsUpdate = true;
    }
    function wrap(t, x, y, mw, lh) {
      var words = t.split(' '), line = '', yy = y, n = 0;
      for (var i = 0; i < words.length; i++) {
        var test = line + words[i] + ' ';
        if (ctx.measureText(test).width > mw && line) { ctx.fillText(line, x, yy); line = words[i] + ' '; yy += lh; if (++n > 4) break; }
        else line = test;
      }
      ctx.fillText(line, x, yy);
    }
    draw('', false);
    return { tex: tex, draw: draw };
  }

  /* ---------- один рабочий стол ---------- */
  function buildStation(a, angle) {
    var col = a.hue;
    var st = new THREE.Group();
    var R = 3.5;
    st.position.set(Math.sin(angle) * R, 0, Math.cos(angle) * R);
    st.rotation.y = angle + Math.PI; // лицом к центру

    var deskMat = new THREE.MeshStandardMaterial({ color: 0x22242c, roughness: 0.75, metalness: 0.1 });
    var top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.8), deskMat);
    top.position.y = 0.72; top.castShadow = true; top.receiveShadow = true; st.add(top);
    [[-0.78, -0.32], [0.78, -0.32], [-0.78, 0.32], [0.78, 0.32]].forEach(function (p) {
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.72, 0.07), deskMat);
      leg.position.set(p[0], 0.36, p[1]); st.add(leg);
    });
    /* монитор */
    var scr = makeScreen(a);
    var stand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), deskMat);
    stand.position.set(0, 0.9, -0.22); st.add(stand);
    var mon = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.56, 0.05), new THREE.MeshStandardMaterial({ color: 0x15161c, roughness: 0.5 }));
    mon.position.set(0, 1.22, -0.24); st.add(mon);
    var screenMat = new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false });
    var screen = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.5), screenMat);
    screen.position.set(0, 1.22, -0.213); st.add(screen);
    /* кресло */
    var chairMat = new THREE.MeshStandardMaterial({ color: 0x2a2d37, roughness: 0.8 });
    var seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), chairMat); seat.position.set(0, 0.5, 0.85); seat.castShadow = true; st.add(seat);
    var back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.1), chairMat); back.position.set(0, 0.8, 1.08); back.castShadow = true; st.add(back);
    /* «сотрудник» — мягкая фигура в фирменном цвете */
    var bodyMat = new THREE.MeshStandardMaterial({ color: hsl(col, 0.5, 0.5), roughness: 0.6, metalness: 0.05 });
    var body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.32, 6, 12), bodyMat); body.position.set(0, 0.82, 0.72); body.castShadow = true; st.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), new THREE.MeshStandardMaterial({ color: 0xf0d9c4, roughness: 0.7 })); head.position.set(0, 1.18, 0.72); head.castShadow = true; st.add(head);
    /* подсветка стола (point light, гаснет в покое) */
    var pl = new THREE.PointLight(hsl(col, 0.85, 0.6), 0, 4, 2); pl.position.set(0, 1.5, 0); st.add(pl);
    /* нейм-плейт над столом */
    var plate = makePlate(a);
    plate.position.set(0, 2.05, 0.2); st.add(plate);
    /* пол-подсветка (диск) */
    var ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 40), new THREE.MeshBasicMaterial({ color: hsl(col, 0.8, 0.6), transparent: true, opacity: 0, side: THREE.DoubleSide, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; st.add(ring);

    return { group: st, screen: scr, plate: plate, light: pl, screenMat: screenMat, body: bodyMat, ring: ring, hue: col, a: a, state: 'idle' };
  }

  function build() {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    box.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:pan-y';

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a0c14, 10, 22);
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

    group = new THREE.Group(); scene.add(group);

    /* свет */
    scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x1a1d26, 0.55));
    var key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(5, 9, 6);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1; key.shadow.camera.far = 30;
    key.shadow.camera.left = -8; key.shadow.camera.right = 8; key.shadow.camera.top = 8; key.shadow.camera.bottom = -8;
    key.shadow.bias = -0.0004; scene.add(key);
    scene.add(new THREE.AmbientLight(0x223, 0.5));

    /* пол */
    var floor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.MeshStandardMaterial({ color: 0x11131b, roughness: 0.95, metalness: 0.0 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; group.add(floor);
    var grid = new THREE.GridHelper(18, 36, 0x2a3350, 0x1a2036);
    grid.material.transparent = true; grid.material.opacity = 0.35; grid.position.y = 0.01; group.add(grid);

    /* центральный «сервер» */
    core = new THREE.Group();
    var rackMat = new THREE.MeshStandardMaterial({ color: 0x1b1e28, roughness: 0.5, metalness: 0.3 });
    var rack = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.9), rackMat); rack.position.y = 0.75; rack.castShadow = true; core.add(rack);
    for (var i = 0; i < 5; i++) {
      var led = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.02), new THREE.MeshBasicMaterial({ color: 0x30d158, toneMapped: false }));
      led.position.set(0, 0.35 + i * 0.25, 0.46); core.add(led);
    }
    var glowRing = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.35, 48), new THREE.MeshBasicMaterial({ color: 0x2ea1ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, toneMapped: false }));
    glowRing.rotation.x = -Math.PI / 2; glowRing.position.y = 0.03; core.add(glowRing);
    core.userData.ring = glowRing;
    var coreLight = new THREE.PointLight(0x2ea1ff, 6, 8, 2); coreLight.position.set(0, 1.4, 0); core.add(coreLight);
    group.add(core);

    /* станции сотрудников по дуге */
    var n = ROS.length;
    ROS.forEach(function (a, i) {
      var angle = (i - (n - 1) / 2) * (1.15 / Math.max(1, (n - 1) / 2)) ; // разворот дуги
      angle = (i / n) * Math.PI * 2; // полный круг — читается лучше при вращении
      var st = buildStation(a, angle);
      group.add(st.group);
      stations[a.id] = st;
    });

    onResize();
    bindPointer();
    clock0 = 0;
    loop();
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    var t = (performance && performance.now ? performance.now() : Date.now()) / 1000;
    if (autoRot && !dragging && !reduce) targetYaw += 0.0016;
    yaw += (targetYaw - yaw) * 0.08;
    group.rotation.y = yaw;
    /* дыхание сервера */
    if (core) { var s = 1 + Math.sin(t * 1.8) * 0.04; core.userData.ring.scale.setScalar(s); core.userData.ring.material.opacity = 0.35 + Math.sin(t * 1.8) * 0.15; }
    /* нейм-плейты всегда к камере (Sprite это делает сам); лёгкое парение активных */
    for (var id in stations) {
      var st = stations[id];
      if (st.state === 'active') { st.plate.position.y = 2.05 + Math.sin(t * 3) * 0.04; }
    }
    renderer.render(scene, camera);
  }

  function onResize() {
    if (!box || !renderer) return;
    var w = box.clientWidth || 600, h = box.clientHeight || 380;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    /* изометричная посадка камеры */
    camera.position.set(0, 6.2, 9.4);
    camera.lookAt(0, 1.1, 0);
  }

  function bindPointer() {
    var el = renderer.domElement;
    el.addEventListener('pointerdown', function (e) { dragging = true; lastX = e.clientX; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', function (e) { if (!dragging) return; targetYaw += (e.clientX - lastX) * 0.006; lastX = e.clientX; });
    function up() { dragging = false; }
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
  }

  /* ---------- API синхронизации ---------- */
  function setState(id, state, text) {
    var st = stations[id]; if (!st) return;
    st.state = state;
    var active = state === 'active', done = state === 'done';
    st.light.intensity = active ? 5 : (done ? 2 : 0);
    st.ring.material.opacity = active ? 0.85 : (done ? 0.5 : 0);
    if (done) st.ring.material.color = new THREE.Color(0x30d158);
    else st.ring.material.color = hsl(st.hue, 0.8, 0.6);
    st.screenMat.map.dispose && 0;
    st.screen.draw(active || done ? (text || '') : '', active || done);
    st.body.emissive = hsl(st.hue, 0.8, 0.5); st.body.emissiveIntensity = active ? 0.5 : (done ? 0.2 : 0);
    if (st.plate.userData.draw) st.plate.userData.draw(text || st.a.role, active, done);
    st.plate.scale.set(active ? 2.5 : 2.1, active ? 0.9 : 0.75, 1);
  }
  function assign(id, text) { setState(id, 'active', text); }
  function done(id, text) { setState(id, 'done', text); }
  function reset() { for (var id in stations) setState(id, 'idle', ''); }

  function ensure(el, roster) {
    box = el; ROS = roster || ROS;
    if (mounted) { onResize(); return Promise.resolve(); }
    if (disposed) return Promise.resolve();
    return import(new URL('vendor/three/three.module.min.js', document.baseURI).href).then(function (mod) {
      THREE = mod; if (mounted) return; build(); mounted = true;
      if (window.ResizeObserver) { var ro = new ResizeObserver(function () { onResize(); }); ro.observe(box); }
      window.addEventListener('resize', onResize);
    }).catch(function (e) { if (box) box.classList.add('is-failed'); });
  }
  function dispose() {
    if (raf) cancelAnimationFrame(raf);
    if (renderer) { renderer.dispose && renderer.dispose(); if (renderer.domElement && renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); }
    mounted = false; disposed = false;
  }

  window.Office3D = { ensure: ensure, assign: assign, done: done, reset: reset, dispose: dispose, ready: function () { return mounted; } };
})();
