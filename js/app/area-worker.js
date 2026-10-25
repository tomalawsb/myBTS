import { computeArea } from './area.js';
let ctl = null;
self.onmessage = async (ev) => {
  const { type, job, id } = ev.data;
  if (type === 'abort'){ ctl?.abort(); return; }
  ctl = new AbortController();
  try {
    const res = await computeArea(job, { signal: ctl.signal, progress: (p, text) => self.postMessage({ id, type: 'progress', p, text }) });
    self.postMessage({ id, type: 'done', res }, [res.field.buffer, res.mask.buffer]);
  } catch (e){ self.postMessage({ id, type: 'error', kind: e.kind || 'unknown', message: e.message }); }
};
