import { describe, expect, it } from 'vitest';
import {
  BALL,
  FIELD,
  KEY,
  KICK,
  PLAYER,
  createWorld,
  detectGoal,
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

  it('solo se patea con el balón al alcance, y una vez por pulsación', () => {
    const reach = PLAYER.radius + BALL.radius + KICK.reach;
    const far = world({ x: -300 + reach + 10 });
    setKeys(far.players[0], KEY.kick);
    stepWorld(far);
    expect(far.ball.vx).toBe(0);

    const near = world({ x: -300 + reach - 1 });
    setKeys(near.players[0], KEY.kick);
    stepWorld(near);
    expect(near.ball.vx).toBeGreaterThan(KICK.strength * 0.9);
    expect(near.lastTouch).toBe('a');

    // Mantener patear no vuelve a patear: hay que soltar y pulsar otra vez.
    Object.assign(near.ball, { x: -300 + reach - 1, vx: 0, vy: 0 });
    Object.assign(near.players[0], { x: -300, vx: 0 });
    setKeys(near.players[0], KEY.kick);
    stepWorld(near);
    expect(near.ball.vx).toBeLessThan(1);
    setKeys(near.players[0], 0);
    Object.assign(near.ball, { x: -300 + reach - 1, vx: 0, vy: 0 });
    Object.assign(near.players[0], { x: -300, vx: 0 });
    setKeys(near.players[0], KEY.kick);
    stepWorld(near);
    expect(near.ball.vx).toBeGreaterThan(KICK.strength * 0.9);
  });

  it('en un choque entre jugadores se conserva la cantidad de movimiento', () => {
    const w = createWorld([
      { id: 'a', team: 'red' },
      { id: 'b', team: 'blue' },
    ]);
    Object.assign(w.ball, { x: 300, y: 150 });
    w.kickoff = null;
    Object.assign(w.players[0], { x: -20, y: 0, vx: 2, vy: 0 });
    Object.assign(w.players[1], { x: 12, y: 0, vx: -1, vy: 0 });
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
