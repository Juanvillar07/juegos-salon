import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { COUNTDOWN_MS } from '@typeracer/shared';
import {
  GAME_NAMESPACE,
  SUBMIT_COOLDOWN_MS,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type WordAck,
} from '@typeracer/shared/carrera-de-silabas';
import { createAppServer } from '../../../src/app.js';
import { RoomManager } from '../../../src/games/carrera-de-silabas/domain/RoomManager.js';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const SESSION_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const SESSION_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const WORDS = new Set(['trabajo', 'tractor', 'casa', 'camion']);

let url = '';
let server: ReturnType<typeof createAppServer>;
const clients: Client[] = [];
/** Adelanto del reloj del gestor, para saltarse el semáforo sin esperar 3 s. */
let shift = 0;

beforeEach(async () => {
  shift = 0;
  const silabas = new RoomManager({
    now: () => Date.now() + shift,
    isWord: (w) => WORDS.has(w),
    pickSyllables: (count) => Array.from({ length: count }, (_, i) => (i % 2 === 0 ? 'tra' : 'ca')),
  });
  server = createAppServer({ corsOrigins: ['*'], silabas, reconnectGraceMs: 300 });
  await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
  url = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  clients.splice(0).forEach((c) => c.disconnect());
  await server.close();
});

async function join(sessionId: string): Promise<Client> {
  const client: Client = connect(url + GAME_NAMESPACE, { auth: { sessionId }, transports: ['websocket'], forceNew: true });
  clients.push(client);
  await new Promise((resolve) => client.once('session:ready', resolve));
  return client;
}

const word = (client: Client, w: string) =>
  new Promise<WordAck>((resolve) => client.emit('race:word', { word: w }, resolve));

describe('Carrera de Sílabas por socket', () => {
  it('/health informa las salas del juego', async () => {
    const res = await fetch(`${url}/health`);
    expect(await res.json()).toEqual({ ok: true, games: { 'carrera-de-silabas': { rooms: 0 } } });
  });

  it('dos jugadores reciben la misma secuencia y ven el marcador del otro, pero no sus palabras', async () => {
    const host = await join(SESSION_A);
    const code = await new Promise<string>((resolve, reject) =>
      host.emit('room:create', { nickname: 'Ana' }, (r) => (r.ok ? resolve(r.code) : reject(new Error(r.error)))),
    );
    const guest = await join(SESSION_B);
    await new Promise((resolve) => guest.emit('room:join', { code, nickname: 'Beto' }, resolve));

    const countdowns = Promise.all([host, guest].map((c) => new Promise<{ syllables: string[] }>((r) => c.once('race:countdown', r))));
    host.emit('race:start');
    const [a, b] = await countdowns;
    expect(a.syllables).toEqual(b.syllables);
    expect(a.syllables.slice(0, 2)).toEqual(['tra', 'ca']);

    shift = COUNTDOWN_MS;
    // Cualquier evento que reciba Beto: ninguno puede llevar la palabra de Ana.
    const guestEvents: unknown[] = [];
    guest.onAny((_event, ...args) => guestEvents.push(args));
    const guestSees = new Promise<Parameters<ServerToClientEvents['race:progress']>[0]>((r) =>
      guest.once('race:progress', r),
    );
    expect(await word(host, 'Trabajo')).toEqual({ ok: true, word: 'trabajo', points: 7, score: 7, syllableIndex: 1, finished: false });
    const { players } = await guestSees;
    expect(players.find((p) => p.score === 7)).toMatchObject({ words: 1, syllableIndex: 1 });
    expect(JSON.stringify(guestEvents)).not.toContain('trabajo');

    shift += SUBMIT_COOLDOWN_MS;
    expect(await word(host, 'tractor')).toEqual({ ok: false, error: 'No contiene «CA»' });
    expect(await word(guest, 'tractor')).toMatchObject({ ok: true, syllableIndex: 1 });
  });

  it('un jugador vuelve a la sala y después el host cancela la carrera', async () => {
    const host = await join(SESSION_A);
    const code = await new Promise<string>((resolve, reject) =>
      host.emit('room:create', { nickname: 'Ana' }, (r) => (r.ok ? resolve(r.code) : reject(new Error(r.error)))),
    );
    const guest = await join(SESSION_B);
    await new Promise((resolve) => guest.emit('room:join', { code, nickname: 'Beto' }, resolve));
    const started = new Promise((r) => guest.once('race:countdown', r));
    host.emit('race:start');
    await started;

    const retired = nextState(host, (s) => s.players.some((p) => p.retired));
    guest.emit('race:retire');
    expect((await retired).players.find((p) => p.nickname === 'Beto')).toMatchObject({ retired: true });
    shift = COUNTDOWN_MS;
    expect(await word(guest, 'trabajo')).toEqual({ ok: false, error: 'Volviste a la sala' });

    const lobby = nextState(guest, (s) => s.phase === 'lobby');
    host.emit('race:cancel');
    const s = await lobby;
    expect(s.syllables).toBeNull();
    expect(s.players.every((p) => !p.retired && p.score === 0)).toBe(true);
  });
});

type Snapshot = Parameters<ServerToClientEvents['room:state']>[0];

function nextState(client: Client, predicate: (s: Snapshot) => boolean): Promise<Snapshot> {
  return new Promise((resolve) => {
    const handler = (s: Snapshot) => {
      if (!predicate(s)) return;
      client.off('room:state', handler);
      resolve(s);
    };
    client.on('room:state', handler);
  });
}
