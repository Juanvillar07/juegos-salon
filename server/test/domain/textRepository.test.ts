import { describe, expect, it } from 'vitest';
import { normalizeRaceText } from '@typeracer/shared';
import { createTextPicker, loadTexts } from '../../src/games/rally-de-letras/domain/textRepository.js';

describe('textRepository', () => {
  it('hay al menos 60 textos distintos, de 140 a 400 caracteres, listos para escribirse', () => {
    const texts = loadTexts();
    expect(texts.length).toBeGreaterThanOrEqual(60);
    expect(new Set(texts.map((t) => t.text)).size).toBe(texts.length);
    for (const { text } of texts) {
      expect(text.length).toBeGreaterThanOrEqual(140);
      expect(text.length).toBeLessThanOrEqual(400);
      // Sin comillas o guiones tipográficos ni espacios dobles: igual que un texto pegado ya normalizado.
      expect(normalizeRaceText(text)).toBe(text);
    }
  });

  it('el catálogo mezcla textos cortos, medianos y largos', () => {
    const lengths = loadTexts().map((t) => t.text.length);
    expect(lengths.some((n) => n < 200)).toBe(true);
    expect(lengths.some((n) => n > 300)).toBe(true);
  });

  it('no repite los textos recientes de la sala', () => {
    const texts = [0, 1, 2, 3].map((id) => ({ id, text: String(id) }));
    const pick = createTextPicker(texts);
    for (let i = 0; i < 30; i++) expect(pick([0, 2, 3]).id).toBe(1);
  });

  it('si ya se usaron todos, solo evita el último', () => {
    const texts = [0, 1, 2].map((id) => ({ id, text: String(id) }));
    // random() = 0 elige el primero de los disponibles.
    expect(createTextPicker(texts, () => 0)([0, 1, 2]).id).toBe(0);
    expect(createTextPicker(texts, () => 0)([1, 2, 0]).id).toBe(1);
  });

  it('una sala recorre muchos textos distintos antes de repetir', () => {
    const texts = loadTexts();
    const pick = createTextPicker(texts);
    const recent: number[] = [];
    for (let i = 0; i < 30; i++) recent.push(pick(recent).id);
    expect(new Set(recent).size).toBe(30);
  });
});
