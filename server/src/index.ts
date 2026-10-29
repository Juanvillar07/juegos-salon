import { createAppServer } from './app.js';
import { readConfig } from './config.js';
import { RoomManager as CanchaManager } from './games/cancha-rapida/index.js';
import * as silabas from './games/carrera-de-silabas/index.js';
import { RoomManager, createTextPicker, loadTexts } from './games/rally-de-letras/index.js';

const config = readConfig();
const rally = new RoomManager({ pickText: createTextPicker(loadTexts()) });

const dictionary = silabas.buildDictionary(silabas.loadSpanishWords());
const syllablePool = silabas.buildSyllablePool(dictionary);
const silabasManager = new silabas.RoomManager({
  isWord: (word) => dictionary.has(word),
  pickSyllables: silabas.createSyllablePicker(syllablePool),
});
console.log(`Carrera de Sílabas: ${dictionary.size} palabras, ${syllablePool.length} sílabas`);

const { httpServer } = createAppServer({ ...config, rally, silabas: silabasManager, cancha: new CanchaManager() });

httpServer.listen(config.port, () => {
  console.log(`Servidor escuchando en http://localhost:${config.port} (CORS: ${config.corsOrigins.join(', ')})`);
});
