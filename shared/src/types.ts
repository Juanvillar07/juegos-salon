import type { CarModel } from './cars.js';
import type { RoomSettings } from './settings.js';

export type RoomPhase = 'lobby' | 'racing' | 'finished';

/**
 * - connected: jugando normalmente.
 * - reconnecting: perdió la conexión; el servidor le guarda el lugar durante RECONNECT_GRACE_MS.
 * - left: abandonó la carrera; se conserva solo para mostrar su carrito y su resultado.
 */
export type PlayerStatus = 'connected' | 'reconnecting' | 'left';

export interface PlayerInfo {
  id: string;
  nickname: string;
  color: string;
  car: CarModel;
  status: PlayerStatus;
  /** Marcó "Listo" en el lobby. */
  ready: boolean;
  /** Caracteres correctos confirmados por el servidor. */
  progress: number;
  wpm: number;
  /** Posición de llegada (1, 2, 3…) o null si no ha terminado. */
  position: number | null;
}

export interface RaceResult {
  playerId: string;
  nickname: string;
  color: string;
  car: CarModel;
  status: PlayerStatus;
  /** null = no terminó (DNF). */
  position: number | null;
  wpm: number;
  /** Porcentaje 0–100. */
  accuracy: number;
  progress: number;
}

export interface RoomState {
  code: string;
  hostId: string;
  phase: RoomPhase;
  players: PlayerInfo[];
  text: string | null;
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
  progress: number;
  wpm: number;
}
