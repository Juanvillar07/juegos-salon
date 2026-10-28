import { describe, expect, it } from 'vitest';
import { CHAT_COOLDOWN_MS, CHAT_HISTORY_SIZE, MAX_CHAT_LENGTH } from '@typeracer/shared';
import { RoomManager } from '../../src/games/rally-de-letras/domain/RoomManager.js';

function setup() {
  let clock = 1_000_000;
  const manager = new RoomManager({ now: () => clock, pickText: () => ({ id: 0, text: 'hola mundo' }), generateCode: () => 'ROOM1' });
  const created = manager.createRoom('a', 'Ana');
  if (!created.ok) throw new Error(created.error);
  return {
    manager,
    room: created.room,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe('RoomManager: chat', () => {
  it('guarda el mensaje con autor, color y hora', () => {
    const { manager, room } = setup();
    const res = manager.sendChat('a', 'hola a todos');
    expect(res.ok && res.message).toMatchObject({
      id: 1,
      kind: 'player',
      playerId: 'a',
      nickname: 'Ana',
      color: room.players.get('a')!.color,
      text: 'hola a todos',
      at: 1_000_000,
    });
    expect(room.chat).toHaveLength(1);
  });

  it('limpia saltos de línea y espacios, y recorta mensajes largos', () => {
    const { manager } = setup();
    const res = manager.sendChat('a', '  hola\n\n   mundo  ');
    expect(res.ok && res.message.text).toBe('hola mundo');
    const { manager: m2 } = setup();
    const long = m2.sendChat('a', 'x'.repeat(MAX_CHAT_LENGTH + 50));
    expect(long.ok && long.message.text.length).toBe(MAX_CHAT_LENGTH);
  });

  it('rechaza mensajes vacíos y de quien no está en una sala', () => {
    const { manager } = setup();
    expect(manager.sendChat('a', '   ').ok).toBe(false);
    expect(manager.sendChat('nadie', 'hola').ok).toBe(false);
  });

  it('limita la frecuencia de mensajes por jugador', () => {
    const { manager, advance } = setup();
    expect(manager.sendChat('a', 'uno').ok).toBe(true);
    expect(manager.sendChat('a', 'dos')).toEqual({ ok: false, error: 'Vas muy rápido, espera un momento' });
    advance(CHAT_COOLDOWN_MS);
    expect(manager.sendChat('a', 'dos').ok).toBe(true);
  });

  it(`conserva solo los últimos ${CHAT_HISTORY_SIZE} mensajes`, () => {
    const { manager, room } = setup();
    for (let i = 0; i < CHAT_HISTORY_SIZE + 5; i++) manager.postSystemMessage('ROOM1', `aviso ${i}`);
    expect(room.chat).toHaveLength(CHAT_HISTORY_SIZE);
    expect(room.chat[0].text).toBe('aviso 5');
    expect(room.chat.at(-1)!.id).toBe(CHAT_HISTORY_SIZE + 5);
  });

  it('los avisos del sistema no tienen autor', () => {
    const { manager } = setup();
    expect(manager.postSystemMessage('ROOM1', 'Beto entró a la sala')).toMatchObject({
      kind: 'system',
      playerId: null,
      text: 'Beto entró a la sala',
    });
    expect(manager.postSystemMessage('NOPE1', 'x')).toBeNull();
  });
});
