export interface ChatMessage {
  /** Correlativo dentro de la sala. */
  id: number;
  /** player: lo escribió un jugador; system: aviso del servidor (alguien entró, salió…). */
  kind: 'player' | 'system';
  playerId: string | null;
  nickname: string;
  color: string;
  text: string;
  /** Timestamp del servidor. */
  at: number;
}

export const MAX_CHAT_LENGTH = 200;
/** Mensajes que guarda cada sala; los nuevos jugadores reciben este historial. */
export const CHAT_HISTORY_SIZE = 50;
/** Tiempo mínimo entre mensajes de un mismo jugador. */
export const CHAT_COOLDOWN_MS = 500;

/** Limpia un mensaje: una sola línea, sin espacios repetidos ni caracteres de control. */
export function cleanChatText(raw: string): string {
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CHAT_LENGTH);
}
