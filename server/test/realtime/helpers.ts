import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { GAME_NAMESPACE, type Ack, type ClientToServerEvents, type RoomSnapshot, type ServerToClientEvents } from '@typeracer/shared';
import { createAppServer } from '../../src/app.js';
import { RoomManager } from '../../src/games/rally-de-letras/domain/RoomManager.js';

export type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
export type SessionReady = Parameters<ServerToClientEvents['session:ready']>[0];

export const SESSION_A = 'aaaaaaaa-0000-0000-0000-000000000001';
export const SESSION_B = 'bbbbbbbb-0000-0000-0000-000000000002';

/**
 * Levanta un servidor real en un puerto libre antes de cada test y lo cierra después.
 * Devuelve funciones para conectar clientes de Socket.IO contra él.
 */
export function useTestServer(options: { graceMs?: number; autoStartMs?: number } = {}) {
  let url = '';
  let server: ReturnType<typeof createAppServer>;
  const clients: Client[] = [];

  beforeEach(async () => {
    const manager = new RoomManager({ pickText: () => ({ id: 0, text: 'hola mundo' }), autoStartMs: options.autoStartMs });
    server = createAppServer({ corsOrigins: ['*'], manager, reconnectGraceMs: options.graceMs ?? 300 });
    await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
    url = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    clients.splice(0).forEach((c) => c.disconnect());
    await server.close();
  });

  /** Conecta un cliente y espera su session:ready. */
  async function join(sessionId: string): Promise<{ client: Client; ready: SessionReady }> {
    // Cada juego vive en su namespace: el cliente se conecta a /rally-de-letras.
    const client: Client = connect(url + GAME_NAMESPACE, { auth: { sessionId }, transports: ['websocket'], forceNew: true });
    clients.push(client);
    const ready = await new Promise<SessionReady>((resolve) => client.once('session:ready', resolve));
    return { client, ready };
  }

  return { join };
}

export function createRoom(client: Client, nickname: string): Promise<string> {
  return new Promise((resolve, reject) =>
    client.emit('room:create', { nickname }, (res) => (res.ok ? resolve(res.code) : reject(new Error(res.error)))),
  );
}

export function joinRoom(client: Client, code: string, nickname: string): Promise<Ack> {
  return new Promise((resolve) => client.emit('room:join', { code, nickname }, resolve));
}

export function nextState(client: Client, predicate: (s: RoomSnapshot) => boolean): Promise<RoomSnapshot> {
  return new Promise((resolve) => {
    const handler = (s: RoomSnapshot) => {
      if (!predicate(s)) return;
      client.off('room:state', handler);
      resolve(s);
    };
    client.on('room:state', handler);
  });
}

/** Espera el próximo evento de un tipo. */
export function nextEvent<E extends keyof ServerToClientEvents>(
  client: Client,
  event: E,
): Promise<Parameters<ServerToClientEvents[E]>[0]> {
  return new Promise((resolve) => client.once(event, ((arg: never) => resolve(arg)) as never));
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
