/* ============================================================
   face3d.mjs — 3D-лицо ИИ-секретаря с липсинком. Загружается
   ЛЕНИВО по кнопке «Включить видео-аватар» (~0,75 МБ three.js).

   Почему НЕ Ready Player Me GLB: лицензия RPM разрешает аватары
   только внутри приложений, интегрированных с их платформой по
   Developer Agreement; выкладывать готовый GLB на коммерческий
   сайт без такой интеграции нельзя. Поэтому — собственная
   стилизованная голова на three.js (MIT): сфера + «морфы» рта
   и век, деловой стиль. Плюс: в 10 раз легче и без внешних
   ассетов вообще.

   Липсинк: уровень речи (RMS-огибающая VITS или синусоида
   системного голоса) → 4 визeмы (закрыт / полуоткрыт / открыт /
   «о») → сглаженное раскрытие рта.

   Бюджет: замер fps; < 30 → pixelRatio 1; всё равно слабо →
   onWeak() и самовыключение. Рендер на паузе при скрытой вкладке.
   ============================================================ */
import * as THREE from '../vendor/three/three.module.min.js';

let renderer = null, scene = null, camera = null, raf = 0;
let running = false, disposed = false;
let container = null, getLevel = null, onWeak = null;

let headG, eyeL, eyeR, lidL, lidR, irisL, irisR, browL, browR;
let mouthCavity, lipTop, lipBottom, jaw;
let mouthOpen = 0, mouthWide = 0, targetViseme = 0;
let state = 'idle';                 // idle | listen | think | speak
let blinkV = 0, blinkNext = 0, blinkPhase = 0;
let t0 = 0, lastFrame = 0;

/* fps-замер */
let frames = 0, fpsWindowStart = 0, fpsValue = 60, lowStrikes = 0, degraded = false;

const SKIN = 0xE8B694, SKIN_D = 0xD9A07E, HAIR = 0x3B2B22,
      LIP = 0xB2586C, CAVITY = 0x53222E, BLAZER = 0x223049,
      WHITE = 0xF6F3EE, IRIS = 0x5A7350;

function mat(color, rough) {
  return new THREE.MeshStandardMaterial({ color: color, roughness: rough == null ? 0.62 : rough, metalness: 0.02 });
}

function build() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
  camera.position.set(0, 0.02, 5.0);

  scene.add(new THREE.AmbientLight(0xffffff, 1.15));
  const key = new THREE.DirectionalLight(0xfff2e0, 1.6); key.position.set(2, 3, 4); scene.add(key);
  const fill = new THREE.DirectionalLight(0xbfd4ff, 0.7); fill.position.set(-3, 0.5, 2.5); scene.add(fill);

  headG = new THREE.Group();
  scene.add(headG);

  /* череп */
  const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 36), mat(SKIN));
  skull.scale.set(0.82, 1.0, 0.86);
  headG.add(skull);

  /* причёска: гладкая «шапка» + деловой пучок */
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1.03, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.44), mat(HAIR, 0.8));
  cap.scale.set(0.85, 1.02, 0.9);
  cap.rotation.x = -0.34;
  headG.add(cap);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 18), mat(HAIR, 0.8));
  bun.position.set(0, 0.5, -0.82);
  headG.add(bun);
  /* волосы до плеч: мягкие пряди по бокам, чуть позади лица */
  const sideGeo = new THREE.SphereGeometry(0.3, 20, 16);
  const sideL = new THREE.Mesh(sideGeo, mat(HAIR, 0.8));
  sideL.position.set(-0.66, -0.5, -0.18); sideL.scale.set(0.62, 1.9, 0.8);
  headG.add(sideL);
  const sideR = sideL.clone(); sideR.position.x = 0.66;
  headG.add(sideR);
  const backHair = new THREE.Mesh(new THREE.SphereGeometry(0.95, 24, 18), mat(HAIR, 0.8));
  backHair.position.set(0, -0.25, -0.32); backHair.scale.set(0.92, 1.05, 0.7);
  headG.add(backHair);
  /* уши + серьги */
  const earGeo = new THREE.SphereGeometry(0.12, 16, 12);
  const earL = new THREE.Mesh(earGeo, mat(SKIN_D)); earL.position.set(-0.8, -0.02, 0.05); earL.scale.set(0.5, 1, 0.7); headG.add(earL);
  const earR = earL.clone(); earR.position.x = 0.8; headG.add(earR);
  const rgGeo = new THREE.SphereGeometry(0.035, 10, 8);
  const rgMat = new THREE.MeshStandardMaterial({ color: 0xD8B36A, roughness: 0.25, metalness: 0.9 });
  const rgL = new THREE.Mesh(rgGeo, rgMat); rgL.position.set(-0.83, -0.2, 0.14); headG.add(rgL);
  const rgR = rgL.clone(); rgR.position.x = 0.83; headG.add(rgR);

  /* глаза */
  function makeEye(x) {
    const g = new THREE.Group();
    g.position.set(x, 0.1, 0.72);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.145, 24, 18), mat(WHITE, 0.35));
    ball.scale.z = 0.8;
    g.add(ball);
    const irisG = new THREE.Group();
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.065, 18, 14), mat(IRIS, 0.3));
    iris.position.z = 0.105; iris.scale.z = 0.45;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), mat(0x1A120E, 0.2));
    pupil.position.z = 0.135; pupil.scale.z = 0.4;
    irisG.add(iris); irisG.add(pupil);
    g.add(irisG);
    /* веко: полусфера кожи поверх глаза; rotation.x — «морф» закрытия */
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.155, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(SKIN_D));
    lid.rotation.x = -0.7;
    g.add(lid);
    return { g, irisG, lid };
  }
  const eL = makeEye(-0.3), eR = makeEye(0.3);
  eyeL = eL.g; eyeR = eR.g; irisL = eL.irisG; irisR = eR.irisG; lidL = eL.lid; lidR = eR.lid;
  headG.add(eyeL); headG.add(eyeR);

  /* брови */
  const browGeo = new THREE.CapsuleGeometry(0.02, 0.2, 4, 8);
  browL = new THREE.Mesh(browGeo, mat(HAIR, 0.7));
  browL.position.set(-0.3, 0.32, 0.76); browL.rotation.z = Math.PI / 2 + 0.12; browL.rotation.y = -0.25;
  headG.add(browL);
  browR = new THREE.Mesh(browGeo, mat(HAIR, 0.7));
  browR.position.set(0.3, 0.32, 0.76); browR.rotation.z = Math.PI / 2 - 0.12; browR.rotation.y = 0.25;
  headG.add(browR);

  /* нос */
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), mat(SKIN_D));
  nose.position.set(0, -0.1, 0.8); nose.scale.set(0.72, 1.25, 0.8);
  headG.add(nose);

  /* румянец */
  const chGeo = new THREE.SphereGeometry(0.09, 12, 10);
  const chMat = new THREE.MeshStandardMaterial({ color: 0xE39B84, roughness: 0.9, transparent: true, opacity: 0.55 });
  const chL = new THREE.Mesh(chGeo, chMat); chL.position.set(-0.42, -0.18, 0.68); chL.scale.set(1.2, 0.7, 0.5); headG.add(chL);
  const chR = chL.clone(); chR.position.x = 0.42; headG.add(chR);

  /* рот: полость + две губы; jaw-группа опускается при открытии */
  jaw = new THREE.Group();
  jaw.position.set(0, -0.42, 0.75);
  headG.add(jaw);
  mouthCavity = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), mat(CAVITY, 0.9));
  mouthCavity.scale.set(1, 0.12, 0.4);
  jaw.add(mouthCavity);
  const lipGeo = new THREE.TorusGeometry(0.155, 0.032, 10, 24, Math.PI);
  lipTop = new THREE.Mesh(lipGeo, mat(LIP, 0.45));
  lipTop.position.z = 0.045; lipTop.scale.set(1, 0.5, 0.6);
  jaw.add(lipTop);
  lipBottom = new THREE.Mesh(lipGeo, mat(LIP, 0.45));
  lipBottom.position.z = 0.045; lipBottom.rotation.z = Math.PI; lipBottom.scale.set(1, 0.62, 0.6);
  jaw.add(lipBottom);

  /* шея и пиджак */
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.5, 20), mat(SKIN));
  neck.position.y = -1.1;
  scene.add(neck);
  const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(BLAZER, 0.7));
  torso.position.y = -2.05; torso.scale.set(1.35, 1.15, 0.72);
  scene.add(torso);
  const collar = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(WHITE, 0.5));
  collar.position.y = -1.42; collar.scale.set(1.15, 0.5, 0.9);
  scene.add(collar);
}

/* уровень речи 0..1 → одна из 4 визем → плавное раскрытие */
function viseme(level) {
  if (level < 0.06) return 0;        // закрыт
  if (level < 0.22) return 0.35;     // полуоткрыт
  if (level < 0.5) return 0.75;      // открыт
  return 1;                          // «о» — округлённый
}

function animate(now) {
  if (!running || disposed) return;
  raf = requestAnimationFrame(animate);
  if (!t0) { t0 = now; fpsWindowStart = now; }
  const t = (now - t0) / 1000;
  const dt = Math.min(0.1, (now - (lastFrame || now)) / 1000);
  lastFrame = now;

  /* --- fps-бюджет --- */
  frames++;
  if (now - fpsWindowStart >= 1000) {
    fpsValue = frames * 1000 / (now - fpsWindowStart);
    frames = 0; fpsWindowStart = now;
    if (fpsValue < 30) {
      lowStrikes++;
      if (!degraded && lowStrikes >= 2) {
        degraded = true;
        renderer.setPixelRatio(1);          // понижаем качество
      } else if (degraded && lowStrikes >= 5) {
        if (onWeak) onWeak(fpsValue);        // устройству тяжело — выключаемся
        return;
      }
    } else if (lowStrikes) lowStrikes = 0;
  }

  /* --- липсинк: 4 визeмы + сглаживание --- */
  const level = getLevel ? Math.max(0, Math.min(1, getLevel())) : 0;
  targetViseme = viseme(level);
  mouthOpen += (targetViseme - mouthOpen) * Math.min(1, dt * 18);
  const isO = targetViseme === 1;
  mouthWide += ((isO ? 0.55 : 1) - mouthWide) * Math.min(1, dt * 10);

  mouthCavity.scale.y = 0.1 + mouthOpen * 0.85;
  mouthCavity.scale.x = mouthWide;
  lipTop.position.y = 0.01 + mouthOpen * 0.05;
  lipBottom.position.y = -0.01 - mouthOpen * 0.13;
  lipTop.scale.x = mouthWide; lipBottom.scale.x = mouthWide;
  jaw.position.y = -0.42 - mouthOpen * 0.05; jaw.position.z = 0.75;

  /* --- моргание раз в 3–6 с --- */
  if (!blinkNext) blinkNext = t + 1.2 + Math.random() * 3;
  if (t >= blinkNext && blinkPhase === 0) blinkPhase = 1;
  if (blinkPhase === 1) { blinkV += dt * 12; if (blinkV >= 1) { blinkV = 1; blinkPhase = 2; } }
  else if (blinkPhase === 2) { blinkV -= dt * 9; if (blinkV <= 0) { blinkV = 0; blinkPhase = 0; blinkNext = t + 3 + Math.random() * 3; } }
  const lidRot = -0.7 + blinkV * 1.9;
  lidL.rotation.x = lidRot; lidR.rotation.x = lidRot;

  /* --- позы: слушаю / думаю / говорю / покой --- */
  let ry = Math.sin(t * 0.55) * 0.07;              // лёгкое покачивание всегда
  let rx = Math.sin(t * 0.35) * 0.02;
  let rz = 0, px = 0, py = 0, brow = 0;
  if (state === 'listen') { rz = 0.1; brow = 0.02; }
  else if (state === 'think') { rz = -0.06; rx -= 0.07; px = -0.055; py = 0.05; brow = 0.035; }
  else if (state === 'speak') { rx += Math.sin(t * 5.2) * 0.018 * (0.4 + level); }
  headG.rotation.y += (ry - headG.rotation.y) * Math.min(1, dt * 4);
  headG.rotation.x += (rx - headG.rotation.x) * Math.min(1, dt * 4);
  headG.rotation.z += (rz - headG.rotation.z) * Math.min(1, dt * 3);
  irisL.position.x += (px - irisL.position.x) * Math.min(1, dt * 6);
  irisL.position.y += (py - irisL.position.y) * Math.min(1, dt * 6);
  irisR.position.x = irisL.position.x; irisR.position.y = irisL.position.y;
  browL.position.y = 0.32 + brow; browR.position.y = 0.32 + brow;

  renderer.render(scene, camera);
}

function onVisibility() {
  if (disposed) return;
  if (document.hidden) { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  else if (!running) { running = true; lastFrame = 0; raf = requestAnimationFrame(animate); }
}

export function init(opts) {
  container = opts.container;
  getLevel = opts.getLevel || null;
  onWeak = opts.onWeak || null;
  disposed = false;

  const size = Math.min(300, Math.max(200, container.clientWidth || 260));
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(size, size);
  renderer.domElement.style.width = size + 'px';
  renderer.domElement.style.height = size + 'px';
  container.appendChild(renderer.domElement);

  build();
  document.addEventListener('visibilitychange', onVisibility);
  running = true;
  raf = requestAnimationFrame(animate);
  return Promise.resolve(true);
}

export function setState(s) { state = s; }

export function dispose() {
  disposed = true; running = false;
  if (raf) cancelAnimationFrame(raf); raf = 0;
  document.removeEventListener('visibilitychange', onVisibility);
  if (renderer) {
    try {
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    } catch (e) {}
  }
  if (scene) {
    scene.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    });
  }
  renderer = null; scene = null; camera = null; t0 = 0;
}

export function stats() { return { fps: fpsValue, mouth: mouthOpen, viseme: targetViseme, degraded: degraded, running: running }; }
