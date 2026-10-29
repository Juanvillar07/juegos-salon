import { describe, expect, it } from 'vitest';
import { RoomManager as RallyManager } from '../../src/games/rally-de-letras/domain/RoomManager.js';
import { RoomManager as SilabasManager } from '../../src/games/carrera-de-silabas/domain/RoomManager.js';

/** Lo común a los dos juegos que se prueba aquí: expulsar a un jugador. */
type Manager = RallyManager | SilabasManager;

const games: [string, (now: () => number) => Manager][] = [
  [
    'Rally de Letras',
    (now) => new RallyManager({ now, pickText: () => ({ id: 0, text: 'hola mundo' }), generateCode: () => 'ROOM0' }),
  ],
  [
    'Carrera de Sílabas',
    (now) =>
      new SilabasManager({
        now,
        isWord: () => true,
        pickSyllables: (n) => Array.from({ length: n }, () => 'a'),
        generateCode: () => 'ROOM0',
      }),
  ],
];

describe.each(games)('%s: expulsar', (_name, create) => {
  function setup() {
    const manager = create(() => 1_000_000);
    manager.createRoom('a', 'Ana');
    manager.joinRoom('ROOM0', 'b', 'Beto');
    return { manager };
  }

  it('el host expulsa: el expulsado sale y no puede volver a entrar', () => {
    const { manager } = setup();
    expect(manager.kick('a', 'b')).toMatchObject({ ok: true, nickname: 'Beto' });
    manager.leaveRoom('b');
    expect(manager.getRoomOfPlayer('b')).toBeUndefined();
    expect(manager.joinRoom('ROOM0', 'b', 'Beto')).toEqual({ ok: false, error: 'El host te expulsó de esta sala' });
  });

  it('solo el host expulsa, y no a sí mismo ni a quien no está', () => {
    const { manager } = setup();
    expect(manager.kick('b', 'a')).toMatchObject({ ok: false, error: 'Solo el host puede expulsar' });
    expect(manager.kick('a', 'a')).toMatchObject({ ok: false });
    expect(manager.kick('a', 'nadie')).toMatchObject({ ok: false, error: 'Ese jugador no está en la sala' });
  });

});
