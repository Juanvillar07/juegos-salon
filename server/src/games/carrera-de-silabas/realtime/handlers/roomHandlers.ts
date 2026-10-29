import { normalizeRoomCode } from '../../../../common/roomCode.js';
import type { ClientSocket, RealtimeContext } from '../context.js';

export function registerRoomHandlers(socket: ClientSocket, ctx: RealtimeContext): void {
  const { manager } = ctx;
  const { playerId } = socket.data;

  // Crear o unirse a otra sala implica abandonar la anterior (p. ej. una pestaña que volvió al inicio).
  const leaveOtherRoom = (code?: string) => {
    const current = manager.getRoomOfPlayer(playerId);
    if (current && current.code !== (code && normalizeRoomCode(code))) ctx.removePlayer(playerId);
  };

  socket.on('room:create', ({ nickname, car, color }, ack) => {
    if (typeof ack !== 'function') return;
    leaveOtherRoom();
    const res = manager.createRoom(playerId, String(nickname ?? ''), { car, color });
    if (!res.ok) return ack(res);
    socket.join(res.room.code);
    ack({ ok: true, code: res.room.code });
    socket.emit('chat:history', res.room.chat);
    ctx.broadcastState(res.room);
  });

  socket.on('room:join', ({ code, nickname, car, color, password }, ack) => {
    if (typeof ack !== 'function') return;
    const roomCode = String(code ?? '');
    leaveOtherRoom(roomCode);
    const alreadyIn = manager.getRoomOfPlayer(playerId)?.code === normalizeRoomCode(roomCode);
    const res = manager.joinRoom(roomCode, playerId, String(nickname ?? ''), { car, color }, password);
    if (!res.ok) return ack(res);
    socket.join(res.room.code);
    ack({ ok: true });
    socket.emit('chat:history', res.room.chat);
    if (!alreadyIn) ctx.announce(res.room.code, `${res.room.players.get(playerId)!.nickname} entró a la sala`);
    ctx.broadcastState(res.room);
  });

  socket.on('player:customize', (prefs, ack) => {
    if (typeof ack !== 'function') return;
    const res = manager.customize(playerId, { car: prefs?.car, color: prefs?.color });
    if (!res.ok) return ack(res);
    ack({ ok: true });
    ctx.broadcastState(res.room);
  });

  socket.on('player:ready', (payload, ack) => {
    if (typeof ack !== 'function') return;
    const res = manager.setReady(playerId, Boolean(payload?.ready));
    if (!res.ok) return ack(res);
    ack({ ok: true });
    // broadcastState revisa si con esto arranca (o se programa) la salida automática.
    ctx.broadcastState(res.room);
  });

  socket.on('room:settings', (patch, ack) => {
    if (typeof ack !== 'function') return;
    const res = manager.updateSettings(playerId, {
      target: patch?.target,
      timeLimitSec: patch?.timeLimitSec,
      skipPenalty: patch?.skipPenalty,
    });
    if (!res.ok) return ack(res);
    ack({ ok: true });
    ctx.broadcastState(res.room);
  });

  socket.on('room:kick', (payload, ack) => {
    if (typeof ack !== 'function') return;
    const res = manager.kick(playerId, payload?.playerId);
    if (!res.ok) return ack(res);
    const targetId = payload.playerId;
    // Primero se le avisa (después ya no estará en el canal de la sala).
    for (const s of ctx.io.sockets.values()) {
      if (s.data.playerId === targetId) s.emit('room:kicked');
    }
    ctx.removePlayer(targetId, `${res.nickname} fue expulsado por el host`);
    ack({ ok: true });
  });

  socket.on('room:password', (payload, ack) => {
    if (typeof ack !== 'function') return;
    const res = manager.setPassword(playerId, payload?.password ?? null);
    if (!res.ok) return ack(res);
    ack({ ok: true });
    ctx.broadcastState(res.room);
  });

  socket.on('room:leave', () => {
    ctx.removePlayer(playerId);
  });
}
