import type { Server } from 'socket.io';
import { GAME_NAMESPACE } from '@typeracer/shared/carrera-de-silabas';
import type { RoomManager } from './domain/RoomManager.js';
import type { IO, RealtimeContext, RealtimeOptions } from './realtime/context.js';
import { registerSocketHandlers } from './realtime/registerSocketHandlers.js';

export { RoomManager } from './domain/RoomManager.js';
export { buildDictionary, buildSyllablePool, createSyllablePicker, loadSpanishWords } from './domain/dictionary.js';

/** Monta Carrera de Sílabas en su namespace de Socket.IO. */
export function mountCarreraDeSilabas(io: Server, manager: RoomManager, options: RealtimeOptions): RealtimeContext {
  // El Server es común a todos los juegos (sin tipos de eventos); cada namespace tipa los suyos.
  const namespace = io.of(GAME_NAMESPACE) as unknown as IO;
  return registerSocketHandlers(namespace, manager, options);
}
