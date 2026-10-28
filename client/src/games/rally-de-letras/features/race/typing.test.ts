import { describe, expect, it } from 'vitest';
import { applyInput, createTypingState, splitWords, viewOf, type TypingState } from './typing';

const TEXT = 'hola mundo feliz';
const words = splitWords(TEXT);

/** Simula pulsaciones una a una, como haría un usuario. */
function typeKeys(state: TypingState, keys: string): TypingState {
  for (const key of keys) {
    state = key === '\b' ? applyInput(words, state, state.input.slice(0, -1)) : applyInput(words, state, state.input + key);
  }
  return state;
}

describe('typing', () => {
  it('la racha suma palabras sin errores y se corta al fallar', () => {
    let s = typeKeys(createTypingState(TEXT), 'hola mundo ');
    expect(s).toMatchObject({ streak: 2, bestStreak: 2 });
    s = typeKeys(s, 'fx');
    expect(s.streak).toBe(0);
    s = typeKeys(s, '\beliz');
    // la palabra se completó pero tuvo un error: no suma
    expect(s).toMatchObject({ wordIndex: 3, streak: 0, bestStreak: 2 });
  });

  it('avanza de palabra solo al escribirla bien con su espacio', () => {
    let s = typeKeys(createTypingState(TEXT), 'hola');
    expect(s.wordIndex).toBe(0);
    s = typeKeys(s, ' ');
    expect(s).toMatchObject({ wordIndex: 1, input: '', errors: 0, streak: 1 });
    expect(viewOf(words, s).correctChars).toBe(5);
  });

  it('no avanza si la palabra tiene un error, aunque se escriba el espacio', () => {
    const s = typeKeys(createTypingState(TEXT), 'hila ');
    expect(s.wordIndex).toBe(0);
    expect(viewOf(words, s)).toMatchObject({ correctInWord: 1, correctChars: 1 });
  });

  it('cuenta cada pulsación incorrecta y permite corregir con retroceso', () => {
    let s = typeKeys(createTypingState(TEXT), 'hil');
    expect(s.errors).toBe(2); // la "i" y la "l" escritas después del error
    s = typeKeys(s, '\b\bola ');
    expect(s).toMatchObject({ wordIndex: 1, errors: 2 });
  });

  it('la última palabra termina sin espacio', () => {
    const s = typeKeys(createTypingState(TEXT), 'hola mundo feliz');
    const view = viewOf(words, s);
    expect(view.finished).toBe(true);
    expect(view.correctChars).toBe(TEXT.length);
  });

  it('limita lo que se puede escribir de más', () => {
    const s = applyInput(words, createTypingState(TEXT), 'x'.repeat(50));
    expect(s.input.length).toBe('hola '.length + 10);
  });

  it('reconstruye la posición desde el progreso del servidor', () => {
    expect(createTypingState(TEXT, 0)).toMatchObject({ wordIndex: 0, input: '' });
    expect(createTypingState(TEXT, 5)).toMatchObject({ wordIndex: 1, input: '' });
    expect(createTypingState(TEXT, 8)).toMatchObject({ wordIndex: 1, input: 'mun' });
    expect(createTypingState(TEXT, TEXT.length)).toMatchObject({ wordIndex: words.length });
    expect(viewOf(words, createTypingState(TEXT, 8)).correctChars).toBe(8);
  });
});
