import type { CarModel, ChatMessage, PlayerStatus, RaceResult, RoomPhase, RoomSettings } from '@typeracer/shared';

export interface RaceText {
  id: number;
  text: string;
}

export interface Player {
  id: string;
  nickname: string;
  color: string;
  car: CarModel;
  status: PlayerStatus;
  ready: boolean;
  progress: number;
  errors: number;
  position: number | null;
  finishedAt: number | null;
  /** Último mensaje de chat, para limitar la frecuencia. */
  lastChatAt: number | null;
}

export interface Room {
  code: string;
  hostId: string;
  phase: RoomPhase;
  /** Map conserva el orden de llegada, que se usa para elegir nuevo host. */
  players: Map<string, Player>;
  text: RaceText | null;
  lastTextId: number | null;
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

export type ProgressResult =
  | { accepted: false; reason: string }
  | {
      accepted: true;
      room: Room;
      /** Posición asignada si esta actualización completó el texto. */
      finishedPosition: number | null;
      /** true si ya terminaron todos los jugadores que siguen en la carrera. */
      raceOver: boolean;
    };

export interface LeaveResult {
  room: Room | null;
  roomDeleted: boolean;
  hostChanged: boolean;
  /** true si la salida dejó a todos los que siguen en la carrera ya terminados. */
  raceOver: boolean;
}

/** Un jugador cuenta como "en la sala" mientras no la haya abandonado (aunque esté reconectando). */
export function isActive(player: Player): boolean {
  return player.status !== 'left';
}
