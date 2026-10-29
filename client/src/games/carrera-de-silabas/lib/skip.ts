import { SKIP_BLOCK_MS, SKIP_POINTS, type SkipPenalty } from '@typeracer/shared/carrera-de-silabas';

/** Lo que cuesta pasar de sílaba con cada ajuste: "−5 pts", "3 s" o "−5 pts y 3 s". */
export function skipCost(penalty: SkipPenalty): string {
  const points = `−${SKIP_POINTS} pts`;
  const time = `${SKIP_BLOCK_MS / 1000} s`;
  return penalty === 'points' ? points : penalty === 'time' ? time : `${points} y ${time}`;
}
