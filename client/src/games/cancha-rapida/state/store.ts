import { useSyncExternalStore } from 'react';
import type { ChatMessage } from '@typeracer/shared';
import {
  TEAM_NAMES,
  decodeSnapshot,
  type Ack,
  type CreateAck,
  type GoalEvent,
  type RoomSettings,
  type RoomSnapshot,
  type RoomState,
  type Team,
} from '@typeracer/shared/cancha-rapida';
import { alertRaceStart } from '../../../shell/raceAlert';
import { ClockSync } from '../lib/clock';
import { FrameBuffer } from '../lib/interpolation';
import { socket } from '../lib/socket';
import { setSessionId } from '../lib/storage';

export interface Notice {
  id: number;
  text: string;
}

export interface ClientState {
  connected: boolean;
  /** true cuando el servidor ya confirmó nuestra sesión (y nuestra sala, si la había). */
  sessionReady: boolean;
  /** La sesión se abrió en otra pestaña y esta quedó desconectada. */
  replaced: boolean;
  myId: string | null;
  room: RoomState | null;
  chat: ChatMessage[];
  notices: Notice[];
  /** Último gol, para el cartel grande de "¡Gol!" (se borra solo). */
  goal: (GoalEvent & { id: number }) | null;
  error: string | null;
}

let state: ClientState = {
  connected: false,
  sessionReady: false,
  replaced: false,
  myId: null,
  room: null,
  chat: [],
  notices: [],
  goal: null,
  error: null,
};
const listeners = new Set<() => void>();

function setState(patch: Partial<ClientState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): ClientState {
  return state;
}

export function useClientState(): ClientState {
  return useSyncExternalStore(subscribe, getState);
}

// --------------------------------------------- tiempo real (fuera de React)

/**
 * Las instantáneas llegan 30 veces por segundo: no pasan por el estado de React (serían 30
 * renders por segundo), las lee directamente el bucle de dibujo de la cancha.
 */
export const frames = new FrameBuffer();
export const clock = new ClockSync();

/** Hora actual estimada en el reloj del servidor. */
export function serverNow(): number {
  return Date.now() + clock.offset;
}

let syncTimer: ReturnType<typeof setInterval> | null = null;

function syncClock(): void {
  const sentAt = Date.now();
  socket.emit('time:sync', (serverTime) => clock.sample(sentAt, Date.now(), serverTime));
}

/** Durante el partido se mide el reloj cada 2 s (la latencia cambia, sobre todo por Wi-Fi). */
function keepClockSynced(on: boolean): void {
  if (on && !syncTimer) {
    syncClock();
    syncTimer = setInterval(syncClock, 2000);
  } else if (!on && syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

let lastKeys = 0;

/** Manda las teclas solo si cambiaron (el servidor guarda las últimas). */
export function sendInput(keys: number): void {
  if (keys === lastKeys) return;
  lastKeys = keys;
  socket.emit('input', keys);
}

// ----------------------------------------------------------------- acciones

export function createRoom(nickname: string): Promise<CreateAck> {
  return new Promise((resolve) => socket.emit('room:create', { nickname }, resolve));
}

export function joinRoom(code: string, nickname: string): Promise<Ack> {
  return new Promise((resolve) => socket.emit('room:join', { code, nickname }, resolve));
}

/** Acción con respuesta: si el servidor la rechaza, se muestra el error. */
function withError(send: (ack: (res: Ack) => void) => void): Promise<Ack> {
  return new Promise((resolve) =>
    send((res) => {
      if (!res.ok) setState({ error: res.error });
      resolve(res);
    }),
  );
}

export function kickPlayer(playerId: string): Promise<Ack> {
  return withError((ack) => socket.emit('room:kick', { playerId }, ack));
}

/** Cambia goles o tiempo (host). Devuelve el ack para mostrar el error junto al control. */
export function updateRoomSettings(patch: Partial<RoomSettings>): Promise<Ack> {
  return new Promise((resolve) => socket.emit('room:settings', patch, resolve));
}

export function joinTeam(team: Team): Promise<Ack> {
  return withError((ack) => socket.emit('team:join', { team }, ack));
}

export function movePlayer(playerId: string, team: Team): Promise<Ack> {
  return withError((ack) => socket.emit('team:move', { playerId, team }, ack));
}

export function startMatch(): Promise<Ack> {
  return withError((ack) => socket.emit('match:start', ack));
}

export function stopMatch(): void {
  socket.emit('match:stop');
}

export function backToLobby(): void {
  socket.emit('match:again');
}

export function leaveRoom(): void {
  if (state.room) socket.emit('room:leave');
  setState({ room: null, chat: [], notices: [], goal: null, error: null });
}

export function sendChat(text: string): Promise<Ack> {
  return new Promise((resolve) => socket.emit('chat:send', { text }, resolve));
}

export function clearError(): void {
  setState({ error: null });
}

let noticeSeq = 0;
function pushNotice(text: string): void {
  const notice = { id: ++noticeSeq, text };
  setState({ notices: [...state.notices, notice] });
  setTimeout(() => setState({ notices: state.notices.filter((n) => n.id !== notice.id) }), 4000);
}

// ------------------------------------------------------ eventos del servidor

function applySnapshot({ serverNow: sNow, ...room }: RoomSnapshot): void {
  clock.rough(sNow, Date.now());
  keepClockSynced(room.phase === 'playing');
  setState({ room });
}

// En desarrollo, si este módulo cambia, se recarga la página entera: el socket es único y sus
// eventos (connect, session:ready) ya ocurrieron, así que un store recién cargado nunca los vería.
import.meta.hot?.accept(() => window.location.reload());

socket.on('connect', () => setState({ connected: true }));
// Al perder la conexión se conserva la sala en pantalla: el servidor nos guarda el lugar un rato.
socket.on('disconnect', () => {
  lastKeys = 0;
  setState({ connected: false, sessionReady: false });
});

socket.on('session:ready', ({ sessionId, playerId, room }) => {
  setSessionId(sessionId);
  setState({ sessionReady: true, myId: playerId, room: null, ...(room ? {} : { chat: [] }) });
  if (room) applySnapshot(room);
});

socket.on('session:replaced', () => setState({ replaced: true, room: null }));
// Expulsado por el host: sin sala, la página vuelve a pedir entrar y el servidor explica por qué no.
socket.on('room:kicked', () => setState({ room: null, chat: [], notices: [], error: null }));

socket.on('room:state', applySnapshot);

socket.on('chat:history', (messages) => setState({ chat: messages }));
socket.on('chat:message', (message) => setState({ chat: [...state.chat, message] }));

socket.on('match:countdown', ({ serverNow: sNow }) => {
  clock.rough(sNow, Date.now());
  frames.clear();
  lastKeys = 0;
  alertRaceStart();
});

socket.on('match:snapshot', (snapshot) => frames.push(decodeSnapshot(snapshot)));

let goalSeq = 0;
socket.on('match:goal', (goal) => {
  const flash = { ...goal, id: ++goalSeq };
  setState({ goal: flash });
  setTimeout(() => {
    if (state.goal?.id === flash.id) setState({ goal: null });
  }, 2000);
});

socket.on('match:results', (result) => {
  pushNotice(result.winner ? `¡Ganó el equipo ${TEAM_NAMES[result.winner]}!` : 'Partido terminado: empate');
});

socket.on('error', ({ message }) => setState({ error: message }));
