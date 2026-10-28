import { createServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import { GAME_ID } from '@typeracer/shared';
import { mountRallyDeLetras, type RoomManager } from './games/rally-de-letras/index.js';

export interface AppOptions {
  corsOrigins: string[];
  /** Salas de Rally de Letras. */
  manager: RoomManager;
  reconnectGraceMs: number;
}

/**
 * Arma Express + Socket.IO sin escuchar en ningún puerto (lo hacen index.ts o los tests).
 * Cada juego del portal se monta en su propio namespace; para agregar uno nuevo basta con
 * montarlo aquí.
 */
export function createAppServer({ corsOrigins, manager, reconnectGraceMs }: AppOptions) {
  const app = express();
  app.use(cors({ origin: corsOrigins }));
  app.get('/health', (_req, res) => {
    res.json({ ok: true, games: { [GAME_ID]: { rooms: manager.roomCount } } });
  });

  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: corsOrigins } });
  const rally = mountRallyDeLetras(io, manager, { reconnectGraceMs });

  const close = async () => {
    rally.dispose();
    await io.close();
  };
  return { app, httpServer, io, close };
}
