import type { PlayerStatus } from '../../types.js';
import type { TeamKit } from './kits.js';
import type { Side } from './physics.js';
import type { RoomSettings } from './settings.js';

export type Team = Side | 'spectator';

/** lobby: armando equipos; playing: partido en curso; finished: resultados. */
export type MatchPhase = 'lobby' | 'playing' | 'finished';

/** Tramo del partido: tiempo normal, gol de oro (prórroga) o tanda de penaltis. */
export type MatchStage = 'regular' | 'goldenGoal' | 'penalties';

/** Lo que lleva cada jugador en esta sala (para repartir equipos equilibrados). */
export interface PlayerRecord {
  played: number;
  wins: number;
  goals: number;
}

export interface PlayerInfo {
  id: string;
  nickname: string;
  status: PlayerStatus;
  team: Team;
  /** Puesto en las instantáneas del partido en curso; null si no juega este partido. */
  slot: number | null;
  /** Goles en el partido en curso (o el último). */
  goals: number;
  record: PlayerRecord;
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

/** Tanda de penaltis en curso: lanzamientos de cada equipo (true = gol) y quién tira y ataja ahora. */
export interface PenaltyState {
  shots: Record<Side, boolean[]>;
  /** Equipo que tira ahora. */
  team: Side;
  shooterId: string | null;
  keeperId: string | null;
  /** El que tira ya pateó: el arquero puede salir de la línea y el que tira ya no se mueve. */
  shotTaken: boolean;
  /** Hora del servidor en que se acaba el tiempo para tirar (null si ya tiró o se muestra el resultado). */
  deadline: number | null;
}

export interface MatchResult {
  score: Score;
  /** null = empate. */
  winner: Side | null;
  goals: GoalEvent[];
  durationMs: number;
  /** Quiénes jugaron, con su equipo. */
  players: { id: string; nickname: string; team: Side }[];
  /** Cómo se decidió un empate al acabar el tiempo (null si no hizo falta). */
  tiebreak: 'goldenGoal' | 'penalties' | null;
  /** Lanzamientos de la tanda, si la hubo. */
  penalties: Record<Side, boolean[]> | null;
}

export interface RoomState {
  code: string;
  hostId: string;
  phase: MatchPhase;
  players: PlayerInfo[];
  settings: RoomSettings;
  /** Uniforme de cada equipo (lo elige el host). */
  kits: Record<Side, TeamKit>;
  score: Score;
  goals: GoalEvent[];
  /** Timestamp (reloj del servidor) en que termina la cuenta atrás del saque inicial. */
  startAt: number | null;
  /** Tramo del partido en curso (null fuera de partido). */
  stage: MatchStage | null;
  penalties: PenaltyState | null;
  result: MatchResult | null;
}

/** Estado de sala más la hora del servidor, para sincronizar relojes. */
export type RoomSnapshot = RoomState & { serverNow: number };
