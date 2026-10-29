import { useState, type ReactNode } from 'react';
import { SCORE_LIMIT_OPTIONS, TIME_LIMIT_OPTIONS, type RoomSettings } from '@typeracer/shared/cancha-rapida';
import { useSlidingPill } from '../../../../shell/transitions';
import { updateRoomSettings } from '../../state/store';
import styles from '../../../rally-de-letras/features/lobby/RoomSettingsPanel.module.css';

interface Props {
  settings: RoomSettings;
  isHost: boolean;
}

function goalsLabel(limit: number): string {
  return limit === 0 ? 'Sin límite' : `${limit} ${limit === 1 ? 'gol' : 'goles'}`;
}

/** Goles para ganar y duración del partido: el host los elige, el resto los ve. */
export default function RoomSettingsPanel({ settings, isHost }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const goalsBar = useSlidingPill<HTMLDivElement>(settings.scoreLimit);
  const timeBar = useSlidingPill<HTMLDivElement>(settings.timeLimitMin);
  const goalsHint =
    settings.scoreLimit === 0 ? 'Se juega todo el tiempo.' : 'El primero en llegar gana, aunque quede tiempo.';
  const timeHint = 'Las pausas tras un gol no cuentan. Al acabarse, gana quien vaya por delante.';

  const save = async (patch: Partial<RoomSettings>) => {
    setSaving(true);
    const res = await updateRoomSettings(patch);
    setSaving(false);
    setError(res.ok ? null : res.error);
  };

  if (!isHost) {
    return (
      <div className={styles.panel}>
        <Setting name="Goles para ganar" hint={goalsHint}>
          <span className={styles.value}>{goalsLabel(settings.scoreLimit)}</span>
        </Setting>
        <Setting name="Duración" hint={timeHint}>
          <span className={styles.value}>{settings.timeLimitMin} min</span>
        </Setting>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <Setting name="Goles para ganar" hint={goalsHint}>
        <div className="segmented" ref={goalsBar}>
          <span className="t-tabs-pill" aria-hidden="true" />
          {SCORE_LIMIT_OPTIONS.map((limit) => (
            <button
              key={limit}
              type="button"
              aria-pressed={settings.scoreLimit === limit}
              onClick={() => save({ scoreLimit: limit })}
              disabled={saving}
            >
              {goalsLabel(limit)}
            </button>
          ))}
        </div>
      </Setting>
      <Setting name="Duración" hint={timeHint}>
        <div className="segmented" ref={timeBar}>
          <span className="t-tabs-pill" aria-hidden="true" />
          {TIME_LIMIT_OPTIONS.map((min) => (
            <button
              key={min}
              type="button"
              aria-pressed={settings.timeLimitMin === min}
              onClick={() => save({ timeLimitMin: min })}
              disabled={saving}
            >
              {min} min
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
