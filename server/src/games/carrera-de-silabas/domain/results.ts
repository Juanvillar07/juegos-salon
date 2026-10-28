import type { RaceResult } from '@typeracer/shared/carrera-de-silabas';
import type { Room } from './types.js';

/** Primero los que llegaron a la meta, por orden de llegada; luego el resto, por puntos. */
export function computeResults(room: Room): RaceResult[] {
  return [...room.players.values()]
    .map<RaceResult>((p) => ({
      playerId: p.id,
      nickname: p.nickname,
      color: p.color,
      car: p.car,
      status: p.status,
      position: p.position,
      retired: p.retired,
      score: p.score,
      words: p.usedWords.size,
      longestWord: p.longestWord,
    }))
    .sort((a, b) => {
      if (a.position !== null && b.position !== null) return a.position - b.position;
      if (a.position !== null) return -1;
      if (b.position !== null) return 1;
      return b.score - a.score;
    });
}
