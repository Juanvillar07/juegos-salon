import type { Side } from './physics.js';

/**
 * Uniformes de los equipos: color principal, color secundario y un diseño. Los elige el host en
 * la sala; se ven en la cancha, la sala, el marcador y los resultados.
 */

export type KitPattern = 'solid' | 'stripes' | 'hoops' | 'halves' | 'sash';

export interface TeamKit {
  primary: string;
  secondary: string;
  pattern: KitPattern;
}

/** Colores disponibles, con nombre para mostrarlos. */
export const KIT_COLORS: readonly { value: string; name: string }[] = [
  { value: '#d64541', name: 'Rojo' },
  { value: '#8c2333', name: 'Granate' },
  { value: '#ef7b2d', name: 'Naranja' },
  { value: '#f2c230', name: 'Amarillo' },
  { value: '#2f9a5a', name: 'Verde' },
  { value: '#5fb4e8', name: 'Celeste' },
  { value: '#3b6fd8', name: 'Azul' },
  { value: '#7c4dbd', name: 'Morado' },
  { value: '#e46aa7', name: 'Rosa' },
  { value: '#f4f4f2', name: 'Blanco' },
  { value: '#8b8d94', name: 'Gris' },
  { value: '#1f1f23', name: 'Negro' },
];

export const KIT_PATTERNS: readonly { value: KitPattern; name: string }[] = [
  { value: 'solid', name: 'Liso' },
  { value: 'stripes', name: 'Rayas' },
  { value: 'hoops', name: 'Franjas' },
  { value: 'halves', name: 'Mitades' },
  { value: 'sash', name: 'Banda' },
];

export const DEFAULT_KITS: Record<Side, TeamKit> = {
  red: { primary: '#d64541', secondary: '#f4f4f2', pattern: 'solid' },
  blue: { primary: '#3b6fd8', secondary: '#f4f4f2', pattern: 'solid' },
};

const COLOR_VALUES = new Set(KIT_COLORS.map((c) => c.value));
const PATTERN_VALUES = new Set<unknown>(KIT_PATTERNS.map((p) => p.value));

/**
 * Valida un uniforme: colores de la paleta, principal distinto del secundario y distinto del
 * principal del rival (si no, en la cancha no se distinguirían los equipos).
 */
export function validateKit(kit: unknown, rival: TeamKit): string | null {
  if (typeof kit !== 'object' || kit === null) return 'Uniforme no válido';
  const { primary, secondary, pattern } = kit as Record<string, unknown>;
  if (typeof primary !== 'string' || !COLOR_VALUES.has(primary)) return 'Color principal no válido';
  if (typeof secondary !== 'string' || !COLOR_VALUES.has(secondary)) return 'Color secundario no válido';
  if (!PATTERN_VALUES.has(pattern)) return 'Diseño no válido';
  if (primary === secondary) return 'El color principal y el secundario tienen que ser distintos';
  if (primary === rival.primary) return 'El otro equipo ya usa ese color principal';
  return null;
}

/** Un polígono en un círculo de radio 1 centrado en el origen (y hacia abajo, como en pantalla). */
export type KitShape = readonly (readonly [number, number])[];

const rect = (x0: number, y0: number, x1: number, y1: number): KitShape => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

/**
 * Lo que se pinta con el color secundario sobre el principal, recortado luego al círculo del
 * jugador. La misma geometría la usan el canvas y el SVG, así el uniforme se ve igual en todos lados.
 */
export function kitShapes(pattern: KitPattern): KitShape[] {
  switch (pattern) {
    case 'stripes':
      return [rect(-0.58, -1.2, -0.26, 1.2), rect(0.26, -1.2, 0.58, 1.2)];
    case 'hoops':
      return [rect(-1.2, -0.58, 1.2, -0.26), rect(-1.2, 0.26, 1.2, 0.58)];
    case 'halves':
      return [rect(0, -1.2, 1.2, 1.2)];
    case 'sash':
      // Banda en diagonal, del hombro izquierdo a la cadera derecha.
      return [
        [
          [-0.85, -1.2],
          [1.2, 0.85],
          [0.85, 1.2],
          [-1.2, -0.85],
        ],
      ];
    default:
      return [];
  }
}

/** Color legible para las iniciales sobre el color principal (blanco o casi negro). */
export function kitInk(primary: string): string {
  const n = parseInt(primary.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? '#151517' : '#ffffff';
}

/** Nombre del color (para la etiqueta de accesibilidad del escudo). */
export function kitColorName(value: string): string {
  return KIT_COLORS.find((c) => c.value === value)?.name ?? value;
}
