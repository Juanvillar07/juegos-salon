import { createServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import { GAME_ID as RALLY_ID } from '@typeracer/shared';
import { GAME_ID as SILABAS_ID } from '@typeracer/shared/carrera-de-silabas';
import { GAME_ID as CANCHA_ID } from '@typeracer/shared/cancha-rapida';
import { mountCanchaRapida, type RoomManager as CanchaManager } from './games/cancha-rapida/index.js';
import { mountCarreraDeSilabas, type RoomManager as SilabasManager } from './games/carrera-de-silabas/index.js';
import { mountRallyDeLetras, type RoomManager as RallyManager } from './games/rally-de-letras/index.js';

export interface AppOptions {
  corsOrigins: string[];
  reconnectGraceMs: number;
  /** Salas de cada juego; solo se monta el juego cuyo gestor se pasa (los tests montan uno). */
  rally?: RallyManager;
  silabas?: SilabasManager;
  cancha?: CanchaManager;
}

/**
 * Arma Express + Socket.IO sin escuchar en ningún puerto (lo hacen index.ts o los tests).
 * Cada juego del portal se monta en su propio namespace; para agregar uno nuevo basta con
 * montarlo aquí.
 */
export function createAppServer({ corsOrigins, reconnectGraceMs, rally, silabas, cancha }: AppOptions) {
  const app = express();
  app.use(cors({ origin: corsOrigins }));
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: corsOrigins } });
  const canchaCtx = cancha && mountCanchaRapida(io, cancha, { reconnectGraceMs });
  const mounted = [
    rally && mountRallyDeLetras(io, rally, { reconnectGraceMs }),
    silabas && mountCarreraDeSilabas(io, silabas, { reconnectGraceMs }),
    canchaCtx,
  ];

  app.get('/health', (_req, res) => {
    const games: Record<string, object> = {};
    if (rally) games[RALLY_ID] = { rooms: rally.roomCount };
    if (silabas) games[SILABAS_ID] = { rooms: silabas.roomCount };
    // Partidos en curso y lo que tarda cada paso de simulación: si sube, el plan de la instancia se queda corto.
    if (cancha && canchaCtx) {
      games[CANCHA_ID] = {
        rooms: cancha.roomCount,
        matches: cancha.activeMatches,
        tickMs: Math.round(canchaCtx.tickMs * 1000) / 1000,
      };
    }
    res.json({ ok: true, games });
  });

  const close = async () => {
    mounted.forEach((game) => game?.dispose());
    await io.close();
  };
  return { app, httpServer, io, close };
}
