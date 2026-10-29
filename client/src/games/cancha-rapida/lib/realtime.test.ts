import { describe, expect, it } from 'vitest';
import { KEY, PLAYER, TICK_MS, type Frame } from '@typeracer/shared/cancha-rapida';
import { ClockSync } from './clock';
import { FrameBuffer, viewAt } from './interpolation';
import { Predictor } from './prediction';

function frame(tick: number, serverTime: number, x: number): Frame {
  const disc = { x, y: 0, vx: 1, vy: 0 };
  return { tick, serverTime, clockMs: tick * TICK_MS, ball: disc, players: new Map([[0, { ...disc, kicking: false }]]) };
}

describe('interpolación', () => {
  it('entre dos instantáneas, mezcla según el instante pedido', () => {
    const frames = [frame(2, 1000, 0), frame(4, 1033, 10)];
    const view = viewAt(frames, 1016.5)!;
    expect(view.ball.x).toBeCloseTo(5, 5);
    expect(view.players.get(0)!.x).toBeCloseTo(5, 5);
  });

  it('antes de la primera usa la primera; después de la última extrapola un poco y se detiene', () => {
    const frames = [frame(2, 1000, 0), frame(4, 1033, 10)];
    expect(viewAt(frames, 900)!.ball.x).toBe(0);
    // Velocidad 1 px por paso: 50 ms después son 3 pasos.
    expect(viewAt(frames, 1033 + 50)!.ball.x).toBeCloseTo(10 + 50 / TICK_MS, 5);
    // Como mucho 100 ms de extrapolación, aunque falten instantáneas más tiempo.
    expect(viewAt(frames, 1033 + 1000)!.ball.x).toBeCloseTo(10 + 100 / TICK_MS, 5);
  });

  it('el búfer descarta instantáneas viejas o repetidas', () => {
    const buffer = new FrameBuffer();
    buffer.push(frame(2, 1000, 0));
    buffer.push(frame(2, 1000, 99));
    buffer.push(frame(4, 1033, 10));
    expect(buffer.latest!.ball.x).toBe(10);
    for (let i = 3; i < 80; i++) buffer.push(frame(i * 2, 1000 + i * 33, i));
    expect(buffer.viewAt(0)!.ball.x).toBeGreaterThan(40);
  });
});

describe('predicción del jugador propio', () => {
  it('responde a las teclas al instante, con la física del servidor', () => {
    const p = new Predictor('a', 'red', { x: 0, y: 0, vx: 0, vy: 0 });
    p.advance(TICK_MS * 3, KEY.right);
    expect(p.body.x).toBeGreaterThan(0);
    expect(p.body.vx).toBeCloseTo(PLAYER.accel * (PLAYER.damping + PLAYER.damping ** 2 + PLAYER.damping ** 3), 5);
  });

  it('se corrige poco a poco hacia el servidor, y salta si el error es grande', () => {
    const p = new Predictor('a', 'red', { x: 0, y: 0, vx: 0, vy: 0 });
    p.correct({ x: 10, y: 0, vx: 0, vy: 0 });
    expect(p.body.x).toBeGreaterThan(0);
    expect(p.body.x).toBeLessThan(10);
    p.correct({ x: 300, y: 0, vx: 0, vy: 0 });
    expect(p.body.x).toBe(300);
  });

  it('la corrección no depende de los cuadros por segundo', () => {
    const at60 = new Predictor('a', 'red', { x: 0, y: 0, vx: 0, vy: 0 });
    const at120 = new Predictor('a', 'red', { x: 0, y: 0, vx: 0, vy: 0 });
    at60.correct({ x: 20, y: 0, vx: 0, vy: 0 }, TICK_MS);
    at120.correct({ x: 20, y: 0, vx: 0, vy: 0 }, TICK_MS / 2);
    at120.correct({ x: 20, y: 0, vx: 0, vy: 0 }, TICK_MS / 2);
    expect(at120.body.x).toBeCloseTo(at60.body.x, 5);
  });
});

describe('reloj del servidor', () => {
  it('suma la mitad del viaje a la hora del servidor', () => {
    const clock = new ClockSync();
    clock.sample(1000, 1100, 5050);
    expect(clock.roundTrip).toBe(100);
    expect(clock.offset).toBe(5050 + 50 - 1100);
    // La estimación gruesa no pisa una medida real.
    clock.rough(9999, 1200);
    expect(clock.offset).toBe(4000);
  });
});
