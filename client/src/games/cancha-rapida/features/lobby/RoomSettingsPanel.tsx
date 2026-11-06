import { useState, type ReactNode } from 'react';
import {
  SCORE_LIMIT_OPTIONS,
  TIEBREAK_OPTIONS,
  TIME_LIMIT_OPTIONS,
  type RoomSettings,
  type Tiebreak,
} from '@typeracer/shared/cancha-rapida';
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

const SHOT_OPTIONS = [
  { value: true, label: 'Con potencia' },
  { value: false, label: 'Clásica' },
] as const;

const TIEBREAK_LABELS: Record<Tiebreak, string> = {
  draw: 'Empate',
  goldenGoal: 'Gol de oro',
  penalties: 'Penaltis',
};

const TIEBREAK_HINTS: Record<Tiebreak, string> = {
  draw: 'Si se acaba el tiempo con empate, queda empate.',
  goldenGoal: 'Con empate al final se sigue jugando: el primero que marque gana.',
  penalties: 'Con empate al final, 3 penaltis por equipo y luego muerte súbita.',
};

function shotHint(chargedShot: boolean): string {
  return chargedShot
    ? 'Mantén patear para cargar y suelta para tirar: un toque es un pase suave.'
    : 'Sin carga: la patada sale al tocar el balón, siempre con la misma fuerza.';
}

/** Goles para ganar, duración y tipo de patada: el host los elige, el resto los ve. */
export default function RoomSettingsPanel({ settings, isHost }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const goalsBar = useSlidingPill<HTMLDivElement>(settings.scoreLimit);
  const timeBar = useSlidingPill<HTMLDivElement>(settings.timeLimitMin);
  const shotBar = useSlidingPill<HTMLDivElement>(settings.chargedShot);
  const tiebreakBar = useSlidingPill<HTMLDivElement>(settings.tiebreak);
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
        <Setting name="Si hay empate" hint={TIEBREAK_HINTS[settings.tiebreak]}>
          <span className={styles.value}>{TIEBREAK_LABELS[settings.tiebreak]}</span>
        </Setting>
        <Setting name="Patada" hint={shotHint(settings.chargedShot)}>
          <span className={styles.value}>{settings.chargedShot ? 'Con potencia' : 'Clásica'}</span>
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
      <Setting name="Si hay empate" hint={TIEBREAK_HINTS[settings.tiebreak]}>
        <div className="segmented" ref={tiebreakBar}>
          <span className="t-tabs-pill" aria-hidden="true" />
          {TIEBREAK_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={settings.tiebreak === option}
              onClick={() => save({ tiebreak: option })}
              disabled={saving}
            >
              {TIEBREAK_LABELS[option]}
            </button>
          ))}
        </div>
      </Setting>
      <Setting name="Patada" hint={shotHint(settings.chargedShot)}>
        <div className="segmented" ref={shotBar}>
          <span className="t-tabs-pill" aria-hidden="true" />
          {SHOT_OPTIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={settings.chargedShot === option.value}
              onClick={() => save({ chargedShot: option.value })}
              disabled={saving}
            >
              {option.label}
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
