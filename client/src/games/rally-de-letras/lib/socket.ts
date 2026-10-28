import { io, type Socket } from 'socket.io-client';
import { GAME_NAMESPACE, type ClientToServerEvents, type ServerToClientEvents, type SocketAuth } from '@typeracer/shared';
import { getSessionId } from './storage';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Cada juego del portal usa su propio namespace en el mismo servidor.
export const socket: GameSocket = io(SERVER_URL + GAME_NAMESPACE, {
  // Se evalúa en cada (re)conexión, así siempre se manda el sessionId vigente.
  auth: (cb) => cb({ sessionId: getSessionId() } satisfies SocketAuth),
});
