import { describe, expect, it } from 'vitest';
import { PASSWORD_ATTEMPTS_PER_MINUTE } from '@typeracer/shared';
import { RoomManager as RallyManager } from '../../src/games/rally-de-letras/domain/RoomManager.js';
import { RoomManager as SilabasManager } from '../../src/games/carrera-de-silabas/domain/RoomManager.js';

/** Lo común a los dos juegos que se prueba aquí: salas, expulsión y contraseña. */
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

describe.each(games)('%s: expulsar y contraseña', (_name, create) => {
  function setup() {
    let clock = 1_000_000;
    const manager = create(() => clock);
    manager.createRoom('a', 'Ana');
    manager.joinRoom('ROOM0', 'b', 'Beto');
    return {
      manager,
      advance: (ms: number) => {
        clock += ms;
      },
    };
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

  it('con contraseña: sin ella pide la contraseña, con la incorrecta la rechaza y con la buena entra', () => {
    const { manager } = setup();
    expect(manager.setPassword('a', '  clave1  ').ok).toBe(true);
    const room = manager.getRoom('ROOM0')!;
    expect(manager.toState(room as never).locked).toBe(true);
    expect(JSON.stringify(manager.toState(room as never))).not.toContain('clave1');

    expect(manager.joinRoom('ROOM0', 'c', 'Caro')).toEqual({ ok: false, error: 'Esta sala tiene contraseña', needsPassword: true });
    expect(manager.joinRoom('ROOM0', 'c', 'Caro', {}, 'otra')).toEqual({
      ok: false,
      error: 'Contraseña incorrecta',
      needsPassword: true,
    });
    expect(manager.joinRoom('ROOM0', 'c', 'Caro', {}, 'clave1')).toMatchObject({ ok: true });
  });

  it('quien ya está dentro vuelve sin contraseña (p. ej. al recargar)', () => {
    const { manager } = setup();
    manager.setPassword('a', 'clave1');
    manager.disconnect('b');
    expect(manager.joinRoom('ROOM0', 'b', 'Beto')).toMatchObject({ ok: true });
  });

  it(`tras ${PASSWORD_ATTEMPTS_PER_MINUTE} intentos fallidos hay que esperar un minuto`, () => {
    const { manager, advance } = setup();
    manager.setPassword('a', 'clave1');
    for (let i = 0; i < PASSWORD_ATTEMPTS_PER_MINUTE; i++) manager.joinRoom('ROOM0', 'c', 'Caro', {}, `mal${i}`);
    expect(manager.joinRoom('ROOM0', 'c', 'Caro', {}, 'clave1')).toMatchObject({
      ok: false,
      error: 'Demasiados intentos: espera un minuto',
    });
    advance(60_000);
    expect(manager.joinRoom('ROOM0', 'c', 'Caro', {}, 'clave1')).toMatchObject({ ok: true });
  });

  it('solo el host pone o quita la contraseña, y se valida', () => {
    const { manager } = setup();
    expect(manager.setPassword('b', 'x')).toMatchObject({ ok: false });
    expect(manager.setPassword('a', '   ')).toMatchObject({ ok: false });
    expect(manager.setPassword('a', 'x'.repeat(31))).toMatchObject({ ok: false });
    manager.setPassword('a', 'clave1');
    expect(manager.setPassword('a', null).ok).toBe(true);
    expect(manager.joinRoom('ROOM0', 'c', 'Caro')).toMatchObject({ ok: true });
  });
});
