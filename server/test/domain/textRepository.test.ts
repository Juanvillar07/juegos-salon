import { describe, expect, it } from 'vitest';
import { createTextPicker, loadTexts } from '../../src/games/rally-de-letras/domain/textRepository.js';

describe('textRepository', () => {
  it('hay al menos 10 textos de 200 a 400 caracteres, sin espacios dobles', () => {
    const texts = loadTexts();
    expect(texts.length).toBeGreaterThanOrEqual(10);
    for (const { text } of texts) {
      expect(text.length).toBeGreaterThanOrEqual(200);
      expect(text.length).toBeLessThanOrEqual(400);
      expect(text).not.toMatch(/\s{2,}/);
    }
  });

  it('no repite el último texto usado', () => {
    const pick = createTextPicker([
      { id: 0, text: 'a' },
      { id: 1, text: 'b' },
    ]);
    for (let i = 0; i < 20; i++) expect(pick(0).id).toBe(1);
  });
});
