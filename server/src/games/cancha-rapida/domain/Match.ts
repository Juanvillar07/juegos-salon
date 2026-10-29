import {
  GOAL_PAUSE_MS,
  TICK_MS,
  createWorld,
  detectGoal,
  resetKickoff,
  setKeys,
  stepWorld,
  type GoalEvent,
  type RoomSettings,
  type Score,
  type Side,
  type World,
} from '@typeracer/shared/cancha-rapida';

export interface MatchPlayer {
  id: string;
  nickname: string;
  team: Side;
}

/** Lo que pasó en un paso: un gol, o el final del partido. */
export interface StepEvents {
  goal?: GoalEvent;
  ended?: boolean;
}

/**
 * Un partido: la física de la cancha más las reglas (marcador, reloj, pausa tras el gol y fin).
 * Avanza de a un paso (TICK_MS) y no sabe de relojes reales ni de sockets, así se puede probar
 * paso a paso; el bucle de tiempo real lo llama TICK_HZ veces por segundo.
 */
export class Match {
  readonly world: World;
  /** Puesto de cada jugador en las instantáneas (no se reutiliza si alguien se va). */
  readonly slots = new Map<string, number>();
  readonly players: MatchPlayer[];
  tick = 0;
  score: Score = { red: 0, blue: 0 };
  goals: GoalEvent[] = [];
  ended = false;
  /** Pasos de juego (sin la cuenta atrás ni las pausas de gol): el reloj del partido. */
  private played = 0;
  /** Pasos que quedan con la cancha quieta (cuenta atrás del saque inicial). */
  private frozen: number;
  /** Pasos que quedan de celebración tras un gol (la jugada sigue, pero no cuenta). */
  private celebrating = 0;
  private readonly limitTicks: number;

  constructor(
    players: MatchPlayer[],
    private readonly settings: RoomSettings,
    countdownMs: number,
  ) {
    this.players = players;
    players.forEach((p, i) => this.slots.set(p.id, i));
    this.world = createWorld(players);
    this.frozen = Math.round(countdownMs / TICK_MS);
    this.limitTicks = Math.round((settings.timeLimitMin * 60_000) / TICK_MS);
  }

  get clockMs(): number {
    return this.played * TICK_MS;
  }

  /** Teclas de un jugador; se ignoran si no juega (o ya se fue). */
  setKeys(playerId: string, keys: number): void {
    const body = this.world.players.find((p) => p.id === playerId);
    if (body) setKeys(body, keys);
  }

  /** Saca a un jugador de la cancha (se fue de la sala). */
  removePlayer(playerId: string): void {
    const i = this.world.players.findIndex((p) => p.id === playerId);
    if (i >= 0) this.world.players.splice(i, 1);
    if (this.world.lastTouch === playerId) this.world.lastTouch = null;
  }

  get playersOnPitch(): number {
    return this.world.players.length;
  }

  step(): StepEvents {
    if (this.ended) return {};
    this.tick++;
    if (this.frozen > 0) {
      this.frozen--;
      return {};
    }
    stepWorld(this.world);

    if (this.celebrating > 0) {
      this.celebrating--;
      if (this.celebrating > 0) return {};
      if (this.scoreLimitReached()) return this.end();
      resetKickoff(this.world);
      return {};
    }

    this.played++;
    const side = detectGoal(this.world);
    if (side) return { goal: this.scoreGoal(side) };
    if (this.played >= this.limitTicks) return this.end();
    return {};
  }

  private scoreGoal(team: Side): GoalEvent {
    const scorer = this.players.find((p) => p.id === this.world.lastTouch) ?? null;
    const goal: GoalEvent = {
      team,
      scorerId: scorer?.id ?? null,
      scorerName: scorer?.nickname ?? null,
      ownGoal: scorer !== null && scorer.team !== team,
      clockMs: this.clockMs,
    };
    this.score[team]++;
    this.goals.push(goal);
    this.celebrating = Math.round(GOAL_PAUSE_MS / TICK_MS);
    return goal;
  }

  private scoreLimitReached(): boolean {
    const limit = this.settings.scoreLimit;
    return limit > 0 && Math.max(this.score.red, this.score.blue) >= limit;
  }

  private end(): StepEvents {
    this.ended = true;
    return { ended: true };
  }
}
