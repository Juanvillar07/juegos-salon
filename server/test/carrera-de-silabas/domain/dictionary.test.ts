import { describe, expect, it } from 'vitest';
import { checkWordShape, normalizeWord } from '@typeracer/shared/carrera-de-silabas';
import {
  buildDictionary,
  buildSyllablePool,
  createSyllablePicker,
  loadSpanishWords,
} from '../../../src/games/carrera-de-silabas/domain/dictionary.js';

describe('normalizeWord', () => {
  it('pasa a minúsculas y quita tildes y diéresis, pero conserva la ñ', () => {
    expect(normalizeWord('  Camión ')).toBe('camion');
    expect(normalizeWord('PINGÜINO')).toBe('pinguino');
    expect(normalizeWord('Ñandú')).toBe('ñandu');
  });
});

describe('checkWordShape', () => {
  it('exige solo letras, largo mínimo y la sílaba', () => {
    expect(checkWordShape('trabajo', 'tra')).toBeNull();
    expect(checkWordShape('casa', 'tra')).toBe('No contiene «TRA»');
    expect(checkWordShape('t1a', 't')).toBe('Solo letras, sin espacios ni símbolos');
  });
});

describe('diccionario y sílabas', () => {
  it('normaliza el diccionario y descarta entradas que no son solo letras', () => {
    expect([...buildDictionary(['Camión', 'pingüino', 'dos palabras', 'x-y'])]).toEqual(['camion', 'pinguino']);
  });

  it('solo usa sílabas frecuentes y con vocal', () => {
    const pool = buildSyllablePool(['casa', 'cosa', 'masa', 'rst', 'rsta'], 3);
    expect(pool).toContain('sa');
    expect(pool).not.toContain('rs');
    expect(pool).not.toContain('co');
  });

  it('el sorteo no repite sílabas seguidas aunque tenga que volver a empezar', () => {
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const picks = createSyllablePicker(['ab', 'cd', 'ef'], random)(30);
    expect(picks).toHaveLength(30);
    expect(picks.every((s, i) => i === 0 || s !== picks[i - 1])).toBe(true);
  });

  it('con el diccionario real, cada sílaba del sorteo tiene muchas palabras posibles', () => {
    const dictionary = buildDictionary(loadSpanishWords());
    expect(dictionary.size).toBeGreaterThan(500_000);
    for (const word of ['trabajo', 'camion', 'pinguino', 'ñandu', 'corrieron']) expect(dictionary.has(word)).toBe(true);
    const pool = buildSyllablePool(dictionary);
    expect(pool.length).toBeGreaterThan(200);
    expect(pool.every((s) => /^[a-zñ]{2,3}$/.test(s) && /[aeiou]/.test(s))).toBe(true);
  });
});
