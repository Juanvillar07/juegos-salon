import { calcWpm, type RaceResult } from '@typeracer/shared';
import type { Player, Room } from './types.js';

export function playerWpm(room: Room, player: Player, now: number): number {
  if (room.startAt === null) return 0;
  const end = player.finishedAt ?? room.endedAt ?? now;
  return Math.round(calcWpm(player.progress, end - room.startAt));
}

export function playerAccuracy(player: Player): number {
  const typed = player.progress + player.errors;
  return typed === 0 ? 0 : Math.round((player.progress / typed) * 1000) / 10;
}

/** Primero los que llegaron, por orden de llegada; luego los que no terminaron, por avance. */
export function computeResults(room: Room, now: number): RaceResult[] {
  return [...room.players.values()]
    // Quien entró con la carrera en marcha no corrió: no aparece en los resultados.
    .filter((p) => !p.spectator)
    .map<RaceResult>((p) => ({
      playerId: p.id,
      nickname: p.nickname,
      color: p.color,
      car: p.car,
      status: p.status,
      position: p.position,
      retired: p.retired,
      wpm: playerWpm(room, p, now),
      accuracy: playerAccuracy(p),
      progress: p.progress,
    }))
    .sort((a, b) => {
      if (a.position !== null && b.position !== null) return a.position - b.position;
      if (a.position !== null) return -1;
      if (b.position !== null) return 1;
      return b.progress - a.progress;
    });
}
