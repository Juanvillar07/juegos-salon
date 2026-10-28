import { useSyncExternalStore } from 'react';
import type { CarPrefs, ChatMessage } from '@typeracer/shared';
import type {
  Ack,
  CreateAck,
  RoomSettings,
  RoomSnapshot,
  RoomState,
  WordAck,
} from '@typeracer/shared/carrera-de-silabas';
import { ordinal } from '../../rally-de-letras/lib/format';
import { socket } from '../lib/socket';
import { getCarChoice, setSessionId } from '../lib/storage';

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
  /** Mensajes del chat de la sala actual. */
  chat: ChatMessage[];
  /** Diferencia reloj servidor − reloj local, en ms. */
  clockOffset: number;
  notices: Notice[];
  error: string | null;
}


let state: ClientState = {
  connected: false,
  sessionReady: false,
  replaced: false,
  myId: null,
  room: null,
  chat: [],
  clockOffset: 0,
  notices: [],
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

/** Hora actual estimada en el reloj del servidor. */
export function serverNow(): number {
  return Date.now() + state.clockOffset;
}

// ----------------------------------------------------------------- acciones

// Al crear o unirse se manda el auto elegido en el garaje.
export function createRoom(nickname: string): Promise<CreateAck> {
  return new Promise((resolve) => socket.emit('room:create', { nickname, ...getCarChoice() }, resolve));
}

export function joinRoom(code: string, nickname: string): Promise<Ack> {
  return new Promise((resolve) => socket.emit('room:join', { code, nickname, ...getCarChoice() }, resolve));
}

/** Cambia auto/color en la sala. Si el servidor lo rechaza (color ocupado), se muestra el error. */
export function customizeCar(prefs: CarPrefs): Promise<Ack> {
  return new Promise((resolve) =>
    socket.emit('player:customize', prefs, (res) => {
      if (!res.ok) setState({ error: res.error });
      resolve(res);
    }),
  );
}

/** Cambia la meta de la sala (host). Devuelve el ack para mostrar el error junto al control. */
export function updateRoomSettings(patch: Partial<RoomSettings>): Promise<Ack> {
  return new Promise((resolve) => socket.emit('room:settings', patch, resolve));
}

export function leaveRoom(): void {
  if (state.room) socket.emit('room:leave');
  setState({ room: null, chat: [], notices: [], error: null });
}

export function sendChat(text: string): Promise<Ack> {
  return new Promise((resolve) => socket.emit('chat:send', { text }, resolve));
}

/** Marcar o desmarcar "Listo" en el lobby. */
export function setReady(ready: boolean): Promise<Ack> {
  return new Promise((resolve) =>
    socket.emit('player:ready', { ready }, (res) => {
      if (!res.ok) setState({ error: res.error });
      resolve(res);
    }),
  );
}

export function startRace(): void {
  socket.emit('race:start');
}

/**
 * Propone una palabra. Si se acepta, el marcador propio se actualiza al instante con la
 * respuesta (sin esperar el race:progress que llega a todos).
 */
export function submitWord(word: string): Promise<WordAck> {
  return new Promise((resolve) =>
    socket.emit('race:word', { word }, (res) => {
      if (res.ok && state.room) {
        setState({
          room: {
            ...state.room,
            players: state.room.players.map((p) =>
              p.id === state.myId ? { ...p, score: res.score, syllableIndex: res.syllableIndex, words: p.words + 1 } : p,
            ),
          },
        });
      }
      resolve(res);
    }),
  );
}

/**
 * Deja de correr y vuelve al lobby de la sala, sin salir de ella. Se marca al momento, sin
 * esperar al servidor: así se ve el lobby enseguida y su propio aviso no sale como notificación.
 */
export function retireFromRace(): void {
  const { room, myId } = state;
  if (room) setState({ room: { ...room, players: room.players.map((p) => (p.id === myId ? { ...p, retired: true } : p)) } });
  socket.emit('race:retire');
}

/** Cancela la carrera en curso (solo el host): todos vuelven al lobby. */
export function cancelRace(): void {
  socket.emit('race:cancel');
}

export function playAgain(): void {
  socket.emit('race:again');
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
  setState({ room, clockOffset: sNow - Date.now() });
}

// En desarrollo, si este módulo cambia, se recarga la página entera: el socket es único y sus
// eventos (connect, session:ready) ya ocurrieron, así que un store recién cargado nunca los vería.
import.meta.hot?.accept(() => window.location.reload());

socket.on('connect', () => setState({ connected: true }));
// Al perder la conexión se conserva la sala en pantalla: el servidor nos guarda el lugar un rato.
socket.on('disconnect', () => setState({ connected: false, sessionReady: false }));

socket.on('session:ready', ({ sessionId, playerId, room }) => {
  setSessionId(sessionId);
  setState({ sessionReady: true, myId: playerId, room: null, ...(room ? {} : { chat: [] }) });
  if (room) applySnapshot(room);
});

socket.on('session:replaced', () => setState({ replaced: true, room: null }));

socket.on('room:state', applySnapshot);

socket.on('chat:history', (messages) => setState({ chat: messages }));
socket.on('chat:message', (message) => {
  setState({ chat: [...state.chat, message] });
  // Durante la carrera el chat no se ve: los avisos (alguien abandonó…) salen como notificación.
  // Quien volvió a la sala ya ve los avisos en el chat del lobby.
  const me = state.room?.players.find((p) => p.id === state.myId);
  if (message.kind === 'system' && state.room?.phase === 'racing' && !me?.retired) pushNotice(message.text);
});

socket.on('race:countdown', ({ serverNow: sNow }) => setState({ clockOffset: sNow - Date.now() }));


socket.on('race:progress', ({ players }) => {
  if (!state.room) return;
  const byId = new Map(players.map((p) => [p.id, p]));
  setState({
    room: {
      ...state.room,
      players: state.room.players.map((p) => {
        const update = byId.get(p.id);
        return update ? { ...p, score: update.score, words: update.words, syllableIndex: update.syllableIndex } : p;
      }),
    },
  });
});

socket.on('race:playerFinished', ({ playerId, nickname, position }) => {
  const who = playerId === state.myId ? 'Llegaste' : `${nickname} llegó`;
  pushNotice(`${who} ${ordinal(position)}`);
});

socket.on('race:results', () => pushNotice('Carrera terminada'));

socket.on('error', ({ message }) => setState({ error: message }));
