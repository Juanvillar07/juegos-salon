import type { SocketAuth } from '@typeracer/shared';
import type { ClientSocket, RealtimeContext } from '../context.js';

/**
 * Identifica al jugador por su sessionId (no por socket.id, que cambia en cada recarga)
 * y lo reincorpora a su sala si el servidor todavía le guardaba el lugar.
 */
export function attachSession(socket: ClientSocket, ctx: RealtimeContext): void {
  const { sessions, manager, graceTimers } = ctx;
  const session = sessions.resolve((socket.handshake.auth as SocketAuth | undefined)?.sessionId);
  socket.data.sessionId = session.sessionId;
  socket.data.playerId = session.playerId;

  // Misma sesión abierta en otra pestaña (p. ej. "duplicar pestaña"): gana la conexión nueva.
  const previous = sessions.attach(session, socket.id);
  if (previous) {
    const old = ctx.io.sockets.get(previous);
    old?.emit('session:replaced');
    old?.disconnect(true);
  }

  graceTimers.clear(session.playerId);
  const room = manager.reconnect(session.playerId);
  if (room) socket.join(room.code);
  socket.emit('session:ready', {
    sessionId: session.sessionId,
    playerId: session.playerId,
    room: room ? ctx.snapshot(room) : null,
  });
  if (room) {
    socket.emit('chat:history', room.chat);
    ctx.broadcastState(room);
  }
}

export function registerSessionHandlers(socket: ClientSocket, ctx: RealtimeContext): void {
  const { sessionId, playerId } = socket.data;

  socket.on('disconnect', () => {
    // Si otra conexión ya tomó la sesión, esta desconexión no cuenta.
    if (!ctx.sessions.detach(sessionId, socket.id)) return;

    const room = ctx.manager.disconnect(playerId);
    if (!room) {
      ctx.sessions.remove(sessionId);
      return;
    }
    ctx.broadcastState(room);
    ctx.graceTimers.set(playerId, ctx.options.reconnectGraceMs, () => {
      ctx.removePlayer(playerId);
      ctx.sessions.remove(sessionId);
    });
  });
}
