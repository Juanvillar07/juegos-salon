import { describe, expect, it } from 'vitest';
import { ghostCharsAt, isGhost, type GhostSample } from './ghost';

const SAMPLES: GhostSample[] = [
  [1000, 5],
  [2000, 10],
  [4000, 20],
];

describe('auto fantasma', () => {
  it('antes de la salida no ha avanzado', () => {
    expect(ghostCharsAt(SAMPLES, 0)).toBe(0);
    expect(ghostCharsAt(SAMPLES, -500)).toBe(0);
  });

  it('interpola entre muestras (y desde la salida hasta la primera)', () => {
    expect(ghostCharsAt(SAMPLES, 500)).toBe(2.5);
    expect(ghostCharsAt(SAMPLES, 1000)).toBe(5);
    expect(ghostCharsAt(SAMPLES, 3000)).toBe(15);
  });

  it('después de la última muestra se queda donde terminó', () => {
    expect(ghostCharsAt(SAMPLES, 9000)).toBe(20);
    expect(ghostCharsAt([], 9000)).toBe(0);
  });

  it('descarta fantasmas guardados que no tienen la forma esperada', () => {
    expect(isGhost({ wpm: 50, samples: SAMPLES })).toBe(true);
    expect(isGhost(null)).toBe(false);
    expect(isGhost({ wpm: 0, samples: SAMPLES })).toBe(false);
    expect(isGhost({ wpm: 50, samples: [] })).toBe(false);
    expect(isGhost({ wpm: 50, samples: [[1, 'x']] })).toBe(false);
  });
});
