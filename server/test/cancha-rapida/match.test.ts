import { describe, expect, it } from 'vitest';
import { FIELD, GOAL_PAUSE_MS, KEY, TICK_MS, type RoomSettings } from '@typeracer/shared/cancha-rapida';
import { Match, type StepEvents } from '../../src/games/cancha-rapida/domain/Match.js';

const PLAYERS = [
  { id: 'a', nickname: 'Ana', team: 'red' as const },
  { id: 'b', nickname: 'Beto', team: 'blue' as const },
];

function match(settings: Partial<RoomSettings> = {}, countdownMs = 0): Match {
  return new Match(PLAYERS, { scoreLimit: 3, timeLimitMin: 3, ...settings }, countdownMs);
}

/** Lanza el balón hacia la portería derecha desde cerca, como si lo hubiera tocado `touch`. */
function shootRight(m: Match, touch: string): void {
  Object.assign(m.world.ball, { x: FIELD.halfWidth - 20, y: 0, vx: 4, vy: 0 });
  m.world.lastTouch = touch;
}

function stepUntil(m: Match, done: (e: StepEvents) => boolean, max = 500): StepEvents {
  for (let i = 0; i < max; i++) {
    const e = m.step();
    if (done(e)) return e;
  }
  throw new Error('no ocurrió');
}

describe('partido', () => {
  it('durante la cuenta atrás la cancha está quieta', () => {
    const m = match({}, 1000);
    m.setKeys('a', KEY.right);
    const x = m.world.players[0].x;
    for (let i = 0; i < Math.round(1000 / TICK_MS); i++) m.step();
    expect(m.world.players[0].x).toBe(x);
    expect(m.clockMs).toBe(0);
    m.step();
    expect(m.world.players[0].x).toBeGreaterThan(x);
  });

  it('un gol suma al equipo que ataca esa portería, con su autor, y tras la pausa vuelve el saque', () => {
    const m = match();
    shootRight(m, 'a');
    const { goal } = stepUntil(m, (e) => Boolean(e.goal));
    expect(goal).toMatchObject({ team: 'red', scorerId: 'a', scorerName: 'Ana', ownGoal: false });
    expect(m.score).toEqual({ red: 1, blue: 0 });

    const clock = m.clockMs;
    for (let i = 0; i < Math.round(GOAL_PAUSE_MS / TICK_MS); i++) m.step();
    // La pausa no cuenta en el reloj, y al terminar todos vuelven a su puesto.
    expect(m.clockMs).toBe(clock);
    expect(m.world.ball).toMatchObject({ x: 0, y: 0 });
    expect(m.world.players.find((p) => p.id === 'a')!.x).toBeLessThan(0);
  });

  it('en propia puerta cuenta como autogol', () => {
    const m = match();
    shootRight(m, 'b');
    const { goal } = stepUntil(m, (e) => Boolean(e.goal));
    expect(goal).toMatchObject({ team: 'red', scorerId: 'b', ownGoal: true });
  });

  it('termina al llegar al límite de goles, tras la celebración', () => {
    const m = match({ scoreLimit: 1 });
    shootRight(m, 'a');
    stepUntil(m, (e) => Boolean(e.goal));
    expect(m.ended).toBe(false);
    stepUntil(m, (e) => Boolean(e.ended), Math.round(GOAL_PAUSE_MS / TICK_MS) + 1);
    expect(m.ended).toBe(true);
  });

  it('termina al acabarse el tiempo, aunque sea empate', () => {
    const m = match({ scoreLimit: 0, timeLimitMin: 3 });
    stepUntil(m, (e) => Boolean(e.ended), 3 * 60 * 60 + 1);
    expect(m.clockMs).toBeCloseTo(3 * 60_000, -1);
    expect(m.score).toEqual({ red: 0, blue: 0 });
  });

  it('quien se va sale de la cancha y su puesto no se reutiliza', () => {
    const m = match();
    m.removePlayer('a');
    expect(m.playersOnPitch).toBe(1);
    expect(m.slots.get('b')).toBe(1);
  });
});
