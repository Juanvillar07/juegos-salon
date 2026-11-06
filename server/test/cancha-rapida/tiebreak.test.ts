import { describe, expect, it } from 'vitest';
import {
  BALL,
  DEFAULT_SETTINGS,
  FIELD,
  GOAL_PAUSE_MS,
  KEEPER_LINE_MAX_Y,
  KEY,
  PENALTY,
  PENALTY_MAX_ROUNDS,
  PLAYER,
  TICK_MS,
  constrainKeeper,
  createWorld,
  setKeys,
  setupPenalty,
  stepLonePlayer,
  stepWorld,
  type RoomSettings,
} from '@typeracer/shared/cancha-rapida';
import {
  Match,
  PENALTY_READY_TICKS,
  PENALTY_RESOLVE_TICKS,
  PENALTY_SHOT_TICKS,
  type MatchPlayer,
  type StepEvents,
} from '../../src/games/cancha-rapida/domain/Match.js';

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
/** El arquero en la línea, junto a un poste: el tiro recto entra. */
const KEEPER_ASIDE = -KEEPER_LINE_MAX_Y;
const SPOT = FIELD.halfWidth - PENALTY.spotDistance;

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
const body = (m: Match, id: string) => m.world.players.find((p) => p.id === id)!;
const pen = (m: Match) => m.penaltyState(0)!;

/** Espera la pausa previa del penalti (con la cancha quieta). */
function waitReady(m: Match): void {
  for (let i = 0; i < PENALTY_READY_TICKS; i++) m.step();
}

/** Lanza el balón recto a la portería derecha, como si lo hubiera tocado `touch`. */
function shootRight(m: Match, touch: string): void {
  Object.assign(m.world.ball, { x: FIELD.halfWidth - 20, y: 0, vx: 4, vy: 0 });
  m.world.lastTouch = touch;
}

/** El que tira, pegado detrás del balón, carga la patada unos pasos y la suelta: tiro recto. */
function kickPenalty(m: Match): void {
  const { shooterId, team } = pen(m);
  const shooter = body(m, shooterId!);
  const dir = team === 'red' ? 1 : -1;
  Object.assign(shooter, { x: m.world.ball.x - dir * (PLAYER.radius + BALL.radius + 1), y: 0, vx: 0, vy: 0 });
  m.setKeys(shooter.id, KEY.kick);
  for (let i = 0; i < 20; i++) m.step();
  m.setKeys(shooter.id, 0);
  stepUntil(m, (e) => Boolean(e.penaltyShot), 15);
}

/** Tira el penalti preparado: con el arquero junto a un poste (gol) o en medio de la portería (lo para). */
function takePenalty(m: Match, scored: boolean): StepEvents {
  waitReady(m);
  body(m, pen(m).keeperId!).y = scored ? KEEPER_ASIDE : 0;
  kickPenalty(m);
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
  it('prepara el primer penalti del local: solo el que tira y el arquero, con plazo para tirar', () => {
    const m = match({ tiebreak: 'penalties' });
    expect(timeUp(m)).toEqual({ stage: 'penalties', penaltySetup: true });
    expect(m.penaltyState(1000)).toEqual({
      shots: { red: [], blue: [] },
      team: 'red',
      shooterId: 'a',
      keeperId: 'b',
      shotTaken: false,
      // La pausa previa más los 6 s para tirar.
      deadline: 1000 + (PENALTY_READY_TICKS + PENALTY_SHOT_TICKS) * TICK_MS,
    });
    expect(m.world.ball).toMatchObject({ x: SPOT, y: 0 });
    expect(m.world.players.map((p) => p.id)).toEqual(['a', 'b']);
    expect(m.world.keeper).toEqual({ id: 'b', side: 'blue' });
    expect(m.world.penaltyShooter).toBe('a');
    expect(m.playersOnPitch).toBe(2);
  });

  it('acercarse al balón no lo mueve ni cuenta como tiro: solo la patada lo lanza', () => {
    const m = match({ tiebreak: 'penalties' });
    timeUp(m);
    waitReady(m);
    m.setKeys('a', KEY.right);
    for (let i = 0; i < 90; i++) expect(m.step()).toEqual({});
    // Chocó con el balón (rebota en él) y el balón sigue quieto en el punto.
    expect(m.world.ball).toEqual({ x: SPOT, y: 0, vx: 0, vy: 0 });
    expect(body(m, 'a').x).toBeCloseTo(SPOT - PLAYER.radius - BALL.radius, 0);
    expect(m.world.lastTouch).toBeNull();
    expect(pen(m).shotTaken).toBe(false);

    m.setKeys('a', KEY.right | KEY.kick);
    for (let i = 0; i < 10; i++) m.step();
    m.setKeys('a', KEY.right);
    stepUntil(m, (e) => Boolean(e.penaltyShot), 15);
    expect(m.world.ball.vx).toBeGreaterThan(3);
    expect(m.world.penaltyShooter).toBeNull();
    expect(m.penaltyState(5000)).toMatchObject({ shotTaken: true, deadline: null });
  });

  it('el arquero no sale de la línea hasta la patada; después puede adelantarse', () => {
    const m = match({ tiebreak: 'penalties' });
    timeUp(m);
    waitReady(m);
    m.setKeys('b', KEY.left | KEY.up);
    for (let i = 0; i < 90; i++) m.step();
    const keeper = body(m, 'b');
    expect(keeper.x).toBe(FIELD.halfWidth - PLAYER.radius);
    expect(keeper.y).toBeCloseTo(KEEPER_ASIDE);

    kickPenalty(m);
    for (let i = 0; i < 60; i++) m.step();
    expect(keeper.x).toBeCloseTo(FIELD.halfWidth - PENALTY.keeperDepth);
  });

  it('gol o parada, y luego tira el visitante en la otra portería', () => {
    const m = match({ tiebreak: 'penalties' });
    timeUp(m);
    expect(takePenalty(m, true).penalty).toEqual({ team: 'red', scored: true, shooterName: 'Ana' });
    expect(afterPenalty(m)).toEqual({ penaltySetup: true });
    expect(pen(m)).toMatchObject({ team: 'blue', shooterId: 'b', keeperId: 'a', shotTaken: false });
    expect(m.world.ball.x).toBe(-SPOT);
    expect(takePenalty(m, false).penalty).toEqual({ team: 'blue', scored: false, shooterName: 'Beto' });
    // El marcador del partido no cambia: la tanda va aparte.
    expect(m.score).toEqual({ red: 0, blue: 0 });
  });

  it('un balón que el arquero toca pero entra despacio cuenta como gol', () => {
    const m = match({ tiebreak: 'penalties' });
    timeUp(m);
    waitReady(m);
    body(m, 'b').y = KEEPER_ASIDE;
    kickPenalty(m);
    // Como si el arquero lo hubiera rozado: sigue hacia la portería, despacio (tarda más de 1 s).
    Object.assign(m.world.ball, { x: FIELD.halfWidth - 30, y: 0, vx: 0.8, vy: 0 });
    m.world.lastTouch = 'b';
    m.world.ballSpin = 0;
    const start = m.tick;
    expect(stepUntil(m, (e) => Boolean(e.penalty)).penalty).toMatchObject({ team: 'red', scored: true });
    expect(m.tick - start).toBeGreaterThan(60);
  });

  it('si 3 s después de la patada no entró, es fallo', () => {
    const m = match({ tiebreak: 'penalties' });
    timeUp(m);
    waitReady(m);
    body(m, 'b').y = KEEPER_ASIDE;
    kickPenalty(m);
    // El balón da vueltas lejos de la portería (como si el arquero lo controlara).
    let result: StepEvents = {};
    let ticks = 0;
    while (!result.penalty && ticks < PENALTY_RESOLVE_TICKS + 10) {
      Object.assign(m.world.ball, { x: 300, y: 0, vx: 0.5, vy: 0 });
      result = m.step();
      ticks++;
    }
    expect(result.penalty).toMatchObject({ team: 'red', scored: false });
    expect(ticks).toBeGreaterThanOrEqual(PENALTY_RESOLVE_TICKS - 2);
  });

  it('el que tira se queda quieto tras patear y sus teclas ya no cuentan', () => {
    const m = match({ tiebreak: 'penalties' });
    timeUp(m);
    waitReady(m);
    const shooter = body(m, 'a');
    Object.assign(shooter, { x: SPOT - PLAYER.radius - BALL.radius - 1, y: 0 });
    m.setKeys('a', KEY.kick);
    for (let i = 0; i < 10; i++) m.step();
    // Suelta patear yendo hacia el balón: sin parar, seguiría de largo contra él.
    m.setKeys('a', KEY.right);
    shooter.vx = 2;
    stepUntil(m, (e) => Boolean(e.penaltyShot), 15);
    expect(shooter).toMatchObject({ vx: 0, vy: 0, keys: 0 });
    const x = shooter.x;
    m.setKeys('a', KEY.right);
    for (let i = 0; i < 10; i++) m.step();
    expect(shooter.x).toBe(x);
  });

  it('las teclas que ya se mantienen se aplican al preparar el penalti', () => {
    const m = match({ tiebreak: 'penalties' }, TWO_EACH);
    // Beto mantiene arriba desde antes del final; Caro, que espera su turno, mantiene abajo.
    m.setKeys('b', KEY.up);
    timeUp(m);
    expect(body(m, 'b').keys).toBe(KEY.up);
    m.setKeys('c', KEY.down);
    waitReady(m);
    for (let i = 0; i < 30; i++) m.step();
    expect(body(m, 'b').y).toBeLessThan(0);

    takePenalty(m, true);
    afterPenalty(m);
    takePenalty(m, true);
    afterPenalty(m);
    expect(pen(m).shooterId).toBe('c');
    expect(body(m, 'c').keys).toBe(KEY.down);
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
    expect(m.penaltyShots).toEqual({ red: [true, true], blue: [false, false] });
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

  it(`si siguen igualados tras ${PENALTY_MAX_ROUNDS} rondas, empate`, () => {
    const m = match({ tiebreak: 'penalties' });
    timeUp(m);
    // Nadie tira: todos fallan por tiempo.
    let last: StepEvents = {};
    for (let i = 0; i < PENALTY_MAX_ROUNDS * 2; i++) {
      stepUntil(m, (e) => Boolean(e.penalty));
      last = afterPenalty(m);
    }
    expect(last).toEqual({ ended: true, penaltyDraw: true });
    expect(m.penaltyWinner).toBeNull();
    expect(m.penaltyShots!.red).toHaveLength(PENALTY_MAX_ROUNDS);
  });

  it('si no patea en 6 segundos, cuenta como fallado', () => {
    const m = match({ tiebreak: 'penalties' });
    timeUp(m);
    const start = m.tick;
    const { penalty } = stepUntil(m, (e) => Boolean(e.penalty));
    expect(penalty).toMatchObject({ team: 'red', scored: false });
    expect(m.tick - start).toBe(PENALTY_READY_TICKS + PENALTY_SHOT_TICKS);
  });

  it('van rotando quién tira y quién ataja', () => {
    const m = match({ tiebreak: 'penalties' }, TWO_EACH);
    timeUp(m);
    const turns: [string | null, string | null][] = [];
    for (let i = 0; i < 4; i++) {
      const { shooterId, keeperId } = pen(m);
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

  it('si se va el que tira, se repite el intento con otro de su equipo (no cuenta)', () => {
    const m = match({ tiebreak: 'penalties' }, TWO_EACH);
    timeUp(m);
    m.removePlayer('a');
    expect(m.step()).toEqual({ penaltySetup: true });
    expect(pen(m)).toMatchObject({ team: 'red', shooterId: 'c', shots: { red: [], blue: [] } });
  });

  it('si se va el arquero, se repite el intento con otro arquero', () => {
    const m = match({ tiebreak: 'penalties' }, TWO_EACH);
    timeUp(m);
    waitReady(m);
    m.removePlayer('b');
    expect(m.step()).toEqual({ penaltySetup: true });
    expect(pen(m)).toMatchObject({ team: 'red', keeperId: 'd', shots: { red: [], blue: [] } });
  });

  it('si un equipo se queda sin nadie, gana el otro (aunque fuera perdiendo)', () => {
    const m = match({ tiebreak: 'penalties' });
    timeUp(m);
    takePenalty(m, false);
    afterPenalty(m);
    takePenalty(m, true);
    // 0–1 para el visitante, y el visitante se va.
    m.removePlayer('b');
    expect(m.step()).toEqual({ ended: true, forfeit: 'red' });
    expect(m.penaltyWinner).toBe('red');
  });
});

describe('física del penalti', () => {
  function penaltyWorld() {
    const world = createWorld([
      { id: 'a', team: 'red' },
      { id: 'b', team: 'blue' },
    ]);
    const [a, b] = world.players;
    setupPenalty(world, a, b, 'red');
    return { world, shooter: a, keeper: b };
  }

  it('coloca el balón en el punto, al que tira detrás y al arquero en la línea', () => {
    const world = createWorld([
      { id: 'a', team: 'red' },
      { id: 'b', team: 'blue' },
      { id: 'c', team: 'red' },
    ]);
    const [a, b] = world.players;
    setupPenalty(world, b, a, 'blue');
    expect(world.ball).toEqual({ x: -SPOT, y: 0, vx: 0, vy: 0 });
    expect(b).toMatchObject({ x: -SPOT + 45, y: 0 });
    expect(a).toMatchObject({ x: -(FIELD.halfWidth - PLAYER.radius), y: 0 });
    expect(world.players).toEqual([b, a]);
    expect(world.keeper).toEqual({ id: 'a', side: 'red' });
    expect(world.penaltyShooter).toBe('b');
    expect(world.kickoff).toBeNull();
  });

  it('el balón sin patear es como un poste: quien lo choca rebota; la patada lo suelta', () => {
    const { world, shooter } = penaltyWorld();
    setKeys(shooter, KEY.right);
    for (let i = 0; i < 90; i++) stepWorld(world);
    expect(world.ball).toEqual({ x: SPOT, y: 0, vx: 0, vy: 0 });
    expect(world.lastTouch).toBeNull();

    setKeys(shooter, KEY.right | KEY.kick);
    for (let i = 0; i < 5; i++) stepWorld(world);
    setKeys(shooter, KEY.right);
    stepWorld(world);
    expect(world.penaltyShooter).toBeNull();
    expect(world.lastTouch).toBe('a');
    expect(world.ball.vx).toBeGreaterThan(0);
  });

  it('antes de la patada, solo puede patear el que tira', () => {
    const { world, keeper } = penaltyWorld();
    // Aunque el arquero tuviera el balón al alcance, su patada no cuenta.
    Object.assign(world.ball, { x: keeper.x - PLAYER.radius - BALL.radius - 1 });
    setKeys(keeper, KEY.kick);
    stepWorld(world);
    setKeys(keeper, 0);
    stepWorld(world);
    expect(world.ball.vx).toBe(0);
    expect(world.penaltyShooter).toBe('a');
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

  it('antes de la patada el arquero solo se mueve sobre la línea (también en la predicción)', () => {
    const p = { x: FIELD.halfWidth - 40, y: 10, vx: -1, vy: 1 };
    constrainKeeper(p, 'blue', true);
    expect(p).toMatchObject({ x: FIELD.halfWidth - PLAYER.radius, vx: 0, y: 10, vy: 1 });
    // De lado, hasta tocar el poste (no hasta el margen de fuera de los postes).
    const q = { x: FIELD.halfWidth - PLAYER.radius, y: -90, vx: 0, vy: -2 };
    constrainKeeper(q, 'blue', true);
    expect(q).toMatchObject({ y: -KEEPER_LINE_MAX_Y, vy: 0 });

    const { keeper } = penaltyWorld();
    setKeys(keeper, KEY.left | KEY.down);
    for (let i = 0; i < 30; i++) stepLonePlayer(keeper, null, 'blue', true);
    expect(keeper.x).toBe(FIELD.halfWidth - PLAYER.radius);
    expect(keeper.y).toBeGreaterThan(0);
  });
});
