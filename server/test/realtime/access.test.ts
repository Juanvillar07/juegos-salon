import { describe, expect, it } from 'vitest';
import type { JoinAck } from '@typeracer/shared';
import { createRoom, nextEvent, nextState, useTestServer, type Client } from './helpers.js';

const { join } = useTestServer();

function joinWith(client: Client, code: string, nickname: string, password?: string): Promise<JoinAck> {
  return new Promise((resolve) => client.emit('room:join', { code, nickname, password }, resolve));
}

describe('expulsar y contraseña por socket', () => {
  it('el host expulsa: al expulsado le llega room:kicked y no puede volver', async () => {
    const ana = (await join('aaaaaaaa-0000-0000-0000-000000000001')).client;
    const { client: beto, ready } = await join('bbbbbbbb-0000-0000-0000-000000000002');
    const code = await createRoom(ana, 'Ana');
    await joinWith(beto, code, 'Beto');

    const kicked = nextEvent(beto, 'room:kicked');
    const notice = new Promise<string>((resolve) =>
      ana.on('chat:message', (m) => {
        if (m.text.includes('expulsado')) resolve(m.text);
      }),
    );
    const ack = await new Promise((resolve) => ana.emit('room:kick', { playerId: ready.playerId }, resolve));
    expect(ack).toEqual({ ok: true });
    await kicked;
    expect(await notice).toBe('Beto fue expulsado por el host');
    expect(await joinWith(beto, code, 'Beto')).toEqual({ ok: false, error: 'El host te expulsó de esta sala' });
  });

  it('con contraseña, entrar sin ella pide la contraseña; con ella se entra', async () => {
    const ana = (await join('aaaaaaaa-0000-0000-0000-000000000001')).client;
    const beto = (await join('bbbbbbbb-0000-0000-0000-000000000002')).client;
    const code = await createRoom(ana, 'Ana');
    const locked = nextState(ana, (s) => s.locked);
    expect(await new Promise((resolve) => ana.emit('room:password', { password: 'clave1' }, resolve))).toEqual({
      ok: true,
    });
    await locked;

    expect(await joinWith(beto, code, 'Beto')).toMatchObject({ ok: false, needsPassword: true });
    expect(await joinWith(beto, code, 'Beto', 'clave1')).toEqual({ ok: true });
  });
});
