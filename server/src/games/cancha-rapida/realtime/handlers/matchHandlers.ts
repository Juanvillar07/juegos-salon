import { TEAM_NAMES } from '@typeracer/shared/cancha-rapida';
import type { ClientSocket, RealtimeContext } from '../context.js';

export function registerMatchHandlers(socket: ClientSocket, ctx: RealtimeContext): void {
  const { manager } = ctx;
  const { playerId } = socket.data;

  socket.on('team:join', (payload, ack) => {
    if (typeof ack !== 'function') return;
    const res = manager.joinTeam(playerId, payload?.team);
    if (!res.ok) return ack(res);
    ack({ ok: true });
    ctx.broadcastState(res.room);
  });

  socket.on('team:move', (payload, ack) => {
    if (typeof ack !== 'function') return;
    const res = manager.moveToTeam(playerId, payload?.playerId, payload?.team);
    if (!res.ok) return ack(res);
    ack({ ok: true });
    const moved = res.room.players.get(payload.playerId)!;
    ctx.announce(res.room.code, `El host pasó a ${moved.nickname} a ${TEAM_NAMES[moved.team]}`);
    ctx.broadcastState(res.room);
  });

  socket.on('match:start', (ack) => {
    if (typeof ack !== 'function') return;
    const res = manager.startMatch(playerId);
    if (!res.ok) return ack(res);
    ack({ ok: true });
    ctx.launchMatch(res.room);
  });

  socket.on('match:stop', () => {
    const res = manager.stopMatch(playerId);
    if (!res.ok) return void socket.emit('error', { message: res.error });
    ctx.returnToLobby(res.room, 'El host terminó el partido');
  });

  socket.on('match:again', () => {
    const res = manager.resetToLobby(playerId);
    if (!res.ok) return void socket.emit('error', { message: res.error });
    ctx.broadcastState(res.room);
  });

  // Lo más frecuente: llega cada vez que el jugador pulsa o suelta una tecla. Se valida en el gestor.
  socket.on('input', (keys) => manager.setInput(playerId, keys));

  socket.on('time:sync', (ack) => {
    if (typeof ack === 'function') ack(Date.now());
  });
}
