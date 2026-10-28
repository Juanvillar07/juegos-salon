/**
 * Catálogo de autos. Son diseños propios inspirados en estilos de autos de carrera
 * modernos (gran turismo, hiperdeportivo, monoplaza…), sin marcas reales.
 */
export const CAR_MODELS = ['gt', 'hyper', 'f1', 'atelier', 'wedge', 'lmp'] as const;
export type CarModel = (typeof CAR_MODELS)[number];

export const CAR_MODEL_NAMES: Record<CarModel, string> = {
  gt: 'Gran Turismo',
  hyper: 'Hiperdeportivo',
  f1: 'Monoplaza',
  atelier: 'Atelier',
  wedge: 'Superdeportivo',
  lmp: 'Prototipo',
};

export const CAR_MODEL_DESCRIPTIONS: Record<CarModel, string> = {
  gt: 'Motor delantero, capó largo y cola fastback.',
  hyper: 'Curvas suaves y motor central de 16 cilindros.',
  f1: 'Ruedas descubiertas, halo y alerones.',
  atelier: 'Cabina de burbuja hecha a mano.',
  wedge: 'Líneas afiladas en forma de cuña.',
  lmp: 'Prototipo de resistencia con aleta dorsal.',
};

/** Pinturas sobrias. Hay más colores que jugadores, así cada uno puede tener el suyo. */
export const CAR_COLORS = [
  '#b8463c', // rosso
  '#c99a3d', // giallo
  '#2f5d50', // verde inglés
  '#3c5a7d', // azul acero
  '#6a5d7b', // violeta humo
  '#9c7a5b', // bronce
  '#8b9099', // plata
  '#e6e4df', // blanco perla
  '#2a2c31', // grafito
  '#56707a', // petróleo
] as const;
export type CarColor = (typeof CAR_COLORS)[number];

export const CAR_COLOR_NAMES: Record<CarColor, string> = {
  '#b8463c': 'Rosso',
  '#c99a3d': 'Giallo',
  '#2f5d50': 'Verde inglés',
  '#3c5a7d': 'Azul acero',
  '#6a5d7b': 'Violeta humo',
  '#9c7a5b': 'Bronce',
  '#8b9099': 'Plata',
  '#e6e4df': 'Blanco perla',
  '#2a2c31': 'Grafito',
  '#56707a': 'Petróleo',
};

export const DEFAULT_CAR: CarModel = 'gt';

/** Preferencias de auto que el jugador elige; ambas opcionales. */
export interface CarPrefs {
  car?: CarModel;
  color?: string;
}

export function isCarModel(value: unknown): value is CarModel {
  return typeof value === 'string' && (CAR_MODELS as readonly string[]).includes(value);
}

export function isCarColor(value: unknown): value is CarColor {
  return typeof value === 'string' && (CAR_COLORS as readonly string[]).includes(value);
}
