import { TICK_MS, type Disc, type Frame, type PlayerFrame, type Side } from '@typeracer/shared/cancha-rapida';

/**
 * Interpolación de instantáneas: la cancha se dibuja un poco en el pasado, entre las dos
 * instantáneas que rodean ese instante, para que el movimiento se vea suave aunque lleguen
 * 30 por segundo y con algo de irregularidad. Pura, para poder probarla.
 */

/** Si faltan instantáneas (corte de red), se extrapola como mucho este tiempo con la última velocidad. */
const MAX_EXTRAPOLATE_MS = 100;
/** Instantáneas que se guardan hacia atrás. */
const KEEP_MS = 1000;

export interface View {
  ball: Disc;
  players: Map<number, PlayerFrame>;
  clockMs: number;
  /** Equipo que saca (de la instantánea más reciente de las dos). */
  kickoff: Side | null;
}

export class FrameBuffer {
  private frames: Frame[] = [];

  push(frame: Frame): void {
    const last = this.frames.at(-1);
    // Las instantáneas volátiles pueden perderse, pero no llegar desordenadas; por si acaso.
    if (last && frame.tick <= last.tick) return;
    this.frames.push(frame);
    const oldest = frame.serverTime - KEEP_MS;
    while (this.frames.length > 2 && this.frames[0].serverTime < oldest) this.frames.shift();
  }

  clear(): void {
    this.frames = [];
  }

  get latest(): Frame | undefined {
    return this.frames.at(-1);
  }

  viewAt(time: number): View | null {
    return viewAt(this.frames, time);
  }
}

export function viewAt(frames: Frame[], time: number): View | null {
  if (frames.length === 0) return null;
  const next = frames.findIndex((f) => f.serverTime > time);
  if (next === 0) return frameView(frames[0], 0);
  if (next === -1) {
    const last = frames[frames.length - 1];
    return frameView(last, Math.min(time - last.serverTime, MAX_EXTRAPOLATE_MS));
  }
  const a = frames[next - 1];
  const b = frames[next];
  const f = (time - a.serverTime) / (b.serverTime - a.serverTime);
  const players = new Map<number, PlayerFrame>();
  for (const [slot, pb] of b.players) {
    const pa = a.players.get(slot);
    players.set(slot, pa ? { ...mix(pa, pb, f), kicking: pb.kicking } : pb);
  }
  return {
    ball: mix(a.ball, b.ball, f),
    players,
    clockMs: a.clockMs + (b.clockMs - a.clockMs) * f,
    kickoff: b.kickoff,
  };
}

function frameView(frame: Frame, extrapolateMs: number): View {
  const players = new Map<number, PlayerFrame>();
  for (const [slot, p] of frame.players) players.set(slot, { ...project(p, extrapolateMs), kicking: p.kicking });
  return { ball: project(frame.ball, extrapolateMs), players, clockMs: frame.clockMs, kickoff: frame.kickoff };
}

function mix(a: Disc, b: Disc, f: number): Disc {
  return {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    vx: a.vx + (b.vx - a.vx) * f,
    vy: a.vy + (b.vy - a.vy) * f,
  };
}

/** Posición `ms` más adelante con la velocidad actual. */
export function project(d: Disc, ms: number): Disc {
  if (ms <= 0) return { x: d.x, y: d.y, vx: d.vx, vy: d.vy };
  const ticks = ms / TICK_MS;
  return { x: d.x + d.vx * ticks, y: d.y + d.vy * ticks, vx: d.vx, vy: d.vy };
}
