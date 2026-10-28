import { describe, expect, it } from 'vitest';
import { SESSION_A, SESSION_B, createRoom, joinRoom, nextState, sleep, useTestServer } from './helpers.js';

const GRACE_MS = 300;
const { join } = useTestServer({ graceMs: GRACE_MS });

describe('reconexión al recargar la página', () => {
  it('el creador que recarga vuelve a su sala con el mismo id (antes la sala se borraba)', async () => {
    const first = await join(SESSION_A);
    const code = await createRoom(first.client, 'Ana');

    first.client.disconnect(); // recarga
    const second = await join(SESSION_A);

    expect(second.ready.playerId).toBe(first.ready.playerId);
    expect(second.ready.room?.code).toBe(code);
    expect(second.ready.room?.players).toEqual([expect.objectContaining({ nickname: 'Ana', status: 'connected' })]);
    expect(second.ready.room?.hostId).toBe(first.ready.playerId);
  });

  it('quien se unió también recupera su lugar y los demás lo ven reconectando y de vuelta', async () => {
    const host = await join(SESSION_A);
    const code = await createRoom(host.client, 'Ana');
    const guest = await join(SESSION_B);
    await joinRoom(guest.client, code, 'Beto');

    const sawReconnecting = nextState(host.client, (s) => s.players.some((p) => p.status === 'reconnecting'));
    guest.client.disconnect();
    await sawReconnecting;

    const sawBack = nextState(host.client, (s) => s.players.every((p) => p.status === 'connected'));
    const again = await join(SESSION_B);
    await sawBack;
    expect(again.ready.room?.players.map((p) => p.nickname)).toEqual(['Ana', 'Beto']);
  });

  it('volver a mandar room:join tras recargar es inofensivo', async () => {
    const first = await join(SESSION_A);
    const code = await createRoom(first.client, 'Ana');
    first.client.disconnect();
    const second = await join(SESSION_A);
    expect(await joinRoom(second.client, code, 'Ana')).toEqual({ ok: true });
  });

  it('si no vuelve a tiempo, la sala vacía se elimina', async () => {
    const first = await join(SESSION_A);
    const code = await createRoom(first.client, 'Ana');
    first.client.disconnect();
    await sleep(GRACE_MS + 150);

    const later = await join(SESSION_A);
    expect(later.ready.room).toBeNull();
    expect(await joinRoom(later.client, code, 'Ana')).toEqual({ ok: false, error: 'La sala no existe' });
  });

  it('si el host no vuelve a tiempo, otro jugador pasa a ser host', async () => {
    const host = await join(SESSION_A);
    const code = await createRoom(host.client, 'Ana');
    const guest = await join(SESSION_B);
    await joinRoom(guest.client, code, 'Beto');

    const newHost = nextState(guest.client, (s) => s.hostId === guest.ready.playerId);
    host.client.disconnect();
    const state = await newHost;
    expect(state.players.map((p) => p.nickname)).toEqual(['Beto']);
  });

  it('la misma sesión en otra pestaña reemplaza a la conexión anterior', async () => {
    const first = await join(SESSION_A);
    await createRoom(first.client, 'Ana');
    const replaced = new Promise<void>((resolve) => first.client.once('session:replaced', resolve));
    const second = await join(SESSION_A);
    await replaced;
    expect(second.ready.room?.players).toHaveLength(1);
  });
});
