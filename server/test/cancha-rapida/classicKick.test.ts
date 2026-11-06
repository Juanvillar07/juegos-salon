import { describe, expect, it } from 'vitest';
import {
  BALL,
  FIELD,
  KEY,
  KICK,
  PLAYER,
  createWorld,
  detectGoal,
  setKeys,
  stepWorld,
  type World,
} from '@typeracer/shared/cancha-rapida';
import { RoomManager } from '../../src/games/cancha-rapida/domain/RoomManager.js';

const REACH = PLAYER.radius + BALL.radius + KICK.reach;

/** Un jugador rojo en -300 y el balón donde se diga, con la patada clásica (sin carga). */
function classicWorld(ballX: number, playerVx = 0): World {
  const w = createWorld([{ id: 'a', team: 'red' }], { chargedShot: false });
  Object.assign(w.ball, { x: ballX, y: 0, vx: 0, vy: 0 });
  Object.assign(w.players[0], { x: -300, y: 0, vx: playerVx, vy: 0 });
  w.kickoff = null;
  return w;
}

describe('patada clásica (sin potencia)', () => {
  it('sale al pulsar con el balón al alcance, con la fuerza fija y sin carga', () => {
    const w = classicWorld(-300 + REACH - 1);
    setKeys(w.players[0], KEY.kick, w.chargedShot);
    stepWorld(w);
    expect(w.ball.vx).toBeCloseTo(KICK.classicPower * BALL.damping, 2);
    expect(w.players[0].charge).toBe(0);
  });

  it('mantener patear la deja lista hasta tocar el balón, aunque tarde', () => {
    // Corre hacia el balón con patear pulsado: patea al llegar, sin soltar.
    const w = classicWorld(-300 + REACH + 40, 2);
    setKeys(w.players[0], KEY.kick | KEY.right, w.chargedShot);
    for (let i = 0; i < 60 && w.ball.vx === 0; i++) stepWorld(w);
    expect(w.ball.vx).toBeGreaterThan(KICK.classicPower * 0.9);
  });

  it('una patada por pulsación, y soltar antes de tocar el balón la descarta', () => {
    const w = classicWorld(-300 + REACH - 1);
    setKeys(w.players[0], KEY.kick, w.chargedShot);
    stepWorld(w);
    // Sigue pulsado: aunque vuelva a tener el balón al lado, no patea otra vez.
    Object.assign(w.ball, { x: -300 + REACH - 1, vx: 0, vy: 0 });
    Object.assign(w.players[0], { x: -300, vx: 0 });
    stepWorld(w);
    expect(w.ball.vx).toBe(0);

    const released = classicWorld(-300 + REACH + 40, 2);
    setKeys(released.players[0], KEY.kick, released.chargedShot);
    setKeys(released.players[0], 0, released.chargedShot);
    for (let i = 0; i < 40; i++) stepWorld(released);
    expect(released.ball.vx).toBeLessThan(KICK.classicPower * 0.6);
  });
});

describe('balones lentos en la portería', () => {
  it('un balón que entra despacio cruza la línea y es gol (la red no lo frena antes)', () => {
    const w = classicWorld(FIELD.halfWidth - 20);
    w.ball.vx = 0.6;
    let goal = null;
    for (let i = 0; i < 200 && !goal; i++) {
      stepWorld(w);
      goal = detectGoal(w);
    }
    expect(goal).toBe('red');
  });

  it('una patada clásica desde el centro llega a la portería', () => {
    const w = classicWorld(0);
    Object.assign(w.players[0], { x: -REACH + 1 });
    setKeys(w.players[0], KEY.kick, w.chargedShot);
    let goal = null;
    for (let i = 0; i < 400 && !goal; i++) {
      stepWorld(w);
      goal = detectGoal(w);
    }
    expect(goal).toBe('red');
  });
});

describe('ajuste de la patada en la sala', () => {
  function setup() {
    const manager = new RoomManager({ generateCode: () => 'ROOM0', countdownMs: 0 });
    const created = manager.createRoom('a', 'Ana');
    if (!created.ok) throw new Error(created.error);
    manager.joinRoom('ROOM0', 'b', 'Beto');
    return { manager, room: created.room };
  }

  it('por defecto con potencia; el host la cambia y el partido la usa', () => {
    const { manager, room } = setup();
    expect(room.settings.chargedShot).toBe(true);
    expect(manager.updateSettings('b', { chargedShot: false })).toMatchObject({ ok: false });
    expect(manager.updateSettings('a', { chargedShot: 'no' as unknown as boolean })).toMatchObject({ ok: false });
    expect(manager.updateSettings('a', { chargedShot: false })).toMatchObject({ ok: true });
    manager.startMatch('a');
    expect(room.match!.world.chargedShot).toBe(false);
  });
});
