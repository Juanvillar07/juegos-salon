import { describe, expect, it } from 'vitest';
import type { Ack, ChatMessage } from '@typeracer/shared';
import { SESSION_A, SESSION_B, createRoom, joinRoom, nextEvent, nextState, useTestServer, type Client } from './helpers.js';

const { join } = useTestServer();

function say(client: Client, text: string): Promise<Ack> {
  return new Promise((resolve) => client.emit('chat:send', { text }, resolve));
}

/** Sala con Ana (host) y Beto ya dentro. */
async function twoPlayers() {
  const ana = await join(SESSION_A);
  const code = await createRoom(ana.client, 'Ana');
  const beto = await join(SESSION_B);
  await joinRoom(beto.client, code, 'Beto');
  return { ana: ana.client, beto: beto.client, code };
}

describe('chat de la sala', () => {
  it('los mensajes llegan a todos los de la sala con el autor', async () => {
    const { ana, beto } = await twoPlayers();
    const received = nextEvent(beto, 'chat:message');
    expect(await say(ana, '  ¿listos?  ')).toEqual({ ok: true });
    expect(await received).toMatchObject({ kind: 'player', nickname: 'Ana', text: '¿listos?' });
  });

  it('avisa cuando alguien entra y quien entra recibe el historial', async () => {
    const ana = await join(SESSION_A);
    const code = await createRoom(ana.client, 'Ana');
    await say(ana.client, 'hola');

    const announced = nextEvent(ana.client, 'chat:message');
    const beto = await join(SESSION_B);
    const history = nextEvent(beto.client, 'chat:history');
    const betoSeesOwnEntry = nextEvent(beto.client, 'chat:message');
    await joinRoom(beto.client, code, 'Beto');

    // El historial llega antes del aviso, que después recibe como mensaje normal (sin duplicarse).
    expect((await history).map((m: ChatMessage) => m.text)).toEqual(['hola']);
    expect(await announced).toMatchObject({ kind: 'system', text: 'Beto entró a la sala' });
    expect(await betoSeesOwnEntry).toMatchObject({ text: 'Beto entró a la sala' });
  });

  it('rechaza mensajes vacíos', async () => {
    const { ana } = await twoPlayers();
    expect(await say(ana, '   ')).toEqual({ ok: false, error: 'El mensaje está vacío' });
  });

  it('abandonar en plena carrera saca al jugador, lo avisa en el chat y lo marca en la pista', async () => {
    const { ana, beto } = await twoPlayers();
    ana.emit('race:start');
    await nextState(beto, (s) => s.phase === 'racing');

    const announced = nextEvent(ana, 'chat:message');
    const leftState = nextState(ana, (s) => s.players.some((p) => p.status === 'left'));
    beto.emit('room:leave');

    expect(await announced).toMatchObject({ kind: 'system', text: 'Beto abandonó la carrera' });
    const state = await leftState;
    expect(state.phase).toBe('racing');
    expect(state.players.find((p) => p.nickname === 'Beto')?.status).toBe('left');
  });

  it('si abandona el último que corría, la carrera termina para los demás', async () => {
    const ana = await join(SESSION_A);
    const code = await createRoom(ana.client, 'Ana');
    const beto = await join(SESSION_B);
    await joinRoom(beto.client, code, 'Beto');
    ana.client.emit('race:start');
    await nextState(beto.client, (s) => s.phase === 'racing');

    // Ana abandona; Beto sigue solo en la carrera y además pasa a ser host.
    const newHost = nextState(beto.client, (s) => s.hostId === beto.ready.playerId);
    ana.client.emit('room:leave');
    const state = await newHost;
    expect(state.phase).toBe('racing');
  });
});
