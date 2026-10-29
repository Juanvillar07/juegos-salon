/** Lo que cuesta pasar de sílaba con los puntos de la sala: "−5 pts", o "gratis" si no hay penalización. */
export function skipCost(points: number): string {
  return points === 0 ? 'gratis' : `−${points} pts`;
}
