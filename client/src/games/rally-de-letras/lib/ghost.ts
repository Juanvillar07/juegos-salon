/**
 * Auto fantasma: tu mejor carrera grabada como caracteres correctos a lo largo del tiempo.
 * Se reproduce sobre cualquier texto (cuenta caracteres, no el texto), así que corres contra
 * tu mejor ritmo aunque el texto sea otro.
 */

/** Una muestra: [ms desde la salida, caracteres correctos]. */
export type GhostSample = [number, number];

export interface Ghost {
  wpm: number;
  samples: GhostSample[];
}

/** Caracteres que llevaba el fantasma `ms` después de la salida, interpolando entre muestras. */
export function ghostCharsAt(samples: readonly GhostSample[], ms: number): number {
  if (samples.length === 0 || ms <= 0) return 0;
  let prev: GhostSample = [0, 0];
  for (const sample of samples) {
    if (sample[0] >= ms) {
      const span = sample[0] - prev[0];
      return span <= 0 ? sample[1] : prev[1] + ((sample[1] - prev[1]) * (ms - prev[0])) / span;
    }
    prev = sample;
  }
  return prev[1];
}

/** Valida un fantasma leído del almacenamiento (puede venir corrupto o de otra versión). */
export function isGhost(value: unknown): value is Ghost {
  if (!value || typeof value !== 'object') return false;
  const { wpm, samples } = value as Partial<Ghost>;
  return (
    typeof wpm === 'number' &&
    wpm > 0 &&
    Array.isArray(samples) &&
    samples.length > 0 &&
    samples.every((s) => Array.isArray(s) && s.length === 2 && s.every((n) => typeof n === 'number' && n >= 0))
  );
}
