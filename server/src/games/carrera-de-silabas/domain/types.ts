import type { CarModel, ChatMessage, PlayerStatus, RoomPhase } from '@typeracer/shared';
import type { RaceResult, RoomSettings } from '@typeracer/shared/carrera-de-silabas';

export interface Player {
  id: string;
  nickname: string;
  color: string;
  car: CarModel;
  status: PlayerStatus;
  ready: boolean;
  score: number;
  /** Palabras aceptadas en esta carrera (ya normalizadas); no se pueden repetir. */
  usedWords: Set<string>;
  longestWord: string | null;
  /** Índice de la sílaba que le toca dentro de room.syllables. */
  syllableIndex: number;
  position: number | null;
  finishedAt: number | null;
  /** Volvió a la sala durante la carrera: ya no corre, pero sigue en la sala. */
  retired: boolean;
  /** Último intento de palabra, para limitar la frecuencia. */
  lastWordAt: number | null;
  /** Último mensaje de chat, para limitar la frecuencia. */
  lastChatAt: number | null;
}

export interface Room {
  code: string;
  hostId: string;
  phase: RoomPhase;
  /** Map conserva el orden de llegada, que se usa para elegir nuevo host. */
  players: Map<string, Player>;
  /** Secuencia de sílabas de la carrera, igual para todos. */
  syllables: string[] | null;
  startAt: number | null;
  endedAt: number | null;
  finishCount: number;
  /** Se incrementa en cada carrera para invalidar temporizadores viejos. */
  raceId: number;
  results: RaceResult[] | null;
  settings: RoomSettings;
  chat: ChatMessage[];
  chatSeq: number;
  /** Salida automática programada (todos o la mayoría marcaron "Listo"). */
  autoStartAt: number | null;
}

/**
 * Qué hacer tras revisar quién está listo:
 * - start: todos listos, arrancar ya.
 * - scheduled: se acaba de programar la salida automática (room.autoStartAt).
 * - cancelled: había una salida programada y ya no corresponde.
 * - unchanged: nada cambia.
 */
export type AutoStartDecision = 'start' | 'scheduled' | 'cancelled' | 'unchanged';

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export type WordResult =
  | { accepted: false; error: string }
  | {
      accepted: true;
      room: Room;
      /** Palabra normalizada que se aceptó. */
      word: string;
      /** Sílaba que resolvió. */
      syllable: string;
      points: number;
      /** Posición asignada si con esta palabra llegó a la meta. */
      finishedPosition: number | null;
      /** true si ya llegaron todos los jugadores que siguen en la carrera. */
      raceOver: boolean;
    };

/**
 * Cómo queda la carrera tras una salida o un retiro:
 * - continues: alguien sigue corriendo.
 * - over: los que siguen corriendo ya llegaron (o nadie corre, pero alguien llegó): hay resultados.
 * - cancelled: nadie corre y nadie llegó: se vuelve al lobby sin resultados.
 */
export type RaceOutcome = 'continues' | 'over' | 'cancelled';

export interface LeaveResult {
  room: Room | null;
  roomDeleted: boolean;
  hostChanged: boolean;
  /** Solo importa si la sala estaba en carrera. */
  race: RaceOutcome;
}

/** Un jugador cuenta como "en la sala" mientras no la haya abandonado (aunque esté reconectando). */
export function isActive(player: Player): boolean {
  return player.status !== 'left';
}

/** Sigue en la carrera: está en la sala y no volvió al lobby. */
export function isRacing(player: Player): boolean {
  return isActive(player) && !player.retired;
}
