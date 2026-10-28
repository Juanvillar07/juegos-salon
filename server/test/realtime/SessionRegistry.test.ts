import { describe, expect, it } from 'vitest';
import { SessionRegistry } from '../../src/games/rally-de-letras/realtime/SessionRegistry.js';

const VALID = 'abcdef12-3456-7890-abcd-ef1234567890';

describe('SessionRegistry', () => {
  it('devuelve la misma sesión (y el mismo jugador) para el mismo sessionId', () => {
    const sessions = new SessionRegistry();
    const first = sessions.resolve(VALID);
    expect(sessions.resolve(VALID)).toBe(first);
    expect(first.sessionId).toBe(VALID);
    expect(first.playerId).not.toBe(VALID);
  });

  it('crea una sesión nueva si el sessionId falta o no es válido', () => {
    const sessions = new SessionRegistry();
    const a = sessions.resolve(undefined);
    const b = sessions.resolve('corto');
    expect(a.sessionId).not.toBe(b.sessionId);
    expect(b.sessionId).not.toBe('corto');
  });

  it('attach devuelve el socket anterior si la sesión seguía conectada', () => {
    const sessions = new SessionRegistry();
    const s = sessions.resolve(VALID);
    expect(sessions.attach(s, 'socket-1')).toBeNull();
    expect(sessions.attach(s, 'socket-2')).toBe('socket-1');
  });

  it('detach ignora sockets que ya fueron reemplazados', () => {
    const sessions = new SessionRegistry();
    const s = sessions.resolve(VALID);
    sessions.attach(s, 'socket-1');
    sessions.attach(s, 'socket-2');
    expect(sessions.detach(VALID, 'socket-1')).toBe(false);
    expect(sessions.isConnected(VALID)).toBe(true);
    expect(sessions.detach(VALID, 'socket-2')).toBe(true);
    expect(sessions.isConnected(VALID)).toBe(false);
  });
});
