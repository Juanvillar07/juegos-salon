import { describe, expect, it } from 'vitest';
import type { Ack } from '@typeracer/shared';
import { createRoom, joinRoom, nextEvent, nextState, useTestServer, type Client } from './helpers.js';

const AUTO_MS = 400;
const { join } = useTestServer({ autoStartMs: AUTO_MS });

function setReady(client: Client, ready = true): Promise<Ack> {
  return new Promise((resolve) => client.emit('player:ready', { ready }, resolve));
}

/** Sala con Ana (host) y los nombres indicados. */
async function room(...names: string[]) {
  const ana = await join('aaaaaaaa-0000-0000-0000-000000000001');
  const code = await createRoom(ana.client, 'Ana');
  const others: Client[] = [];
  for (const [i, name] of names.entries()) {
    const p = await join(`cccccccc-0000-0000-0000-00000000000${i}`);
    await joinRoom(p.client, code, name);
    others.push(p.client);
  }
  return { ana: ana.client, others };
}

describe('salida automática por listos', () => {
  it('cuando todos se marcan listos la carrera arranca sola, sin el host', async () => {
    const { ana, others } = await room('Beto');
    await setReady(ana);
    const countdown = nextEvent(others[0], 'race:countdown');
    const notice = nextEvent(others[0], 'chat:message');
    await setReady(others[0]);
    expect((await countdown).text).toBe('hola mundo');
    expect(await notice).toMatchObject({ kind: 'system', text: '¡Todos listos! Arranca la carrera' });
  });

  it('con mayoría lista se avisa la hora de salida y arranca al cumplirse la espera', async () => {
    const { ana, others } = await room('Beto', 'Caro');
    const scheduled = nextState(ana, (s) => s.autoStartAt !== null);
    await setReady(ana);
    await setReady(others[0]); // 2 de 3
    const state = await scheduled;
    expect(state.autoStartAt! - state.serverNow).toBeGreaterThan(0);
    expect(state.autoStartAt! - state.serverNow).toBeLessThanOrEqual(AUTO_MS);

    const started = await nextState(others[1], (s) => s.phase === 'racing');
    expect(started.autoStartAt).toBeNull();
  });

  it('si alguien se desmarca y se pierde la mayoría, no arranca', async () => {
    const { ana, others } = await room('Beto', 'Caro');
    await setReady(ana);
    await setReady(others[0]);
    const cancelled = nextState(ana, (s) => s.autoStartAt === null);
    await setReady(others[0], false);
    await cancelled;

    await new Promise((r) => setTimeout(r, AUTO_MS + 150));
    const still = nextState(ana, () => true);
    others[1].emit('chat:send', { text: 'sigo aquí' }, () => {});
    ana.emit('player:customize', { car: 'f1' }, () => {});
    expect((await still).phase).toBe('lobby');
  });
});
