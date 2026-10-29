import type { PlayerStatus } from '../../types.js';
import type { Side } from './physics.js';
import type { RoomSettings } from './settings.js';

export type Team = Side | 'spectator';

/** lobby: armando equipos; playing: partido en curso; finished: resultados. */
export type MatchPhase = 'lobby' | 'playing' | 'finished';

export interface PlayerInfo {
  id: string;
  nickname: string;
  status: PlayerStatus;
  team: Team;
  /** Puesto en las instantáneas del partido en curso; null si no juega este partido. */
  slot: number | null;
  /** Goles en el partido en curso (o el último). */
  goals: number;
}

export interface Score {
  red: number;
  blue: number;
}

export interface GoalEvent {
  /** Equipo al que se le suma el gol. */
  team: Side;
  scorerId: string | null;
  scorerName: string | null;
  /** Lo metió un jugador del otro equipo en su propia portería. */
  ownGoal: boolean;
  /** Minuto de juego (ms transcurridos). */
  clockMs: number;
}

export interface MatchResult {
  score: Score;
  /** null = empate. */
  winner: Side | null;
  goals: GoalEvent[];
  durationMs: number;
  /** Quiénes jugaron, con su equipo. */
  players: { id: string; nickname: string; team: Side }[];
}

export interface RoomState {
  code: string;
  hostId: string;
  phase: MatchPhase;
  players: PlayerInfo[];
  settings: RoomSettings;
  score: Score;
  goals: GoalEvent[];
  /** Timestamp (reloj del servidor) en que termina la cuenta atrás del saque inicial. */
  startAt: number | null;
  result: MatchResult | null;
}

/** Estado de sala más la hora del servidor, para sincronizar relojes. */
export type RoomSnapshot = RoomState & { serverNow: number };
