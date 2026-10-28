import { GAME_ID } from '@typeracer/shared/carrera-de-silabas';

/** Rutas del juego dentro del portal. */
export const GAME_HOME = `/${GAME_ID}`;

export function roomPath(code: string): string {
  return `${GAME_HOME}/sala/${code}`;
}
