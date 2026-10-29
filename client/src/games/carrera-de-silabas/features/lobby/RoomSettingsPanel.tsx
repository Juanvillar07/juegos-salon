import { useState, type ReactNode } from 'react';
import {
  SKIP_POINTS_OPTIONS,
  TARGET_OPTIONS,
  TIME_LIMIT_OPTIONS,
  type RoomSettings,
} from '@typeracer/shared/carrera-de-silabas';
import { useSlidingPill } from '../../../../shell/transitions';
import { formatDuration } from '../../../rally-de-letras/lib/format';
import { updateRoomSettings } from '../../state/store';
import styles from '../../../rally-de-letras/features/lobby/RoomSettingsPanel.module.css';

interface Props {
  settings: RoomSettings;
  isHost: boolean;
}

/** Largo de una palabra típica, para estimar cuántas hacen falta para la meta. */
const TYPICAL_WORD = 7;

function skipLabel(points: number): string {
  return points === 0 ? 'Sin penalización' : `−${points} pts`;
}

function skipHint(points: number): string {
  return points === 0 ? 'Pasar a la siguiente sílaba es gratis.' : `Pasar quita ${points} puntos, aunque te deje en negativo.`;
}

/** Meta de puntos, límite de tiempo y coste de pasar: el host los elige, el resto los ve. */
export default function RoomSettingsPanel({ settings, isHost }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Píldora deslizante de los selectores (Tabs sliding, transitions.dev).
  const targetBar = useSlidingPill<HTMLDivElement>(settings.target);
  const timeBar = useSlidingPill<HTMLDivElement>(settings.timeLimitSec);
  const skipBar = useSlidingPill<HTMLDivElement>(settings.skipPoints);
  const targetHint = `Con palabras de ${TYPICAL_WORD} letras son unas ${Math.ceil(settings.target / TYPICAL_WORD)} palabras.`;
  const timeHint = 'Si se acaba, gana quien tenga más puntos.';

  const save = async (patch: Partial<RoomSettings>) => {
    setSaving(true);
    const res = await updateRoomSettings(patch);
    setSaving(false);
    setError(res.ok ? null : res.error);
  };

  if (!isHost) {
    return (
      <div className={styles.panel}>
        <Setting name="Meta" hint={targetHint}>
          <span className={`${styles.value} num`}>{settings.target} puntos</span>
        </Setting>
        <Setting name="Tiempo límite" hint={timeHint}>
          <span className={styles.value}>{formatDuration(settings.timeLimitSec)}</span>
        </Setting>
        <Setting name="Pasar sílaba" hint={skipHint(settings.skipPoints)}>
          <span className={styles.value}>{skipLabel(settings.skipPoints)}</span>
        </Setting>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <Setting name="Meta" hint={targetHint}>
        <div className="segmented" ref={targetBar}>
          <span className="t-tabs-pill" aria-hidden="true" />
          {TARGET_OPTIONS.map((target) => (
            <button
              key={target}
              type="button"
              aria-pressed={settings.target === target}
              onClick={() => save({ target })}
              disabled={saving}
            >
              {target} puntos
            </button>
          ))}
        </div>
      </Setting>

      <Setting name="Tiempo límite" hint={timeHint}>
        <div className="segmented" ref={timeBar}>
          <span className="t-tabs-pill" aria-hidden="true" />
          {TIME_LIMIT_OPTIONS.map((sec) => (
            <button
              key={sec}
              type="button"
              aria-pressed={settings.timeLimitSec === sec}
              onClick={() => save({ timeLimitSec: sec })}
              disabled={saving}
            >
              {formatDuration(sec)}
            </button>
          ))}
        </div>
      </Setting>

      <Setting name="Pasar sílaba" hint={skipHint(settings.skipPoints)}>
        <div className="segmented" ref={skipBar}>
          <span className="t-tabs-pill" aria-hidden="true" />
          {SKIP_POINTS_OPTIONS.map((points) => (
            <button
              key={points}
              type="button"
              aria-pressed={settings.skipPoints === points}
              onClick={() => save({ skipPoints: points })}
              disabled={saving}
            >
              {skipLabel(points)}
            </button>
          ))}
        </div>
      </Setting>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

/** Una fila de ajustes: nombre y explicación a la izquierda, control (o valor) a la derecha. */
function Setting({ name, hint, children }: { name: string; hint: string; children: ReactNode }) {
  return (
    <div className={styles.section}>
      <div className={styles.field}>
        <div className={styles.fieldText}>
          <span className={styles.fieldName}>{name}</span>
          <span className={styles.hint}>{hint}</span>
        </div>
        {children}
      </div>
    </div>
  );
}
