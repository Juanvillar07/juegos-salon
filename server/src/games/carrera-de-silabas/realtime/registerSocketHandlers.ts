import type { RoomManager } from '../domain/RoomManager.js';
import { RealtimeContext, type IO, type RealtimeOptions } from './context.js';
import { registerChatHandlers } from './handlers/chatHandlers.js';
import { registerRaceHandlers } from './handlers/raceHandlers.js';
import { registerRoomHandlers } from './handlers/roomHandlers.js';
import { attachSession, registerSessionHandlers } from './handlers/sessionHandlers.js';

export function registerSocketHandlers(io: IO, manager: RoomManager, options: RealtimeOptions): RealtimeContext {
  const ctx = new RealtimeContext(io, manager, options);

  io.on('connection', (socket) => {
    attachSession(socket, ctx);
    registerSessionHandlers(socket, ctx);
    registerRoomHandlers(socket, ctx);
    registerRaceHandlers(socket, ctx);
    registerChatHandlers(socket, ctx);
  });

  return ctx;
}
