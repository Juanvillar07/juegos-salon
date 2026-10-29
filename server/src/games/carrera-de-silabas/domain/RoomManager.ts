import {
  CAR_COLORS,
  AUTO_START_MS,
  COUNTDOWN_MS,
  DEFAULT_CAR,
  MAX_NICKNAME_LENGTH,
  MAX_PLAYERS,
  CHAT_COOLDOWN_MS,
  CHAT_HISTORY_SIZE,
  isCarColor,
  isCarModel,
  cleanChatText,
  type CarPrefs,
  type ChatMessage,
} from '@typeracer/shared';
import {
  DEFAULT_SETTINGS,
  MAX_WORD_LENGTH,
  MIN_WORD_LENGTH,
  SKIP_BLOCK_MS,
  SKIP_POINTS,
  SUBMIT_COOLDOWN_MS,
  checkWordShape,
  normalizeWord,
  validateTarget,
  validateSkipPenalty,
  validateTimeLimit,
  wordPoints,
  type PlayerProgress,
  type RaceResult,
  type RoomSettings,
  type RoomState,
} from '@typeracer/shared/carrera-de-silabas';
import { PASSWORD_ATTEMPTS_PER_MINUTE, normalizeRoomPassword } from '@typeracer/shared';
import { generateRoomCode, normalizeRoomCode } from '../../../common/roomCode.js';
import { computeResults } from './results.js';
import {
  isActive,
  isRacing,
  type AutoStartDecision,
  type JoinResult,
  type LeaveResult,
  type RaceOutcome,
  type Player,
  type Result,
  type Room,
  type WordResult,
} from './types.js';

export interface RoomManagerOptions {
  /** ¿Está la palabra (ya normalizada) en el diccionario? */
  isWord: (word: string) => boolean;
  /** Sorteo de la secuencia de sílabas de una carrera. */
  pickSyllables: (count: number) => string[];
  now?: () => number;
  generateCode?: () => string;
  /** Espera de la salida automática cuando la mayoría está lista. */
  autoStartMs?: number;
}

function cleanNickname(nickname: string): string | null {
  const clean = nickname.trim().slice(0, MAX_NICKNAME_LENGTH);
  return clean.length > 0 ? clean : null;
}

/** Sílabas que hacen falta para llegar a la meta aunque todas las palabras sean de largo mínimo. */
export function syllablesForTarget(target: number): number {
  return Math.ceil(target / MIN_WORD_LENGTH);
}

/**
 * Toda la lógica de salas y carreras de Carrera de Sílabas, sin dependencias de Socket.IO.
 * Salas, lobby, chat y reconexión funcionan igual que en Rally de Letras; lo propio de este
 * juego es la carrera por palabras: cada palabra válida suma un punto por letra.
 */
export class RoomManager {
  private rooms = new Map<string, Room>();
  /** Sala de cada jugador activo (los que abandonaron una carrera ya no están aquí). */
  private playerRoom = new Map<string, string>();
  private now: () => number;
  private isWord: (word: string) => boolean;
  private pickSyllables: (count: number) => string[];
  private generateCode: () => string;
  private autoStartMs: number;

  constructor(options: RoomManagerOptions) {
    this.isWord = options.isWord;
    this.pickSyllables = options.pickSyllables;
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
      syllables: null,
      startAt: null,
      endedAt: null,
      finishCount: 0,
      raceId: 0,
      results: null,
      settings: { ...DEFAULT_SETTINGS },
      chat: [],
      chatSeq: 0,
      autoStartAt: null,
      password: null,
      banned: new Set(),
      failedJoins: new Map(),
    };
    this.rooms.set(code, room);
    this.addPlayer(room, playerId, name, prefs);
    return { ok: true, room };
  }

  joinRoom(code: string, playerId: string, nickname: string, prefs: CarPrefs = {}, password?: unknown): JoinResult {
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
    if (room.password !== null) {
      const denied = this.checkPassword(room, playerId, password);
      if (denied) return denied;
    }

    if (room.phase === 'racing') return { ok: false, error: 'La carrera ya empezó, espera a que termine' };
    const active = [...room.players.values()].filter(isActive).length;
    if (active >= MAX_PLAYERS) return { ok: false, error: `La sala está llena (máximo ${MAX_PLAYERS})` };

    this.addPlayer(room, playerId, name, prefs);
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

  /** Contraseña al entrar: null si es correcta; si no, el error (con un tope de intentos por minuto). */
  private checkPassword(room: Room, playerId: string, password: unknown): JoinResult | null {
    const now = this.now();
    const recent = (room.failedJoins.get(playerId) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= PASSWORD_ATTEMPTS_PER_MINUTE) {
      return { ok: false, error: 'Demasiados intentos: espera un minuto', needsPassword: true };
    }
    if (typeof password !== 'string' || password.trim() === '') {
      return { ok: false, error: 'Esta sala tiene contraseña', needsPassword: true };
    }
    if (password.trim() === room.password) {
      room.failedJoins.delete(playerId);
      return null;
    }
    room.failedJoins.set(playerId, [...recent, now]);
    return { ok: false, error: 'Contraseña incorrecta', needsPassword: true };
  }

  /** Pone o quita (null) la contraseña de la sala. Solo el host. */
  setPassword(playerId: string, raw: unknown): Result<{ room: Room }> {
    const room = this.getRoomOfPlayer(playerId);
    if (!room) return { ok: false, error: 'No estás en ninguna sala' };
    if (room.hostId !== playerId) return { ok: false, error: 'Solo el host puede cambiar la contraseña' };
    if (raw === null) {
      room.password = null;
      return { ok: true, room };
    }
    const res = normalizeRoomPassword(raw);
    if (!res.ok) return res;
    room.password = res.password;
    return { ok: true, room };
  }

  /**
   * El host expulsa a un jugador: queda vetado en la sala (no puede volver a entrar).
   * La salida en sí (avisos, carrera) la hace la capa de tiempo real con leaveRoom.
   */
  kick(hostId: string, targetId: unknown): Result<{ room: Room; nickname: string }> {
    const room = this.getRoomOfPlayer(hostId);
    if (!room) return { ok: false, error: 'No estás en ninguna sala' };
    if (room.hostId !== hostId) return { ok: false, error: 'Solo el host puede expulsar' };
    if (typeof targetId !== 'string' || targetId === hostId) return { ok: false, error: 'No puedes expulsarte a ti mismo' };
    const target = room.players.get(targetId);
    if (!target || !isActive(target)) return { ok: false, error: 'Ese jugador no está en la sala' };
    room.banned.add(targetId);
    return { ok: true, room, nickname: target.nickname };
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

  /** Cambia la meta de puntos. Solo el host y fuera de carrera. */
  updateSettings(playerId: string, patch: Partial<RoomSettings>): Result<{ room: Room }> {
    const room = this.getRoomOfPlayer(playerId);
    if (!room) return { ok: false, error: 'No estás en ninguna sala' };
    if (room.hostId !== playerId) return { ok: false, error: 'Solo el host puede cambiar los ajustes' };
    if (room.phase === 'racing') return { ok: false, error: 'No se pueden cambiar los ajustes durante la carrera' };

    const next = { ...room.settings };
    if (patch.target !== undefined) {
      const error = validateTarget(patch.target);
      if (error) return { ok: false, error };
      next.target = patch.target;
    }
    if (patch.timeLimitSec !== undefined) {
      const error = validateTimeLimit(patch.timeLimitSec);
      if (error) return { ok: false, error };
      next.timeLimitSec = patch.timeLimitSec;
    }
    if (patch.skipPenalty !== undefined) {
      const error = validateSkipPenalty(patch.skipPenalty);
      if (error) return { ok: false, error };
      next.skipPenalty = patch.skipPenalty;
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
    room.syllables = this.pickSyllables(syllablesForTarget(room.settings.target));
    room.phase = 'racing';
    room.startAt = this.now() + COUNTDOWN_MS;
    room.endedAt = null;
    room.finishCount = 0;
    room.results = null;
    room.raceId++;
    room.players.forEach(resetPlayerRace);
    return { ok: true, room };
  }

  /**
   * Valida una palabra contra la sílaba que le toca al jugador. Si es válida suma un punto
   * por letra y el jugador pasa a la siguiente sílaba; al alcanzar la meta queda clasificado.
   */
  submitWord(playerId: string, rawWord: unknown): WordResult {
    const room = this.getRoomOfPlayer(playerId);
    const player = room?.players.get(playerId);
    if (!room || !player) return { accepted: false, error: 'No estás en ninguna sala' };
    if (room.phase !== 'racing' || !room.syllables || room.startAt === null) {
      return { accepted: false, error: 'No hay ninguna carrera en curso' };
    }
    const now = this.now();
    if (now < room.startAt) return { accepted: false, error: 'Espera la salida' };
    if (player.retired) return { accepted: false, error: 'Volviste a la sala' };
    if (player.position !== null) return { accepted: false, error: 'Ya llegaste a la meta' };
    if (player.blockedUntil !== null && now < player.blockedUntil) {
      return { accepted: false, error: `Espera ${Math.ceil((player.blockedUntil - now) / 1000)} s` };
    }
    if (player.lastWordAt !== null && now - player.lastWordAt < SUBMIT_COOLDOWN_MS) {
      return { accepted: false, error: 'Más despacio' };
    }
    player.lastWordAt = now;

    if (typeof rawWord !== 'string' || rawWord.length > MAX_WORD_LENGTH * 2) {
      return { accepted: false, error: 'Palabra no válida' };
    }
    const word = normalizeWord(rawWord);
    const syllable = room.syllables[player.syllableIndex % room.syllables.length];
    const shapeError = checkWordShape(word, syllable);
    if (shapeError) return { accepted: false, error: shapeError };
    if (player.usedWords.has(word)) return { accepted: false, error: 'Ya usaste esa palabra' };
    if (!this.isWord(word)) return { accepted: false, error: 'No está en el diccionario' };

    const points = wordPoints(word);
    player.usedWords.add(word);
    player.plays.push({ word, syllable });
    player.score += points;
    player.syllableIndex++;
    if (player.longestWord === null || word.length > player.longestWord.length) player.longestWord = word;

    let finishedPosition: number | null = null;
    if (player.score >= room.settings.target) {
      room.finishCount++;
      player.position = room.finishCount;
      player.finishedAt = now;
      finishedPosition = player.position;
    }
    const raceOver = this.raceOutcome(room) === 'over';
    return { accepted: true, room, word, syllable, points, finishedPosition, raceOver };
  }

  /**
   * Pasa a la siguiente sílaba pagando la penalización de la sala: puntos (sin bajar de 0),
   * unos segundos sin poder escribir, o ambas cosas.
   */
  skipSyllable(playerId: string): Result<{ room: Room; player: Player }> {
    const room = this.getRoomOfPlayer(playerId);
    const player = room?.players.get(playerId);
    if (!room || !player) return { ok: false, error: 'No estás en ninguna sala' };
    if (room.phase !== 'racing' || room.startAt === null) return { ok: false, error: 'No hay ninguna carrera en curso' };
    const now = this.now();
    if (now < room.startAt) return { ok: false, error: 'Espera la salida' };
    if (player.retired) return { ok: false, error: 'Volviste a la sala' };
    if (player.position !== null) return { ok: false, error: 'Ya llegaste a la meta' };
    if (player.blockedUntil !== null && now < player.blockedUntil) {
      return { ok: false, error: `Espera ${Math.ceil((player.blockedUntil - now) / 1000)} s` };
    }

    const { skipPenalty } = room.settings;
    if (skipPenalty !== 'time') player.score = Math.max(0, player.score - SKIP_POINTS);
    player.blockedUntil = skipPenalty !== 'points' ? now + SKIP_BLOCK_MS : null;
    player.syllableIndex++;
    player.skips++;
    return { ok: true, room, player };
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
    room.results = computeResults(room);
    return room.results;
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
    room.syllables = null;
    room.startAt = null;
    room.endedAt = null;
    room.results = null;
    room.players.forEach(resetPlayerRace);
  }

  // ---------------------------------------------------------- serialización

  getProgress(room: Room): PlayerProgress[] {
    return [...room.players.values()].map((p) => ({
      id: p.id,
      score: p.score,
      words: p.usedWords.size,
      syllableIndex: p.syllableIndex,
    }));
  }

  toState(room: Room): RoomState {
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
        score: p.score,
        words: p.usedWords.size,
        syllableIndex: p.syllableIndex,
        position: p.position,
        retired: p.retired,
      })),
      syllables: room.syllables,
      startAt: room.startAt,
      endsAt: room.startAt === null ? null : room.startAt + room.settings.timeLimitSec * 1000,
      results: room.results,
      settings: room.settings,
      autoStartAt: room.autoStartAt,
      locked: room.password !== null,
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
      score: 0,
      usedWords: new Set(),
      longestWord: null,
      syllableIndex: 0,
      position: null,
      finishedAt: null,
      retired: false,
      plays: [],
      skips: 0,
      blockedUntil: null,
      lastWordAt: null,
      lastChatAt: null,
    });
    this.playerRoom.set(id, room.code);
  }
}

function resetPlayerRace(p: Player): void {
  p.score = 0;
  p.usedWords = new Set();
  p.longestWord = null;
  p.syllableIndex = 0;
  p.position = null;
  p.finishedAt = null;
  p.retired = false;
  p.plays = [];
  p.skips = 0;
  p.blockedUntil = null;
  p.lastWordAt = null;
  p.ready = false;
}
