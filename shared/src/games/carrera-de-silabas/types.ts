import type { CarModel } from '../../cars.js';
import type { PlayerStatus, RoomPhase } from '../../types.js';
import type { RoomSettings } from './settings.js';

export interface PlayerInfo {
  id: string;
  nickname: string;
  color: string;
  car: CarModel;
  status: PlayerStatus;
  /** Marcó "Listo" en el lobby. */
  ready: boolean;
  score: number;
  /** Palabras aceptadas en esta carrera. */
  words: number;
  /** Índice de la sílaba que le toca dentro de `RoomState.syllables`. */
  syllableIndex: number;
  /** Posición de llegada (1, 2, 3…) o null si no ha llegado a la meta. */
  position: number | null;
  /** Volvió a la sala durante la carrera: ya no corre (su auto queda en la pista) y ve el lobby. */
  retired: boolean;
}

export interface RaceResult {
  playerId: string;
  nickname: string;
  color: string;
  car: CarModel;
  status: PlayerStatus;
  /** null = no llegó a la meta. */
  position: number | null;
  /** Volvió a la sala antes de que terminara la carrera. */
  retired: boolean;
  score: number;
  words: number;
  longestWord: string | null;
}

export interface RoomState {
  code: string;
  hostId: string;
  phase: RoomPhase;
  players: PlayerInfo[];
  /** Secuencia de sílabas de la carrera; es la misma para todos los jugadores. */
  syllables: string[] | null;
  /** Timestamp (reloj del servidor) en que arranca la carrera. */
  startAt: number | null;
  /** Timestamp (reloj del servidor) del límite de tiempo. */
  endsAt: number | null;
  results: RaceResult[] | null;
  settings: RoomSettings;
  /** Timestamp (reloj del servidor) de la salida automática, si está programada. */
  autoStartAt: number | null;
}

/** Estado de sala más la hora del servidor, para sincronizar relojes. */
export type RoomSnapshot = RoomState & { serverNow: number };

export interface PlayerProgress {
  id: string;
  score: number;
  words: number;
  syllableIndex: number;
}

/** Una palabra aceptada, para el registro de jugadas que ven todos. */
export interface WordPlay {
  playerId: string;
  nickname: string;
  color: string;
  word: string;
  syllable: string;
  points: number;
}
