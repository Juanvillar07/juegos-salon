import { useState } from 'react';
import {
  MIN_WORD_LENGTH,
  SKIP_BLOCK_MS,
  SKIP_PENALTY_OPTIONS,
  SKIP_POINTS,
  TARGET_OPTIONS,
  TIME_LIMIT_OPTIONS,
  type RoomSettings,
  type SkipPenalty,
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

const SKIP_LABELS: Record<SkipPenalty, string> = {
  points: `−${SKIP_POINTS} pts`,
  time: `${SKIP_BLOCK_MS / 1000} s`,
  both: 'Ambos',
};

const SKIP_HINTS: Record<SkipPenalty, string> = {
  points: `Pasar a la siguiente sílaba quita ${SKIP_POINTS} puntos (sin bajar de 0).`,
  time: `Pasar a la siguiente sílaba deja ${SKIP_BLOCK_MS / 1000} segundos sin poder escribir.`,
  both: `Pasar quita ${SKIP_POINTS} puntos y deja ${SKIP_BLOCK_MS / 1000} segundos sin poder escribir.`,
};

/** Meta de puntos y límite de tiempo de la sala: el host los elige, el resto los ve. */
export default function RoomSettingsPanel({ settings, isHost }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Píldora deslizante de los selectores (Tabs sliding, transitions.dev).
  const targetBar = useSlidingPill<HTMLDivElement>(settings.target);
  const timeBar = useSlidingPill<HTMLDivElement>(settings.timeLimitSec);
  const skipBar = useSlidingPill<HTMLDivElement>(settings.skipPenalty);
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
        <div className={styles.readRow}>
          <span className="label">Pasar sílaba</span>
          <span>{SKIP_LABELS[settings.skipPenalty]}</span>
        </div>
        <p className={styles.hint}>{SKIP_HINTS[settings.skipPenalty]}</p>
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

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <span className="label">Pasar sílaba</span>
          <div className="segmented" ref={skipBar}>
            <span className="t-tabs-pill" aria-hidden="true" />
            {SKIP_PENALTY_OPTIONS.map((penalty) => (
              <button
                key={penalty}
                type="button"
                aria-pressed={settings.skipPenalty === penalty}
                onClick={() => save({ skipPenalty: penalty })}
                disabled={saving}
              >
                {SKIP_LABELS[penalty]}
              </button>
            ))}
          </div>
        </div>
        <p className={styles.hint}>{SKIP_HINTS[settings.skipPenalty]}</p>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
