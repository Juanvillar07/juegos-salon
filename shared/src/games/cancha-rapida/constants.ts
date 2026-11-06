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

/**
 * Nombres de los equipos. Por dentro siguen siendo `red` (el local: defiende la izquierda y saca
 * primero) y `blue` (el visitante); los colores los pone el uniforme que elige el host (kits.ts).
 */
export const TEAM_NAMES = { red: 'Local', blue: 'Visitante', spectator: 'Espectadores' } as const;
/** Color de los espectadores (en el chat y la sala), que no llevan uniforme. */
export const SPECTATOR_COLOR = '#8b8b93';
