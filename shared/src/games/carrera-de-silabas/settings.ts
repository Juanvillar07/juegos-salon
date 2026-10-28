/** Configuración de la sala que elige el host. */
export interface RoomSettings {
  /** Puntos necesarios para cruzar la meta. */
  target: number;
}

export const TARGET_OPTIONS = [100, 200] as const;

export const DEFAULT_SETTINGS: RoomSettings = {
  target: TARGET_OPTIONS[0],
};

export function validateTarget(target: unknown): string | null {
  if (!(TARGET_OPTIONS as readonly unknown[]).includes(target)) {
    return `La meta debe ser de ${TARGET_OPTIONS.join(' o ')} puntos`;
  }
  return null;
}
