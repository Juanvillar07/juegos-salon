import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  FIELD,
  GOAL_PAUSE_MS,
  KEY,
  PENALTY,
  PLAYER,
  TICK_MS,
  constrainKeeper,
  createWorld,
  setupPenalty,
  type RoomSettings,
} from '@typeracer/shared/cancha-rapida';
import { Match, type MatchPlayer, type StepEvents } from '../../src/games/cancha-rapida/domain/Match.js';

const ONE_EACH: MatchPlayer[] = [
  { id: 'a', nickname: 'Ana', team: 'red' },
  { id: 'b', nickname: 'Beto', team: 'blue' },
];
const TWO_EACH: MatchPlayer[] = [
  { id: 'a', nickname: 'Ana', team: 'red' },
  { id: 'b', nickname: 'Beto', team: 'blue' },
  { id: 'c', nickname: 'Caro', team: 'red' },
  { id: 'd', nickname: 'Dani', team: 'blue' },
];

/** Un minuto de partido, sin límite de goles. */
function match(settings: Partial<RoomSettings>, players = ONE_EACH): Match {
  return new Match(players, { ...DEFAULT_SETTINGS, scoreLimit: 0, timeLimitMin: 1, ...settings }, 0);
}

function stepUntil(m: Match, done: (e: StepEvents) => boolean, max = 5000): StepEvents {
  for (let i = 0; i < max; i++) {
    const e = m.step();
    if (done(e)) return e;
  }
  throw new Error('no ocurrió');
}

const timeUp = (m: Match) => stepUntil(m, (e) => Boolean(e.stage || e.ended), 60 * 60 + 1);

/** Lanza el balón recto a la portería derecha, como si lo hubiera tocado `touch`. */
function shootRight(m: Match, touch: string): void {
  Object.assign(m.world.ball, { x: FIELD.halfWidth - 20, y: 0, vx: 4, vy: 0 });
  m.world.lastTouch = touch;
}

/**
 * Tira el penalti preparado, tras la pausa previa: recto al arco, con el arquero apartado junto
 * a un poste (gol) o en medio de la portería (lo para).
 */
function takePenalty(m: Match, scored: boolean): StepEvents {
  for (let i = 0; i < Math.round(1000 / TICK_MS); i++) m.step();
  const pen = m.penaltyState!;
  const keeper = m.world.players.find((p) => p.id === pen.keeperId)!;
  keeper.y = scored ? -(FIELD.goalHalfHeight + PENALTY.keeperSideMargin) : 0;
  Object.assign(m.world.ball, { vx: (pen.team === 'red' ? 1 : -1) * 6, vy: 0 });
  m.world.lastTouch = pen.shooterId;
  return stepUntil(m, (e) => Boolean(e.penalty));
}

/** Tras mostrar el resultado del penalti: el siguiente, o el final. */
const afterPenalty = (m: Match) => stepUntil(m, (e) => Boolean(e.penaltySetup || e.ended));

/** Una serie de penaltis (true = gol), alternando desde el local. */
function shootout(m: Match, results: boolean[]): void {
  for (const scored of results) {
    takePenalty(m, scored);
    afterPenalty(m);
  }
}

describe('desempate: gol de oro', () => {
  it('con empate al final sigue el partido, y el primer gol lo gana', () => {
    const m = match({ tiebreak: 'goldenGoal' });
    expect(timeUp(m)).toEqual({ stage: 'goldenGoal' });
    expect(m.stage).toBe('goldenGoal');
    // El tiempo ya no termina el partido.
    for (let i = 0; i < 600; i++) expect(m.step().ended).toBeUndefined();

    shootRight(m, 'a');
    stepUntil(m, (e) => Boolean(e.goal));
    stepUntil(m, (e) => Boolean(e.ended), Math.round(GOAL_PAUSE_MS / TICK_MS) + 1);
    expect(m.score).toEqual({ red: 1, blue: 0 });
  });

  it('sin empate al final, termina como siempre', () => {
    const m = match({ tiebreak: 'goldenGoal' });
    m.score.red = 1;
    expect(timeUp(m)).toEqual({ ended: true });
    expect(m.stage).toBe('regular');
  });

  it('con un solo equipo (práctica) no hay desempate', () => {
    const m = match({ tiebreak: 'penalties' }, [ONE_EACH[0]]);
    expect(timeUp(m)).toEqual({ ended: true });
  });

  it('con "empate", el partido termina igualado', () => {
    const m = match({ tiebreak: 'draw' });
    expect(timeUp(m)).toEqual({ ended: true });
  });
});

describe('desempate: penaltis', () => {
  it('prepara el primer penalti del local: solo el que tira y el arquero en la cancha', () => {
    const m = match({ tiebreak: 'penalties' });
    expect(timeUp(m)).toEqual({ stage: 'penalties', penaltySetup: true });
    expect(m.penaltyState).toEqual({ shots: { red: [], blue: [] }, team: 'red', shooterId: 'a', keeperId: 'b' });
    expect(m.world.ball).toMatchObject({ x: FIELD.halfWidth - PENALTY.spotDistance, y: 0 });
    expect(m.world.players.map((p) => p.id)).toEqual(['a', 'b']);
    expect(m.world.keeper).toEqual({ id: 'b', side: 'blue' });
    expect(m.playersOnPitch).toBe(2);
  });

  it('gol o parada, y luego tira el visitante en la otra portería', () => {
    const m = match({ tiebreak: 'penalties' });
    timeUp(m);
    expect(takePenalty(m, true).penalty).toEqual({ team: 'red', scored: true, shooterName: 'Ana' });
    expect(afterPenalty(m)).toEqual({ penaltySetup: true });
    expect(m.penaltyState).toMatchObject({ team: 'blue', shooterId: 'b', keeperId: 'a' });
    expect(m.world.ball.x).toBe(-(FIELD.halfWidth - PENALTY.spotDistance));
    expect(takePenalty(m, false).penalty).toEqual({ team: 'blue', scored: false, shooterName: 'Beto' });
    // El marcador del partido no cambia: la tanda va aparte.
    expect(m.score).toEqual({ red: 0, blue: 0 });
  });

  it('se decide antes de tiempo cuando el rival ya no puede alcanzar', () => {
    const m = match({ tiebreak: 'penalties' });
    timeUp(m);
    shootout(m, [true, false, true]);
    expect(m.ended).toBe(false);
    takePenalty(m, false);
    // 2–0 con un penalti por tirar del visitante: ya no le alcanza.
    expect(afterPenalty(m)).toEqual({ ended: true });
    expect(m.penaltyWinner).toBe('red');
    expect(m.penaltyState!.shots).toEqual({ red: [true, true], blue: [false, false] });
  });

  it('empatados tras las tres rondas, muerte súbita por parejas', () => {
    const m = match({ tiebreak: 'penalties' });
    timeUp(m);
    shootout(m, [true, true, true, true, true, true, false]);
    // Falló el local; el visitante aún tiene su penalti de esta ronda.
    expect(m.ended).toBe(false);
    takePenalty(m, true);
    expect(afterPenalty(m)).toEqual({ ended: true });
    expect(m.penaltyWinner).toBe('blue');
  });

  it('si no tira en 6 segundos, cuenta como fallado', () => {
    const m = match({ tiebreak: 'penalties' });
    timeUp(m);
    const ready = Math.round(1000 / TICK_MS);
    const { penalty } = stepUntil(m, (e) => Boolean(e.penalty));
    expect(penalty).toMatchObject({ team: 'red', scored: false });
    expect(m.tick).toBeGreaterThanOrEqual(60 * 60 + ready + Math.round(6000 / TICK_MS));
  });

  it('el que tira solo tiene un toque: después sus teclas no cuentan', () => {
    const m = match({ tiebreak: 'penalties' });
    timeUp(m);
    for (let i = 0; i < Math.round(1000 / TICK_MS); i++) m.step();
    m.world.ball.vx = 3;
    m.world.lastTouch = 'a';
    m.step();
    m.setKeys('a', KEY.right);
    expect(m.world.players.find((p) => p.id === 'a')!.keys).toBe(0);
  });

  it('el arquero no sale de su área', () => {
    const m = match({ tiebreak: 'penalties' });
    timeUp(m);
    m.setKeys('b', KEY.left | KEY.up);
    for (let i = 0; i < 240; i++) m.step();
    const keeper = m.world.players.find((p) => p.id === 'b')!;
    expect(keeper.x).toBeCloseTo(FIELD.halfWidth - PENALTY.keeperDepth);
    expect(keeper.y).toBeCloseTo(-(FIELD.goalHalfHeight + PENALTY.keeperSideMargin));
  });

  it('van rotando quién tira y quién ataja', () => {
    const m = match({ tiebreak: 'penalties' }, TWO_EACH);
    timeUp(m);
    const turns: [string | null, string | null][] = [];
    for (let i = 0; i < 4; i++) {
      const { shooterId, keeperId } = m.penaltyState!;
      turns.push([shooterId, keeperId]);
      takePenalty(m, true);
      afterPenalty(m);
    }
    expect(turns).toEqual([
      ['a', 'b'],
      ['b', 'a'],
      ['c', 'd'],
      ['d', 'c'],
    ]);
    // Los que esperan su turno siguen en el partido.
    expect(m.playersOnPitch).toBe(4);
  });

  it('si un equipo se queda sin nadie, la tanda termina sin ganador', () => {
    const m = match({ tiebreak: 'penalties' });
    timeUp(m);
    takePenalty(m, true);
    m.removePlayer('b');
    expect(afterPenalty(m)).toEqual({ ended: true });
    expect(m.penaltyWinner).toBeNull();
  });
});

describe('física del penalti', () => {
  it('coloca el balón en el punto, al que tira detrás y al arquero en la línea', () => {
    const world = createWorld([
      { id: 'a', team: 'red' },
      { id: 'b', team: 'blue' },
      { id: 'c', team: 'red' },
    ]);
    const [a, b] = world.players;
    setupPenalty(world, b, a, 'blue');
    const spot = -(FIELD.halfWidth - PENALTY.spotDistance);
    expect(world.ball).toEqual({ x: spot, y: 0, vx: 0, vy: 0 });
    expect(b).toMatchObject({ x: spot + 45, y: 0 });
    expect(a).toMatchObject({ x: -(FIELD.halfWidth - PLAYER.radius), y: 0 });
    expect(world.players).toEqual([b, a]);
    expect(world.keeper).toEqual({ id: 'a', side: 'red' });
    expect(world.kickoff).toBeNull();
  });

  it('el área del arquero: ni dentro de la red, ni lejos de la línea, ni lejos de los postes', () => {
    const p = { x: FIELD.halfWidth + 30, y: 0, vx: 2, vy: 0 };
    constrainKeeper(p, 'blue');
    expect(p).toMatchObject({ x: FIELD.halfWidth - PLAYER.radius, vx: 0 });

    const q = { x: 0, y: FIELD.halfHeight, vx: -2, vy: 3 };
    constrainKeeper(q, 'blue');
    expect(q).toMatchObject({ x: FIELD.halfWidth - PENALTY.keeperDepth, vx: 0 });
    expect(q).toMatchObject({ y: FIELD.goalHalfHeight + PENALTY.keeperSideMargin, vy: 0 });

    // El rojo defiende la izquierda.
    const r = { x: 0, y: 0, vx: 0, vy: 0 };
    constrainKeeper(r, 'red');
    expect(r.x).toBe(-(FIELD.halfWidth - PENALTY.keeperDepth));
  });
});
