import type { CarPrefs } from './cars.js';
import type { ChatMessage } from './chat.js';
import type { RoomSettings } from './settings.js';
import type { PlayerProgress, RaceResult, RoomSnapshot } from './types.js';

export type Ack = { ok: true } | { ok: false; error: string };
export type CreateAck = { ok: true; code: string } | { ok: false; error: string };

/** Lo que el cliente manda en el handshake (`io(url, { auth })`). */
export interface SocketAuth {
  /** Secreto por pestaña que identifica al jugador entre recargas. Nunca se difunde a otros. */
  sessionId?: string;
}

export interface ClientToServerEvents {
  'room:create': (payload: { nickname: string } & CarPrefs, ack: (res: CreateAck) => void) => void;
  'room:join': (payload: { code: string; nickname: string } & CarPrefs, ack: (res: Ack) => void) => void;
  'room:leave': () => void;
  /** Cambiar auto o color (solo fuera de carrera). */
  'player:customize': (payload: CarPrefs, ack: (res: Ack) => void) => void;
  /** Marcar o desmarcar "Listo" en el lobby. */
  'player:ready': (payload: { ready: boolean }, ack: (res: Ack) => void) => void;
  /** Cambiar el texto o el tiempo de la sala (solo el host, fuera de carrera). */
  'room:settings': (payload: Partial<RoomSettings>, ack: (res: Ack) => void) => void;
  'chat:send': (payload: { text: string }, ack: (res: Ack) => void) => void;
  'race:start': () => void;
  'race:progress': (payload: { correctChars: number; errors: number }) => void;
  'race:again': () => void;
}

export interface ServerToClientEvents {
  /** Primer evento tras conectar: identidad del jugador y, si seguía en una sala, su estado. */
  'session:ready': (payload: { sessionId: string; playerId: string; room: RoomSnapshot | null }) => void;
  /** La misma sesión se abrió en otra pestaña; esta conexión se cierra. */
  'session:replaced': () => void;
  'room:state': (state: RoomSnapshot) => void;
  /** Historial completo al entrar (o volver) a una sala. */
  'chat:history': (messages: ChatMessage[]) => void;
  'chat:message': (message: ChatMessage) => void;
  'race:countdown': (payload: { text: string; startAt: number; serverNow: number }) => void;
  'race:progress': (payload: { players: PlayerProgress[] }) => void;
  'race:playerFinished': (payload: { playerId: string; nickname: string; position: number }) => void;
  'race:results': (results: RaceResult[]) => void;
  error: (payload: { message: string }) => void;
}

export interface SocketData {
  sessionId: string;
  playerId: string;
}
