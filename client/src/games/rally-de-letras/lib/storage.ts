import { CAR_COLORS, DEFAULT_CAR, isCarColor, isCarModel, type CarModel } from '@typeracer/shared';

// sessionStorage es por pestaña y sobrevive a recargas: ideal para identificar al jugador
// de cada pestaña. localStorage guarda preferencias que conviene recordar entre visitas.
const SESSION_KEY = 'typeracer:session';
const TAB_NICKNAME_KEY = 'typeracer:tab-nickname';
const LAST_NICKNAME_KEY = 'typeracer:nickname';
const CAR_KEY = 'typeracer:car';
const BEST_WPM_KEY = 'typeracer:best-wpm';

function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function write(storage: () => Storage, key: string, value: string): void {
  try {
    storage().setItem(key, value);
  } catch {
    // almacenamiento no disponible (modo privado estricto): se sigue sin persistir
  }
}

const session = () => sessionStorage;
const local = () => localStorage;

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/** Secreto de sesión de esta pestaña; se crea la primera vez. */
export function getSessionId(): string {
  let id = read(session, SESSION_KEY);
  if (!id) {
    id = randomId();
    write(session, SESSION_KEY, id);
  }
  return id;
}

export function setSessionId(id: string): void {
  write(session, SESSION_KEY, id);
}

/** Nickname con el que esta pestaña entró a su sala (para reintentar tras recargar). */
export function getTabNickname(): string | null {
  return read(session, TAB_NICKNAME_KEY);
}

/** Último nickname usado en cualquier pestaña, para rellenar formularios. */
export function getLastNickname(): string {
  return read(local, LAST_NICKNAME_KEY) ?? '';
}

export function saveNickname(nickname: string): void {
  write(session, TAB_NICKNAME_KEY, nickname);
  write(local, LAST_NICKNAME_KEY, nickname);
}

export interface CarChoice {
  car: CarModel;
  color: string;
}

/** Auto y color elegidos en el garaje (por pestaña, con el último usado como valor inicial). */
export function getCarChoice(): CarChoice {
  try {
    const raw = read(session, CAR_KEY) ?? read(local, CAR_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<CarChoice>) : {};
    return {
      car: isCarModel(parsed.car) ? parsed.car : DEFAULT_CAR,
      color: isCarColor(parsed.color) ? parsed.color : CAR_COLORS[0],
    };
  } catch {
    return { car: DEFAULT_CAR, color: CAR_COLORS[0] };
  }
}

export function saveCarChoice(choice: CarChoice): void {
  const raw = JSON.stringify(choice);
  write(session, CAR_KEY, raw);
  write(local, CAR_KEY, raw);
}

const bestWpmListeners = new Set<() => void>();

export function getBestWpm(): number {
  return Number(read(local, BEST_WPM_KEY) ?? 0) || 0;
}

export function subscribeBestWpm(listener: () => void): () => void {
  bestWpmListeners.add(listener);
  return () => bestWpmListeners.delete(listener);
}

/** Guarda el WPM si supera el récord. Devuelve true si es un récord nuevo. */
export function recordWpm(wpm: number): boolean {
  if (wpm <= getBestWpm()) return false;
  write(local, BEST_WPM_KEY, String(wpm));
  bestWpmListeners.forEach((l) => l());
  return true;
}
