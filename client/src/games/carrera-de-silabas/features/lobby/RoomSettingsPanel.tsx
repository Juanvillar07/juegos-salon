import { useState } from 'react';
import {
  MIN_WORD_LENGTH,
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

/** Meta de puntos y límite de tiempo de la sala: el host los elige, el resto los ve. */
export default function RoomSettingsPanel({ settings, isHost }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Píldora deslizante de los selectores (Tabs sliding, transitions.dev).
  const targetBar = useSlidingPill<HTMLDivElement>(settings.target);
  const timeBar = useSlidingPill<HTMLDivElement>(settings.timeLimitSec);
  const hint = `Cada palabra suma un punto por letra (mínimo ${MIN_WORD_LENGTH}). Con palabras de ${TYPICAL_WORD} letras son unas ${Math.ceil(settings.target / TYPICAL_WORD)} palabras.`;
  const timeHint = 'Si se acaba el tiempo, los que no llegaron a la meta se ordenan por puntos.';

  const save = async (patch: Partial<RoomSettings>) => {
    setSaving(true);
    const res = await updateRoomSettings(patch);
    setSaving(false);
    setError(res.ok ? null : res.error);
  };

  if (!isHost) {
    return (
      <div className={styles.panel}>
        <div className={styles.readRow}>
          <span className="label">Meta</span>
          <span className="num">{settings.target} puntos</span>
        </div>
        <p className={styles.hint}>{hint}</p>
        <div className={styles.readRow}>
          <span className="label">Tiempo</span>
          <span>{formatDuration(settings.timeLimitSec)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <span className="label">Meta</span>
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
        </div>
        <p className={styles.hint}>{hint}</p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <span className="label">Tiempo límite</span>
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
        </div>
        <p className={styles.hint}>{timeHint}</p>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
