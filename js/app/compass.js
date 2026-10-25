// Czujnik kierunku: jedno źródło kursu dla ekranu „Ustaw antenę”, róży kompasu i stożka na mapie.
// Źródła: (1) natywny kompas aplikacji Android (window.DVBTNative: rotation vector + deklinacja, ~20 Hz),
//         (2) w przeglądarce DeviceOrientation (absolutny / iOS webkitCompassHeading).
// Kurs GPS (kierunek ruchu) NIE jest używany jako orientacja telefonu.
import { headingFromEvent, processHeading, compassState } from '../core/compass-math.js';
export const nativeBridge = () => (typeof window !== 'undefined' && window.DVBTNative && typeof window.DVBTNative.startCompass === 'function') ? window.DVBTNative : null;
export function createCompass({ getCalib }){
  const nat = nativeBridge();
  let natOk = false; try { natOk = !!nat && nat.hasCompass(); } catch {}
  const st = { permission: 'off', lastTs: 0, raw: null, heading: null, accuracy: null, needsCalibration: false, declination: null, manual: false, manualHeading: 0, listening: false,
    source: natOk ? 'native' : 'browser', supported: natOk || (typeof window !== 'undefined' && ('DeviceOrientationEvent' in window)) };
  const subs = new Set();
  const screenAngle = () => (screen.orientation && Number.isFinite(screen.orientation.angle)) ? screen.orientation.angle : (Number(window.orientation) || 0);
  function onEvent(ev){
    const r = headingFromEvent(ev, screenAngle());
    if (!r) return;
    const c = getCalib();
    st.raw = r.heading; st.accuracy = r.accuracy; st.lastTs = performance.now();
    st.heading = processHeading(st.heading, r.heading, { invert: c.invert, offset: c.offset });
    emit();
  }
  // Wywoływane przez aplikację Android (evaluateJavascript). Kurs już geograficzny i wygładzony natywnie.
  function onNative(h, acc, needCal, src, decl){
    if (!Number.isFinite(h) || st.permission !== 'granted') return;
    const c = getCalib();
    st.raw = h; st.accuracy = Number.isFinite(acc) ? acc : null; st.needsCalibration = !!needCal; st.declination = Number.isFinite(decl) ? decl : null; st.lastTs = performance.now();
    st.heading = processHeading(st.heading, h, { invert: c.invert, offset: c.offset, alpha: 0.5 });
    emit();
  }
  if (natOk) window.__nativeCompass = onNative;
  function emit(){ const s = api.snapshot(); for (const f of subs) f(s); }
  let tick = null;
  const api = {
    get source(){ return st.source; },
    subscribe(fn){ subs.add(fn); fn(api.snapshot()); return () => subs.delete(fn); },
    setLocation(lat, lon, altM = 0){ if (natOk) try { nat.setLocation(lat, lon, altM); } catch {} },
    isRunning(){ return st.permission === 'granted'; },
    async start(){
      st.manual = false;
      if (!st.supported){ emit(); return 'unsupported'; }
      if (natOk){
        if (st.permission !== 'granted'){ st.permission = 'granted'; st.lastTs = 0; st.heading = null; try { nat.startCompass(); } catch { st.permission = 'denied'; } }
      } else {
        try {
          if (typeof DeviceOrientationEvent.requestPermission === 'function'){
            st.permission = 'prompt'; emit();
            const p = await DeviceOrientationEvent.requestPermission();
            if (p !== 'granted'){ st.permission = 'denied'; emit(); return 'denied'; }
          }
        } catch { st.permission = 'denied'; emit(); return 'denied'; }
        if (st.permission !== 'granted'){ st.permission = 'granted'; st.lastTs = 0; st.heading = null; }
        if (!st.listening){
          window.addEventListener('deviceorientationabsolute', onEvent, true);
          window.addEventListener('deviceorientation', onEvent, true);
          st.listening = true;
        }
      }
      clearInterval(tick); tick = setInterval(emit, 1000);
      emit(); return 'waiting';
    },
    /** Czy start wymaga gestu użytkownika (iOS) — wtedy nie uruchamiamy automatycznie. */
    needsGesture(){ return !natOk && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function'; },
    stop(){
      if (natOk) try { nat.stopCompass(); } catch {}
      window.removeEventListener('deviceorientationabsolute', onEvent, true);
      window.removeEventListener('deviceorientation', onEvent, true);
      st.listening = false; st.permission = 'off'; st.heading = null; clearInterval(tick); emit();
    },
    setManual(on, heading){ st.manual = !!on; if (heading != null) st.manualHeading = heading; emit(); },
    snapshot(){
      const state = compassState({ supported: st.supported, permission: st.permission, lastTs: st.lastTs, now: performance.now(), manual: st.manual });
      const heading = state === 'manual' ? st.manualHeading : (state === 'ok' ? st.heading : null);
      const accuracy = state === 'ok' ? st.accuracy : null;
      return { state, heading, raw: st.raw, accuracy, lastTs: st.lastTs, source: st.source, declination: st.declination,
        needsCalibration: state === 'ok' && (st.needsCalibration || (st.source === 'native' && (accuracy == null || accuracy > 20))) };
    }
  };
  return api;
}
