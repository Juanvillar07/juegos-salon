import {
  CAR_COLORS,
  AUTO_START_MS,
  COUNTDOWN_MS,
  DEFAULT_CAR,
  MAX_NICKNAME_LENGTH,
  MAX_PLAYERS,
  CHAT_COOLDOWN_MS,
  CHAT_HISTORY_SIZE,
  DEFAULT_SETTINGS,
  MAX_WPM,
  calcWpm,
  isCarColor,
  isCarModel,
  cleanChatText,
  isTextLength,
  normalizeRaceText,
  stripSigns,
  validateCustomText,
  validateTimeLimit,
  type CarPrefs,
  type ChatMessage,
  type RoomSettings,
  type PlayerProgress,
  type RaceResult,
  type RoomState,
  type TextLength,
} from '@typeracer/shared';
import { computeResults, playerWpm } from './results.js';
import { generateRoomCode, normalizeRoomCode } from '../../../common/roomCode.js';
import {
  isActive,
  isRacing,
  type AutoStartDecision,
  type LeaveResult,
  type Player,
  type ProgressResult,
  type RaceOutcome,
  type RaceText,
  type Result,
  type Room,
} from './types.js';

/** Id del texto personalizado (los del catálogo usan su índice, 0 en adelante). */
const CUSTOM_TEXT_ID = -1;
/** Cuántos textos recientes del catálogo no se repiten en una sala. */
const RECENT_TEXTS = 30;

export interface RoomManagerOptions {
  /** Elige un texto del catálogo de esa longitud, evitando los recientes de la sala (del más antiguo al más nuevo). */
  pickText: (recentIds: readonly number[], length: TextLength) => RaceText;
  now?: () => number;
  generateCode?: () => string;
  /** Espera de la salida automática cuando la mayoría está lista. */
  autoStartMs?: number;
}

function cleanNickname(nickname: string): string | null {
  const clean = nickname.trim().slice(0, MAX_NICKNAME_LENGTH);
  return clean.length > 0 ? clean : null;
}

/**
 * Toda la lógica de salas y carreras, sin dependencias de Socket.IO.
 * Los jugadores se identifican por un id público y estable entre reconexiones.
 */
export class RoomManager {
  private rooms = new Map<string, Room>();
  /** Sala de cada jugador activo (los que abandonaron una carrera ya no están aquí). */
  private playerRoom = new Map<string, string>();
  private now: () => number;
  private pickText: (recentIds: readonly number[], length: TextLength) => RaceText;
  private generateCode: () => string;
  private autoStartMs: number;

  constructor(options: RoomManagerOptions) {
    this.pickText = options.pickText;
    this.now = options.now ?? Date.now;
    this.generateCode = options.generateCode ?? generateRoomCode;
    this.autoStartMs = options.autoStartMs ?? AUTO_START_MS;
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(normalizeRoomCode(code));
  }

  getRoomOfPlayer(playerId: string): Room | undefined {
    const code = this.playerRoom.get(playerId);
    return code ? this.rooms.get(code) : undefined;
  }

  // ---------------------------------------------------------------- salas

  createRoom(playerId: string, nickname: string, prefs: CarPrefs = {}): Result<{ room: Room }> {
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
      text: null,
      recentTextIds: [],
      startAt: null,
      endedAt: null,
      finishCount: 0,
      raceId: 0,
      results: null,
      settings: { ...DEFAULT_SETTINGS },
      chat: [],
      chatSeq: 0,
      autoStartAt: null,
    };
    this.rooms.set(code, room);
    this.addPlayer(room, playerId, name, prefs);
    return { ok: true, room };
  }

  joinRoom(code: string, playerId: string, nickname: string, prefs: CarPrefs = {}): Result<{ room: Room }> {
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

    const active = [...room.players.values()].filter(isActive).length;
    if (active >= MAX_PLAYERS) return { ok: false, error: `La sala está llena (máximo ${MAX_PLAYERS})` };

    this.addPlayer(room, playerId, name, prefs);
    if (room.phase === 'racing') {
      // Con la carrera en marcha entra como espectador: la ve desde el lobby y corre la siguiente.
      const player = room.players.get(playerId)!;
      player.spectator = true;
      player.retired = true;
    }
    return { ok: true, room };
  }

  /** Cambia el auto y/o el color del jugador. No se permite durante la carrera ni repetir color. */
  customize(playerId: string, prefs: CarPrefs): Result<{ room: Room }> {
    const room = this.getRoomOfPlayer(playerId);
    const player = room?.players.get(playerId);
    if (!room || !player) return { ok: false, error: 'No estás en ninguna sala' };
    if (room.phase === 'racing' && !player.retired) {
      return { ok: false, error: 'No puedes cambiar de auto durante la carrera' };
    }
    if (prefs.car !== undefined && !isCarModel(prefs.car)) return { ok: false, error: 'Ese auto no existe' };
    if (prefs.color !== undefined) {
      if (!isCarColor(prefs.color)) return { ok: false, error: 'Ese color no está disponible' };
      if (this.colorsInUse(room, playerId).has(prefs.color)) {
        return { ok: false, error: 'Otro jugador ya tiene ese color' };
      }
    }
    if (prefs.car) player.car = prefs.car;
    if (prefs.color) player.color = prefs.color;
    return { ok: true, room };
  }

  /** Pérdida de conexión: el jugador conserva su lugar hasta que vuelva o se llame a leaveRoom. */
  disconnect(playerId: string): Room | null {
    const room = this.getRoomOfPlayer(playerId);
    const player = room?.players.get(playerId);
    if (!room || !player) return null;
    player.status = 'reconnecting';
    return room;
  }

  reconnect(playerId: string): Room | null {
    const room = this.getRoomOfPlayer(playerId);
    const player = room?.players.get(playerId);
    if (!room || !player) return null;
    player.status = 'connected';
    return room;
  }

  /**
   * Salida definitiva (voluntaria o porque venció la espera de reconexión).
   * Durante la carrera el jugador se conserva como "left" para que su carrito siga visible.
   */
  leaveRoom(playerId: string): LeaveResult {
    const room = this.getRoomOfPlayer(playerId);
    const empty: LeaveResult = { room: null, roomDeleted: false, hostChanged: false, race: 'continues' };
    if (!room) return empty;
    this.playerRoom.delete(playerId);

    const player = room.players.get(playerId);
    if (room.phase === 'racing' && player) player.status = 'left';
    else room.players.delete(playerId);

    const active = [...room.players.values()].filter(isActive);
    if (active.length === 0) {
      this.rooms.delete(room.code);
      return { ...empty, room, roomDeleted: true };
    }

    let hostChanged = false;
    if (room.hostId === playerId) {
      room.hostId = (active.find((p) => p.status === 'connected') ?? active[0]).id;
      hostChanged = true;
    }
    return { room, roomDeleted: false, hostChanged, race: this.raceOutcome(room) };
  }

  // ------------------------------------------------------------------ chat

  /** Mensaje de un jugador. Se limpia, se limita la longitud y la frecuencia. */
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
    const message = this.pushChat(room, { kind: 'player', playerId, nickname: player.nickname, color: player.color, text });
    return { ok: true, room, message };
  }

  /** Aviso del servidor en el chat (alguien entró, salió…). */
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

  /**
   * Cambia el texto y/o el límite de tiempo. Solo el host y fuera de carrera.
   * `customText: null` vuelve a los textos aleatorios del catálogo.
   */
  updateSettings(playerId: string, patch: Partial<RoomSettings>): Result<{ room: Room }> {
    const room = this.getRoomOfPlayer(playerId);
    if (!room) return { ok: false, error: 'No estás en ninguna sala' };
    if (room.hostId !== playerId) return { ok: false, error: 'Solo el host puede cambiar los ajustes' };
    if (room.phase === 'racing') return { ok: false, error: 'No se pueden cambiar los ajustes durante la carrera' };

    const next = { ...room.settings };
    if (patch.timeLimitSec !== undefined) {
      const error = validateTimeLimit(patch.timeLimitSec);
      if (error) return { ok: false, error };
      next.timeLimitSec = patch.timeLimitSec;
    }
    if (patch.customText !== undefined) {
      if (patch.customText === null) {
        next.customText = null;
      } else {
        if (typeof patch.customText !== 'string') return { ok: false, error: 'Texto no válido' };
        const text = normalizeRaceText(patch.customText);
        const error = validateCustomText(text);
        if (error) return { ok: false, error };
        next.customText = text;
      }
    }
    if (patch.textLength !== undefined) {
      if (!isTextLength(patch.textLength)) return { ok: false, error: 'Longitud de texto no válida' };
      next.textLength = patch.textLength;
    }
    if (patch.plainText !== undefined) {
      if (typeof patch.plainText !== 'boolean') return { ok: false, error: 'Opción no válida' };
      next.plainText = patch.plainText;
    }
    room.settings = next;
    return { ok: true, room };
  }

  // ---------------------------------------------------------------- listos

  /** Marca o desmarca "Listo". Solo en el lobby. Después hay que llamar a refreshAutoStart. */
  setReady(playerId: string, ready: boolean): Result<{ room: Room }> {
    const room = this.getRoomOfPlayer(playerId);
    const player = room?.players.get(playerId);
    if (!room || !player) return { ok: false, error: 'No estás en ninguna sala' };
    if (room.phase !== 'lobby') return { ok: false, error: 'Solo puedes marcarte listo en la sala de espera' };
    player.ready = Boolean(ready);
    return { ok: true, room };
  }

  /**
   * Revisa quién está listo y decide la salida automática:
   * - todos listos (aunque sea uno solo practicando): arrancar ya;
   * - más de la mitad listos (con 2 o más): salida programada dentro de autoStartMs;
   * - si deja de cumplirse, se cancela.
   * Los que están reconectando cuentan como jugadores (no listos), para no dejarlos fuera.
   */
  refreshAutoStart(room: Room): AutoStartDecision {
    const hadSchedule = room.autoStartAt !== null;
    if (room.phase !== 'lobby') {
      room.autoStartAt = null;
      return hadSchedule ? 'cancelled' : 'unchanged';
    }
    const players = [...room.players.values()].filter(isActive);
    const ready = players.filter((p) => p.ready).length;
    if (players.length > 0 && ready === players.length) {
      room.autoStartAt = null;
      return 'start';
    }
    if (players.length >= 2 && ready * 2 > players.length) {
      if (hadSchedule) return 'unchanged';
      room.autoStartAt = this.now() + this.autoStartMs;
      return 'scheduled';
    }
    room.autoStartAt = null;
    return hadSchedule ? 'cancelled' : 'unchanged';
  }

  // -------------------------------------------------------------- carrera

  /** El host empieza cuando quiere, esté lista o no la parrilla. */
  startRace(playerId: string): Result<{ room: Room }> {
    const room = this.getRoomOfPlayer(playerId);
    if (!room) return { ok: false, error: 'No estás en ninguna sala' };
    if (room.hostId !== playerId) return { ok: false, error: 'Solo el host puede empezar la carrera' };
    return this.beginRace(room);
  }

  /** Salida automática (todos listos o se cumplió la espera): no requiere host. */
  startRaceAuto(code: string): Result<{ room: Room }> {
    const room = this.getRoom(code);
    if (!room) return { ok: false, error: 'La sala no existe' };
    return this.beginRace(room);
  }

  private beginRace(room: Room): Result<{ room: Room }> {
    if (room.phase !== 'lobby') return { ok: false, error: 'La carrera ya está en curso' };
    room.autoStartAt = null;
    if (room.settings.customText !== null) {
      // El texto pegado se escribe tal cual (longitud y "sin signos" son ajustes del catálogo).
      room.text = { id: CUSTOM_TEXT_ID, text: room.settings.customText };
    } else {
      const picked = this.pickText(room.recentTextIds, room.settings.textLength);
      room.text = room.settings.plainText ? { ...picked, text: stripSigns(picked.text) } : picked;
      room.recentTextIds = [...room.recentTextIds, picked.id].slice(-RECENT_TEXTS);
    }
    room.phase = 'racing';
    room.startAt = this.now() + COUNTDOWN_MS;
    room.endedAt = null;
    room.finishCount = 0;
    room.results = null;
    room.raceId++;
    room.players.forEach(resetPlayerRace);
    return { ok: true, room };
  }

  /** Valida y aplica el progreso reportado por un cliente. Nunca confía en un "terminé". */
  updateProgress(playerId: string, correctChars: number, errors: number): ProgressResult {
    const room = this.getRoomOfPlayer(playerId);
    if (!room) return { accepted: false, reason: 'not-in-room' };
    const player = room.players.get(playerId);
    if (!player || room.phase !== 'racing' || !room.text || room.startAt === null) {
      return { accepted: false, reason: 'not-racing' };
    }
    if (!Number.isInteger(correctChars) || correctChars < 0) return { accepted: false, reason: 'invalid' };

    const now = this.now();
    if (now < room.startAt) return { accepted: false, reason: 'before-start' };
    if (player.retired) return { accepted: false, reason: 'retired' };
    if (player.position !== null) return { accepted: false, reason: 'already-finished' };

    if (Number.isInteger(errors) && errors > player.errors) player.errors = errors;

    if (correctChars <= player.progress) return { accepted: false, reason: 'not-increasing' };
    if (correctChars > room.text.text.length) return { accepted: false, reason: 'too-long' };
    if (calcWpm(correctChars, now - room.startAt) > MAX_WPM) return { accepted: false, reason: 'too-fast' };

    player.progress = correctChars;
    let finishedPosition: number | null = null;
    if (correctChars === room.text.text.length) {
      room.finishCount++;
      player.position = room.finishCount;
      player.finishedAt = now;
      finishedPosition = player.position;
    }
    return { accepted: true, room, finishedPosition, raceOver: this.raceOutcome(room) === 'over' };
  }

  /**
   * La carrera termina cuando llegan todos los que siguen en ella (incluidos los que reconectan).
   * Si ya nadie corre (todos volvieron a la sala o se fueron): resultados si alguien llegó,
   * o cancelada si nadie lo hizo.
   */
  raceOutcome(room: Room): RaceOutcome {
    if (room.phase !== 'racing') return 'continues';
    const racing = [...room.players.values()].filter(isRacing);
    if (racing.some((p) => p.position === null)) return 'continues';
    return racing.length > 0 || room.finishCount > 0 ? 'over' : 'cancelled';
  }

  /** Vuelve al lobby de la sala sin salir de ella: deja de correr y su auto queda en la pista. */
  retireFromRace(playerId: string): Result<{ room: Room; race: RaceOutcome }> {
    const room = this.getRoomOfPlayer(playerId);
    const player = room?.players.get(playerId);
    if (!room || !player) return { ok: false, error: 'No estás en ninguna sala' };
    if (room.phase !== 'racing') return { ok: false, error: 'No hay ninguna carrera en curso' };
    if (player.retired) return { ok: false, error: 'Ya volviste a la sala' };
    player.retired = true;
    return { ok: true, room, race: this.raceOutcome(room) };
  }

  /** El host cancela la carrera en curso: todos vuelven al lobby, sin resultados. */
  cancelRace(playerId: string): Result<{ room: Room }> {
    const room = this.getRoomOfPlayer(playerId);
    if (!room) return { ok: false, error: 'No estás en ninguna sala' };
    if (room.hostId !== playerId) return { ok: false, error: 'Solo el host puede cancelar la carrera' };
    if (room.phase !== 'racing') return { ok: false, error: 'No hay ninguna carrera en curso' };
    this.backToLobby(room);
    return { ok: true, room };
  }

  /** Cancelación sin host: ya nadie corre y nadie llegó a la meta. */
  abortRace(code: string): Room | null {
    const room = this.getRoom(code);
    if (!room || room.phase !== 'racing') return null;
    this.backToLobby(room);
    return room;
  }

  /** Cierra la carrera (todos llegaron o se agotó el tiempo) y calcula resultados. */
  endRace(code: string): RaceResult[] | null {
    const room = this.getRoom(code);
    if (!room || room.phase !== 'racing') return null;
    room.phase = 'finished';
    room.endedAt = this.now();
    room.results = computeResults(room, room.endedAt);
    this.updateStats(room, room.results);
    return room.results;
  }

  /** Marcador de la sala: carreras terminadas, mejor WPM y victorias (con 2 o más pilotos). */
  private updateStats(room: Room, results: RaceResult[]): void {
    for (const r of results) {
      const player = room.players.get(r.playerId);
      if (!player || r.position === null) continue;
      player.stats.finished++;
      player.stats.bestWpm = Math.max(player.stats.bestWpm, r.wpm);
      if (r.position === 1 && results.length >= 2) player.stats.wins++;
    }
  }

  /** "Otra carrera": vuelve al lobby y descarta a los que abandonaron. */
  resetToLobby(playerId: string): Result<{ room: Room }> {
    const room = this.getRoomOfPlayer(playerId);
    if (!room) return { ok: false, error: 'No estás en ninguna sala' };
    if (room.hostId !== playerId) return { ok: false, error: 'Solo el host puede iniciar otra carrera' };
    if (room.phase !== 'finished') return { ok: false, error: 'La carrera no ha terminado' };
    this.backToLobby(room);
    return { ok: true, room };
  }

  /** Vuelve al lobby (tras los resultados o cancelando) y descarta a los que abandonaron. */
  private backToLobby(room: Room): void {
    for (const [id, p] of room.players) {
      if (!isActive(p)) room.players.delete(id);
    }
    room.phase = 'lobby';
    room.text = null;
    room.startAt = null;
    room.endedAt = null;
    room.results = null;
    room.players.forEach(resetPlayerRace);
  }

  // ---------------------------------------------------------- serialización

  getProgress(room: Room): PlayerProgress[] {
    const now = this.now();
    return [...room.players.values()].map((p) => ({ id: p.id, progress: p.progress, wpm: playerWpm(room, p, now) }));
  }

  toState(room: Room): RoomState {
    const now = this.now();
    return {
      code: room.code,
      hostId: room.hostId,
      phase: room.phase,
      players: [...room.players.values()].map((p) => ({
        id: p.id,
        nickname: p.nickname,
        color: p.color,
        car: p.car,
        status: p.status,
        ready: p.ready,
        progress: p.progress,
        wpm: playerWpm(room, p, now),
        position: p.position,
        retired: p.retired,
        spectator: p.spectator,
        stats: { ...p.stats },
      })),
      text: room.text?.text ?? null,
      startAt: room.startAt,
      endsAt: room.startAt === null ? null : room.startAt + room.settings.timeLimitSec * 1000,
      results: room.results,
      settings: room.settings,
      autoStartAt: room.autoStartAt,
    };
  }

  private colorsInUse(room: Room, exceptId?: string): Set<string> {
    return new Set([...room.players.values()].filter((p) => p.id !== exceptId).map((p) => p.color));
  }

  private addPlayer(room: Room, id: string, nickname: string, prefs: CarPrefs): void {
    const used = this.colorsInUse(room);
    // Se respeta el color pedido si está libre; si no, el primero disponible.
    const color =
      isCarColor(prefs.color) && !used.has(prefs.color)
        ? prefs.color
        : (CAR_COLORS.find((c) => !used.has(c)) ?? CAR_COLORS[room.players.size % CAR_COLORS.length]);
    room.players.set(id, {
      id,
      nickname,
      color,
      car: isCarModel(prefs.car) ? prefs.car : DEFAULT_CAR,
      status: 'connected',
      ready: false,
      progress: 0,
      errors: 0,
      position: null,
      finishedAt: null,
      retired: false,
      spectator: false,
      stats: { wins: 0, finished: 0, bestWpm: 0 },
      lastChatAt: null,
    });
    this.playerRoom.set(id, room.code);
  }
}

function resetPlayerRace(p: Player): void {
  p.progress = 0;
  p.errors = 0;
  p.position = null;
  p.finishedAt = null;
  p.retired = false;
  p.spectator = false;
  p.ready = false;
}
