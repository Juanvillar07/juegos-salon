import { describe, expect, it } from 'vitest';
import { COUNTDOWN_MS } from '@typeracer/shared';
import { RACE_LIMIT_MS, SUBMIT_COOLDOWN_MS } from '@typeracer/shared/carrera-de-silabas';
import { RoomManager, syllablesForTarget } from '../../../src/games/carrera-de-silabas/domain/RoomManager.js';
import type { Room } from '../../../src/games/carrera-de-silabas/domain/types.js';

const T0 = 1_000_000;
const SEQUENCE = ['tra', 'ca', 'pa'];
const WORDS = new Set(['trabajo', 'tractor', 'maestra', 'casa', 'camion', 'paso', 'zapato', 'ñandu']);

/** Palabra de 30 letras (30 puntos) distinta para cada i; con isWord permisivo sirve para llegar a la meta. */
const longWord = (syllable: string, i: number) => (syllable + 'abcdefghij'[i]).padEnd(30, 'o');

function setup(options: { anyWord?: boolean; syllables?: string[] } = {}) {
  let clock = T0;
  let codeSeq = 0;
  const sequence = options.syllables ?? SEQUENCE;
  const manager = new RoomManager({
    now: () => clock,
    isWord: options.anyWord ? () => true : (w) => WORDS.has(w),
    pickSyllables: (count) => Array.from({ length: count }, (_, i) => sequence[i % sequence.length]),
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
function racing(options: Parameters<typeof setup>[0] = {}, ...others: string[]) {
  const ctx = setup(options);
  const room = roomWith(ctx.manager, ...others);
  ctx.manager.startRace('a');
  ctx.advance(COUNTDOWN_MS + 1000);
  return { ...ctx, room };
}

describe('Carrera de Sílabas: ajustes', () => {
  it('la meta por defecto es 100 y el host puede cambiarla a 200', () => {
    const { manager } = setup();
    const room = roomWith(manager, 'b');
    expect(room.settings.target).toBe(100);
    expect(manager.updateSettings('a', { target: 200 }).ok).toBe(true);
    expect(room.settings.target).toBe(200);
  });

  it('rechaza metas fuera de las opciones y cambios de quien no es host', () => {
    const { manager } = setup();
    roomWith(manager, 'b');
    expect(manager.updateSettings('a', { target: 150 }).ok).toBe(false);
    expect(manager.updateSettings('b', { target: 200 }).ok).toBe(false);
  });

  it('no se puede cambiar la meta durante la carrera', () => {
    const { manager } = racing();
    expect(manager.updateSettings('a', { target: 200 }).ok).toBe(false);
  });
});

describe('Carrera de Sílabas: salida', () => {
  it('sortea sílabas suficientes para la meta y todos reciben la misma secuencia', () => {
    const { manager, room } = racing({}, 'b');
    expect(room.syllables).toHaveLength(syllablesForTarget(100));
    const state = manager.toState(room);
    expect(state.syllables?.slice(0, 3)).toEqual(SEQUENCE);
    expect(state.players.every((p) => p.syllableIndex === 0 && p.score === 0)).toBe(true);
    expect(state.endsAt).toBe(room.startAt! + RACE_LIMIT_MS);
  });

  it('no acepta palabras antes de la salida', () => {
    const { manager } = setup();
    roomWith(manager);
    manager.startRace('a');
    expect(manager.submitWord('a', 'trabajo')).toMatchObject({ accepted: false, error: 'Espera la salida' });
  });
});

describe('Carrera de Sílabas: palabras', () => {
  it('una palabra válida suma un punto por letra y pasa a la siguiente sílaba', () => {
    const { manager, room } = racing();
    const res = manager.submitWord('a', 'trabajo');
    expect(res).toMatchObject({ accepted: true, word: 'trabajo', syllable: 'tra', points: 7, finishedPosition: null });
    const player = room.players.get('a')!;
    expect(player.score).toBe(7);
    expect(player.syllableIndex).toBe(1);
  });

  it('ignora mayúsculas y tildes, y acepta la sílaba en cualquier parte', () => {
    const { manager, advance } = racing();
    expect(manager.submitWord('a', '  MAESTRA ')).toMatchObject({ accepted: true, word: 'maestra' });
    advance(SUBMIT_COOLDOWN_MS);
    expect(manager.submitWord('a', 'Camión')).toMatchObject({ accepted: true, word: 'camion', points: 6 });
  });

  it('rechaza palabras sin la sílaba, inventadas, cortas o con símbolos', () => {
    const { manager, advance, room } = racing();
    const tries = ['casa', 'trazzz', 'tr', 'tra bajo', ''];
    const errors = tries.map((w) => {
      advance(SUBMIT_COOLDOWN_MS);
      const res = manager.submitWord('a', w);
      return res.accepted ? null : res.error;
    });
    expect(errors).toEqual([
      'No contiene «TRA»',
      'No está en el diccionario',
      'Mínimo 3 letras',
      'Solo letras, sin espacios ni símbolos',
      'Escribe una palabra',
    ]);
    expect(room.players.get('a')!.score).toBe(0);
  });

  it('no se puede repetir una palabra en la misma carrera', () => {
    const { manager, advance } = racing({ syllables: ['tra'] });
    expect(manager.submitWord('a', 'trabajo').accepted).toBe(true);
    advance(SUBMIT_COOLDOWN_MS);
    expect(manager.submitWord('a', 'trabajo')).toMatchObject({ accepted: false, error: 'Ya usaste esa palabra' });
  });

  it('limita la frecuencia de intentos', () => {
    const { manager, advance } = racing();
    expect(manager.submitWord('a', 'casa').accepted).toBe(false);
    expect(manager.submitWord('a', 'trabajo')).toMatchObject({ accepted: false, error: 'Más despacio' });
    advance(SUBMIT_COOLDOWN_MS);
    expect(manager.submitWord('a', 'trabajo').accepted).toBe(true);
  });

  it('cada jugador avanza por la secuencia a su ritmo', () => {
    const { manager, advance, room } = racing({}, 'b');
    manager.submitWord('a', 'trabajo');
    advance(SUBMIT_COOLDOWN_MS);
    expect(manager.submitWord('a', 'casa')).toMatchObject({ accepted: true, syllable: 'ca' });
    expect(manager.submitWord('b', 'casa')).toMatchObject({ accepted: false, error: 'No contiene «TRA»' });
    expect(room.players.get('a')!.syllableIndex).toBe(2);
    expect(room.players.get('b')!.syllableIndex).toBe(0);
  });

  it('rechaza valores que no son texto', () => {
    const { manager } = racing();
    expect(manager.submitWord('a', 42).accepted).toBe(false);
  });
});

describe('Carrera de Sílabas: meta y resultados', () => {
  /** Manda palabras de 30 puntos hasta llegar a la meta. */
  function reachTarget(ctx: ReturnType<typeof racing>, id: string) {
    for (let i = 0; ; i++) {
      ctx.advance(SUBMIT_COOLDOWN_MS);
      const res = ctx.manager.submitWord(id, longWord('a', i));
      if (!res.accepted) throw new Error(res.error);
      if (res.finishedPosition !== null) return res;
    }
  }

  it('al llegar a la meta el jugador queda clasificado y no suma más', () => {
    const ctx = racing({ anyWord: true, syllables: ['a'] }, 'b');
    const res = reachTarget(ctx, 'a');
    expect(res).toMatchObject({ finishedPosition: 1, raceOver: false });
    expect(ctx.room.players.get('a')!.score).toBe(120);
    ctx.advance(SUBMIT_COOLDOWN_MS);
    expect(ctx.manager.submitWord('a', longWord('a', 9))).toMatchObject({ accepted: false, error: 'Ya llegaste a la meta' });
  });

  it('la carrera termina cuando llegan todos y los resultados van por orden de llegada', () => {
    const ctx = racing({ anyWord: true, syllables: ['a'] }, 'b');
    reachTarget(ctx, 'b');
    expect(reachTarget(ctx, 'a').raceOver).toBe(true);
    const results = ctx.manager.endRace(ctx.room.code)!;
    expect(results.map((r) => [r.playerId, r.position, r.score, r.words])).toEqual([
      ['b', 1, 120, 4],
      ['a', 2, 120, 4],
    ]);
    expect(results[0].longestWord).toHaveLength(30);
  });

  it('si se acaba el tiempo, los que no llegaron se ordenan por puntos', () => {
    const ctx = racing({}, 'b', 'c');
    ctx.manager.submitWord('c', 'tractor');
    ctx.manager.submitWord('b', 'trabajo');
    ctx.advance(SUBMIT_COOLDOWN_MS);
    ctx.manager.submitWord('b', 'casa');
    const results = ctx.manager.endRace(ctx.room.code)!;
    expect(results.map((r) => [r.playerId, r.position, r.score])).toEqual([
      ['b', null, 11],
      ['c', null, 7],
      ['a', null, 0],
    ]);
  });

  it('con meta 200 se sortean más sílabas y "Otra carrera" reinicia el marcador', () => {
    const ctx = setup({ anyWord: true, syllables: ['a'] });
    const room = roomWith(ctx.manager);
    ctx.manager.updateSettings('a', { target: 200 });
    ctx.manager.startRace('a');
    expect(room.syllables).toHaveLength(syllablesForTarget(200));
    ctx.advance(COUNTDOWN_MS + 1000);
    ctx.manager.submitWord('a', longWord('a', 0));
    ctx.manager.endRace(room.code);
    expect(ctx.manager.resetToLobby('a').ok).toBe(true);
    expect(room.players.get('a')).toMatchObject({ score: 0, syllableIndex: 0, position: null });
    expect(room.players.get('a')!.usedWords.size).toBe(0);
    expect(room.syllables).toBeNull();
  });
});

describe('Carrera de Sílabas: volver a la sala y cancelar', () => {
  it('quien vuelve a la sala sigue en ella, ya no puede jugar y puede cambiar de auto', () => {
    const { manager, room } = racing({}, 'b');
    expect(manager.submitWord('b', 'trabajo').accepted).toBe(true);
    expect(manager.retireFromRace('b')).toMatchObject({ ok: true, race: 'continues' });
    expect(manager.getRoomOfPlayer('b')).toBe(room);
    expect(manager.toState(room).players.find((p) => p.id === 'b')).toMatchObject({ retired: true, score: 7 });
    expect(manager.submitWord('b', 'tractor')).toMatchObject({ accepted: false, error: 'Volviste a la sala' });
    expect(manager.customize('b', { car: 'f1' }).ok).toBe(true);
    expect(manager.customize('a', { car: 'f1' }).ok).toBe(false);
  });

  it('si los que siguen corriendo ya llegaron, hay resultados con el retirado al final', () => {
    const { manager, room, advance } = racing({ anyWord: true, syllables: ['a'] }, 'b');
    for (let i = 0; manager.toState(room).players[0].position === null; i++) {
      advance(SUBMIT_COOLDOWN_MS);
      manager.submitWord('a', longWord('a', i));
    }
    expect(manager.retireFromRace('b')).toMatchObject({ ok: true, race: 'over' });
    expect(manager.endRace(room.code)!.map((r) => [r.playerId, r.position, r.retired])).toEqual([
      ['a', 1, false],
      ['b', null, true],
    ]);
  });

  it('si nadie corre y nadie llegó, se cancela', () => {
    const { manager, room } = racing({}, 'b');
    manager.retireFromRace('a');
    expect(manager.retireFromRace('b')).toMatchObject({ ok: true, race: 'cancelled' });
    expect(manager.abortRace(room.code)).toBe(room);
    expect(room.phase).toBe('lobby');
  });

  it('el host cancela: todos vuelven al lobby y se puede correr otra; los demás no pueden cancelar', () => {
    const { manager, room } = racing({}, 'b');
    expect(manager.cancelRace('b')).toMatchObject({ ok: false, error: 'Solo el host puede cancelar la carrera' });
    manager.submitWord('b', 'trabajo');
    expect(manager.cancelRace('a').ok).toBe(true);
    expect(room.phase).toBe('lobby');
    expect(room.results).toBeNull();
    expect(room.players.get('b')).toMatchObject({ score: 0, syllableIndex: 0, retired: false });
    expect(manager.startRace('a').ok).toBe(true);
  });
});
