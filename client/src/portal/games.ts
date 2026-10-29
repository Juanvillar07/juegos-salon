/**
 * Catálogo del Salón de Juegos. Para publicar un juego nuevo: agrégalo aquí, crea su carpeta
 * en src/games/<id> con su componente raíz y registra la ruta en shell/App.tsx.
 */
export interface GameEntry {
  id: string;
  name: string;
  tagline: string;
  description: string;
  /** Ruta del juego; null si todavía no está disponible. */
  path: string | null;
  players: string;
  tags: string[];
}

export const GAMES: GameEntry[] = [
  {
    id: 'rally-de-letras',
    name: 'Rally de Letras',
    tagline: 'Carreras de mecanografía',
    description: 'Compite escribiendo el mismo texto que tus amigos: cada palabra correcta acelera tu auto.',
    path: '/rally-de-letras',
    players: '1–8 jugadores',
    tags: ['Multijugador', 'Tiempo real', 'Chat'],
  },
  {
    id: 'carrera-de-silabas',
    name: 'Carrera de Sílabas',
    tagline: 'Carreras de palabras',
    description: 'Todos reciben las mismas sílabas: escribe palabras que las contengan y suma un punto por letra hasta la meta.',
    path: '/carrera-de-silabas',
    players: '1–8 jugadores',
    tags: ['Multijugador', 'Vocabulario', 'Chat'],
  },
  {
    id: 'cancha-rapida',
    name: 'Cancha Rápida',
    tagline: 'Fútbol en tiempo real',
    description: 'Rojos contra azules en una cancha vista desde arriba: muévete con el teclado, patea y mete más goles.',
    path: '/cancha-rapida',
    players: '1–8 jugadores',
    tags: ['Multijugador', 'Equipos', 'Chat'],
  },
];

/** Juego al que pertenece una ruta (para la cabecera). */
export function gameForPath(pathname: string): GameEntry | undefined {
  return GAMES.find((g) => g.path && (pathname === g.path || pathname.startsWith(`${g.path}/`)));
}
