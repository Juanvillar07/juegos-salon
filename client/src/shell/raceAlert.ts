// Aviso de salida para quien espera la carrera en otra pestaña: el título parpadea y suena un pitido.

const ALERT_TITLE = '¡Arranca!';
/** Los navegadores frenan los temporizadores de las pestañas ocultas a uno por segundo. */
const FLASH_MS = 1000;

let stopFlash: (() => void) | null = null;

/** Se llama al empezar la cuenta atrás. Con la pestaña a la vista no hace nada: ya se ve el semáforo. */
export function alertRaceStart(): void {
  if (!document.hidden || stopFlash) return;
  beep();

  const original = document.title;
  document.title = ALERT_TITLE;
  const timer = window.setInterval(() => {
    document.title = document.title === ALERT_TITLE ? original : ALERT_TITLE;
  }, FLASH_MS);
  const onVisible = () => {
    if (!document.hidden) stopFlash?.();
  };
  document.addEventListener('visibilitychange', onVisible);
  stopFlash = () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    document.title = original;
    stopFlash = null;
  };
}

/** Dos pitidos cortos (como un semáforo de salida). Si el navegador no deja sonar, se ignora. */
function beep(): void {
  try {
    const ctx = new AudioContext();
    void ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    [
      { at: 0, freq: 660 },
      { at: 0.3, freq: 880 },
    ].forEach(({ at, freq }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + at);
      gain.gain.exponentialRampToValueAtTime(0.2, t + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + at);
      osc.stop(t + at + 0.25);
    });
    window.setTimeout(() => void ctx.close().catch(() => {}), 1500);
  } catch {
    // sin audio: queda el título parpadeando
  }
}
