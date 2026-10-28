import { describe, expect, it } from 'vitest';
import { COUNTDOWN_MS, DEFAULT_SETTINGS } from '@typeracer/shared';
import { RoomManager } from '../../src/games/rally-de-letras/domain/RoomManager.js';

const CATALOG_TEXT = { id: 3, text: 'texto del catálogo para la carrera' };
const CUSTOM = 'Este es un texto pegado por el host para la carrera.';

function setup() {
  let clock = 1_000_000;
  const manager = new RoomManager({ now: () => clock, pickText: () => CATALOG_TEXT, generateCode: () => 'ROOM1' });
  const created = manager.createRoom('a', 'Ana');
  if (!created.ok) throw new Error(created.error);
  manager.joinRoom('ROOM1', 'b', 'Beto');
  return {
    manager,
    room: created.room,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe('RoomManager: ajustes de sala', () => {
  it('empieza con texto aleatorio y 3 minutos', () => {
    const { room, manager } = setup();
    expect(room.settings).toEqual(DEFAULT_SETTINGS);
    expect(manager.toState(room).settings).toEqual({
      timeLimitSec: 180,
      customText: null,
      textLength: 'any',
      plainText: false,
    });
  });

  it('el host puede pegar un texto propio y se usa al empezar', () => {
    const { manager, room } = setup();
    expect(manager.updateSettings('a', { customText: CUSTOM }).ok).toBe(true);
    manager.startRace('a');
    expect(room.text?.text).toBe(CUSTOM);
    expect(manager.toState(room).text).toBe(CUSTOM);
  });

  it('el texto pegado se normaliza (espacios, saltos de línea y comillas tipográficas)', () => {
    const { manager, room } = setup();
    manager.updateSettings('a', { customText: '  “Hola”,   dijo—\n\n   el piloto…  y aceleró. ' });
    expect(room.settings.customText).toBe('"Hola", dijo- el piloto... y aceleró.');
  });

  it('volver a null regresa a los textos del catálogo', () => {
    const { manager, room } = setup();
    manager.updateSettings('a', { customText: CUSTOM });
    manager.updateSettings('a', { customText: null });
    manager.startRace('a');
    expect(room.text).toEqual(CATALOG_TEXT);
  });

  it('rechaza textos demasiado cortos o largos', () => {
    const { manager, room } = setup();
    expect(manager.updateSettings('a', { customText: 'corto' }).ok).toBe(false);
    expect(manager.updateSettings('a', { customText: 'a '.repeat(1000) }).ok).toBe(false);
    expect(room.settings.customText).toBeNull();
  });

  it('el límite de tiempo define endsAt', () => {
    const { manager, room } = setup();
    expect(manager.updateSettings('a', { timeLimitSec: 60 }).ok).toBe(true);
    manager.startRace('a');
    expect(manager.toState(room).endsAt).toBe(room.startAt! + 60_000);
    expect(room.startAt).toBe(1_000_000 + COUNTDOWN_MS);
  });

  it('rechaza límites de tiempo fuera de rango o no enteros', () => {
    const { manager } = setup();
    expect(manager.updateSettings('a', { timeLimitSec: 5 }).ok).toBe(false);
    expect(manager.updateSettings('a', { timeLimitSec: 5000 }).ok).toBe(false);
    expect(manager.updateSettings('a', { timeLimitSec: 60.5 }).ok).toBe(false);
  });

  it('solo el host puede cambiarlos y nunca durante la carrera', () => {
    const { manager } = setup();
    expect(manager.updateSettings('b', { timeLimitSec: 60 })).toEqual({
      ok: false,
      error: 'Solo el host puede cambiar los ajustes',
    });
    manager.startRace('a');
    expect(manager.updateSettings('a', { timeLimitSec: 60 }).ok).toBe(false);
  });

  it('un cambio inválido no aplica nada del parche', () => {
    const { manager, room } = setup();
    expect(manager.updateSettings('a', { timeLimitSec: 60, customText: 'corto' }).ok).toBe(false);
    expect(room.settings.timeLimitSec).toBe(180);
  });

  it('los ajustes se conservan en "Otra carrera"', () => {
    const { manager, room, advance } = setup();
    manager.updateSettings('a', { customText: CUSTOM, timeLimitSec: 90 });
    manager.startRace('a');
    advance(COUNTDOWN_MS + 1000);
    manager.endRace(room.code);
    manager.resetToLobby('a');
    expect(room.settings).toEqual({ customText: CUSTOM, timeLimitSec: 90, textLength: 'any', plainText: false });
  });
});
