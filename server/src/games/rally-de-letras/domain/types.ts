import type { CarModel, ChatMessage, PlayerStats, PlayerStatus, RaceResult, RoomPhase, RoomSettings } from '@typeracer/shared';

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
  /** Volvió a la sala durante la carrera: ya no corre, pero sigue en la sala. */
  retired: boolean;
  /** Entró con la carrera en marcha: no forma parte de ella (tampoco de sus resultados). */
  spectator: boolean;
  /** Marcador de la sala; no se reinicia entre carreras. */
  stats: PlayerStats;
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
  /** Textos del catálogo corridos hace poco (del más antiguo al más nuevo), para no repetirlos. */
  recentTextIds: number[];
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
  /** Contraseña para entrar (solo vive en el servidor); null = sala abierta. */
  password: string | null;
  /** Jugadores expulsados por el host: no pueden volver a entrar. */
  banned: Set<string>;
  /** Intentos fallidos de contraseña por jugador (marcas de tiempo), para frenar los intentos a ciegas. */
  failedJoins: Map<string, number[]>;
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

/** Entrar a una sala: si pide contraseña (falta o no coincide), `needsPassword`. */
export type JoinResult = { ok: true; room: Room } | { ok: false; error: string; needsPassword?: boolean };

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
