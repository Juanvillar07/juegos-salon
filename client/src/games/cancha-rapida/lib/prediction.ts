import { TICK_MS, stepLonePlayer, type Disc, type PlayerBody, type Side } from '@typeracer/shared/cancha-rapida';

/** Con un error mayor (un saque, un choque fuerte) se salta a la posición del servidor. */
const SNAP_DISTANCE = 60;
/** Fracción del error que se corrige en cada cuadro: suave, para que no se note el tirón. */
const CORRECTION = 0.12;
/** Tras un corte largo no se simulan más de estos pasos de golpe. */
const MAX_PENDING_MS = TICK_MS * 6;

/**
 * Predicción del jugador propio: sus teclas se aplican al instante con la misma física que usa
 * el servidor (sin choques), y la posición se va corrigiendo hacia la del servidor. Así se
 * mueve sin esperar la ida y vuelta, y los choques o el saque lo recolocan.
 */
export class Predictor {
  readonly body: PlayerBody;
  private pending = 0;

  constructor(id: string, team: Side, start: Disc) {
    this.body = { id, team, ...start, keys: 0, kickArmed: false };
  }

  /** Avanza el tiempo transcurrido en pasos fijos, como el servidor. */
  advance(elapsedMs: number, keys: number): void {
    this.pending = Math.min(this.pending + elapsedMs, MAX_PENDING_MS);
    this.body.keys = keys;
    // Con margen: sumar duraciones de paso en coma flotante puede quedarse una milésima corto.
    while (this.pending >= TICK_MS - 1e-6) {
      this.pending -= TICK_MS;
      stepLonePlayer(this.body);
    }
  }

  /**
   * Acerca la predicción a donde el servidor dice que está (ya proyectado al presente). La
   * fracción se ajusta al tiempo del cuadro, así corrige igual a 60 que a 144 cuadros por segundo.
   */
  correct(target: Disc, elapsedMs: number = TICK_MS): void {
    const b = this.body;
    if (Math.hypot(target.x - b.x, target.y - b.y) > SNAP_DISTANCE) {
      Object.assign(b, { x: target.x, y: target.y, vx: target.vx, vy: target.vy });
      return;
    }
    const f = 1 - (1 - CORRECTION) ** (elapsedMs / TICK_MS);
    b.x += (target.x - b.x) * f;
    b.y += (target.y - b.y) * f;
    b.vx += (target.vx - b.vx) * f;
    b.vy += (target.vy - b.vy) * f;
  }
}
