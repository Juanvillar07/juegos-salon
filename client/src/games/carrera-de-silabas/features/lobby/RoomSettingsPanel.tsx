import { useState } from 'react';
import { MIN_WORD_LENGTH, TARGET_OPTIONS, type RoomSettings } from '@typeracer/shared/carrera-de-silabas';
import { updateRoomSettings } from '../../state/store';
import styles from '../../../rally-de-letras/features/lobby/RoomSettingsPanel.module.css';

interface Props {
  settings: RoomSettings;
  isHost: boolean;
}

/** Largo de una palabra típica, para estimar cuántas hacen falta para la meta. */
const TYPICAL_WORD = 7;

/** Meta de puntos de la sala: el host la elige, el resto la ve. */
export default function RoomSettingsPanel({ settings, isHost }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const hint = `Cada palabra suma un punto por letra (mínimo ${MIN_WORD_LENGTH}). Con palabras de ${TYPICAL_WORD} letras son unas ${Math.ceil(settings.target / TYPICAL_WORD)} palabras.`;

  const choose = async (target: number) => {
    setSaving(true);
    const res = await updateRoomSettings({ target });
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
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <span className="label">Meta</span>
          <div className="segmented">
            {TARGET_OPTIONS.map((target) => (
              <button
                key={target}
                type="button"
                aria-pressed={settings.target === target}
                onClick={() => choose(target)}
                disabled={saving}
              >
                {target} puntos
              </button>
            ))}
          </div>
        </div>
        <p className={styles.hint}>{hint}</p>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
