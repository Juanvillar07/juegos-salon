import { describe, expect, it } from 'vitest';
import { COUNTDOWN_MS, type TextLength } from '@typeracer/shared';
import { RoomManager } from '../../src/games/rally-de-letras/domain/RoomManager.js';
import { createTextPicker } from '../../src/games/rally-de-letras/domain/textRepository.js';
import type { RaceText, Room } from '../../src/games/rally-de-letras/domain/types.js';

const TEXT: RaceText = { id: 0, text: 'hola mundo' }; // 10 caracteres
const LEN = TEXT.text.length;
const T0 = 1_000_000;

function setup(pickText: (recent: readonly number[], length: TextLength) => RaceText = () => TEXT) {
  let clock = T0;
  const manager = new RoomManager({ now: () => clock, pickText, generateCode: () => 'ROOM0' });
  return {
    manager,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

function roomWith(manager: RoomManager, ...others: string[]): Room {
  const created = manager.createRoom('a', 'Ana');
  if (!created.ok) throw new Error(created.error);
  for (const id of others) {
    const joined = manager.joinRoom(created.room.code, id, id.toUpperCase());
    if (!joined.ok) throw new Error(joined.error);
  }
  return created.room;
}

/** Carrera completa: llegan los jugadores en el orden dado (con 10 s de carrera). */
function race(manager: RoomManager, advance: (ms: number) => void, finishers: string[]) {
  manager.startRace('a');
  advance(COUNTDOWN_MS + 10_000);
  for (const id of finishers) manager.updateProgress(id, LEN, 0);
  return manager.endRace('ROOM0')!;
}

describe('Rally: entrar con la carrera en marcha', () => {
  it('se puede entrar: queda como espectador y ve el lobby', () => {
    const { manager, advance } = setup();
    const room = roomWith(manager, 'b');
    manager.startRace('a');
    advance(COUNTDOWN_MS + 1000);

    expect(manager.joinRoom('ROOM0', 'c', 'Caro')).toMatchObject({ ok: true });
    const caro = manager.toState(room).players.find((p) => p.id === 'c');
    expect(caro).toMatchObject({ spectator: true, retired: true, status: 'connected' });
    expect(manager.updateProgress('c', 3, 0)).toMatchObject({ accepted: false });
  });

  it('el espectador no cuenta para terminar la carrera ni aparece en los resultados', () => {
    const { manager, advance } = setup();
    const room = roomWith(manager, 'b');
    manager.startRace('a');
    advance(COUNTDOWN_MS + 1000);
    manager.joinRoom('ROOM0', 'c', 'Caro');

    manager.updateProgress('a', LEN, 0);
    expect(manager.updateProgress('b', LEN, 0)).toMatchObject({ raceOver: true });
    expect(manager.endRace(room.code)!.map((r) => r.playerId)).toEqual(['a', 'b']);
  });

  it('en la carrera siguiente corre como todos', () => {
    const { manager, advance } = setup();
    const room = roomWith(manager);
    manager.startRace('a');
    advance(COUNTDOWN_MS + 1000);
    manager.joinRoom('ROOM0', 'c', 'Caro');
    manager.cancelRace('a');

    expect(manager.toState(room).players.find((p) => p.id === 'c')).toMatchObject({ spectator: false, retired: false });
    manager.startRace('a');
    advance(COUNTDOWN_MS + 1000);
    expect(manager.updateProgress('c', 3, 0)).toMatchObject({ accepted: true });
  });
});

describe('Rally: marcador de la sala', () => {
  it('cuenta victorias, carreras terminadas y el mejor WPM, carrera tras carrera', () => {
    const { manager, advance } = setup();
    const room = roomWith(manager, 'b');

    race(manager, advance, ['b', 'a']);
    manager.resetToLobby('a');
    race(manager, advance, ['b']); // Ana no termina

    const stats = Object.fromEntries(manager.toState(room).players.map((p) => [p.id, p.stats]));
    expect(stats.b).toEqual({ wins: 2, finished: 2, bestWpm: 12 }); // 10 caracteres en 10 s = 12 WPM
    expect(stats.a).toEqual({ wins: 0, finished: 1, bestWpm: 12 });
  });

  it('practicando solo se suman carreras y WPM, pero no victorias', () => {
    const { manager, advance } = setup();
    const room = roomWith(manager);
    race(manager, advance, ['a']);
    expect(manager.toState(room).players[0].stats).toEqual({ wins: 0, finished: 1, bestWpm: 12 });
  });

  it('una carrera cancelada no cuenta', () => {
    const { manager, advance } = setup();
    const room = roomWith(manager, 'b');
    manager.startRace('a');
    advance(COUNTDOWN_MS + 10_000);
    manager.updateProgress('b', LEN, 0);
    manager.cancelRace('a');
    expect(manager.toState(room).players.every((p) => p.stats.finished === 0 && p.stats.wins === 0)).toBe(true);
  });
});

describe('Rally: longitud del texto y sin signos', () => {
  it('el host elige la longitud y llega al catálogo al empezar', () => {
    const lengths: TextLength[] = [];
    const { manager } = setup((_recent, length) => {
      lengths.push(length);
      return TEXT;
    });
    roomWith(manager, 'b');
    expect(manager.updateSettings('a', { textLength: 'long' }).ok).toBe(true);
    manager.startRace('a');
    expect(lengths).toEqual(['long']);
  });

  it('rechaza longitudes desconocidas, valores no booleanos y cambios de quien no es host', () => {
    const { manager } = setup();
    roomWith(manager, 'b');
    expect(manager.updateSettings('a', { textLength: 'enorme' as TextLength }).ok).toBe(false);
    expect(manager.updateSettings('a', { plainText: 'sí' as unknown as boolean }).ok).toBe(false);
    expect(manager.updateSettings('b', { plainText: true }).ok).toBe(false);
  });

  it('sin signos quita ¿ ¡ y comillas del texto del catálogo; el pegado se escribe tal cual', () => {
    const { manager } = setup(() => ({ id: 3, text: '¿Vienes? ¡Claro! Dijo "ya voy".' }));
    const room = roomWith(manager);
    manager.updateSettings('a', { plainText: true });
    manager.startRace('a');
    expect(room.text?.text).toBe('Vienes? Claro! Dijo ya voy.');

    manager.cancelRace('a');
    manager.updateSettings('a', { customText: '¡Hola! "Esto" es un texto pegado de prueba.' });
    manager.startRace('a');
    expect(room.text?.text).toBe('¡Hola! "Esto" es un texto pegado de prueba.');
  });

  it('el catálogo filtra por longitud y, si no hay textos de esa longitud, usa cualquiera', () => {
    const texts: RaceText[] = [
      { id: 0, text: 'a'.repeat(150) },
      { id: 1, text: 'b'.repeat(250) },
      { id: 2, text: 'c'.repeat(350) },
    ];
    const pick = createTextPicker(texts);
    for (let i = 0; i < 10; i++) {
      expect(pick([], 'short').id).toBe(0);
      expect(pick([], 'medium').id).toBe(1);
      expect(pick([], 'long').id).toBe(2);
    }
    expect(createTextPicker([texts[1]])([], 'long').id).toBe(1);
  });
});
