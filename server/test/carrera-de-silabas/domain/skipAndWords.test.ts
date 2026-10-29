import { describe, expect, it } from 'vitest';
import { COUNTDOWN_MS } from '@typeracer/shared';
import { SKIP_BLOCK_MS, SKIP_POINTS, SUBMIT_COOLDOWN_MS, type SkipPenalty } from '@typeracer/shared/carrera-de-silabas';
import { RoomManager } from '../../../src/games/carrera-de-silabas/domain/RoomManager.js';

const SEQUENCE = ['tra', 'ca', 'pa'];
const WORDS = new Set(['trabajo', 'tractor', 'casa', 'camion', 'paso', 'zapato']);

/** Sala en carrera (ya pasada la salida) con Ana (host) y Beto, y la penalización elegida. */
function racing(penalty: SkipPenalty = 'time') {
  let clock = 1_000_000;
  const manager = new RoomManager({
    now: () => clock,
    isWord: (w) => WORDS.has(w),
    pickSyllables: (count) => Array.from({ length: count }, (_, i) => SEQUENCE[i % SEQUENCE.length]),
    generateCode: () => 'ROOM0',
  });
  const created = manager.createRoom('a', 'Ana');
  if (!created.ok) throw new Error(created.error);
  manager.joinRoom('ROOM0', 'b', 'Beto');
  expect(manager.updateSettings('a', { skipPenalty: penalty }).ok).toBe(true);
  manager.startRace('a');
  clock += COUNTDOWN_MS + 1000;
  return {
    manager,
    room: created.room,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe('Carrera de Sílabas: pasar de sílaba', () => {
  it('con penalización de tiempo pasa a la siguiente y no deja escribir durante el bloqueo', () => {
    const { manager, room, advance } = racing('time');
    const res = manager.skipSyllable('a');
    expect(res).toMatchObject({ ok: true });
    const ana = room.players.get('a')!;
    expect(ana).toMatchObject({ syllableIndex: 1, skips: 1, score: 0 });

    // Sílaba actual: "ca". Durante el bloqueo se rechaza; al terminar, se acepta.
    expect(manager.submitWord('a', 'casa')).toMatchObject({ accepted: false, error: 'Espera 3 s' });
    expect(manager.skipSyllable('a')).toMatchObject({ ok: false });
    advance(SKIP_BLOCK_MS);
    expect(manager.submitWord('a', 'casa')).toMatchObject({ accepted: true, syllable: 'ca' });
  });

  it('con penalización de puntos resta sin bajar de 0 y no bloquea', () => {
    const { manager, room, advance } = racing('points');
    manager.submitWord('a', 'trabajo'); // +7
    advance(SUBMIT_COOLDOWN_MS);
    manager.skipSyllable('a');
    expect(room.players.get('a')).toMatchObject({ score: 7 - SKIP_POINTS, blockedUntil: null, syllableIndex: 2 });
    manager.skipSyllable('a');
    expect(room.players.get('a')!.score).toBe(0);
    expect(manager.submitWord('a', 'tractor')).toMatchObject({ accepted: true });
  });

  it('con ambas, resta puntos y bloquea', () => {
    const { manager, room } = racing('both');
    manager.submitWord('a', 'trabajo');
    manager.skipSyllable('a');
    expect(room.players.get('a')!.score).toBe(7 - SKIP_POINTS);
    expect(room.players.get('a')!.blockedUntil).not.toBeNull();
  });

  it('no se puede pasar fuera de carrera, al haber llegado o tras volver a la sala', () => {
    const { manager } = racing();
    manager.retireFromRace('b');
    expect(manager.skipSyllable('b')).toMatchObject({ ok: false, error: 'Volviste a la sala' });
    expect(manager.skipSyllable('nadie')).toMatchObject({ ok: false });
  });

  it('la penalización se valida y solo la cambia el host', () => {
    const { manager } = racing();
    manager.cancelRace('a');
    expect(manager.updateSettings('a', { skipPenalty: 'gratis' as SkipPenalty }).ok).toBe(false);
    expect(manager.updateSettings('b', { skipPenalty: 'points' }).ok).toBe(false);
  });
});

describe('Carrera de Sílabas: palabras en los resultados', () => {
  it('cada resultado trae sus palabras en orden, con la sílaba que resolvió, y las sílabas pasadas', () => {
    const { manager, room, advance } = racing('points');
    manager.submitWord('a', 'trabajo');
    advance(SUBMIT_COOLDOWN_MS);
    manager.skipSyllable('a'); // salta "ca"
    advance(SUBMIT_COOLDOWN_MS);
    manager.submitWord('a', 'paso');
    manager.submitWord('b', 'tractor');

    const results = manager.endRace(room.code)!;
    expect(results.find((r) => r.playerId === 'a')).toMatchObject({
      plays: [
        { word: 'trabajo', syllable: 'tra' },
        { word: 'paso', syllable: 'pa' },
      ],
      skips: 1,
    });
    expect(results.find((r) => r.playerId === 'b')).toMatchObject({ plays: [{ word: 'tractor', syllable: 'tra' }] });
  });

  it('durante la carrera el estado no trae las palabras de nadie', () => {
    const { manager, room } = racing();
    manager.submitWord('a', 'trabajo');
    expect(JSON.stringify(manager.toState(room))).not.toContain('trabajo');
  });

  it('en la carrera siguiente se empieza sin palabras ni sílabas pasadas', () => {
    const { manager, room } = racing('points');
    manager.submitWord('a', 'trabajo');
    manager.skipSyllable('a');
    manager.cancelRace('a');
    expect(room.players.get('a')).toMatchObject({ plays: [], skips: 0, blockedUntil: null });
  });
});
