/** Identificador del juego en el portal: ruta del cliente y namespace de Socket.IO. */
export const GAME_ID = 'carrera-de-silabas';
export const GAME_NAMESPACE = `/${GAME_ID}`;

/** Límite de seguridad: si nadie llega a la meta, la carrera termina igual. */
export const RACE_LIMIT_MS = 5 * 60 * 1000;
export const MIN_WORD_LENGTH = 3;
export const MAX_WORD_LENGTH = 30;
/** Tiempo mínimo entre dos intentos de un mismo jugador. */
export const SUBMIT_COOLDOWN_MS = 300;
