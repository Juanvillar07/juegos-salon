import type { ChatMessage, PlayerStatus } from '@typeracer/shared';
import type { MatchPhase, MatchResult, RoomSettings, Team } from '@typeracer/shared/cancha-rapida';
import type { Match } from './Match.js';

export interface Player {
  id: string;
  nickname: string;
  status: PlayerStatus;
  team: Team;
  /** Último mensaje de chat, para limitar la frecuencia. */
  lastChatAt: number | null;
}

export interface Room {
  code: string;
  hostId: string;
  phase: MatchPhase;
  /** Map conserva el orden de llegada, que se usa para elegir nuevo host. */
  players: Map<string, Player>;
  settings: RoomSettings;
  /** Partido en curso (fase playing). */
  match: Match | null;
  /** Se incrementa en cada partido para invalidar bucles y temporizadores viejos. */
  matchId: number;
  /** Fin de la cuenta atrás del saque inicial (reloj del servidor). */
  startAt: number | null;
  result: MatchResult | null;
  chat: ChatMessage[];
  chatSeq: number;
  /** Jugadores expulsados por el host: no pueden volver a entrar. */
  banned: Set<string>;
}

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface LeaveResult {
  room: Room | null;
  roomDeleted: boolean;
  hostChanged: boolean;
  /** El partido seguía y ya no queda nadie en la cancha: se cancela. */
  matchEmpty: boolean;
}
