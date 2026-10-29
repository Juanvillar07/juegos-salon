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
  any: 'Textos de cualquier largo.',
  short: 'Menos de 200 caracteres.',
  medium: 'De 200 a 300 caracteres.',
  long: 'Más de 300 caracteres.',
};

const TIME_HINT = 'Al acabarse, gana quien más avanzó.';

const SOURCES = [
  { mode: 'random', title: 'Del catálogo', hint: 'Un texto en español distinto en cada carrera.' },
  { mode: 'custom', title: 'Texto propio', hint: 'Pegas el texto que todos van a escribir.' },
] as const;

/** Ajustes de la sala: el host los edita, el resto los ve. */
export default function RoomSettingsPanel({ settings, isHost }: Props) {
  const [mode, setMode] = useState<'random' | 'custom'>(settings.customText ? 'custom' : 'random');
  const [draft, setDraft] = useState(settings.customText ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Píldora deslizante de los selectores (Tabs sliding, transitions.dev).
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
        <div className={styles.section}>
          <div className={styles.field}>
            <div className={styles.fieldText}>
              <span className={styles.fieldName}>Texto</span>
              <span className={styles.hint}>
                {activeText
                  ? 'Lo eligió el host.'
                  : settings.plainText
                    ? `${LENGTH_HINTS[settings.textLength]} Sin ¿ ¡ ni comillas.`
                    : LENGTH_HINTS[settings.textLength]}
              </span>
            </div>
            <span className={styles.value}>
              {activeText
                ? `Propio · ${activeText.length} caracteres`
                : settings.textLength === 'any'
                  ? 'Del catálogo'
                  : `Del catálogo · ${LENGTH_LABELS[settings.textLength].toLowerCase()}`}
            </span>
          </div>
          {activeText && <p className={styles.preview}>{activeText}</p>}
        </div>
        <div className={styles.section}>
          <div className={styles.field}>
            <div className={styles.fieldText}>
              <span className={styles.fieldName}>Tiempo límite</span>
              <span className={styles.hint}>{TIME_HINT}</span>
            </div>
            <span className={styles.value}>{formatDuration(settings.timeLimitSec)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <div className={styles.fieldText}>
          <span className={styles.fieldName}>Texto</span>
          <span className={styles.hint}>De dónde sale el texto que todos escriben.</span>
        </div>
        <div className={styles.choices} role="radiogroup" aria-label="Origen del texto">
          {SOURCES.map((source) => (
            <button
              key={source.mode}
              type="button"
              role="radio"
              aria-checked={mode === source.mode}
              className={styles.choice}
              onClick={() => chooseMode(source.mode)}
              disabled={saving}
            >
              <span className={styles.choiceTitle}>{source.title}</span>
              <span className={styles.choiceHint}>{source.hint}</span>
            </button>
          ))}
        </div>

        {mode === 'random' ? (
          <div className={styles.options}>
            <div className={styles.field}>
              <div className={styles.fieldText}>
                <span className={styles.fieldName}>Longitud</span>
                <span className={styles.hint}>{LENGTH_HINTS[settings.textLength]}</span>
              </div>
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
            {/* Solo para el catálogo: un texto pegado se escribe tal cual. */}
            <label className={styles.field}>
              <span className={styles.fieldText}>
                <span className={styles.fieldName}>Sin signos</span>
                <span className={styles.hint}>Quita ¿ ¡ y comillas: más cómodo con teclado en inglés.</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                className={styles.switch}
                checked={settings.plainText}
                disabled={saving}
                onChange={(e) => save({ plainText: e.target.checked })}
              />
            </label>
          </div>
        ) : (
          // Mismo alto aproximado que las opciones del catálogo: cambiar de origen no hace saltar el panel.
          <div className={styles.options}>
            <textarea
              className={styles.textarea}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setError(null);
              }}
              placeholder="Pega aquí el texto que todos deben escribir…"
              rows={2}
              maxLength={MAX_CUSTOM_TEXT_LENGTH * 2}
              spellCheck={false}
              aria-label="Texto de la carrera"
            />
            <div className={styles.meta}>
              <span className={`num ${normalized.length > MAX_CUSTOM_TEXT_LENGTH ? styles.over : ''}`}>
                {normalized.length}/{MAX_CUSTOM_TEXT_LENGTH}
              </span>
              <span className="num">{words} palabras</span>
              {normalized.length > 0 && (
                <span className="num">≈ {formatDuration(Math.max(1, Math.round((normalized.length / 5 / REFERENCE_WPM) * 60)))} a {REFERENCE_WPM} wpm</span>
              )}
              {!settings.customText && normalized.length === 0 && <span>Mientras, se usa el catálogo</span>}
              <button
                type="button"
                className={`btn primary ${styles.save}`}
                onClick={() => save({ customText: draft })}
                disabled={!dirty || !!draftError || normalized.length === 0 || saving}
              >
                {settings.customText && !dirty ? 'Guardado' : 'Guardar texto'}
              </button>
            </div>
            {draftError && <p className="error">{draftError}</p>}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.field}>
          <div className={styles.fieldText}>
            <span className={styles.fieldName}>Tiempo límite</span>
            <span className={styles.hint}>{TIME_HINT}</span>
          </div>
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
          <p className={styles.warn}>
            Para terminar este texto en {formatDuration(settings.timeLimitSec)} hay que escribir a {neededWpm} wpm o más.
          </p>
        )}
      </div>

      {error && <p className="error">{error}</p>}
    </div>
  );
}
