/** Acceso a las salas (comunes a todos los juegos): contraseña y freno a los intentos fallidos. */

export const MAX_ROOM_PASSWORD_LENGTH = 30;
/** Intentos fallidos de contraseña por jugador y minuto, para frenar a quien prueba a ciegas. */
export const PASSWORD_ATTEMPTS_PER_MINUTE = 5;

/** Limpia y valida la contraseña que pone el host. */
export function normalizeRoomPassword(raw: unknown): { ok: true; password: string } | { ok: false; error: string } {
  if (typeof raw !== 'string') return { ok: false, error: 'Contraseña no válida' };
  const password = raw.trim();
  if (!password) return { ok: false, error: 'La contraseña no puede estar vacía' };
  if (password.length > MAX_ROOM_PASSWORD_LENGTH) {
    return { ok: false, error: `La contraseña no puede superar ${MAX_ROOM_PASSWORD_LENGTH} caracteres` };
  }
  return { ok: true, password };
}
