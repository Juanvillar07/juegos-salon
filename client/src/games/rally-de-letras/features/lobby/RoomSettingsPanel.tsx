import { useEffect, useState } from 'react';
import {
  MAX_CUSTOM_TEXT_LENGTH,
  TIME_LIMIT_OPTIONS,
  normalizeRaceText,
  validateCustomText,
  type RoomSettings,
} from '@typeracer/shared';
import { formatDuration, requiredWpm } from '../../lib/format';
import { updateRoomSettings } from '../../state/store';
import styles from './RoomSettingsPanel.module.css';

interface Props {
  settings: RoomSettings;
  isHost: boolean;
}

/** Velocidad de referencia para estimar cuánto se tarda en escribir un texto. */
const REFERENCE_WPM = 40;
/** A partir de esta exigencia se avisa que el tiempo es muy justo. */
const DEMANDING_WPM = 70;

/** Ajustes de la sala: el host los edita, el resto los ve. */
export default function RoomSettingsPanel({ settings, isHost }: Props) {
  const [mode, setMode] = useState<'random' | 'custom'>(settings.customText ? 'custom' : 'random');
  const [draft, setDraft] = useState(settings.customText ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Cuando llega el texto guardado (ya normalizado por el servidor), se refleja en el editor.
  useEffect(() => {
    setDraft(settings.customText ?? '');
    if (settings.customText) setMode('custom');
  }, [settings.customText]);

  const normalized = normalizeRaceText(draft);
  const draftError = normalized.length > 0 ? validateCustomText(normalized) : null;
  const dirty = normalized !== (settings.customText ?? '');
  const words = normalized ? normalized.split(' ').length : 0;

  const activeText = settings.customText;
  const neededWpm = activeText ? requiredWpm(activeText.length, settings.timeLimitSec) : null;

  const save = async (patch: Partial<RoomSettings>) => {
    setSaving(true);
    const res = await updateRoomSettings(patch);
    setSaving(false);
    setError(res.ok ? null : res.error);
  };

  const chooseMode = (next: 'random' | 'custom') => {
    setMode(next);
    setError(null);
    if (next === 'random' && settings.customText !== null) void save({ customText: null });
  };

  if (!isHost) {
    return (
      <div className={styles.panel}>
        <div className={styles.readRow}>
          <span className="label">Texto</span>
          <span>{activeText ? `Personalizado · ${activeText.length} caracteres` : 'Aleatorio del catálogo'}</span>
        </div>
        {activeText && <p className={styles.preview}>{activeText}</p>}
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
          <span className="label">Texto</span>
          <div className="segmented">
            <button type="button" aria-pressed={mode === 'random'} onClick={() => chooseMode('random')}>
              Aleatorio
            </button>
            <button type="button" aria-pressed={mode === 'custom'} onClick={() => chooseMode('custom')}>
              Personalizado
            </button>
          </div>
        </div>

        {mode === 'random' ? (
          <p className="muted">Cada carrera usa un texto distinto del catálogo en español.</p>
        ) : (
          <>
            <textarea
              className={styles.textarea}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setError(null);
              }}
              placeholder="Pega aquí el texto que todos deben escribir…"
              rows={5}
              maxLength={MAX_CUSTOM_TEXT_LENGTH * 2}
              spellCheck={false}
            />
            <div className={styles.meta}>
              <span className={`num ${normalized.length > MAX_CUSTOM_TEXT_LENGTH ? styles.over : ''}`}>
                {normalized.length}/{MAX_CUSTOM_TEXT_LENGTH}
              </span>
              <span className="num">{words} palabras</span>
              {normalized.length > 0 && (
                <span className="num">≈ {formatDuration(Math.max(1, Math.round((normalized.length / 5 / REFERENCE_WPM) * 60)))} a {REFERENCE_WPM} wpm</span>
              )}
              <button
                type="button"
                className="btn primary"
                onClick={() => save({ customText: draft })}
                disabled={!dirty || !!draftError || normalized.length === 0 || saving}
              >
                {settings.customText && !dirty ? 'Guardado' : 'Guardar texto'}
              </button>
            </div>
            {draftError && <p className="error">{draftError}</p>}
            {!draftError && draft !== normalized && normalized.length > 0 && (
              <p className={styles.hint}>Los saltos de línea y las comillas tipográficas se simplifican al guardar.</p>
            )}
          </>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <span className="label">Tiempo límite</span>
          <div className="segmented">
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
        {neededWpm !== null && neededWpm >= DEMANDING_WPM && (
          <p className={styles.hint}>
            Para terminar este texto en {formatDuration(settings.timeLimitSec)} hay que escribir a {neededWpm} wpm o más.
          </p>
        )}
      </div>

      {error && <p className="error">{error}</p>}
    </div>
  );
}
