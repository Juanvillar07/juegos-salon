import { useEffect, useState } from 'react';
import {
  MAX_CUSTOM_TEXT_LENGTH,
  TEXT_LENGTH_OPTIONS,
  TIME_LIMIT_OPTIONS,
  normalizeRaceText,
  validateCustomText,
  type RoomSettings,
  type TextLength,
} from '@typeracer/shared';
import { useSlidingPill } from '../../../../shell/transitions';
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

const LENGTH_LABELS: Record<TextLength, string> = {
  any: 'Cualquiera',
  short: 'Corto',
  medium: 'Medio',
  long: 'Largo',
};

const LENGTH_HINTS: Record<TextLength, string> = {
  any: 'Cada carrera usa un texto distinto del catálogo en español.',
  short: 'Textos de menos de 200 caracteres: carreras rápidas.',
  medium: 'Textos de 200 a 300 caracteres.',
  long: 'Textos de más de 300 caracteres: para quien busca resistencia.',
};

/** Ajustes de la sala: el host los edita, el resto los ve. */
export default function RoomSettingsPanel({ settings, isHost }: Props) {
  const [mode, setMode] = useState<'random' | 'custom'>(settings.customText ? 'custom' : 'random');
  const [draft, setDraft] = useState(settings.customText ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Píldora deslizante de los selectores (Tabs sliding, transitions.dev).
  const textBar = useSlidingPill<HTMLDivElement>(mode);
  const timeBar = useSlidingPill<HTMLDivElement>(settings.timeLimitSec);
  // Con el modo en la clave: el selector de longitud solo existe con texto aleatorio.
  const lengthBar = useSlidingPill<HTMLDivElement>(`${mode}-${settings.textLength}`);

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
          <span>
            {activeText
              ? `Personalizado · ${activeText.length} caracteres`
              : settings.textLength === 'any'
                ? 'Aleatorio del catálogo'
                : `Aleatorio · ${LENGTH_LABELS[settings.textLength].toLowerCase()}`}
          </span>
        </div>
        {activeText && <p className={styles.preview}>{activeText}</p>}
        {settings.plainText && !activeText && (
          <div className={styles.readRow}>
            <span className="label">Signos</span>
            <span>Sin ¿ ¡ ni comillas</span>
          </div>
        )}
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
          <div className="segmented" ref={textBar}>
            <span className="t-tabs-pill" aria-hidden="true" />
            <button type="button" aria-pressed={mode === 'random'} onClick={() => chooseMode('random')}>
              Aleatorio
            </button>
            <button type="button" aria-pressed={mode === 'custom'} onClick={() => chooseMode('custom')}>
              Personalizado
            </button>
          </div>
        </div>

        {mode === 'random' ? (
          <>
            <div className={styles.subRow}>
              <span className="muted">Longitud</span>
              <div className="segmented" ref={lengthBar}>
                <span className="t-tabs-pill" aria-hidden="true" />
                {TEXT_LENGTH_OPTIONS.map((length) => (
                  <button
                    key={length}
                    type="button"
                    aria-pressed={settings.textLength === length}
                    onClick={() => save({ textLength: length })}
                    disabled={saving}
                  >
                    {LENGTH_LABELS[length]}
                  </button>
                ))}
              </div>
            </div>
            <p className="muted">{LENGTH_HINTS[settings.textLength]}</p>
            {/* Solo para el catálogo: un texto pegado se escribe tal cual. */}
            <label className={styles.check} title="Quita ¿ ¡ y comillas, para quien juega con teclado en inglés">
              <input
                type="checkbox"
                checked={settings.plainText}
                disabled={saving}
                onChange={(e) => save({ plainText: e.target.checked })}
              />
              Sin signos
            </label>
          </>
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
