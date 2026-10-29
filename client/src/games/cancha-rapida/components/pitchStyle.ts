/** Colores de la cancha: iguales en tema claro y oscuro (es césped, no interfaz). */
export const PITCH = {
  grass: '#4f7a43',
  stripe: '#557f48',
  outside: '#3f6336',
  line: 'rgba(255, 255, 255, 0.78)',
  net: 'rgba(255, 255, 255, 0.35)',
  post: '#f4f4f4',
  ball: '#ffffff',
  outline: '#151517',
} as const;

/** Dos letras para el disco de cada jugador (como el avatar de HaxBall). */
export function avatar(nickname: string): string {
  const words = nickname.trim().split(/\s+/);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : nickname.trim().slice(0, 2);
  return letters.toUpperCase();
}
