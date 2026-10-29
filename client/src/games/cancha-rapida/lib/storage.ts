// El nickname es el mismo en todos los juegos del salón: se comparte con Rally.
export { getLastNickname, getTabNickname, saveNickname } from '../../rally-de-letras/lib/storage';

// La sesión, en cambio, es propia: cada juego tiene su namespace y su registro de sesiones.
const SESSION_KEY = 'cancha:session';

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/** Secreto de sesión de esta pestaña (sessionStorage sobrevive a recargas); se crea la primera vez. */
export function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = randomId();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return randomId();
  }
}

export function setSessionId(id: string): void {
  try {
    sessionStorage.setItem(SESSION_KEY, id);
  } catch {
    // almacenamiento no disponible: se sigue sin persistir
  }
}
