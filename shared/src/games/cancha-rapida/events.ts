import type { ChatMessage } from '../../chat.js';
import type { Ack, CreateAck } from '../../events.js';
import type { RoomSettings } from './settings.js';
import type { SnapshotPayload } from './snapshot.js';
import type { GoalEvent, MatchResult, RoomSnapshot, Score, Team } from './types.js';

export type { Ack, CreateAck, SocketAuth, SocketData } from '../../events.js';

export interface ClientToServerEvents {
  'room:create': (payload: { nickname: string }, ack: (res: CreateAck) => void) => void;
  'room:join': (payload: { code: string; nickname: string }, ack: (res: Ack) => void) => void;
  'room:leave': () => void;
  /** Expulsar a un jugador de la sala (solo el host); no podrá volver a entrar. */
  'room:kick': (payload: { playerId: string }, ack: (res: Ack) => void) => void;
  /** Cambiar goles o tiempo del partido (solo el host, fuera de partido). */
  'room:settings': (payload: Partial<RoomSettings>, ack: (res: Ack) => void) => void;
  'chat:send': (payload: { text: string }, ack: (res: Ack) => void) => void;
  /** Pasarse a un equipo o a espectadores (fuera de partido). */
  'team:join': (payload: { team: Team }, ack: (res: Ack) => void) => void;
  /** Mover a otro jugador de equipo (solo el host, fuera de partido). */
  'team:move': (payload: { playerId: string; team: Team }, ack: (res: Ack) => void) => void;
  'match:start': (ack: (res: Ack) => void) => void;
  /** Terminar el partido en curso sin resultados (solo el host). */
  'match:stop': () => void;
  /** Tras los resultados, volver todos a la sala (solo el host). */
  'match:again': () => void;
  /** Teclas pulsadas (máscara de bits de KEY); se manda solo cuando cambian. */
  input: (keys: number) => void;
  /** Sincroniza el reloj: el servidor responde con su hora (el cliente mide la ida y vuelta). */
  'time:sync': (ack: (serverNow: number) => void) => void;
}

export interface ServerToClientEvents {
  /** Primer evento tras conectar: identidad del jugador y, si seguía en una sala, su estado. */
  'session:ready': (payload: { sessionId: string; playerId: string; room: RoomSnapshot | null }) => void;
  /** La misma sesión se abrió en otra pestaña; esta conexión se cierra. */
  'session:replaced': () => void;
  /** El host te expulsó de la sala. */
  'room:kicked': () => void;
  'room:state': (state: RoomSnapshot) => void;
  'chat:history': (messages: ChatMessage[]) => void;
  'chat:message': (message: ChatMessage) => void;
  /** Empieza el partido: la cancha queda quieta hasta `startAt`. */
  'match:countdown': (payload: { startAt: number; serverNow: number }) => void;
  'match:snapshot': (snapshot: SnapshotPayload) => void;
  'match:goal': (payload: GoalEvent & { score: Score }) => void;
  'match:results': (result: MatchResult) => void;
  error: (payload: { message: string }) => void;
}
