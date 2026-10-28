import type { CarModel } from '@typeracer/shared';

/** Proporción del dibujo: todos los modelos comparten este viewBox. */
export const CAR_VIEWBOX = { width: 160, height: 48 };

/**
 * Perfil lateral de cada modelo (mirando a la derecha). El suelo está en y≈46 y las
 * ruedas se dibujan por encima de la carrocería.
 */
export interface CarShape {
  body: string;
  /** Cristales (tintados oscuros). */
  windows?: string;
  /** Líneas de diseño en tono más oscuro que la pintura. */
  lines?: string;
  /** Piezas en negro: alerones, difusores, tomas de aire, halo. */
  carbon?: string;
  wheels: { x: number; r: number }[];
  wheelY: number;
  /** Faro delantero: [x, y, ancho]. */
  headlight: [number, number, number];
  /** Luz trasera: [x, y, alto]. */
  taillight: [number, number, number];
  /** Casco del piloto (monoplaza). */
  helmet?: [number, number];
}

export const CAR_SHAPES: Record<CarModel, CarShape> = {
  // Motor delantero: capó muy largo, cabina retrasada y cola fastback corta.
  gt: {
    body: 'M5 32 Q5 26.5 12 25.5 L34 23.5 Q49 15 66 14 L80 14 Q91 15 101 22 L139 24.5 Q151 26 155 30.5 L155 35 Q155 37.5 152 37.5 L8 37.5 Q5 37.5 5 35 Z',
    windows: 'M42 22.8 Q52 17 64 16.6 L73 16.6 L73 22.8 Z M76 16.6 L80 16.6 Q88 17.2 95 22.8 L76 22.8 Z',
    lines: 'M104 29.5 Q118 27.5 134 28.5 M44 31 L62 28',
    carbon: 'M5 23.5 L14 22.5 L14 24.5 L6 25.5 Z M8 35.5 L22 35.5 L22 37.5 L8 37.5 Z',
    wheels: [
      { x: 33, r: 9.5 },
      { x: 128, r: 9.5 },
    ],
    wheelY: 37.5,
    headlight: [146, 26.5, 8],
    taillight: [5.5, 27, 3],
  },
  // Hiperdeportivo de curvas redondas con la línea en "C" en el costado.
  hyper: {
    body: 'M5 33 Q5 26 12 24 L30 21.5 Q46 11.5 70 10.5 L86 10.5 Q104 11.5 120 20.5 L144 25.5 Q154 27.5 155 32 L155 35 Q155 37.5 152 37.5 L8 37.5 Q5 37.5 5 35 Z',
    windows: 'M52 19.5 Q61 13.8 72 13.6 L82 13.6 L82 19.5 Z M85 13.6 Q99 14.3 111 20 L85 20 Z',
    lines: 'M62 35.5 Q46 32 49.5 25 Q54 19.8 76 20.2',
    carbon: 'M5 21.5 L24 20.5 L24 22.5 L6 23.5 Z M140 35.5 L155 35.5 L154 37.5 L140 37.5 Z',
    wheels: [
      { x: 35, r: 10 },
      { x: 127, r: 10 },
    ],
    wheelY: 37.5,
    headlight: [144, 26.8, 9],
    taillight: [5.5, 26, 4],
  },
  // Monoplaza: ruedas descubiertas, halo, toma de aire sobre el piloto y alerones.
  f1: {
    body: 'M14 31.5 L30 28.5 L50 27 Q56 17.5 64 16.8 Q70 17 72.5 20.5 L86 20.5 Q92 22 96 26 L132 29 Q146 30.5 152 33 L152 35.5 L14 35.5 Z',
    lines: 'M34 31.5 L128 31.5',
    carbon:
      'M1 13 L20 13 L20 18.5 L1 18.5 Z M9 18.5 L12 18.5 L15 30 L12 30 Z M132 37 L159 37 L159 41 L132 41 Z M150 33 L154 33 L157 37 L153 37 Z M70 21 Q80 12.5 93 21 L91 22 Q80 15.5 72 22 Z',
    wheels: [
      { x: 27, r: 10.5 },
      { x: 128, r: 9.5 },
    ],
    wheelY: 36,
    headlight: [149, 32.5, 3],
    taillight: [3, 18.5, 3],
    helmet: [80, 18.5],
  },
  // Hiperdeportivo artesanal: cabina de burbuja, carrocería fluida y escapes centrales.
  atelier: {
    body: 'M6 32 Q6 27.5 13 26 L36 23.5 Q46 23 54 17.5 Q63 12.5 76 12.5 Q90 12.5 99 18.5 Q106 22 118 23.5 L144 26 Q154 27.5 155 31.5 L155 35 Q155 37.5 152 37.5 L9 37.5 Q6 37.5 6 35 Z',
    windows: 'M58.5 18.6 Q65.5 14.9 75 14.8 L75 18.6 Z M78 14.8 Q88.5 15 95.5 18.6 L78 18.6 Z',
    lines: 'M30 30.5 Q72 26.5 118 29.5 M18 26 Q28 22.5 40 24',
    carbon: 'M2 27 L7 27 L7 29 L2 29 Z M2 30 L7 30 L7 32 L2 32 Z M10 35.5 L26 35.5 L26 37.5 L10 37.5 Z M140 35.5 L155 35.5 L154 37.5 L140 37.5 Z',
    wheels: [
      { x: 36, r: 10 },
      { x: 127, r: 10 },
    ],
    wheelY: 37.5,
    headlight: [145, 27.4, 8],
    taillight: [6.5, 25, 3],
  },
  // Superdeportivo en cuña: todo líneas rectas y tomas de aire afiladas.
  wedge: {
    body: 'M5 33 L7 25.5 L30 22.5 L56 11.5 L84 10.5 L118 21.5 L148 25.5 L156 29.5 L156 35 L153 37.5 L8 37.5 L5 35 Z',
    windows: 'M59 19.5 L65 13.8 L82 13.6 L82 19.5 Z M85 13.6 L89 13.6 L108 20.5 L85 20.5 Z',
    lines: 'M100 30.5 L142 28.5 M84 11 L84 34',
    carbon: 'M44 28 L62 23 L66 30.5 L48 32.5 Z M4 22.5 L22 21 L22 23 L5 24.5 Z M136 35 L157 35 L155 37.5 L136 37.5 Z',
    wheels: [
      { x: 34, r: 10 },
      { x: 128, r: 10 },
    ],
    wheelY: 37.5,
    headlight: [143, 26, 10],
    taillight: [5.5, 27, 3],
  },
  // Prototipo de resistencia: cabina cerrada, aleta dorsal y cola larga con alerón.
  lmp: {
    body: 'M4 31 L18 29 Q34 27.5 50 21 Q60 13 74 12.5 L84 12.5 Q95 13 104 20.5 Q114 26.5 140 28 Q154 29 156 32.5 L156 35.5 L6 35.5 Z M18 29.5 L44 18 L58 14.6 L58 17.6 L46 20.6 L28 29 Z',
    windows: 'M60 18.8 Q67 15.2 76 15 L84 15 Q92 15.5 98.5 19.6 L60 19.6 Z',
    lines: 'M24 32 L146 32',
    carbon: 'M1 16.5 L17 16.5 L17 20 L1 20 Z M8 20 L10 20 L12 29.5 L10 29.5 Z M140 35.5 L158 35.5 L158 38 L140 38 Z',
    wheels: [
      { x: 31, r: 9.5 },
      { x: 130, r: 9.5 },
    ],
    wheelY: 36,
    headlight: [148, 29.8, 8],
    taillight: [4.5, 26, 4],
  },
};
