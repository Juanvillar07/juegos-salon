import { createAppServer } from './app.js';
import { readConfig } from './config.js';
import { RoomManager, createTextPicker, loadTexts } from './games/rally-de-letras/index.js';

const config = readConfig();
const manager = new RoomManager({ pickText: createTextPicker(loadTexts()) });
const { httpServer } = createAppServer({ ...config, manager });

httpServer.listen(config.port, () => {
  console.log(`Servidor escuchando en http://localhost:${config.port} (CORS: ${config.corsOrigins.join(', ')})`);
});
