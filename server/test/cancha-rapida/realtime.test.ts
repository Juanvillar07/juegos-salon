import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import {
  GAME_NAMESPACE,
  KEY,
  decodeSnapshot,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SnapshotPayload,
} from '@typeracer/shared/cancha-rapida';
import { createAppServer } from '../../src/app.js';
import { RoomManager } from '../../src/games/cancha-rapida/domain/RoomManager.js';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

describe('Cancha Rápida en tiempo real', () => {
  let server: ReturnType<typeof createAppServer>;
  let url = '';
  const clients: Client[] = [];

  beforeEach(async () => {
    server = createAppServer({
      corsOrigins: ['*'],
      reconnectGraceMs: 300,
      cancha: new RoomManager({ countdownMs: 100 }),
    });
    await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
    url = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    clients.splice(0).forEach((c) => c.disconnect());
    await server.close();
  });

  async function join(sessionId: string) {
    const client: Client = connect(url + GAME_NAMESPACE, { auth: { sessionId }, transports: ['websocket'], forceNew: true });
    clients.push(client);
    const ready = await new Promise<Parameters<ServerToClientEvents['session:ready']>[0]>((r) =>
      client.once('session:ready', r),
    );
    return { client, playerId: ready.playerId };
  }

  it('las teclas mueven al jugador y llegan unas 30 instantáneas por segundo', async () => {
    const ana = await join('aaaaaaaa-0000-0000-0000-00000000000a');
    const beto = await join('bbbbbbbb-0000-0000-0000-00000000000b');
    const code = await new Promise<string>((resolve, reject) =>
      ana.client.emit('room:create', { nickname: 'Ana' }, (res) => (res.ok ? resolve(res.code) : reject(new Error(res.error)))),
    );
    await new Promise((resolve) => beto.client.emit('room:join', { code, nickname: 'Beto' }, resolve));

    const countdown = new Promise((resolve) => beto.client.once('match:countdown', resolve));
    expect(await new Promise((resolve) => ana.client.emit('match:start', resolve))).toEqual({ ok: true });
    await countdown;

    const snapshots: SnapshotPayload[] = [];
    beto.client.on('match:snapshot', (s) => snapshots.push(s));
    ana.client.emit('input', KEY.right);
    await new Promise((r) => setTimeout(r, 1100));

    // Contando desde la segunda instantánea, para no depender de cuándo empezó a escuchar.
    const span = snapshots.at(-1)!.t - snapshots[0].t;
    const perSecond = ((snapshots.length - 1) * 1000) / span;
    expect(perSecond).toBeGreaterThan(20);
    expect(perSecond).toBeLessThan(40);

    // Ana es la primera (puesto 0) y avanzó hacia la derecha.
    const first = decodeSnapshot(snapshots[0]).players.get(0)!;
    const last = decodeSnapshot(snapshots.at(-1)!).players.get(0)!;
    expect(last.x).toBeGreaterThan(first.x + 50);
    // Cada instantánea es pequeña: es lo que más tráfico gasta.
    expect(JSON.stringify(snapshots.at(-1)).length).toBeLessThan(200);
  });

  it('/health informa de los partidos en curso y del coste de cada paso', async () => {
    const res = await fetch(`${url}/health`);
    const body = (await res.json()) as { games: Record<string, { rooms: number; matches: number; tickMs: number }> };
    expect(body.games['cancha-rapida']).toEqual({ rooms: 0, matches: 0, tickMs: 0 });
  });
});
