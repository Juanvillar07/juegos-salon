import { describe, expect, it } from 'vitest';
import { DEFAULT_KITS, KEY, MAX_PER_TEAM, type TeamKit } from '@typeracer/shared/cancha-rapida';
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

describe('Cancha Rápida: repartir equipos', () => {
  /** Azar reproducible (Park–Miller), para que el reparto no cambie entre ejecuciones. */
  function seeded(seed = 7) {
    let s = seed;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  }

  function room(extra: number, seed?: number) {
    const manager = new RoomManager({ generateCode: () => 'ROOM0', countdownMs: 0, random: seeded(seed) });
    manager.createRoom('a', 'Ana');
    for (let i = 0; i < extra; i++) manager.joinRoom('ROOM0', `p${i}`, `Jugador ${i}`);
    return manager;
  }

  const teams = (m: RoomManager) => {
    const players = [...m.getRoom('ROOM0')!.players.values()];
    return {
      red: players.filter((p) => p.team === 'red').map((p) => p.id),
      blue: players.filter((p) => p.team === 'blue').map((p) => p.id),
      spectator: players.filter((p) => p.team === 'spectator').map((p) => p.id),
    };
  };

  it('al azar: mitad y mitad, y los espectadores siguen mirando', () => {
    const manager = room(6);
    manager.joinTeam('p5', 'spectator');
    const before = teams(manager);
    expect(manager.shuffleTeams('a', 'random')).toMatchObject({ ok: true });
    const after = teams(manager);
    expect(after.red).toHaveLength(3);
    expect(after.blue).toHaveLength(3);
    expect(after.spectator).toEqual(['p5']);
    expect([...after.red, ...after.blue].sort()).toEqual([...before.red, ...before.blue].sort());
  });

  it('al azar cambia el reparto según la suerte', () => {
    const results = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) {
      const manager = room(3, seed);
      manager.shuffleTeams('a', 'random');
      results.add(teams(manager).red.sort().join());
    }
    expect(results.size).toBeGreaterThan(1);
  });

  it('equilibrado: los dos mejores (por victorias y goles) quedan en equipos distintos', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const manager = room(3, seed);
      const players = manager.getRoom('ROOM0')!.players;
      players.get('p1')!.record = { played: 4, wins: 4, goals: 6 };
      players.get('p2')!.record = { played: 4, wins: 3, goals: 5 };
      manager.shuffleTeams('a', 'balanced');
      const { red, blue } = teams(manager);
      expect(red).toHaveLength(2);
      expect(blue).toHaveLength(2);
      expect(red.includes('p1')).not.toBe(red.includes('p2'));
    }
  });

  it('solo el host, entre partidos, con al menos dos jugadores y una forma válida', () => {
    const manager = room(1);
    expect(manager.shuffleTeams('p0', 'random')).toMatchObject({ ok: false });
    expect(manager.shuffleTeams('a', 'sorteo')).toMatchObject({ ok: false, error: 'Forma de repartir no válida' });
    manager.startMatch('a');
    expect(manager.shuffleTeams('a', 'random')).toMatchObject({ ok: false, error: 'Los equipos se cambian entre partidos' });

    const alone = room(1);
    alone.joinTeam('p0', 'spectator');
    expect(alone.shuffleTeams('a', 'random')).toMatchObject({
      ok: false,
      error: 'Hacen falta al menos 2 jugadores en los equipos',
    });
  });
});

describe('Cancha Rápida: desempate y récord', () => {
  it('el host elige el desempate; se valida', () => {
    const { manager, room } = setup(1);
    expect(room.settings.tiebreak).toBe('draw');
    expect(manager.updateSettings('a', { tiebreak: 'penalties' })).toMatchObject({ ok: true });
    expect(room.settings.tiebreak).toBe('penalties');
    expect(manager.updateSettings('a', { tiebreak: 'tanda' as never })).toMatchObject({ ok: false, error: 'Desempate no válido' });
    expect(manager.updateSettings('p0', { tiebreak: 'goldenGoal' })).toMatchObject({ ok: false });
  });

  it('el resultado dice cómo se rompió el empate; en penaltis gana la tanda aunque el marcador quede igual', () => {
    const { manager, room } = setup(1);
    manager.startMatch('a');
    Object.assign(room.match!, { stage: 'penalties', penaltyWinner: 'blue' });
    expect(manager.endMatch('ROOM0')).toMatchObject({ winner: 'blue', score: { red: 0, blue: 0 }, tiebreak: 'penalties' });

    manager.startMatch('a');
    room.match!.score = { red: 1, blue: 0 };
    Object.assign(room.match!, { stage: 'goldenGoal' });
    expect(manager.endMatch('ROOM0')).toMatchObject({ winner: 'red', tiebreak: 'goldenGoal', penalties: null });

    manager.startMatch('a');
    expect(manager.endMatch('ROOM0')).toMatchObject({ winner: null, tiebreak: null, penalties: null });
  });

  it('cada partido suma al récord de la sala: jugados, victorias y goles (sin autogoles)', () => {
    const { manager, room } = setup(1);
    manager.startMatch('a');
    room.match!.score = { red: 2, blue: 1 };
    room.match!.goals = [
      { team: 'red', scorerId: 'a', scorerName: 'Ana', ownGoal: false, clockMs: 1000 },
      { team: 'red', scorerId: 'p0', scorerName: 'Jugador 0', ownGoal: true, clockMs: 2000 },
      { team: 'blue', scorerId: 'p0', scorerName: 'Jugador 0', ownGoal: false, clockMs: 3000 },
    ];
    manager.endMatch('ROOM0');
    manager.startMatch('a');
    manager.endMatch('ROOM0');
    const record = (id: string) => manager.toState(room).players.find((p) => p.id === id)!.record;
    expect(record('a')).toEqual({ played: 2, wins: 1, goals: 1 });
    expect(record('p0')).toEqual({ played: 2, wins: 0, goals: 1 });
  });
});

describe('Cancha Rápida: uniformes', () => {
  const GREEN: TeamKit = { primary: '#2f9a5a', secondary: '#f4f4f2', pattern: 'stripes' };

  it('la sala empieza con los uniformes por defecto y el host puede cambiarlos', () => {
    const { manager, room } = setup(1);
    expect(manager.toState(room).kits).toEqual(DEFAULT_KITS);
    expect(manager.setKit('a', 'red', GREEN)).toMatchObject({ ok: true, team: 'red' });
    expect(manager.toState(room).kits.red).toEqual(GREEN);
  });

  it('solo el host, y no durante el partido', () => {
    const { manager } = setup(1);
    expect(manager.setKit('p0', 'red', GREEN)).toMatchObject({ ok: false });
    manager.startMatch('a');
    expect(manager.setKit('a', 'red', GREEN)).toMatchObject({ ok: false, error: 'Los uniformes se cambian entre partidos' });
  });

  it('se valida: colores de la paleta, principal distinto del secundario y del rival', () => {
    const { manager } = setup(1);
    expect(manager.setKit('a', 'red', { ...GREEN, primary: '#123456' })).toMatchObject({ ok: false });
    expect(manager.setKit('a', 'red', { ...GREEN, secondary: GREEN.primary })).toMatchObject({ ok: false });
    expect(manager.setKit('a', 'red', { ...GREEN, pattern: 'cuadros' })).toMatchObject({ ok: false });
    expect(manager.setKit('a', 'red', { ...GREEN, primary: DEFAULT_KITS.blue.primary })).toMatchObject({
      ok: false,
      error: 'El otro equipo ya usa ese color principal',
    });
    expect(manager.setKit('a', 'nadie', GREEN)).toMatchObject({ ok: false });
  });

  it('en el chat, cada jugador sale con el color de su uniforme', () => {
    const { manager } = setup(1);
    manager.setKit('a', 'red', GREEN);
    const res = manager.sendChat('a', 'hola');
    expect(res).toMatchObject({ ok: true, message: { color: GREEN.primary } });
  });
});
