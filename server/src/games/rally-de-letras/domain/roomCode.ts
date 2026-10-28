import { ROOM_CODE_LENGTH } from '@typeracer/shared';

// Sin 0/O ni 1/I/L para que los códigos sean fáciles de dictar.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}
