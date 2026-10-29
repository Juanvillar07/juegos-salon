import { KEY, type Disc, type World } from './physics.js';

/**
 * Instantánea compacta de la cancha (30 por segundo): enteros en arrays en lugar de objetos,
 * para que una sala llena gaste poco ancho de banda. Posiciones ×10 y velocidades ×100.
 */
export interface SnapshotPayload {
  /** Número de paso de la simulación. */
  k: number;
  /** Hora del servidor al enviarla, para interpolar. */
  t: number;
  /** Tiempo de juego transcurrido (ms), sin contar la cuenta atrás ni las pausas de gol. */
  c: number;
  /** Balón: [x, y, vx, vy]. */
  b: number[];
  /** Jugadores: [puesto, x, y, vx, vy, banderas]. */
  p: number[][];
}

const POS = 10;
const VEL = 100;
/** Bandera: mantiene pulsado patear (se dibuja un aro). */
const FLAG_KICKING = 1;

export interface PlayerFrame extends Disc {
  kicking: boolean;
}

export interface Frame {
  tick: number;
  serverTime: number;
  clockMs: number;
  ball: Disc;
  /** Por puesto (`PlayerInfo.slot`). */
  players: Map<number, PlayerFrame>;
}

export function encodeSnapshot(
  world: World,
  slots: Map<string, number>,
  tick: number,
  serverTime: number,
  clockMs: number,
): SnapshotPayload {
  const disc = (d: Disc) => [Math.round(d.x * POS), Math.round(d.y * POS), Math.round(d.vx * VEL), Math.round(d.vy * VEL)];
  return {
    k: tick,
    t: serverTime,
    c: Math.round(clockMs),
    b: disc(world.ball),
    p: world.players.map((p) => [slots.get(p.id) ?? -1, ...disc(p), p.keys & KEY.kick ? FLAG_KICKING : 0]),
  };
}

export function decodeSnapshot(s: SnapshotPayload): Frame {
  const disc = ([x, y, vx, vy]: number[]): Disc => ({ x: x / POS, y: y / POS, vx: vx / VEL, vy: vy / VEL });
  return {
    tick: s.k,
    serverTime: s.t,
    clockMs: s.c,
    ball: disc(s.b),
    players: new Map(s.p.map(([slot, ...rest]) => [slot, { ...disc(rest), kicking: (rest[4] & FLAG_KICKING) !== 0 }])),
  };
}
