import type { ClientSocket, RealtimeContext } from '../context.js';

export function registerRaceHandlers(socket: ClientSocket, ctx: RealtimeContext): void {
  const { manager, io } = ctx;
  const { playerId } = socket.data;

  socket.on('race:start', () => {
    const res = manager.startRace(playerId);
    if (!res.ok) return void socket.emit('error', { message: res.error });
    ctx.launchRace(res.room);
  });

  socket.on('race:progress', (payload) => {
    const res = manager.updateProgress(playerId, Number(payload?.correctChars), Number(payload?.errors));
    if (!res.accepted) return;
    const { room } = res;
    io.to(room.code).emit('race:progress', { players: manager.getProgress(room) });
    if (res.finishedPosition !== null) {
      io.to(room.code).emit('race:playerFinished', {
        playerId,
        nickname: room.players.get(playerId)!.nickname,
        position: res.finishedPosition,
      });
      ctx.broadcastState(room);
    }
    if (res.raceOver) ctx.finishRace(room.code);
  });

  socket.on('race:again', () => {
    const res = manager.resetToLobby(playerId);
    if (!res.ok) return void socket.emit('error', { message: res.error });
    ctx.broadcastState(res.room);
  });
}
