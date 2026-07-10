/* ============================================================
   vits-worker.mjs — синтез речи в отдельном потоке, чтобы
   инференс 60-МБ модели не подвешивал интерфейс.
   Протокол: {type, id, ...} → {type, id, ...}. MIT.
   ============================================================ */
import * as engine from './vits-engine.mjs';

self.onmessage = async (e) => {
  const m = e.data || {};
  try {
    if (m.type === 'ping') {
      self.postMessage({ type: 'pong', id: m.id });
    } else if (m.type === 'cached') {
      self.postMessage({ type: 'cached', id: m.id, value: await engine.isCached(m.voice) });
    } else if (m.type === 'ensure') {
      await engine.ensure(m.voice, (p) => {
        self.postMessage({ type: 'progress', id: m.id, loaded: p.loaded, total: p.total, phase: p.phase || 'model' });
      });
      self.postMessage({ type: 'ready', id: m.id });
    } else if (m.type === 'synth') {
      const r = await engine.synth(m.text);
      self.postMessage({ type: 'audio', id: m.id, pcm: r.pcm, sampleRate: r.sampleRate }, [r.pcm.buffer]);
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: m.id, message: String((err && err.message) || err) });
  }
};
