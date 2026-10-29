/** Identificador del juego en el portal: ruta del cliente y namespace de Socket.IO. */
export const GAME_ID = 'cancha-rapida';
export const GAME_NAMESPACE = `/${GAME_ID}`;

/** El servidor simula la física a este ritmo (pasos por segundo). */
export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;
/** Se envía una instantánea cada tantos pasos: 30 por segundo. */
export const SNAPSHOT_EVERY = 2;

/** Jugadores por equipo; el resto de la sala mira como espectador. */
export const MAX_PER_TEAM = 4;
/** Personas por sala, contando a los espectadores. */
export const MAX_ROOM_PLAYERS = 12;

/** Tras un gol, la jugada sigue (el balón en la red) antes de volver al saque. */
export const GOAL_PAUSE_MS = 2000;

/** Color de cada equipo (camisetas, chat y marcador). */
export const TEAM_COLORS = { red: '#e5534b', blue: '#4a8fe7', spectator: '#8b8b93' } as const;
export const TEAM_NAMES = { red: 'Rojo', blue: 'Azul', spectator: 'Espectadores' } as const;
