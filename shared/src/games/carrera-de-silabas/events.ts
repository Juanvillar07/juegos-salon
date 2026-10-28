import type { CarPrefs } from '../../cars.js';
import type { ChatMessage } from '../../chat.js';
import type { Ack, CreateAck } from '../../events.js';
import type { RoomSettings } from './settings.js';
import type { PlayerProgress, RaceResult, RoomSnapshot } from './types.js';

export type { Ack, CreateAck, SocketAuth, SocketData } from '../../events.js';

/** Respuesta a una palabra: si se acepta, el nuevo marcador del jugador. */
export type WordAck =
  | { ok: true; word: string; points: number; score: number; syllableIndex: number; finished: boolean }
  | { ok: false; error: string };

export interface ClientToServerEvents {
  'room:create': (payload: { nickname: string } & CarPrefs, ack: (res: CreateAck) => void) => void;
  'room:join': (payload: { code: string; nickname: string } & CarPrefs, ack: (res: Ack) => void) => void;
  'room:leave': () => void;
  /** Cambiar auto o color (solo fuera de carrera). */
  'player:customize': (payload: CarPrefs, ack: (res: Ack) => void) => void;
  /** Marcar o desmarcar "Listo" en el lobby. */
  'player:ready': (payload: { ready: boolean }, ack: (res: Ack) => void) => void;
  /** Cambiar la meta de la sala (solo el host, fuera de carrera). */
  'room:settings': (payload: Partial<RoomSettings>, ack: (res: Ack) => void) => void;
  'chat:send': (payload: { text: string }, ack: (res: Ack) => void) => void;
  'race:start': () => void;
  /** Proponer una palabra para la sílaba actual. */
  'race:word': (payload: { word: string }, ack: (res: WordAck) => void) => void;
  /** Dejar de correr y volver al lobby de la sala, sin salir de ella. */
  'race:retire': () => void;
  /** Cancelar la carrera en curso y volver todos al lobby (solo el host). */
  'race:cancel': () => void;
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
  'race:countdown': (payload: { syllables: string[]; startAt: number; serverNow: number }) => void;
  'race:progress': (payload: { players: PlayerProgress[] }) => void;
  'race:playerFinished': (payload: { playerId: string; nickname: string; position: number }) => void;
  'race:results': (results: RaceResult[]) => void;
  error: (payload: { message: string }) => void;
}
