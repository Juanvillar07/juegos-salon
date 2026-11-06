import { describe, expect, it } from 'vitest';
import {
  BALL,
  FIELD,
  KEY,
  KICK,
  PLAYER,
  createWorld,
  decodeSnapshot,
  detectGoal,
  encodeSnapshot,
  kickPower,
  resetKickoff,
  setKeys,
  stepWorld,
  type World,
} from '@typeracer/shared/cancha-rapida';

/** Mundo con un jugador rojo y el balón donde se diga. */
function world(ball: Partial<World['ball']> = {}, player: Partial<World['players'][number]> = {}): World {
  const w = createWorld([{ id: 'a', team: 'red' }]);
  Object.assign(w.ball, { x: 0, y: 0, vx: 0, vy: 0 }, ball);
  Object.assign(w.players[0], { x: -300, y: 0 }, player);
  return w;
}

function steps(w: World, n: number): void {
  for (let i = 0; i < n; i++) stepWorld(w);
}

describe('física de la cancha', () => {
  it('el jugador acelera hacia donde pulsa hasta una velocidad máxima, y frena al soltar', () => {
    // El balón, lejos del camino.
    const w = world({ x: 300, y: -180 }, { x: -440 });
    setKeys(w.players[0], KEY.right);
    steps(w, 150);
    const max = (PLAYER.accel * PLAYER.damping) / (1 - PLAYER.damping);
    expect(w.players[0].vx).toBeCloseTo(max, 1);
    expect(w.players[0].vy).toBe(0);
    setKeys(w.players[0], 0);
    steps(w, 200);
    expect(Math.abs(w.players[0].vx)).toBeLessThan(0.01);
  });

  it('en diagonal no va más rápido que en línea recta', () => {
    const w = world({ x: 300, y: -180 }, { x: -440, y: -200 });
    setKeys(w.players[0], KEY.right | KEY.down);
    steps(w, 150);
    const max = (PLAYER.accel * PLAYER.damping) / (1 - PLAYER.damping);
    expect(Math.hypot(w.players[0].vx, w.players[0].vy)).toBeCloseTo(max, 1);
  });

  it('el balón rebota en las bandas', () => {
    const w = world({ x: 0, y: -FIELD.halfHeight + BALL.radius + 1, vy: -3 });
    steps(w, 2);
    expect(w.ball.vy).toBeGreaterThan(0);
    expect(w.ball.y).toBeGreaterThanOrEqual(-FIELD.halfHeight + BALL.radius);
  });

  it('fuera de la boca de la portería el fondo es una pared: rebota y no hay gol', () => {
    const w = world({ x: FIELD.halfWidth - 30, y: 120, vx: 4 });
    for (let i = 0; i < 40; i++) {
      stepWorld(w);
      expect(detectGoal(w)).toBeNull();
    }
    expect(w.ball.vx).toBeLessThan(0);
  });

  it('el balón que entra por la boca de la portería es gol para el equipo que ataca ese lado', () => {
    const right = world({ x: FIELD.halfWidth - 30, y: 0, vx: 4 });
    let goal = null;
    for (let i = 0; i < 40 && !goal; i++) {
      stepWorld(right);
      goal = detectGoal(right);
    }
    expect(goal).toBe('red');

    const left = world({ x: -FIELD.halfWidth + 30, y: 10, vx: -4 }, { x: 300 });
    goal = null;
    for (let i = 0; i < 40 && !goal; i++) {
      stepWorld(left);
      goal = detectGoal(left);
    }
    expect(goal).toBe('blue');
  });

  it('la red retiene el balón dentro de la portería', () => {
    const w = world({ x: FIELD.halfWidth + 5, y: 0, vx: 6 });
    steps(w, 30);
    expect(w.ball.x).toBeLessThanOrEqual(FIELD.halfWidth + FIELD.goalDepth - BALL.radius);
  });

  describe('tiro cargado', () => {
    const REACH = PLAYER.radius + BALL.radius + KICK.reach;

    /** Mantiene patear `ticks` pasos y suelta (sin moverse). */
    function hold(w: World, ticks: number): void {
      setKeys(w.players[0], KEY.kick);
      steps(w, ticks);
      setKeys(w.players[0], 0);
    }

    it('un toque es un pase suave; mantener carga un tiro más fuerte, hasta el máximo', () => {
      for (const ticks of [1, 20, 100]) {
        const w = world({ x: -300 + REACH - 1 });
        hold(w, ticks);
        stepWorld(w);
        expect(w.ball.vx).toBeCloseTo(kickPower(ticks) * BALL.damping, 2);
        expect(w.lastTouch).toBe('a');
      }
      expect(kickPower(1)).toBeLessThan(4);
      expect(kickPower(100)).toBe(KICK.maxPower);
    });

    it('mientras se mantiene, no patea: el tiro sale al soltar', () => {
      const w = world({ x: -300 + REACH - 1 });
      setKeys(w.players[0], KEY.kick);
      steps(w, 30);
      expect(w.ball.vx).toBe(0);
      setKeys(w.players[0], 0);
      stepWorld(w);
      expect(w.ball.vx).toBeGreaterThan(KICK.minPower);
    });

    it('si se suelta un poco antes de llegar al balón, la patada lo espera; si tarda mucho, se pierde', () => {
      const soon = world({ x: -300 + REACH + 6 }, { vx: 2 });
      hold(soon, 1);
      steps(soon, KICK.graceTicks);
      expect(soon.ball.vx).toBeGreaterThan(KICK.minPower * 0.9);

      const late = world({ x: -300 + REACH + 40 }, { vx: 2 });
      hold(late, 1);
      steps(late, 40);
      // Solo lo empujó al llegar (conducción), sin patada.
      expect(late.ball.vx).toBeLessThan(KICK.minPower * 0.6);
    });

    it('con efecto el tiro curva hacia el lado al que se movía el jugador, sin cambiar su rapidez', () => {
      const straight = world({ x: -300 + REACH - 1 });
      const curved = world({ x: -300 + REACH - 1 });
      for (const w of [straight, curved]) hold(w, KICK.chargeTicks);
      // El de la curva se movía hacia abajo justo al patear.
      curved.players[0].vy = 1.5;
      stepWorld(straight);
      stepWorld(curved);
      expect(curved.ballSpin).toBeGreaterThan(0);
      steps(straight, 40);
      steps(curved, 40);
      expect(curved.ball.y - straight.ball.y).toBeGreaterThan(20);
      expect(Math.hypot(curved.ball.vx, curved.ball.vy)).toBeCloseTo(Math.hypot(straight.ball.vx, straight.ball.vy), 2);
    });

    it('la carga viaja en las instantáneas', () => {
      const w = world();
      w.players[0].charge = KICK.chargeTicks / 2;
      const frame = decodeSnapshot(encodeSnapshot(w, new Map([['a', 0]]), 1, 0, 0));
      expect(frame.players.get(0)!.charge).toBeCloseTo(0.5, 1);
    });
  });

  describe('control y rebotes', () => {
    it('al llevar el balón no sale despedido: se queda cerca del jugador', () => {
      const w = world({ x: -300 + PLAYER.radius + BALL.radius + 2, y: 0 });
      setKeys(w.players[0], KEY.right);
      steps(w, 60);
      const gap = w.ball.x - w.players[0].x - PLAYER.radius - BALL.radius;
      expect(gap).toBeLessThan(20);
      expect(w.ball.x).toBeGreaterThan(-250);
    });

    it('en la red el balón muere: frena y casi no rebota', () => {
      const w = world({ x: FIELD.halfWidth + 5, y: 0, vx: 6 });
      steps(w, 25);
      expect(Math.hypot(w.ball.vx, w.ball.vy)).toBeLessThan(0.5);
      expect(w.ball.x).toBeGreaterThan(FIELD.halfWidth);
    });

    it('en las esquinas redondeadas el balón rebota sin atascarse', () => {
      const { halfWidth: W, halfHeight: H, cornerRadius: C } = FIELD;
      const w = world({ x: W - 40, y: H - 40, vx: 3, vy: 3 });
      steps(w, 30);
      const fromCorner = Math.hypot(w.ball.x - (W - C), w.ball.y - (H - C));
      expect(fromCorner).toBeLessThanOrEqual(C - BALL.radius + 0.01);
      expect(w.ball.vx + w.ball.vy).toBeLessThan(0);
    });
  });

  it('en un choque entre jugadores se conserva la cantidad de movimiento', () => {
    const w = createWorld([
      { id: 'a', team: 'red' },
      { id: 'b', team: 'blue' },
    ]);
    Object.assign(w.ball, { x: 300, y: 150 });
    w.kickoff = null;
    // Separados 2 px más que la suma de radios: en este paso se acercan 3 y chocan.
    Object.assign(w.players[0], { x: -PLAYER.radius - 3, y: 0, vx: 2, vy: 0 });
    Object.assign(w.players[1], { x: PLAYER.radius - 1, y: 0, vx: -1, vy: 0 });
    const before = w.players[0].vx + w.players[1].vx;
    w.players.forEach((p) => {
      p.vx /= PLAYER.damping;
    });
    stepWorld(w);
    const after = w.players[0].vx + w.players[1].vx;
    expect(after).toBeCloseTo(before, 6);
    expect(w.players[0].vx).toBeLessThan(w.players[1].vx);
  });

  it('el saque pone a cada equipo en su mitad y el balón en el centro', () => {
    const w = createWorld([
      { id: 'a', team: 'red' },
      { id: 'b', team: 'blue' },
      { id: 'c', team: 'red' },
    ]);
    Object.assign(w.ball, { x: 100, vx: 3 });
    resetKickoff(w, 'blue');
    expect(w.ball).toEqual({ x: 0, y: 0, vx: 0, vy: 0 });
    expect(w.kickoff).toBe('blue');
    expect(w.players.filter((p) => p.team === 'red').every((p) => p.x < 0)).toBe(true);
    expect(w.players.find((p) => p.team === 'blue')!.x).toBeGreaterThan(0);
  });

  describe('saque', () => {
    function kickoffWorld() {
      const w = createWorld([
        { id: 'r', team: 'red' },
        { id: 'b', team: 'blue' },
      ]);
      expect(w.kickoff).toBe('red');
      return w;
    }

    it('el rival no cruza la línea de medio campo ni entra en el círculo central', () => {
      const w = kickoffWorld();
      const blue = w.players.find((p) => p.id === 'b')!;
      setKeys(blue, KEY.left);
      steps(w, 200);
      expect(Math.hypot(blue.x, blue.y)).toBeGreaterThanOrEqual(FIELD.centerRadius + PLAYER.radius - 0.001);
      expect(blue.x).toBeGreaterThanOrEqual(PLAYER.radius - 0.001);
      expect(w.kickoff).toBe('red');
    });

    it('el que saca puede entrar en el círculo y tocar el balón, y entonces el juego queda libre', () => {
      const w = kickoffWorld();
      const red = w.players.find((p) => p.id === 'r')!;
      setKeys(red, KEY.right);
      let n = 0;
      while (w.kickoff && n++ < 300) stepWorld(w);
      expect(w.kickoff).toBeNull();
      expect(w.lastTouch).toBe('r');
      // Ya en juego libre, el rival puede cruzar la línea.
      const blue = w.players.find((p) => p.id === 'b')!;
      setKeys(red, 0);
      setKeys(blue, KEY.left);
      Object.assign(blue, { y: -200 });
      steps(w, 300);
      expect(blue.x).toBeLessThan(0);
    });

    it('el que saca no pasa la línea fuera del círculo', () => {
      const w = kickoffWorld();
      const red = w.players.find((p) => p.id === 'r')!;
      Object.assign(red, { x: -200, y: 160 });
      setKeys(red, KEY.right);
      steps(w, 200);
      expect(red.x).toBeLessThanOrEqual(-PLAYER.radius + 0.001);
      expect(w.kickoff).toBe('red');
    });

    it('si el equipo que saca no tiene jugadores, se juega libre', () => {
      const w = createWorld([{ id: 'r', team: 'red' }]);
      resetKickoff(w, 'blue');
      expect(w.kickoff).toBeNull();
    });
  });
});
