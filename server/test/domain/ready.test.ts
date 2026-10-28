import { describe, expect, it } from 'vitest';
import { RoomManager } from '../../src/games/rally-de-letras/domain/RoomManager.js';
import type { Room } from '../../src/games/rally-de-letras/domain/types.js';

const AUTO_MS = 15_000;
const T0 = 1_000_000;

/** Sala con Ana (host) y los jugadores indicados. */
function setup(...others: string[]) {
  let clock = T0;
  const manager = new RoomManager({
    now: () => clock,
    pickText: () => ({ id: 0, text: 'hola mundo' }),
    generateCode: () => 'ROOM1',
    autoStartMs: AUTO_MS,
  });
  const created = manager.createRoom('a', 'Ana');
  if (!created.ok) throw new Error(created.error);
  for (const id of others) manager.joinRoom('ROOM1', id, id.toUpperCase());
  const room: Room = created.room;
  return {
    manager,
    room,
    ready: (id: string, value = true) => {
      manager.setReady(id, value);
      return manager.refreshAutoStart(room);
    },
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe('RoomManager: listos y salida automática', () => {
  it('nadie empieza listo y el estado lo muestra', () => {
    const { manager, room } = setup('b');
    expect(manager.toState(room).players.every((p) => p.ready === false)).toBe(true);
    expect(manager.toState(room).autoStartAt).toBeNull();
  });

  it('un jugador solo que se marca listo arranca de inmediato (práctica)', () => {
    const { ready } = setup();
    expect(ready('a')).toBe('start');
  });

  it('con todos listos la decisión es arrancar', () => {
    const { ready } = setup('b', 'c');
    expect(ready('a')).toBe('unchanged');
    expect(ready('b')).toBe('scheduled');
    expect(ready('c')).toBe('start');
  });

  it('con más de la mitad lista se programa la salida automática', () => {
    const { ready, room, manager } = setup('b', 'c');
    expect(ready('a')).toBe('unchanged'); // 1 de 3: no es mayoría
    expect(ready('b')).toBe('scheduled'); // 2 de 3
    expect(room.autoStartAt).toBe(T0 + AUTO_MS);
    expect(manager.toState(room).autoStartAt).toBe(T0 + AUTO_MS);
  });

  it('la salida programada no se reinicia si se suma otro listo sin completar', () => {
    const { ready, room, advance } = setup('b', 'c', 'd', 'e');
    ready('a');
    ready('b');
    expect(ready('c')).toBe('scheduled'); // 3 de 5
    advance(5000);
    expect(ready('d')).toBe('unchanged'); // 4 de 5: se mantiene la hora original
    expect(room.autoStartAt).toBe(T0 + AUTO_MS);
  });

  it('se cancela si deja de haber mayoría', () => {
    const { ready, room } = setup('b', 'c');
    ready('a');
    ready('b');
    expect(ready('b', false)).toBe('cancelled');
    expect(room.autoStartAt).toBeNull();
  });

  it('se cancela si entra alguien y la mayoría se pierde', () => {
    const { ready, room, manager } = setup('b', 'c');
    ready('a');
    ready('b'); // 2 de 3
    manager.joinRoom('ROOM1', 'd', 'D');
    expect(manager.refreshAutoStart(room)).toBe('cancelled'); // 2 de 4: empate, no mayoría
  });

  it('si se va el único que faltaba, todos los que quedan están listos', () => {
    const { ready, room, manager } = setup('b');
    ready('a');
    manager.leaveRoom('b');
    expect(manager.refreshAutoStart(room)).toBe('start');
  });

  it('la salida automática no requiere host y limpia la programación', () => {
    const { ready, room, manager } = setup('b', 'c');
    ready('b');
    ready('c');
    const res = manager.startRaceAuto('ROOM1');
    expect(res.ok).toBe(true);
    expect(room.phase).toBe('racing');
    expect(room.autoStartAt).toBeNull();
  });

  it('el host puede empezar aunque nadie esté listo', () => {
    const { manager } = setup('b');
    expect(manager.startRace('a').ok).toBe(true);
  });

  it('los listos se reinician al empezar y al volver al lobby', () => {
    const { ready, room, manager, advance } = setup('b');
    ready('a');
    ready('b');
    manager.startRaceAuto('ROOM1');
    expect([...room.players.values()].every((p) => !p.ready)).toBe(true);
    advance(60_000);
    manager.endRace('ROOM1');
    manager.resetToLobby('a');
    expect([...room.players.values()].every((p) => !p.ready)).toBe(true);
  });

  it('solo se puede marcar listo en el lobby', () => {
    const { manager } = setup('b');
    manager.startRace('a');
    expect(manager.setReady('b', true)).toEqual({
      ok: false,
      error: 'Solo puedes marcarte listo en la sala de espera',
    });
  });
});
