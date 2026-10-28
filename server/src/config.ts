import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { RECONNECT_GRACE_MS } from '@typeracer/shared';

export interface ServerConfig {
  port: number;
  corsOrigins: string[];
  reconnectGraceMs: number;
}

export function readConfig(): ServerConfig {
  // El .env vive en la raíz del monorepo (misma ruta desde src/ y dist/).
  // En producción las variables vienen del entorno y el archivo no existe.
  loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });
  const env = process.env;
  return {
    port: Number(env.PORT ?? 3001),
    corsOrigins: (env.CLIENT_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    reconnectGraceMs: RECONNECT_GRACE_MS,
  };
}
