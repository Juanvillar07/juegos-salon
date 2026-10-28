import { describe, expect, it } from 'vitest';
import { CAR_COLORS, COUNTDOWN_MS, DEFAULT_CAR, MAX_PLAYERS } from '@typeracer/shared';
import { RoomManager } from '../../src/games/rally-de-letras/domain/RoomManager.js';
import type { RaceText, Room } from '../../src/games/rally-de-letras/domain/types.js';

const TEXT: RaceText = { id: 0, text: 'hola mundo' }; // 10 caracteres
const LEN = TEXT.text.length;
const T0 = 1_000_000;

function setup() {
  let clock = T0;
  let codeSeq = 0;
  const manager = new RoomManager({
    now: () => clock,
    pickText: () => TEXT,
    generateCode: () => `ROOM${codeSeq++}`,
  });
  return {
    manager,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

/** Crea una sala con el host 'a' y los jugadores indicados. */
function roomWith(manager: RoomManager, ...others: string[]): Room {
  const created = manager.createRoom('a', 'Ana');
  if (!created.ok) throw new Error(created.error);
  for (const id of others) {
    const joined = manager.joinRoom(created.room.code, id, id.toUpperCase());
    if (!joined.ok) throw new Error(joined.error);
  }
  return created.room;
}

/** Sala en carrera, ya pasada la cuenta regresiva. */
function racing(...others: string[]) {
  const ctx = setup();
  const room = roomWith(ctx.manager, ...others);
  ctx.manager.startRace('a');
  ctx.advance(COUNTDOWN_MS + 10_000);
  return { ...ctx, room };
}

describe('RoomManager: crear y unirse', () => {
  it('crea una sala con el creador como host', () => {
    const { manager } = setup();
    const res = manager.createRoom('a', '  Ana  ');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.room.hostId).toBe('a');
    expect(res.room.phase).toBe('lobby');
    expect(res.room.players.get('a')).toMatchObject({ nickname: 'Ana', status: 'connected' });
  });

  it('rechaza nickname vacío', () => {
    expect(setup().manager.createRoom('a', '   ').ok).toBe(false);
  });

  it('une jugadores a una sala existente sin importar mayúsculas', () => {
    const { manager } = setup();
    const room = roomWith(manager);
    expect(manager.joinRoom(room.code.toLowerCase(), 'b', 'Beto').ok).toBe(true);
    expect(room.players.size).toBe(2);
  });

  it('unirse otra vez a la misma sala es idempotente', () => {
    const { manager } = setup();
    const room = roomWith(manager, 'b');
    expect(manager.joinRoom(room.code, 'b', 'Beto').ok).toBe(true);
    expect(room.players.size).toBe(2);
  });

  it('rechaza códigos inexistentes', () => {
    expect(setup().manager.joinRoom('XXXXX', 'b', 'Beto')).toEqual({ ok: false, error: 'La sala no existe' });
  });

  it(`limita la sala a ${MAX_PLAYERS} jugadores`, () => {
    const { manager } = setup();
    const others = Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => `p${i}`);
    const room = roomWith(manager, ...others);
    expect(manager.joinRoom(room.code, 'extra', 'Extra').ok).toBe(false);
    expect(room.players.size).toBe(MAX_PLAYERS);
  });

  it('asigna un color distinto a cada jugador', () => {
    const { manager } = setup();
    const room = roomWith(manager, ...Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => `p${i}`));
    expect(new Set([...room.players.values()].map((p) => p.color)).size).toBe(MAX_PLAYERS);
  });

  it('durante una carrera se entra como espectador', () => {
    const { manager } = setup();
    const room = roomWith(manager);
    manager.startRace('a');
    expect(manager.joinRoom(room.code, 'b', 'Beto').ok).toBe(true);
    expect(room.players.get('b')).toMatchObject({ spectator: true, retired: true });
  });
});

describe('RoomManager: auto y color', () => {
  it('usa el auto y el color pedidos al crear y al unirse', () => {
    const { manager } = setup();
    const created = manager.createRoom('a', 'Ana', { car: 'f1', color: '#6a5d7b' });
    if (!created.ok) throw new Error();
    manager.joinRoom(created.room.code, 'b', 'Beto', { car: 'atelier', color: '#c99a3d' });
    expect(created.room.players.get('a')).toMatchObject({ car: 'f1', color: '#6a5d7b' });
    expect(created.room.players.get('b')).toMatchObject({ car: 'atelier', color: '#c99a3d' });
  });

  it('si el color pedido está ocupado o no existe, asigna otro libre; el auto por defecto es el deportivo', () => {
    const { manager } = setup();
    const created = manager.createRoom('a', 'Ana', { color: CAR_COLORS[0] });
    if (!created.ok) throw new Error();
    manager.joinRoom(created.room.code, 'b', 'Beto', { color: CAR_COLORS[0] });
    manager.joinRoom(created.room.code, 'c', 'Caro', { color: '#123456', car: 'cohete' as never });
    const [a, b, c] = [...created.room.players.values()];
    expect(new Set([a.color, b.color, c.color]).size).toBe(3);
    expect(CAR_COLORS).toContain(c.color);
    expect(c.car).toBe(DEFAULT_CAR);
  });

  it('permite cambiar de auto y de color en el lobby', () => {
    const { manager } = setup();
    const room = roomWith(manager);
    expect(manager.customize('a', { car: 'lmp', color: '#56707a' }).ok).toBe(true);
    expect(room.players.get('a')).toMatchObject({ car: 'lmp', color: '#56707a' });
  });

  it('no permite tomar el color de otro jugador', () => {
    const { manager } = setup();
    const room = roomWith(manager, 'b');
    const colorB = room.players.get('b')!.color;
    expect(manager.customize('a', { color: colorB })).toEqual({ ok: false, error: 'Otro jugador ya tiene ese color' });
  });

  it('rechaza autos o colores inválidos y cambios durante la carrera', () => {
    const { manager } = setup();
    roomWith(manager);
    expect(manager.customize('a', { car: 'cohete' as never }).ok).toBe(false);
    expect(manager.customize('a', { color: 'red' }).ok).toBe(false);
    manager.startRace('a');
    expect(manager.customize('a', { car: 'hyper' }).ok).toBe(false);
  });

  it('incluye el auto en el estado y en los resultados', () => {
    const { manager, room } = racing('b');
    manager.customize('a', { car: 'hyper' }); // rechazado: en carrera
    expect(manager.toState(room).players[0].car).toBe(DEFAULT_CAR);
    manager.endRace(room.code);
    expect(room.results![0].car).toBe(DEFAULT_CAR);
  });
});

describe('RoomManager: desconexión y reconexión', () => {
  it('al desconectarse conserva el lugar y la sala', () => {
    const { manager } = setup();
    const room = roomWith(manager);
    expect(manager.disconnect('a')).toBe(room);
    expect(room.players.get('a')?.status).toBe('reconnecting');
    expect(manager.getRoom(room.code)).toBe(room);
    expect(room.hostId).toBe('a');
  });

  it('al reconectar vuelve a estar conectado en la misma sala', () => {
    const { manager } = setup();
    const room = roomWith(manager);
    manager.disconnect('a');
    expect(manager.reconnect('a')).toBe(room);
    expect(room.players.get('a')?.status).toBe('connected');
  });

  it('volver a unirse tras recargar cuenta como reconexión, incluso en plena carrera', () => {
    const { manager, room } = racing('b');
    manager.updateProgress('b', 4, 0);
    manager.disconnect('b');
    expect(manager.joinRoom(room.code, 'b', 'B').ok).toBe(true);
    expect(room.players.get('b')).toMatchObject({ status: 'connected', progress: 4 });
  });

  it('la carrera espera a quien está reconectando', () => {
    const { manager } = racing('b');
    manager.disconnect('b');
    expect(manager.updateProgress('a', LEN, 0)).toMatchObject({ accepted: true, raceOver: false });
  });
});

describe('RoomManager: salida, host y salas vacías', () => {
  it('pasa el host al siguiente jugador cuando el creador se va', () => {
    const { manager } = setup();
    const room = roomWith(manager, 'b', 'c');
    const res = manager.leaveRoom('a');
    expect(res.hostChanged).toBe(true);
    expect(room.hostId).toBe('b');
    expect(room.players.has('a')).toBe(false);
  });

  it('prefiere como nuevo host a un jugador conectado', () => {
    const { manager } = setup();
    const room = roomWith(manager, 'b', 'c');
    manager.disconnect('b');
    manager.leaveRoom('a');
    expect(room.hostId).toBe('c');
  });

  it('elimina la sala cuando se queda vacía', () => {
    const { manager } = setup();
    const room = roomWith(manager);
    expect(manager.leaveRoom('a').roomDeleted).toBe(true);
    expect(manager.getRoom(room.code)).toBeUndefined();
    expect(manager.roomCount).toBe(0);
  });

  it('no elimina la sala si quedan jugadores reconectando', () => {
    const { manager } = setup();
    const room = roomWith(manager, 'b');
    manager.disconnect('b');
    expect(manager.leaveRoom('a').roomDeleted).toBe(false);
    expect(room.hostId).toBe('b');
  });

  it('durante la carrera quien se va queda como "left" y el host pasa a otro', () => {
    const { manager, room } = racing('b');
    manager.leaveRoom('a');
    expect(room.players.get('a')?.status).toBe('left');
    expect(room.hostId).toBe('b');
  });

  it('elimina la sala en carrera si se van todos', () => {
    const { manager } = racing('b');
    manager.leaveRoom('a');
    expect(manager.leaveRoom('b').roomDeleted).toBe(true);
  });
});

describe('RoomManager: inicio de carrera', () => {
  it('solo el host puede empezar', () => {
    const { manager } = setup();
    roomWith(manager, 'b');
    expect(manager.startRace('b').ok).toBe(false);
    expect(manager.startRace('a').ok).toBe(true);
  });

  it('se puede empezar con un solo jugador y el inicio es ahora + cuenta regresiva', () => {
    const { manager } = setup();
    roomWith(manager);
    const res = manager.startRace('a');
    expect(res.ok && res.room.startAt).toBe(T0 + COUNTDOWN_MS);
  });

  it('pasa al catálogo los textos recientes de la sala para no repetirlos (hasta 30)', () => {
    const seen: number[][] = [];
    let next = 0;
    const manager = new RoomManager({
      now: () => T0,
      pickText: (recent) => {
        seen.push([...recent]);
        return { id: next++, text: 'hola mundo' };
      },
    });
    roomWith(manager);
    for (let i = 0; i < 32; i++) {
      manager.startRace('a');
      manager.cancelRace('a');
    }
    expect(seen[0]).toEqual([]);
    expect(seen[2]).toEqual([0, 1]);
    expect(seen[31]).toHaveLength(30);
    expect(seen[31][0]).toBe(1);
  });
});

describe('RoomManager: validación de progreso', () => {
  function started() {
    const ctx = setup();
    const room = roomWith(ctx.manager, 'b');
    ctx.manager.startRace('a');
    return { ...ctx, room };
  }

  it('ignora progreso antes del timestamp de inicio', () => {
    const { manager, advance } = started();
    advance(COUNTDOWN_MS - 1);
    expect(manager.updateProgress('a', 1, 0)).toMatchObject({ accepted: false, reason: 'before-start' });
  });

  it('acepta progreso válido después del inicio', () => {
    const { manager, advance, room } = started();
    advance(COUNTDOWN_MS + 2000);
    expect(manager.updateProgress('a', 5, 0).accepted).toBe(true);
    expect(room.players.get('a')?.progress).toBe(5);
  });

  it('ignora progreso que no aumenta', () => {
    const { manager, advance } = started();
    advance(COUNTDOWN_MS + 2000);
    manager.updateProgress('a', 5, 0);
    expect(manager.updateProgress('a', 5, 0)).toMatchObject({ accepted: false, reason: 'not-increasing' });
    expect(manager.updateProgress('a', 3, 0)).toMatchObject({ accepted: false, reason: 'not-increasing' });
  });

  it('ignora progreso mayor que la longitud del texto', () => {
    const { manager, advance } = started();
    advance(COUNTDOWN_MS + 60_000);
    expect(manager.updateProgress('a', LEN + 1, 0)).toMatchObject({ accepted: false, reason: 'too-long' });
  });

  it('ignora velocidades mayores a 250 WPM', () => {
    const { manager, advance, room } = started();
    room.text = { id: 1, text: 'a'.repeat(100) };
    // 1 s después del inicio, 250 WPM permite como máximo 250 * 5 / 60 ≈ 20.8 caracteres.
    advance(COUNTDOWN_MS + 1000);
    expect(manager.updateProgress('a', 21, 0)).toMatchObject({ accepted: false, reason: 'too-fast' });
    expect(manager.updateProgress('a', 20, 0).accepted).toBe(true);
  });

  it('ignora progreso fuera de una carrera', () => {
    const { manager } = setup();
    roomWith(manager);
    expect(manager.updateProgress('a', 1, 0).accepted).toBe(false);
    expect(manager.updateProgress('nadie', 1, 0).accepted).toBe(false);
  });
});

describe('RoomManager: llegada y resultados', () => {
  it('el servidor asigna el orden de llegada', () => {
    const { manager, advance } = racing('b', 'c');
    expect(manager.updateProgress('b', LEN, 1)).toMatchObject({ finishedPosition: 1, raceOver: false });
    advance(500);
    expect(manager.updateProgress('a', LEN, 0)).toMatchObject({ finishedPosition: 2, raceOver: false });
  });

  it('no acepta más progreso de quien ya terminó', () => {
    const { manager } = racing('b');
    manager.updateProgress('a', LEN, 0);
    expect(manager.updateProgress('a', LEN, 0)).toMatchObject({ accepted: false, reason: 'already-finished' });
  });

  it('la carrera termina cuando llegan todos', () => {
    const { manager, room } = racing('b', 'c');
    manager.updateProgress('a', LEN, 0);
    manager.updateProgress('b', LEN, 0);
    expect(manager.updateProgress('c', LEN, 0)).toMatchObject({ raceOver: true });
    expect(manager.endRace(room.code)!.map((r) => r.playerId)).toEqual(['a', 'b', 'c']);
    expect(room.phase).toBe('finished');
  });

  it('si se va el último que faltaba, la carrera termina', () => {
    const { manager } = racing('b', 'c');
    manager.updateProgress('a', LEN, 0);
    manager.updateProgress('b', LEN, 0);
    expect(manager.leaveRoom('c').race).toBe('over');
  });

  it('calcula WPM y precisión, y deja a los que no terminaron al final por avance', () => {
    const { manager, room } = racing('b', 'c');
    // 10 caracteres en 10 s = 2 palabras en 1/6 min = 12 WPM
    manager.updateProgress('b', LEN, 0);
    manager.updateProgress('c', 4, 1);
    manager.updateProgress('a', 6, 6);
    const results = manager.endRace(room.code)!;
    expect(results.map((r) => [r.playerId, r.position])).toEqual([
      ['b', 1],
      ['a', null],
      ['c', null],
    ]);
    expect(results[0]).toMatchObject({ wpm: 12, accuracy: 100 });
    expect(results[1].accuracy).toBe(50);
    expect(results[2].accuracy).toBe(80);
  });

  it('"Otra carrera" vuelve al lobby, limpia el progreso y descarta a quienes se fueron', () => {
    const { manager, room } = racing('b', 'c');
    manager.leaveRoom('c');
    manager.updateProgress('a', LEN, 0);
    manager.endRace(room.code);
    expect(manager.resetToLobby('b').ok).toBe(false); // no es host
    expect(manager.resetToLobby('a').ok).toBe(true);
    expect(room.phase).toBe('lobby');
    expect(room.players.has('c')).toBe(false);
    expect([...room.players.values()].every((p) => p.progress === 0 && p.position === null)).toBe(true);
  });
});

describe('RoomManager: volver a la sala durante la carrera', () => {
  it('quien vuelve sigue en la sala pero ya no corre', () => {
    const { manager, room } = racing('b');
    manager.updateProgress('b', 3, 0);
    expect(manager.retireFromRace('b')).toMatchObject({ ok: true, race: 'continues' });
    expect(manager.getRoomOfPlayer('b')).toBe(room);
    expect(manager.toState(room).players.find((p) => p.id === 'b')).toMatchObject({ retired: true, progress: 3 });
    expect(manager.updateProgress('b', 5, 0)).toMatchObject({ accepted: false, reason: 'retired' });
    expect(manager.retireFromRace('b')).toMatchObject({ ok: false });
  });

  it('solo durante la carrera', () => {
    const { manager } = setup();
    roomWith(manager, 'b');
    expect(manager.retireFromRace('b')).toMatchObject({ ok: false, error: 'No hay ninguna carrera en curso' });
  });

  it('si los que siguen corriendo ya llegaron, la carrera termina', () => {
    const { manager, room } = racing('b', 'c');
    manager.updateProgress('a', LEN, 0);
    manager.updateProgress('b', LEN, 0);
    expect(manager.retireFromRace('c')).toMatchObject({ ok: true, race: 'over' });
    const results = manager.endRace(room.code)!;
    expect(results.find((r) => r.playerId === 'c')).toMatchObject({ position: null, retired: true });
  });

  it('quien ya llegó conserva su puesto al volver a la sala', () => {
    const { manager, room } = racing('b');
    manager.updateProgress('a', LEN, 0);
    expect(manager.retireFromRace('a')).toMatchObject({ ok: true, race: 'continues' });
    expect(manager.retireFromRace('b')).toMatchObject({ ok: true, race: 'over' });
    expect(manager.endRace(room.code)!.map((r) => [r.playerId, r.position])).toEqual([
      ['a', 1],
      ['b', null],
    ]);
  });

  it('si nadie corre y nadie llegó, se cancela', () => {
    const { manager, room } = racing('b');
    manager.retireFromRace('a');
    expect(manager.retireFromRace('b')).toMatchObject({ ok: true, race: 'cancelled' });
    expect(manager.abortRace(room.code)).toBe(room);
    expect(room.phase).toBe('lobby');
    expect(room.results).toBeNull();
  });

  it('si el último que corría se va de la sala, también se cancela', () => {
    const { manager } = racing('b');
    manager.retireFromRace('a');
    expect(manager.leaveRoom('b').race).toBe('cancelled');
  });

  it('quien volvió a la sala puede cambiar de auto; quien corre, no', () => {
    const { manager } = racing('b');
    expect(manager.customize('a', { car: 'f1' }).ok).toBe(false);
    manager.retireFromRace('a');
    expect(manager.customize('a', { car: 'f1' }).ok).toBe(true);
  });
});

describe('RoomManager: cancelar la carrera', () => {
  it('el host cancela: todos vuelven al lobby sin resultados y se puede correr otra', () => {
    const { manager, room } = racing('b', 'c');
    manager.updateProgress('b', LEN, 0);
    manager.leaveRoom('c');
    expect(manager.cancelRace('a')).toMatchObject({ ok: true });
    expect(room.phase).toBe('lobby');
    expect(room.results).toBeNull();
    expect([...room.players.keys()]).toEqual(['a', 'b']);
    const players = manager.toState(room).players;
    expect(players.every((p) => p.progress === 0 && p.position === null && !p.retired)).toBe(true);
    expect(manager.startRace('a').ok).toBe(true);
  });

  it('solo el host y solo durante la carrera', () => {
    const { manager } = racing('b');
    expect(manager.cancelRace('b')).toMatchObject({ ok: false, error: 'Solo el host puede cancelar la carrera' });
    manager.cancelRace('a');
    expect(manager.cancelRace('a')).toMatchObject({ ok: false, error: 'No hay ninguna carrera en curso' });
  });

  it('también durante la cuenta regresiva', () => {
    const { manager } = setup();
    const room = roomWith(manager, 'b');
    manager.startRace('a');
    expect(manager.cancelRace('a').ok).toBe(true);
    expect(room.phase).toBe('lobby');
  });
});
