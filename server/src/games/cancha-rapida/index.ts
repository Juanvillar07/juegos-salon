import type { Server } from 'socket.io';
import { GAME_NAMESPACE } from '@typeracer/shared/cancha-rapida';
import type { RoomManager } from './domain/RoomManager.js';
import { RealtimeContext, type IO, type RealtimeOptions } from './realtime/context.js';
import { registerMatchHandlers } from './realtime/handlers/matchHandlers.js';
import { registerRoomHandlers } from './realtime/handlers/roomHandlers.js';
import { attachSession, registerSessionHandlers } from './realtime/handlers/sessionHandlers.js';

export { RoomManager } from './domain/RoomManager.js';
export type { RealtimeContext } from './realtime/context.js';

/** Monta Cancha Rápida en su namespace de Socket.IO. */
export function mountCanchaRapida(io: Server, manager: RoomManager, options: RealtimeOptions): RealtimeContext {
  // El Server es común a todos los juegos (sin tipos de eventos); cada namespace tipa los suyos.
  const namespace = io.of(GAME_NAMESPACE) as unknown as IO;
  const ctx = new RealtimeContext(namespace, manager, options);
  namespace.on('connection', (socket) => {
    attachSession(socket, ctx);
    registerSessionHandlers(socket, ctx);
    registerRoomHandlers(socket, ctx);
    registerMatchHandlers(socket, ctx);
  });
  return ctx;
}
