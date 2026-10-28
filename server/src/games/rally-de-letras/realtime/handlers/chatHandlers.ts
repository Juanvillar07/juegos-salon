import type { ClientSocket, RealtimeContext } from '../context.js';

export function registerChatHandlers(socket: ClientSocket, ctx: RealtimeContext): void {
  const { playerId } = socket.data;

  socket.on('chat:send', (payload, ack) => {
    if (typeof ack !== 'function') return;
    const res = ctx.manager.sendChat(playerId, String(payload?.text ?? ''));
    if (!res.ok) return ack(res);
    ack({ ok: true });
    ctx.io.to(res.room.code).emit('chat:message', res.message);
  });
}
