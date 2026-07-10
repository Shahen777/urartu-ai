/* ============================================================
   vits-engine.mjs — нейросетевой русский TTS (Piper/VITS) в браузере.

   Адаптация @diffusionstudio/vits-web v1.0.3 (MIT © Diffusion Studio,
   https://github.com/diffusionstudio/vits-web) под правила этого сайта:
   - onnxruntime-web и piper_phonemize загружаются ЛОКАЛЬНО из vendor/
     (в оригинале — cdnjs и jsdelivr; CDN в рантайме запрещены);
   - голосовая модель качается с huggingface (rhasspy/piper-voices)
     ТОЛЬКО по явной кнопке и кешируется в CacheStorage — второй раз
     работает офлайн и мгновенно;
   - InferenceSession создаётся один раз и переиспользуется
     (в оригинале модель 60 МБ парсилась на каждую фразу);
   - wasm и espeak-данные фонемизатора префетчатся один раз в память.

   Работает и в module-worker, и в главном потоке (фолбэк).
   ============================================================ */
import { createPiperPhonemize } from './piper_phonemize.mjs';
import * as ort from '../ort/ort.wasm.bundle.min.mjs';

const HF_BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/main';
const PATH_MAP = {
  'ru_RU-irina-medium': 'ru/ru_RU/irina/medium/ru_RU-irina-medium.onnx',
  'ru_RU-dmitri-medium': 'ru/ru_RU/dmitri/medium/ru_RU-dmitri-medium.onnx',
  'ru_RU-ruslan-medium': 'ru/ru_RU/ruslan/medium/ru_RU-ruslan-medium.onnx',
  'ru_RU-denis-medium': 'ru/ru_RU/denis/medium/ru_RU-denis-medium.onnx',
  'en_US-hfc_female-medium': 'en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx'
};
const CACHE_NAME = 'vits-voice-v1';

const PIPER_WASM = new URL('./piper_phonemize.wasm', import.meta.url).href;
const PIPER_DATA = new URL('./piper_phonemize.data', import.meta.url).href;
const ORT_DIR = new URL('../ort/', import.meta.url).href;

let session = null;      // ort.InferenceSession — один на всё время жизни
let config = null;       // JSON-конфиг голоса (sample_rate, espeak voice…)
let wasmBin = null;      // ArrayBuffer piper_phonemize.wasm
let dataBuf = null;      // ArrayBuffer piper_phonemize.data (espeak-ng-data)
let loadedVoice = '';

/* ---- CacheStorage: отдаём из кеша, иначе качаем со стримом прогресса ---- */
async function cacheFetch(url, onProgress) {
  let cache = null;
  try { cache = await caches.open(CACHE_NAME); } catch (e) { /* file:// и пр. */ }
  if (cache) {
    const hit = await cache.match(url);
    if (hit) return await hit.blob();
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
  const total = +(res.headers.get('Content-Length') || 0);
  const reader = res.body ? res.body.getReader() : null;
  if (!reader) {
    const blob = await res.blob();
    if (cache) await cache.put(url, new Response(blob));
    return blob;
  }
  const parts = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    loaded += value.length;
    if (onProgress) onProgress({ url, loaded, total });
  }
  const blob = new Blob(parts);
  if (cache) { try { await cache.put(url, new Response(blob)); } catch (e) { /* квота */ } }
  return blob;
}

/* ---- модель уже в кеше? (без единого сетевого запроса) ---- */
export async function isCached(voiceId) {
  const p = PATH_MAP[voiceId];
  if (!p) return false;
  try {
    const cache = await caches.open(CACHE_NAME);
    const a = await cache.match(HF_BASE + '/' + p);
    const b = await cache.match(HF_BASE + '/' + p + '.json');
    return !!(a && b);
  } catch (e) { return false; }
}

export async function removeVoice(voiceId) {
  const p = PATH_MAP[voiceId];
  if (!p) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(HF_BASE + '/' + p);
    await cache.delete(HF_BASE + '/' + p + '.json');
  } catch (e) {}
}

/* ---- загрузка модели + прогрев: после resolve можно синтезировать ---- */
export async function ensure(voiceId, onProgress) {
  if (session && loadedVoice === voiceId) return;
  const p = PATH_MAP[voiceId];
  if (!p) throw new Error('Unknown voice: ' + voiceId);

  const jsonBlob = await cacheFetch(HF_BASE + '/' + p + '.json');
  config = JSON.parse(await jsonBlob.text());

  const onnxBlob = await cacheFetch(HF_BASE + '/' + p, onProgress);

  /* локальные бинарники фонемизатора — один раз в память */
  if (!wasmBin) wasmBin = await (await cacheFetch(PIPER_WASM)).arrayBuffer();
  if (!dataBuf) dataBuf = await (await cacheFetch(PIPER_DATA)).arrayBuffer();

  if (onProgress) onProgress({ url: p, loaded: onnxBlob.size, total: onnxBlob.size, phase: 'warm' });

  ort.env.wasm.wasmPaths = ORT_DIR;
  ort.env.wasm.numThreads = (typeof self !== 'undefined' && self.crossOriginIsolated)
    ? Math.min(4, (navigator.hardwareConcurrency || 1)) : 1;

  session = await ort.InferenceSession.create(await onnxBlob.arrayBuffer());
  loadedVoice = voiceId;
}

/* ---- текст → phoneme ids (espeak-ng внутри wasm) ---- */
function phonemize(text) {
  return new Promise((resolve, reject) => {
    const input = JSON.stringify([{ text: String(text).trim() }]);
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; reject(new Error('phonemize timeout')); }
    }, 20000);
    createPiperPhonemize({
      print: (line) => {
        if (settled) return;
        try {
          const ids = JSON.parse(line).phoneme_ids;
          settled = true; clearTimeout(timer); resolve(ids);
        } catch (e) { /* служебный вывод — пропускаем */ }
      },
      printErr: (line) => { console.warn('[piper]', line); },
      locateFile: (f) => f.endsWith('.wasm') ? PIPER_WASM : (f.endsWith('.data') ? PIPER_DATA : f),
      wasmBinary: wasmBin,
      getPreloadedPackage: () => dataBuf.slice(0)
    }).then((mod) => {
      mod.callMain(['-l', config.espeak.voice, '--input', input, '--espeak_data', '/espeak-ng-data']);
    }).catch((e) => {
      if (!settled) { settled = true; clearTimeout(timer); reject(e); }
    });
  });
}

/* ---- синтез: текст → Float32Array PCM + sampleRate ---- */
export async function synth(text) {
  if (!session || !config) throw new Error('Voice not loaded');
  const ids = await phonemize(text);
  const feeds = {
    input: new ort.Tensor('int64', ids, [1, ids.length]),
    input_lengths: new ort.Tensor('int64', [ids.length]),
    scales: new ort.Tensor('float32', [
      config.inference.noise_scale,
      config.inference.length_scale,
      config.inference.noise_w
    ])
  };
  if (config.speaker_id_map && Object.keys(config.speaker_id_map).length) {
    feeds.sid = new ort.Tensor('int64', [0]);
  }
  const out = await session.run(feeds);
  const pcm = out.output.data; // Float32Array
  return { pcm: Float32Array.from(pcm), sampleRate: config.audio.sample_rate };
}
