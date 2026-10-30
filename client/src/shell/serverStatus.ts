import { useSyncExternalStore } from 'react';

/**
 * ¿Responde el servidor? Con el backend apagado (workflow "Encender / Apagar backend") la web sigue
 * en CloudFront, así que la propia página lo detecta y avisa del mantenimiento.
 * - Con dominio, api.<dominio> deja de existir y la petición falla.
 * - Sin dominio, /health cae en S3 y CloudFront devuelve index.html (HTML, no el JSON de Node).
 * Mientras esté en mantenimiento se reintenta cada 30 s: al encenderlo, el aviso se va solo.
 */

export type ServerStatus = 'comprobando' | 'ok' | 'mantenimiento';

export const MAINTENANCE_TITLE = 'En mantenimiento';
export const MAINTENANCE_MESSAGE = 'Los juegos están apagados por ahora. Vuelve más tarde.';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';
const TIMEOUT_MS = 5_000;
const RETRY_MS = 30_000;

let status: ServerStatus = 'comprobando';
let started = false;
const listeners = new Set<() => void>();

async function isUp(): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_URL}/health`, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return false;
    const body: unknown = await res.json();
    return typeof body === 'object' && body !== null && (body as { ok?: unknown }).ok === true;
  } catch {
    return false;
  }
}

async function check() {
  status = (await isUp()) ? 'ok' : 'mantenimiento';
  listeners.forEach((notify) => notify());
  if (status === 'mantenimiento') setTimeout(check, RETRY_MS);
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  if (!started) {
    started = true;
    void check();
  }
  return () => listeners.delete(notify);
}

export function useServerStatus(): ServerStatus {
  return useSyncExternalStore(subscribe, () => status);
}
