import type { ClientSocket, RealtimeContext } from '../context.js';

export function registerRaceHandlers(socket: ClientSocket, ctx: RealtimeContext): void {
  const { manager, io } = ctx;
  const { playerId } = socket.data;

  socket.on('race:start', () => {
    const res = manager.startRace(playerId);
    if (!res.ok) return void socket.emit('error', { message: res.error });
    ctx.launchRace(res.room);
  });

  socket.on('race:skip', (ack) => {
    if (typeof ack !== 'function') return;
    const res = manager.skipSyllable(playerId);
    if (!res.ok) return ack(res);
    const { room, player } = res;
    ack({ ok: true, score: player.score, syllableIndex: player.syllableIndex, blockedUntil: player.blockedUntil });
    io.to(room.code).emit('race:progress', { players: manager.getProgress(room) });
  });

  socket.on('race:word', (payload, ack) => {
    if (typeof ack !== 'function') return;
    const res = manager.submitWord(playerId, payload?.word);
    if (!res.accepted) return ack({ ok: false, error: res.error });

    const { room } = res;
    const player = room.players.get(playerId)!;
    ack({
      ok: true,
      word: res.word,
      points: res.points,
      score: player.score,
      syllableIndex: player.syllableIndex,
      finished: res.finishedPosition !== null,
    });
    // A los demás solo les llega el marcador, nunca la palabra: verla servía para copiarla.
    io.to(room.code).emit('race:progress', { players: manager.getProgress(room) });
    if (res.finishedPosition !== null) {
      io.to(room.code).emit('race:playerFinished', {
        playerId,
        nickname: player.nickname,
        position: res.finishedPosition,
      });
      ctx.broadcastState(room);
    }
    if (res.raceOver) ctx.finishRace(room.code);
  });

  socket.on('race:retire', () => {
    const res = manager.retireFromRace(playerId);
    if (!res.ok) return void socket.emit('error', { message: res.error });
    ctx.announce(res.room.code, `${res.room.players.get(playerId)!.nickname} volvió a la sala`);
    ctx.settleRace(res.room, res.race);
  });

  socket.on('race:cancel', () => {
    const res = manager.cancelRace(playerId);
    if (!res.ok) return void socket.emit('error', { message: res.error });
    ctx.returnToLobby(res.room, 'El host canceló la carrera');
  });

  socket.on('race:again', () => {
    const res = manager.resetToLobby(playerId);
    if (!res.ok) return void socket.emit('error', { message: res.error });
    ctx.broadcastState(res.room);
  });
}
