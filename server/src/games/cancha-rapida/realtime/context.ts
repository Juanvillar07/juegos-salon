import { performance } from 'node:perf_hooks';
import type { Namespace, Socket } from 'socket.io';
import {
  SNAPSHOT_EVERY,
  TEAM_NAMES,
  TICK_MS,
  encodeSnapshot,
  type ClientToServerEvents,
  type GoalEvent,
  type RoomSnapshot,
  type Score,
  type ServerToClientEvents,
  type SocketData,
} from '@typeracer/shared/cancha-rapida';
import { KeyedTimers } from '../../../common/KeyedTimers.js';
import { SessionRegistry } from '../../../common/SessionRegistry.js';
import type { RoomManager } from '../domain/RoomManager.js';
import type { LeaveResult, Room } from '../domain/types.js';

type InterServerEvents = Record<string, never>;
export type IO = Namespace<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export interface RealtimeOptions {
  /** Cuánto se guarda el lugar de un jugador desconectado. */
  reconnectGraceMs: number;
}

/** Si el proceso se atrasa (p. ej. una pausa larga), no se recuperan más pasos que estos de golpe. */
const MAX_CATCH_UP = 5;

/** Dependencias y operaciones compartidas por todos los handlers de Socket.IO. */
export class RealtimeContext {
  readonly sessions = new SessionRegistry();
  /** Espera de reconexión, por id de jugador. */
  readonly graceTimers = new KeyedTimers();
  /** Bucle de simulación de cada partido en curso, por código de sala. */
  private loops = new Map<string, NodeJS.Timeout>();
  /** Tiempo medio de un paso de simulación (ms), para vigilar cuánta CPU gasta el juego. */
  tickMs = 0;

  constructor(
    readonly io: IO,
    readonly manager: RoomManager,
    readonly options: RealtimeOptions,
  ) {}

  snapshot(room: Room): RoomSnapshot {
    return { ...this.manager.toState(room), serverNow: Date.now() };
  }

  broadcastState(room: Room): void {
    this.io.to(room.code).emit('room:state', this.snapshot(room));
  }

  announce(code: string, text: string): void {
    const message = this.manager.postSystemMessage(code, text);
    if (message) this.io.to(code).emit('chat:message', message);
  }

  /** Empieza el partido: avisa la cuenta atrás y arranca su bucle. Se llama tras startMatch. */
  launchMatch(room: Room): void {
    this.io.to(room.code).emit('match:countdown', { startAt: room.startAt!, serverNow: Date.now() });
    this.broadcastState(room);
    this.startLoop(room);
  }

  /**
   * Bucle de simulación: TICK_HZ pasos por segundo con un acumulador (los temporizadores de
   * Node no son exactos) y, como mucho, una instantánea por vuelta cada SNAPSHOT_EVERY pasos.
   * Las instantáneas van como `volatile`: si un cliente va atrasado se descartan en vez de
   * acumularse, y la siguiente ya trae la posición buena.
   */
  private startLoop(room: Room): void {
    const { code, matchId } = room;
    this.stopLoop(code);
    let last = performance.now();
    let pending = 0;
    const timer = setInterval(() => {
      const current = this.manager.getRoom(code);
      const match = current?.match;
      if (!current || current.matchId !== matchId || !match) return this.stopLoop(code);

      const now = performance.now();
      pending = Math.min(pending + (now - last), TICK_MS * MAX_CATCH_UP);
      last = now;
      let snapshotDue = false;
      while (pending >= TICK_MS) {
        pending -= TICK_MS;
        const started = performance.now();
        const events = match.step();
        this.recordTick(performance.now() - started);
        if (match.tick % SNAPSHOT_EVERY === 0) snapshotDue = true;
        if (events.goal) {
          this.io.to(code).emit('match:goal', { ...events.goal, score: { ...match.score } });
          this.announce(code, goalNotice(events.goal, match.score));
          this.broadcastState(current);
        }
        if (events.ended) return this.finishMatch(code);
      }
      if (snapshotDue) {
        this.io
          .to(code)
          .volatile.emit('match:snapshot', encodeSnapshot(match.world, match.slots, match.tick, Date.now(), match.clockMs));
      }
    }, TICK_MS);
    this.loops.set(code, timer);
  }

  private recordTick(ms: number): void {
    // Media móvil: reacciona en unos segundos sin guardar historial.
    this.tickMs = this.tickMs === 0 ? ms : this.tickMs * 0.99 + ms * 0.01;
  }

  stopLoop(code: string): void {
    const timer = this.loops.get(code);
    if (timer) clearInterval(timer);
    this.loops.delete(code);
  }

  finishMatch(code: string): void {
    this.stopLoop(code);
    const result = this.manager.endMatch(code);
    const room = this.manager.getRoom(code);
    if (!result || !room) return;
    this.io.to(code).emit('match:results', result);
    this.broadcastState(room);
  }

  /** Vuelve todos a la sala sin resultados (lo terminó el host o no queda nadie en la cancha). */
  returnToLobby(room: Room, notice: string): void {
    this.stopLoop(room.code);
    this.announce(room.code, notice);
    this.broadcastState(room);
  }

  /** Saca definitivamente a un jugador de su sala y avisa a los demás (con `notice`, si se da). */
  removePlayer(playerId: string, notice?: string): LeaveResult {
    const nickname = this.manager.getRoomOfPlayer(playerId)?.players.get(playerId)?.nickname;
    const result = this.manager.leaveRoom(playerId);
    const { room } = result;
    if (!room) return result;

    for (const socket of this.io.sockets.values()) {
      if (socket.data.playerId === playerId) socket.leave(room.code);
    }
    if (result.roomDeleted) {
      this.stopLoop(room.code);
      return result;
    }
    this.announce(room.code, notice ?? `${nickname} salió de la sala`);
    if (result.matchEmpty && this.manager.abortMatch(room.code)) {
      this.returnToLobby(room, 'Ya no queda nadie en la cancha: se terminó el partido');
    } else {
      this.broadcastState(room);
    }
    return result;
  }

  dispose(): void {
    for (const code of [...this.loops.keys()]) this.stopLoop(code);
    this.graceTimers.clearAll();
  }
}

/** Aviso del gol en el chat: "Gol de Ana para Rojo · 2–1". */
function goalNotice(goal: GoalEvent, score: Score): string {
  const who = goal.scorerName ? (goal.ownGoal ? `Autogol de ${goal.scorerName}` : `Gol de ${goal.scorerName}`) : 'Gol';
  return `${who} para ${TEAM_NAMES[goal.team]} · ${score.red}–${score.blue}`;
}
