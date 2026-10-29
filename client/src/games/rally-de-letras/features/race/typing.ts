// Lógica pura de tecleo palabra por palabra, separada de React para poder testearla.

export interface TypingState {
  /** Índice de la palabra actual; igual a words.length cuando se terminó el texto. */
  wordIndex: number;
  /** Lo que hay escrito en el input para la palabra actual. */
  input: string;
  /** Pulsaciones incorrectas acumuladas. */
  errors: number;
  /** Racha: palabras seguidas escritas sin ningún error. */
  streak: number;
  bestStreak: number;
  /** false si ya hubo un error en la palabra actual. */
  wordClean: boolean;
}

export interface TypingView {
  /** Lo que hay que escribir para pasar de palabra (incluye el espacio, salvo en la última). */
  target: string;
  /** Caracteres de las palabras ya completadas. */
  committed: number;
  /** Cuántos caracteres del input coinciden con el inicio de target. */
  correctInWord: number;
  /** Caracteres correctos totales: lo que se reporta al servidor. */
  correctChars: number;
  finished: boolean;
}

const FRESH: TypingState = { wordIndex: 0, input: '', errors: 0, streak: 0, bestStreak: 0, wordClean: true };

/** Margen de caracteres de más que se permite escribir antes de bloquear el input. */
const OVERTYPE_LIMIT = 10;

export function splitWords(text: string): string[] {
  return text.split(' ');
}

function targetFor(words: string[], index: number): string {
  if (index >= words.length) return '';
  return index === words.length - 1 ? words[index] : `${words[index]} `;
}

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/**
 * Estado inicial. Con `progress` > 0 reconstruye la posición a partir del avance
 * confirmado por el servidor (por ejemplo, al recargar la página a mitad de carrera).
 */
export function createTypingState(text: string, progress = 0): TypingState {
  const words = splitWords(text);
  let offset = 0;
  for (let i = 0; i < words.length; i++) {
    const length = targetFor(words, i).length;
    if (progress < offset + length) return { ...FRESH, wordIndex: i, input: text.slice(offset, progress) };
    offset += length;
  }
  return { ...FRESH, wordIndex: words.length };
}

export function viewOf(words: string[], state: TypingState): TypingView {
  const target = targetFor(words, state.wordIndex);
  const finished = state.wordIndex >= words.length;
  let committed = 0;
  for (let i = 0; i < state.wordIndex; i++) committed += targetFor(words, i).length;
  const correctInWord = commonPrefix(state.input, target);
  return { target, committed, correctInWord, correctChars: committed + correctInWord, finished };
}

/** Aplica el nuevo valor del input: solo se avanza de palabra cuando está escrita exactamente. */
export function applyInput(words: string[], state: TypingState, rawValue: string): TypingState {
  const target = targetFor(words, state.wordIndex);
  if (state.wordIndex >= words.length) return state;

  // Varias palabras de golpe (autocompletado o escritura deslizando en el móvil, o texto insertado
  // en un solo evento): si empieza por la palabra completa, se avanza y el resto va a la siguiente.
  if (rawValue.length > target.length && rawValue.startsWith(target) && state.wordIndex < words.length - 1) {
    return applyInput(words, applyInput(words, state, target), rawValue.slice(target.length));
  }

  const value = rawValue.slice(0, target.length + OVERTYPE_LIMIT);
  const typedMore = value.length - state.input.length;
  const mistake = typedMore > 0 && !target.startsWith(value);
  const errors = mistake ? state.errors + typedMore : state.errors;
  // Un error corta la racha en el acto; la palabra ya no cuenta como limpia.
  const streak = mistake ? 0 : state.streak;
  const wordClean = state.wordClean && !mistake;

  if (value === target) {
    const nextStreak = wordClean ? streak + 1 : 0;
    return {
      wordIndex: state.wordIndex + 1,
      input: '',
      errors,
      streak: nextStreak,
      bestStreak: Math.max(state.bestStreak, nextStreak),
      wordClean: true,
    };
  }
  return { ...state, input: value, errors, streak, wordClean };
}
