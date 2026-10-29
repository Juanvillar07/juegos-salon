import type { CarPrefs } from '../../cars.js';
import type { ChatMessage } from '../../chat.js';
import type { Ack, CreateAck, JoinAck } from '../../events.js';
import type { RoomSettings } from './settings.js';
import type { PlayerProgress, RaceResult, RoomSnapshot } from './types.js';

export type { Ack, CreateAck, JoinAck, SocketAuth, SocketData } from '../../events.js';

/** Respuesta a una palabra: si se acepta, el nuevo marcador del jugador. */
export type WordAck =
  | { ok: true; word: string; points: number; score: number; syllableIndex: number; finished: boolean }
  | { ok: false; error: string };

/** Respuesta a "Pasar": el marcador tras la penalización y hasta cuándo no se puede escribir. */
export type SkipAck =
  | { ok: true; score: number; syllableIndex: number; blockedUntil: number | null }
  | { ok: false; error: string };

export interface ClientToServerEvents {
  'room:create': (payload: { nickname: string } & CarPrefs, ack: (res: CreateAck) => void) => void;
  /** `password` solo si la sala la tiene (si falta o no coincide, la respuesta trae needsPassword). */
  'room:join': (
    payload: { code: string; nickname: string; password?: string } & CarPrefs,
    ack: (res: JoinAck) => void,
  ) => void;
  'room:leave': () => void;
  /** Expulsar a un jugador de la sala (solo el host); no podrá volver a entrar. */
  'room:kick': (payload: { playerId: string }, ack: (res: Ack) => void) => void;
  /** Poner o quitar (null) la contraseña de la sala (solo el host). Nunca se difunde a los demás. */
  'room:password': (payload: { password: string | null }, ack: (res: Ack) => void) => void;
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
  /** Pasar a la siguiente sílaba pagando la penalización de la sala. */
  'race:skip': (ack: (res: SkipAck) => void) => void;
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
  /** El host te expulsó de la sala. */
  'room:kicked': () => void;
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
