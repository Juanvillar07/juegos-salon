import { describe, expect, it } from 'vitest';
import { createRoom, joinRoom, nextEvent, nextState, useTestServer } from './helpers.js';

const { join } = useTestServer();

/** Sala con Ana (host) y Beto, ya en carrera. */
async function racingRoom() {
  const ana = (await join('aaaaaaaa-0000-0000-0000-000000000001')).client;
  const beto = (await join('bbbbbbbb-0000-0000-0000-000000000002')).client;
  const code = await createRoom(ana, 'Ana');
  await joinRoom(beto, code, 'Beto');
  const started = nextState(beto, (s) => s.phase === 'racing');
  ana.emit('race:start');
  await started;
  return { ana, beto };
}

describe('volver a la sala y cancelar la carrera', () => {
  it('un jugador vuelve a la sala: los demás lo ven retirado y la carrera sigue', async () => {
    const { ana, beto } = await racingRoom();
    const notice = nextEvent(ana, 'chat:message');
    const state = nextState(ana, (s) => s.players.some((p) => p.retired));
    beto.emit('race:retire');
    expect(await notice).toMatchObject({ kind: 'system', text: 'Beto volvió a la sala' });
    const s = await state;
    expect(s.phase).toBe('racing');
    expect(s.players.find((p) => p.nickname === 'Beto')).toMatchObject({ retired: true, status: 'connected' });
  });

  it('si vuelven todos sin que nadie llegue, la carrera se cancela', async () => {
    const { ana, beto } = await racingRoom();
    beto.emit('race:retire');
    await nextState(ana, (s) => s.players.some((p) => p.retired));
    const lobby = nextState(beto, (s) => s.phase === 'lobby');
    ana.emit('race:retire');
    const s = await lobby;
    expect(s.results).toBeNull();
    expect(s.players.every((p) => !p.retired)).toBe(true);
  });

  it('el host cancela la carrera y todos vuelven al lobby', async () => {
    const { ana, beto } = await racingRoom();
    const notice = nextEvent(beto, 'chat:message');
    const lobby = nextState(beto, (s) => s.phase === 'lobby');
    ana.emit('race:cancel');
    expect(await notice).toMatchObject({ kind: 'system', text: 'El host canceló la carrera' });
    expect((await lobby).text).toBeNull();
  });

  it('un jugador que no es host no puede cancelar', async () => {
    const { beto } = await racingRoom();
    const error = nextEvent(beto, 'error');
    beto.emit('race:cancel');
    expect(await error).toEqual({ message: 'Solo el host puede cancelar la carrera' });
  });
});
