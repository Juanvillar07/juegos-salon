import {
  GOAL_PAUSE_MS,
  PENALTY_ROUNDS,
  TICK_MS,
  createWorld,
  detectGoal,
  resetKickoff,
  setKeys,
  setupPenalty,
  stepWorld,
  type GoalEvent,
  type MatchStage,
  type PenaltyState,
  type PlayerBody,
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

/** Lo que pasó en un paso: un gol, un cambio de tramo, un penalti o el final del partido. */
export interface StepEvents {
  goal?: GoalEvent;
  ended?: boolean;
  /** Empieza el gol de oro o la tanda de penaltis. */
  stage?: MatchStage;
  /** Se resolvió un penalti. */
  penalty?: { team: Side; scored: boolean; shooterName: string };
  /** Hay un penalti nuevo preparado (cambian el que tira y el arquero). */
  penaltySetup?: boolean;
}

/** Tiempo para tirar el penalti; si no, cuenta como fallado. */
const PENALTY_SHOT_TICKS = Math.round(6000 / TICK_MS);
/** Pausa antes de cada penalti (para ver quién tira) y después (para ver el resultado). */
const PENALTY_READY_TICKS = Math.round(1000 / TICK_MS);
const PENALTY_RESULT_TICKS = Math.round(1500 / TICK_MS);
/** Si el arquero la toca y no entra en este tiempo, es parada. */
const KEEPER_SAVE_TICKS = 40;

interface PenaltyRun {
  shots: Record<Side, boolean[]>;
  team: Side;
  shooterId: string | null;
  keeperId: string | null;
  /** Pasos desde que se preparó el penalti. */
  ticks: number;
  /** Paso en que el que tira tocó el balón (solo tiene un toque). */
  shotAt: number | null;
  keeperTouchAt: number | null;
  /** Pasos que quedan mostrando el resultado antes del siguiente. */
  pause: number;
}

const other = (side: Side): Side => (side === 'red' ? 'blue' : 'red');

/**
 * Un partido: la física de la cancha más las reglas (marcador, reloj, pausa tras el gol, fin y
 * desempate). Avanza de a un paso (TICK_MS) y no sabe de relojes reales ni de sockets, así se
 * puede probar paso a paso; el bucle de tiempo real lo llama TICK_HZ veces por segundo.
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
  stage: MatchStage = 'regular';
  /** Ganador de la tanda de penaltis (el marcador sigue empatado). */
  penaltyWinner: Side | null = null;
  /** Pasos de juego (sin la cuenta atrás ni las pausas de gol): el reloj del partido. */
  private played = 0;
  /** Pasos que quedan con la cancha quieta (cuenta atrás del saque o antes de un penalti). */
  private frozen: number;
  /** Pasos que quedan de celebración tras un gol (la jugada sigue, pero no cuenta). */
  private celebrating = 0;
  /** Equipo que recibió el último gol: saca al volver al centro. */
  private nextKickoff: Side = 'red';
  private readonly limitTicks: number;
  /** En los penaltis la cancha solo tiene a dos: aquí siguen todos, para ir rotando. */
  private bodies: PlayerBody[] = [];
  private penalty: PenaltyRun | null = null;
  /** Siguiente que tira y que ataja de cada equipo. */
  private shooterTurn: Record<Side, number> = { red: 0, blue: 0 };
  private keeperTurn: Record<Side, number> = { red: 0, blue: 0 };

  constructor(
    players: MatchPlayer[],
    private readonly settings: RoomSettings,
    countdownMs: number,
  ) {
    this.players = players;
    players.forEach((p, i) => this.slots.set(p.id, i));
    this.world = createWorld(players, { chargedShot: settings.chargedShot });
    this.frozen = Math.round(countdownMs / TICK_MS);
    this.limitTicks = Math.round((settings.timeLimitMin * 60_000) / TICK_MS);
  }

  get clockMs(): number {
    return this.played * TICK_MS;
  }

  /** La tanda de penaltis, para el estado de la sala. */
  get penaltyState(): PenaltyState | null {
    const pen = this.penalty;
    if (!pen) return null;
    return {
      shots: { red: [...pen.shots.red], blue: [...pen.shots.blue] },
      team: pen.team,
      shooterId: pen.shooterId,
      keeperId: pen.keeperId,
    };
  }

  /** Teclas de un jugador; se ignoran si no está en la cancha (o ya tiró su penalti). */
  setKeys(playerId: string, keys: number): void {
    const pen = this.penalty;
    if (pen && pen.shotAt !== null && playerId === pen.shooterId) return;
    const body = this.world.players.find((p) => p.id === playerId);
    if (body) setKeys(body, keys, this.world.chargedShot);
  }

  /** Saca a un jugador de la cancha (se fue de la sala). */
  removePlayer(playerId: string): void {
    for (const list of [this.world.players, this.bodies]) {
      const i = list.findIndex((p) => p.id === playerId);
      if (i >= 0) list.splice(i, 1);
    }
    if (this.world.lastTouch === playerId) this.world.lastTouch = null;
  }

  get playersOnPitch(): number {
    return this.stage === 'penalties' ? this.bodies.length : this.world.players.length;
  }

  step(): StepEvents {
    if (this.ended) return {};
    this.tick++;
    if (this.frozen > 0) {
      this.frozen--;
      return {};
    }
    if (this.stage === 'penalties') return this.stepPenalty();
    stepWorld(this.world);

    if (this.celebrating > 0) {
      this.celebrating--;
      if (this.celebrating > 0) return {};
      // Con gol de oro, el primer gol de la prórroga gana.
      if (this.stage === 'goldenGoal' || this.scoreLimitReached()) return this.end();
      resetKickoff(this.world, this.nextKickoff);
      return {};
    }

    this.played++;
    const side = detectGoal(this.world);
    if (side) return { goal: this.scoreGoal(side) };
    if (this.stage === 'regular' && this.played >= this.limitTicks) return this.timeUp();
    return {};
  }

  /** Se acabó el tiempo: fin, o desempate si hay empate y la sala lo pide (y hay dos equipos). */
  private timeUp(): StepEvents {
    const tied = this.score.red === this.score.blue;
    const tiebreak = this.settings.tiebreak;
    if (!tied || tiebreak === 'draw' || !this.bothTeamsPlaying()) return this.end();
    if (tiebreak === 'goldenGoal') {
      this.stage = 'goldenGoal';
      return { stage: 'goldenGoal' };
    }
    this.stage = 'penalties';
    this.bodies = [...this.world.players];
    this.penalty = {
      shots: { red: [], blue: [] },
      team: 'red',
      shooterId: null,
      keeperId: null,
      ticks: 0,
      shotAt: null,
      keeperTouchAt: null,
      pause: 0,
    };
    if (!this.setupPenalty('red')) return this.end();
    return { stage: 'penalties', penaltySetup: true };
  }

  private bothTeamsPlaying(): boolean {
    return (['red', 'blue'] as const).every((team) => this.world.players.some((p) => p.team === team));
  }

  /** Coloca el siguiente penalti de `team` (rotando quién tira y quién ataja). */
  private setupPenalty(team: Side): boolean {
    const pen = this.penalty!;
    const shooters = this.bodies.filter((p) => p.team === team);
    const keepers = this.bodies.filter((p) => p.team === other(team));
    if (shooters.length === 0 || keepers.length === 0) return false;
    const shooter = shooters[this.shooterTurn[team]++ % shooters.length];
    const keeper = keepers[this.keeperTurn[other(team)]++ % keepers.length];
    setupPenalty(this.world, shooter, keeper, team);
    Object.assign(pen, { team, shooterId: shooter.id, keeperId: keeper.id, ticks: 0, shotAt: null, keeperTouchAt: null, pause: 0 });
    this.frozen = PENALTY_READY_TICKS;
    return true;
  }

  private stepPenalty(): StepEvents {
    const pen = this.penalty!;
    stepWorld(this.world);
    if (pen.pause > 0) {
      // El balón sigue su camino mientras se muestra el resultado.
      pen.pause--;
      if (pen.pause > 0) return {};
      const winner = this.decidePenalties();
      if (winner) {
        this.penaltyWinner = winner;
        return this.end();
      }
      if (!this.setupPenalty(other(pen.team))) return this.end();
      return { penaltySetup: true };
    }

    pen.ticks++;
    const { world } = this;
    if (pen.shotAt === null && world.lastTouch === pen.shooterId) {
      // Un solo toque: después, el que tira ya no se mueve.
      pen.shotAt = pen.ticks;
      const shooter = world.players.find((p) => p.id === pen.shooterId);
      if (shooter) Object.assign(shooter, { keys: 0, charge: 0, pendingKick: null });
    }
    if (pen.keeperTouchAt === null && world.lastTouch === pen.keeperId) pen.keeperTouchAt = pen.ticks;

    const scored = this.penaltyOutcome(pen);
    if (scored === null) return {};
    pen.shots[pen.team].push(scored);
    pen.pause = PENALTY_RESULT_TICKS;
    const shooterName = this.players.find((p) => p.id === pen.shooterId)?.nickname ?? '';
    return { penalty: { team: pen.team, scored, shooterName } };
  }

  /** true = gol, false = fallado o parado, null = sigue en juego. */
  private penaltyOutcome(pen: PenaltyRun): boolean | null {
    const goal = detectGoal(this.world);
    if (goal) return goal === pen.team;
    if (pen.shotAt === null) return pen.ticks >= PENALTY_SHOT_TICKS ? false : null;
    const { ball } = this.world;
    const towardGoal = pen.team === 'red' ? ball.vx : -ball.vx;
    const sinceShot = pen.ticks - pen.shotAt;
    if (Math.hypot(ball.vx, ball.vy) < 0.15) return false;
    // Rechazado (por el arquero o un poste): ya no va hacia la portería.
    if (sinceShot > 5 && towardGoal <= 0) return false;
    if (pen.keeperTouchAt !== null && pen.ticks - pen.keeperTouchAt > KEEPER_SAVE_TICKS) return false;
    return null;
  }

  /**
   * Ganador de la tanda, si ya está decidida: en las primeras rondas, cuando el rival ya no puede
   * alcanzarlo; después, en muerte súbita, al cerrar cada par de lanzamientos con distinto resultado.
   */
  private decidePenalties(): Side | null {
    const { red, blue } = this.penalty!.shots;
    const goals = (shots: boolean[]) => shots.filter(Boolean).length;
    const [rg, bg] = [goals(red), goals(blue)];
    if (red.length <= PENALTY_ROUNDS && blue.length <= PENALTY_ROUNDS) {
      if (rg > bg + (PENALTY_ROUNDS - blue.length)) return 'red';
      if (bg > rg + (PENALTY_ROUNDS - red.length)) return 'blue';
      return null;
    }
    if (red.length === blue.length && rg !== bg) return rg > bg ? 'red' : 'blue';
    return null;
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
    this.nextKickoff = team === 'red' ? 'blue' : 'red';
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
