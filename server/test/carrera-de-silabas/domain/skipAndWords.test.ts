import { describe, expect, it } from 'vitest';
import { COUNTDOWN_MS } from '@typeracer/shared';
import { SUBMIT_COOLDOWN_MS } from '@typeracer/shared/carrera-de-silabas';
import { RoomManager } from '../../../src/games/carrera-de-silabas/domain/RoomManager.js';

const SEQUENCE = ['tra', 'ca', 'pa'];
const WORDS = new Set(['trabajo', 'tractor', 'casa', 'camion', 'paso', 'zapato']);

/** Sala en carrera (ya pasada la salida) con Ana (host) y Beto, y los puntos que cuesta pasar. */
function racing(skipPoints = 5) {
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
  expect(manager.updateSettings('a', { skipPoints }).ok).toBe(true);
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
  it('resta los puntos de la sala y se puede seguir escribiendo', () => {
    const { manager, room, advance } = racing(5);
    manager.submitWord('a', 'trabajo'); // +7
    advance(SUBMIT_COOLDOWN_MS);
    expect(manager.skipSyllable('a')).toMatchObject({ ok: true, player: { score: 2, syllableIndex: 2 } });
    expect(room.players.get('a')).toMatchObject({ score: 2, skips: 1 });
    advance(SUBMIT_COOLDOWN_MS);
    manager.skipSyllable('a');
    expect(room.players.get('a')!.score).toBe(-3);
    advance(SUBMIT_COOLDOWN_MS);
    expect(manager.submitWord('a', 'tractor')).toMatchObject({ accepted: true });
  });

  it('sin penalización pasar es gratis', () => {
    const { manager, room, advance } = racing(0);
    manager.submitWord('a', 'trabajo');
    advance(SUBMIT_COOLDOWN_MS);
    manager.skipSyllable('a');
    expect(room.players.get('a')).toMatchObject({ score: 7, syllableIndex: 2, skips: 1 });
  });

  it('pasar nada más empezar deja el marcador en negativo y aleja la meta', () => {
    const { manager, room, advance } = racing(5);
    expect(manager.skipSyllable('a')).toMatchObject({ ok: true, player: { score: -5 } });
    advance(SUBMIT_COOLDOWN_MS);
    manager.submitWord('a', 'casa'); // +4
    expect(room.players.get('a')).toMatchObject({ score: -1, position: null });
  });

  it('no se puede pasar en ráfaga', () => {
    const { manager, room } = racing(0);
    expect(manager.skipSyllable('a')).toMatchObject({ ok: true });
    expect(manager.skipSyllable('a')).toMatchObject({ ok: false, error: 'Más despacio' });
    expect(room.players.get('a')!.syllableIndex).toBe(1);
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
    expect(manager.updateSettings('a', { skipPoints: 7 }).ok).toBe(false);
    expect(manager.updateSettings('a', { skipPoints: -5 }).ok).toBe(false);
    expect(manager.updateSettings('b', { skipPoints: 0 }).ok).toBe(false);
    expect(manager.updateSettings('a', { skipPoints: 0 })).toMatchObject({ ok: true });
  });
});

describe('Carrera de Sílabas: palabras en los resultados', () => {
  it('cada resultado trae sus palabras en orden, con la sílaba que resolvió, y las sílabas pasadas', () => {
    const { manager, room, advance } = racing();
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
    const { manager, room, advance } = racing();
    manager.submitWord('a', 'trabajo');
    advance(SUBMIT_COOLDOWN_MS);
    manager.skipSyllable('a');
    expect(room.players.get('a')!.skips).toBe(1);
    manager.cancelRace('a');
    expect(room.players.get('a')).toMatchObject({ plays: [], skips: 0, lastWordAt: null });
  });
});
