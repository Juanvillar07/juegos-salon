/** Reloj de partido: "2:05". */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/** Minuto en que cayó un gol, como en las crónicas: 0:42 → "1'". */
export function goalMinute(clockMs: number): string {
  return `${Math.floor(clockMs / 60_000) + 1}'`;
}
