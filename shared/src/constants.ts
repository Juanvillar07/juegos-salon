/** Identificador del juego en el portal: ruta del cliente y namespace de Socket.IO. */
export const GAME_ID = 'rally-de-letras';
export const GAME_NAMESPACE = `/${GAME_ID}`;

export const MAX_PLAYERS = 8;
export const ROOM_CODE_LENGTH = 5;
export const MAX_NICKNAME_LENGTH = 20;
/** Velocidad máxima plausible; las actualizaciones que la superan se ignoran. */
export const MAX_WPM = 250;
export const COUNTDOWN_MS = 3000;
export const RACE_LIMIT_MS = 3 * 60 * 1000;
/** Con más de la mitad de los pilotos listos, la carrera arranca sola tras esta espera. */
export const AUTO_START_MS = 15_000;
export const PROGRESS_THROTTLE_MS = 150;
/** Tiempo que el servidor guarda el lugar de un jugador desconectado (p. ej. al recargar). */
export const RECONNECT_GRACE_MS = 15_000;


/** Palabras por minuto con la convención estándar de 5 caracteres por palabra. */
export function calcWpm(correctChars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return correctChars / 5 / (elapsedMs / 60000);
}
