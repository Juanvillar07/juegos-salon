import { describe, expect, it } from 'vitest';
import { KEY, MAX_PER_TEAM } from '@typeracer/shared/cancha-rapida';
import { RoomManager } from '../../src/games/cancha-rapida/domain/RoomManager.js';

function setup(extra = 1) {
  const manager = new RoomManager({ generateCode: () => 'ROOM0', countdownMs: 0 });
  const created = manager.createRoom('a', 'Ana');
  if (!created.ok) throw new Error(created.error);
  for (let i = 0; i < extra; i++) manager.joinRoom('ROOM0', `p${i}`, `Jugador ${i}`);
  return { manager, room: created.room };
}

const teamOf = (m: RoomManager, id: string) => m.getRoom('ROOM0')!.players.get(id)!.team;

describe('Cancha Rápida: salas y equipos', () => {
  it('quien entra va al equipo con menos jugadores; con los equipos llenos, a espectadores', () => {
    const { manager } = setup(MAX_PER_TEAM * 2);
    expect(teamOf(manager, 'a')).toBe('red');
    expect(teamOf(manager, 'p0')).toBe('blue');
    expect(teamOf(manager, 'p1')).toBe('red');
    // Ana + 8 = 9 personas: la novena ya no cabe en ningún equipo.
    expect(teamOf(manager, `p${MAX_PER_TEAM * 2 - 1}`)).toBe('spectator');
  });

  it('cambiar de equipo respeta el máximo, y cada uno puede pasar a espectadores', () => {
    const { manager } = setup(MAX_PER_TEAM * 2);
    expect(manager.joinTeam('p0', 'red')).toMatchObject({ ok: false });
    expect(manager.joinTeam('p0', 'spectator')).toMatchObject({ ok: true });
    expect(manager.joinTeam('p0', 'nada')).toMatchObject({ ok: false, error: 'Ese equipo no existe' });
  });

  it('solo el host mueve a otros y empieza el partido', () => {
    const { manager } = setup(1);
    expect(manager.moveToTeam('p0', 'a', 'spectator')).toMatchObject({ ok: false });
    expect(manager.moveToTeam('a', 'p0', 'red')).toMatchObject({ ok: true });
    expect(teamOf(manager, 'p0')).toBe('red');
    expect(manager.startMatch('p0')).toMatchObject({ ok: false });
    expect(manager.startMatch('a')).toMatchObject({ ok: true });
  });

  it('hace falta al menos un jugador en un equipo; solo se puede practicar', () => {
    const { manager } = setup(0);
    manager.joinTeam('a', 'spectator');
    expect(manager.startMatch('a')).toMatchObject({ ok: false });
    manager.joinTeam('a', 'blue');
    expect(manager.startMatch('a')).toMatchObject({ ok: true });
  });

  it('con el partido en marcha: los equipos no cambian y quien entra mira como espectador', () => {
    const { manager, room } = setup(1);
    manager.startMatch('a');
    expect(manager.joinTeam('p0', 'red')).toMatchObject({ ok: false, error: 'Los equipos se cambian entre partidos' });
    manager.joinRoom('ROOM0', 'c', 'Caro');
    expect(teamOf(manager, 'c')).toBe('spectator');
    expect(manager.toState(room).players.find((p) => p.id === 'c')!.slot).toBeNull();
  });

  it('las teclas de los espectadores y las no válidas se ignoran', () => {
    const { manager, room } = setup(1);
    manager.joinRoom('ROOM0', 'c', 'Caro');
    manager.joinTeam('c', 'spectator');
    manager.startMatch('a');
    manager.setInput('a', 999);
    manager.setInput('c', KEY.right);
    manager.setInput('a', KEY.right);
    expect(room.match!.world.players.find((p) => p.id === 'a')!.keys).toBe(KEY.right);
    expect(room.match!.world.players.some((p) => p.id === 'c')).toBe(false);
  });

  it('si se van todos los de la cancha, el partido se queda vacío', () => {
    const { manager, room } = setup(1);
    manager.joinRoom('ROOM0', 'c', 'Caro');
    manager.joinTeam('c', 'spectator');
    manager.startMatch('a');
    expect(manager.leaveRoom('p0')).toMatchObject({ matchEmpty: false });
    expect(manager.leaveRoom('a')).toMatchObject({ matchEmpty: true, hostChanged: true });
    expect(manager.abortMatch('ROOM0')).toBe(room);
    expect(room.phase).toBe('lobby');
  });

  it('al terminar guarda el resultado con el ganador y los goles de cada uno', () => {
    const { manager, room } = setup(1);
    manager.startMatch('a');
    room.match!.score = { red: 2, blue: 1 };
    room.match!.goals = [
      { team: 'red', scorerId: 'a', scorerName: 'Ana', ownGoal: false, clockMs: 1000 },
      { team: 'red', scorerId: 'p0', scorerName: 'Jugador 0', ownGoal: true, clockMs: 2000 },
      { team: 'blue', scorerId: 'p0', scorerName: 'Jugador 0', ownGoal: false, clockMs: 3000 },
    ];
    const result = manager.endMatch('ROOM0')!;
    expect(result).toMatchObject({ winner: 'red', score: { red: 2, blue: 1 } });
    const state = manager.toState(room);
    expect(state.phase).toBe('finished');
    // El autogol no cuenta como gol del jugador.
    expect(state.players.find((p) => p.id === 'p0')!.goals).toBe(1);
    expect(manager.resetToLobby('a')).toMatchObject({ ok: true });
  });

  it('el expulsado no puede volver', () => {
    const { manager } = setup(1);
    expect(manager.kick('a', 'p0')).toMatchObject({ ok: true, nickname: 'Jugador 0' });
    manager.leaveRoom('p0');
    expect(manager.joinRoom('ROOM0', 'p0', 'Jugador 0')).toMatchObject({ ok: false });
  });
});
