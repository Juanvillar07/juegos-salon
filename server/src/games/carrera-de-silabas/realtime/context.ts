import type { Namespace, Socket } from 'socket.io';
import {
  RACE_LIMIT_MS,
  type ClientToServerEvents,
  type RoomSnapshot,
  type ServerToClientEvents,
  type SocketData,
} from '@typeracer/shared/carrera-de-silabas';
import type { RoomManager } from '../domain/RoomManager.js';
import type { AutoStartDecision, LeaveResult, RaceOutcome, Room } from '../domain/types.js';
import { KeyedTimers } from '../../../common/KeyedTimers.js';
import { SessionRegistry } from '../../../common/SessionRegistry.js';

type InterServerEvents = Record<string, never>;
/** El juego vive en su propio namespace de Socket.IO (p. ej. /carrera-de-silabas). */
export type IO = Namespace<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export interface RealtimeOptions {
  /** Cuánto se guarda el lugar de un jugador desconectado. */
  reconnectGraceMs: number;
}

/** Dependencias y operaciones compartidas por todos los handlers de Socket.IO. */
export class RealtimeContext {
  readonly sessions = new SessionRegistry();
  /** Fin de carrera por límite de tiempo, por código de sala. */
  readonly raceTimers = new KeyedTimers();
  /** Espera de reconexión, por id de jugador. */
  readonly graceTimers = new KeyedTimers();
  /** Salida automática cuando la mayoría está lista, por código de sala. */
  readonly autoStartTimers = new KeyedTimers();

  constructor(
    readonly io: IO,
    readonly manager: RoomManager,
    readonly options: RealtimeOptions,
  ) {}

  snapshot(room: Room): RoomSnapshot {
    return { ...this.manager.toState(room), serverNow: Date.now() };
  }

  /**
   * Envía el estado a toda la sala. Antes revisa la salida automática: cualquier cambio
   * (alguien se marca listo, entra o sale) puede arrancar, programar o cancelar la carrera.
   */
  broadcastState(room: Room): void {
    // Si arrancó la carrera, launchRace ya envió el estado nuevo.
    if (this.syncAutoStart(room) === 'start') return;
    this.io.to(room.code).emit('room:state', this.snapshot(room));
  }

  /** Publica un aviso del sistema en el chat de la sala. */
  announce(code: string, text: string): void {
    const message = this.manager.postSystemMessage(code, text);
    if (message) this.io.to(code).emit('chat:message', message);
  }

  /** Avisa la salida (semáforo de 3 s) a todos y programa el fin por tiempo. Se llama tras beginRace. */
  launchRace(room: Room): void {
    this.autoStartTimers.clear(room.code);
    this.io.to(room.code).emit('race:countdown', {
      syllables: room.syllables!,
      startAt: room.startAt!,
      serverNow: Date.now(),
    });
    this.broadcastState(room);
    this.scheduleRaceEnd(room);
  }

  private syncAutoStart(room: Room): AutoStartDecision {
    const decision = this.manager.refreshAutoStart(room);
    if (decision === 'start') {
      this.startAutomatically(room.code, '¡Todos listos! Arranca la carrera');
    } else if (decision === 'scheduled') {
      this.autoStartTimers.set(room.code, room.autoStartAt! - Date.now(), () => {
        // Solo si la salida sigue programada (nadie la canceló ni el host empezó antes).
        if (this.manager.getRoom(room.code)?.autoStartAt == null) return;
        this.startAutomatically(room.code, 'Se acabó la espera: arranca la carrera');
      });
    } else if (decision === 'cancelled') {
      this.autoStartTimers.clear(room.code);
    }
    return decision;
  }

  private startAutomatically(code: string, notice: string): void {
    const res = this.manager.startRaceAuto(code);
    if (!res.ok) return;
    this.announce(code, notice);
    this.launchRace(res.room);
  }

  finishRace(code: string): void {
    this.raceTimers.clear(code);
    const results = this.manager.endRace(code);
    const room = this.manager.getRoom(code);
    if (!results || !room) return;
    this.io.to(code).emit('race:results', results);
    this.broadcastState(room);
  }

  /** Vuelve todos al lobby sin resultados (cancelada por el host o porque ya nadie corre). */
  returnToLobby(room: Room, notice: string): void {
    this.raceTimers.clear(room.code);
    // El aviso va antes que el estado: quien sigue en la pista lo ve como notificación.
    this.announce(room.code, notice);
    this.broadcastState(room);
  }

  /** Tras una salida o un retiro: la carrera sigue, termina con resultados o se cancela. */
  settleRace(room: Room, race: RaceOutcome): void {
    if (race === 'over') return this.finishRace(room.code);
    if (race === 'cancelled' && this.manager.abortRace(room.code)) {
      return this.returnToLobby(room, 'Ya nadie sigue en carrera: se canceló');
    }
    this.broadcastState(room);
  }

  /** Programa el fin de la carrera por el límite de seguridad (si no llegan todos a la meta). */
  scheduleRaceEnd(room: Room): void {
    const { code, raceId } = room;
    const ms = room.startAt! - Date.now() + RACE_LIMIT_MS;
    this.raceTimers.set(code, ms, () => {
      if (this.manager.getRoom(code)?.raceId === raceId) this.finishRace(code);
    });
  }

  /** Saca definitivamente a un jugador de su sala y avisa a los demás. */
  removePlayer(playerId: string): LeaveResult {
    const nickname = this.manager.getRoomOfPlayer(playerId)?.players.get(playerId)?.nickname;
    const result = this.manager.leaveRoom(playerId);
    const { room } = result;
    if (!room) return result;

    for (const socket of this.io.sockets.values()) {
      if (socket.data.playerId === playerId) socket.leave(room.code);
    }
    if (result.roomDeleted) {
      this.raceTimers.clear(room.code);
      this.autoStartTimers.clear(room.code);
      return result;
    }
    this.announce(room.code, room.phase === 'racing' ? `${nickname} abandonó la carrera` : `${nickname} salió de la sala`);
    this.settleRace(room, result.race);
    return result;
  }

  dispose(): void {
    this.raceTimers.clearAll();
    this.graceTimers.clearAll();
    this.autoStartTimers.clearAll();
  }
}
