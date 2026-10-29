import {
  CHAT_COOLDOWN_MS,
  CHAT_HISTORY_SIZE,
  COUNTDOWN_MS,
  MAX_NICKNAME_LENGTH,
  cleanChatText,
  type ChatMessage,
} from '@typeracer/shared';
import {
  DEFAULT_SETTINGS,
  MAX_PER_TEAM,
  MAX_ROOM_PLAYERS,
  TEAM_COLORS,
  TEAM_NAMES,
  isValidKeys,
  validateScoreLimit,
  validateTimeLimit,
  type MatchResult,
  type RoomSettings,
  type RoomState,
  type Side,
  type Team,
} from '@typeracer/shared/cancha-rapida';
import { generateRoomCode, normalizeRoomCode } from '../../../common/roomCode.js';
import { Match } from './Match.js';
import type { LeaveResult, Player, Result, Room } from './types.js';

export interface RoomManagerOptions {
  now?: () => number;
  generateCode?: () => string;
  /** Cuenta atrás antes del saque inicial. */
  countdownMs?: number;
}

const TEAMS: readonly Team[] = ['red', 'blue', 'spectator'];

function cleanNickname(nickname: string): string | null {
  const clean = nickname.trim().slice(0, MAX_NICKNAME_LENGTH);
  return clean.length > 0 ? clean : null;
}

/**
 * Salas y partidos de Cancha Rápida, sin dependencias de Socket.IO. Salas, chat, expulsar y
 * reconexión funcionan como en los otros juegos; lo propio son los equipos y el partido
 * (Match), que la capa de tiempo real hace avanzar paso a paso.
 */
export class RoomManager {
  private rooms = new Map<string, Room>();
  private playerRoom = new Map<string, string>();
  private now: () => number;
  private generateCode: () => string;
  private countdownMs: number;

  constructor(options: RoomManagerOptions = {}) {
    this.now = options.now ?? Date.now;
    this.generateCode = options.generateCode ?? generateRoomCode;
    this.countdownMs = options.countdownMs ?? COUNTDOWN_MS;
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  /** Salas con un partido en marcha (cada una tiene su bucle de simulación). */
  get activeMatches(): number {
    return [...this.rooms.values()].filter((r) => r.phase === 'playing').length;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(normalizeRoomCode(code));
  }

  getRoomOfPlayer(playerId: string): Room | undefined {
    const code = this.playerRoom.get(playerId);
    return code ? this.rooms.get(code) : undefined;
  }

  // ---------------------------------------------------------------- salas

  createRoom(playerId: string, nickname: string): Result<{ room: Room }> {
    const name = cleanNickname(nickname);
    if (!name) return { ok: false, error: 'El nickname no puede estar vacío' };
    if (this.playerRoom.has(playerId)) return { ok: false, error: 'Ya estás en una sala' };

    let code = this.generateCode();
    for (let tries = 0; this.rooms.has(code); tries++) {
      if (tries > 50) return { ok: false, error: 'No se pudo generar un código de sala' };
      code = this.generateCode();
    }

    const room: Room = {
      code,
      hostId: playerId,
      phase: 'lobby',
      players: new Map(),
      settings: { ...DEFAULT_SETTINGS },
      match: null,
      matchId: 0,
      startAt: null,
      result: null,
      chat: [],
      chatSeq: 0,
      banned: new Set(),
    };
    this.rooms.set(code, room);
    this.addPlayer(room, playerId, name);
    return { ok: true, room };
  }

  joinRoom(code: string, playerId: string, nickname: string): Result<{ room: Room }> {
    const name = cleanNickname(nickname);
    if (!name) return { ok: false, error: 'El nickname no puede estar vacío' };
    const room = this.getRoom(code);
    if (!room) return { ok: false, error: 'La sala no existe' };

    const current = this.playerRoom.get(playerId);
    if (current === room.code) {
      // Ya estaba dentro (p. ej. volvió tras recargar): solo se marca como conectado.
      this.reconnect(playerId);
      return { ok: true, room };
    }
    if (current) return { ok: false, error: 'Ya estás en otra sala' };
    if (room.banned.has(playerId)) return { ok: false, error: 'El host te expulsó de esta sala' };
    if (room.players.size >= MAX_ROOM_PLAYERS) {
      return { ok: false, error: `La sala está llena (máximo ${MAX_ROOM_PLAYERS})` };
    }
    this.addPlayer(room, playerId, name);
    return { ok: true, room };
  }

  /** El host expulsa a un jugador: queda vetado en la sala. La salida la hace la capa de tiempo real. */
  kick(hostId: string, targetId: unknown): Result<{ room: Room; nickname: string }> {
    const room = this.getRoomOfPlayer(hostId);
    if (!room) return { ok: false, error: 'No estás en ninguna sala' };
    if (room.hostId !== hostId) return { ok: false, error: 'Solo el host puede expulsar' };
    if (typeof targetId !== 'string' || targetId === hostId) return { ok: false, error: 'No puedes expulsarte a ti mismo' };
    const target = room.players.get(targetId);
    if (!target) return { ok: false, error: 'Ese jugador no está en la sala' };
    room.banned.add(targetId);
    return { ok: true, room, nickname: target.nickname };
  }

  /** Pérdida de conexión: conserva su lugar; en la cancha suelta todas las teclas. */
  disconnect(playerId: string): Room | null {
    const room = this.getRoomOfPlayer(playerId);
    const player = room?.players.get(playerId);
    if (!room || !player) return null;
    player.status = 'reconnecting';
    room.match?.setKeys(playerId, 0);
    return room;
  }

  reconnect(playerId: string): Room | null {
    const room = this.getRoomOfPlayer(playerId);
    const player = room?.players.get(playerId);
    if (!room || !player) return null;
    player.status = 'connected';
    return room;
  }

  /** Salida definitiva (voluntaria o porque venció la espera de reconexión). */
  leaveRoom(playerId: string): LeaveResult {
    const room = this.getRoomOfPlayer(playerId);
    const empty: LeaveResult = { room: null, roomDeleted: false, hostChanged: false, matchEmpty: false };
    if (!room) return empty;
    this.playerRoom.delete(playerId);
    room.players.delete(playerId);
    room.match?.removePlayer(playerId);

    if (room.players.size === 0) {
      this.rooms.delete(room.code);
      return { ...empty, room, roomDeleted: true };
    }
    let hostChanged = false;
    if (room.hostId === playerId) {
      const players = [...room.players.values()];
      room.hostId = (players.find((p) => p.status === 'connected') ?? players[0]).id;
      hostChanged = true;
    }
    const matchEmpty = room.phase === 'playing' && (room.match?.playersOnPitch ?? 0) === 0;
    return { room, roomDeleted: false, hostChanged, matchEmpty };
  }

  // ------------------------------------------------------------------ chat

  sendChat(playerId: string, rawText: string): Result<{ room: Room; message: ChatMessage }> {
    const room = this.getRoomOfPlayer(playerId);
    const player = room?.players.get(playerId);
    if (!room || !player) return { ok: false, error: 'No estás en ninguna sala' };
    const text = cleanChatText(String(rawText ?? ''));
    if (!text) return { ok: false, error: 'El mensaje está vacío' };
    const now = this.now();
    if (player.lastChatAt !== null && now - player.lastChatAt < CHAT_COOLDOWN_MS) {
      return { ok: false, error: 'Vas muy rápido, espera un momento' };
    }
    player.lastChatAt = now;
    const message = this.pushChat(room, {
      kind: 'player',
      playerId,
      nickname: player.nickname,
      color: TEAM_COLORS[player.team],
      text,
    });
    return { ok: true, room, message };
  }

  postSystemMessage(code: string, text: string): ChatMessage | null {
    const room = this.getRoom(code);
    if (!room) return null;
    return this.pushChat(room, { kind: 'system', playerId: null, nickname: '', color: '', text });
  }

  private pushChat(room: Room, fields: Omit<ChatMessage, 'id' | 'at'>): ChatMessage {
    const message: ChatMessage = { ...fields, id: ++room.chatSeq, at: this.now() };
    room.chat.push(message);
    if (room.chat.length > CHAT_HISTORY_SIZE) room.chat.splice(0, room.chat.length - CHAT_HISTORY_SIZE);
    return message;
  }

  // --------------------------------------------------------------- ajustes

  updateSettings(playerId: string, patch: Partial<RoomSettings>): Result<{ room: Room }> {
    const room = this.getRoomOfPlayer(playerId);
    if (!room) return { ok: false, error: 'No estás en ninguna sala' };
    if (room.hostId !== playerId) return { ok: false, error: 'Solo el host puede cambiar los ajustes' };
    if (room.phase === 'playing') return { ok: false, error: 'No se pueden cambiar los ajustes durante el partido' };

    const next = { ...room.settings };
    if (patch.scoreLimit !== undefined) {
      const error = validateScoreLimit(patch.scoreLimit);
      if (error) return { ok: false, error };
      next.scoreLimit = patch.scoreLimit;
    }
    if (patch.timeLimitMin !== undefined) {
      const error = validateTimeLimit(patch.timeLimitMin);
      if (error) return { ok: false, error };
      next.timeLimitMin = patch.timeLimitMin;
    }
    room.settings = next;
    return { ok: true, room };
  }

  // --------------------------------------------------------------- equipos

  /** Pasarse a un equipo o a espectadores. Los equipos se arman entre partidos. */
  joinTeam(playerId: string, team: unknown): Result<{ room: Room }> {
    const room = this.getRoomOfPlayer(playerId);
    if (!room) return { ok: false, error: 'No estás en ninguna sala' };
    return this.assignTeam(room, playerId, team);
  }

  /** El host mueve a otro jugador de equipo. */
  moveToTeam(hostId: string, targetId: unknown, team: unknown): Result<{ room: Room }> {
    const room = this.getRoomOfPlayer(hostId);
    if (!room) return { ok: false, error: 'No estás en ninguna sala' };
    if (room.hostId !== hostId) return { ok: false, error: 'Solo el host puede mover a otros jugadores' };
    if (typeof targetId !== 'string' || !room.players.has(targetId)) {
      return { ok: false, error: 'Ese jugador no está en la sala' };
    }
    return this.assignTeam(room, targetId, team);
  }

  private assignTeam(room: Room, playerId: string, team: unknown): Result<{ room: Room }> {
    const player = room.players.get(playerId);
    if (!player) return { ok: false, error: 'Ese jugador no está en la sala' };
    if (!(TEAMS as readonly unknown[]).includes(team)) return { ok: false, error: 'Ese equipo no existe' };
    if (room.phase === 'playing') return { ok: false, error: 'Los equipos se cambian entre partidos' };
    const next = team as Team;
    if (player.team === next) return { ok: true, room };
    if (next !== 'spectator' && this.teamSize(room, next) >= MAX_PER_TEAM) {
      return { ok: false, error: `El equipo ${TEAM_NAMES[next]} está completo (máximo ${MAX_PER_TEAM})` };
    }
    player.team = next;
    return { ok: true, room };
  }

  private teamSize(room: Room, team: Side): number {
    return [...room.players.values()].filter((p) => p.team === team).length;
  }

  // --------------------------------------------------------------- partido

  /** El host empieza el partido (desde la sala o desde los resultados, para la revancha). */
  startMatch(playerId: string): Result<{ room: Room }> {
    const room = this.getRoomOfPlayer(playerId);
    if (!room) return { ok: false, error: 'No estás en ninguna sala' };
    if (room.hostId !== playerId) return { ok: false, error: 'Solo el host puede empezar el partido' };
    if (room.phase === 'playing') return { ok: false, error: 'El partido ya está en curso' };
    const players = [...room.players.values()]
      .filter((p): p is Player & { team: Side } => p.team !== 'spectator')
      .map((p) => ({ id: p.id, nickname: p.nickname, team: p.team }));
    if (players.length === 0) return { ok: false, error: 'Tiene que haber al menos un jugador en un equipo' };

    room.match = new Match(players, room.settings, this.countdownMs);
    room.matchId++;
    room.phase = 'playing';
    room.startAt = this.now() + this.countdownMs;
    room.result = null;
    return { ok: true, room };
  }

  /** Teclas de un jugador en la cancha; se ignoran fuera de partido o de espectadores. */
  setInput(playerId: string, keys: unknown): void {
    if (!isValidKeys(keys)) return;
    const room = this.getRoomOfPlayer(playerId);
    if (room?.phase !== 'playing' || room.players.get(playerId)?.team === 'spectator') return;
    room.match?.setKeys(playerId, keys);
  }

  /** El host termina el partido en curso: todos vuelven a la sala, sin resultados. */
  stopMatch(playerId: string): Result<{ room: Room }> {
    const room = this.getRoomOfPlayer(playerId);
    if (!room) return { ok: false, error: 'No estás en ninguna sala' };
    if (room.hostId !== playerId) return { ok: false, error: 'Solo el host puede terminar el partido' };
    if (room.phase !== 'playing') return { ok: false, error: 'No hay ningún partido en curso' };
    this.backToLobby(room);
    return { ok: true, room };
  }

  /** Cancelación sin host: ya no queda nadie en la cancha. */
  abortMatch(code: string): Room | null {
    const room = this.getRoom(code);
    if (!room || room.phase !== 'playing') return null;
    this.backToLobby(room);
    return room;
  }

  /** Cierra el partido (límite de goles o de tiempo) y guarda el resultado. */
  endMatch(code: string): MatchResult | null {
    const room = this.getRoom(code);
    const match = room?.match;
    if (!room || !match || room.phase !== 'playing') return null;
    const { red, blue } = match.score;
    room.result = {
      score: { ...match.score },
      winner: red === blue ? null : red > blue ? 'red' : 'blue',
      goals: [...match.goals],
      durationMs: match.clockMs,
      players: match.players.map((p) => ({ ...p })),
    };
    room.phase = 'finished';
    room.match = null;
    room.startAt = null;
    return room.result;
  }

  /** Tras los resultados, todos vuelven a la sala. */
  resetToLobby(playerId: string): Result<{ room: Room }> {
    const room = this.getRoomOfPlayer(playerId);
    if (!room) return { ok: false, error: 'No estás en ninguna sala' };
    if (room.hostId !== playerId) return { ok: false, error: 'Solo el host puede volver a la sala' };
    if (room.phase !== 'finished') return { ok: false, error: 'El partido no ha terminado' };
    this.backToLobby(room);
    return { ok: true, room };
  }

  private backToLobby(room: Room): void {
    room.phase = 'lobby';
    room.match = null;
    room.startAt = null;
    room.result = null;
  }

  // ---------------------------------------------------------- serialización

  toState(room: Room): RoomState {
    const match = room.match;
    const goals = match?.goals ?? room.result?.goals ?? [];
    return {
      code: room.code,
      hostId: room.hostId,
      phase: room.phase,
      players: [...room.players.values()].map((p) => ({
        id: p.id,
        nickname: p.nickname,
        status: p.status,
        team: p.team,
        slot: match?.slots.get(p.id) ?? null,
        goals: goals.filter((g) => g.scorerId === p.id && !g.ownGoal).length,
      })),
      settings: room.settings,
      score: match ? { ...match.score } : (room.result?.score ?? { red: 0, blue: 0 }),
      goals,
      startAt: room.startAt,
      result: room.result,
    };
  }

  /**
   * Quien entra va al equipo con menos jugadores (si cabe) para poder jugar enseguida;
   * con el partido en marcha, o los equipos llenos, mira como espectador.
   */
  private addPlayer(room: Room, id: string, nickname: string): void {
    const red = this.teamSize(room, 'red');
    const blue = this.teamSize(room, 'blue');
    const smaller: Side = blue < red ? 'blue' : 'red';
    const team: Team =
      room.phase === 'playing' || this.teamSize(room, smaller) >= MAX_PER_TEAM ? 'spectator' : smaller;
    room.players.set(id, { id, nickname, status: 'connected', team, lastChatAt: null });
    this.playerRoom.set(id, room.code);
  }
}
