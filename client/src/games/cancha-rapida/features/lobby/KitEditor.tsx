import { useEffect, useRef, useState } from 'react';
import {
  KIT_COLORS,
  KIT_PATTERNS,
  TEAM_NAMES,
  type Side,
  type TeamKit,
} from '@typeracer/shared/cancha-rapida';
import KitBadge from '../../components/KitBadge';
import { setTeamKit } from '../../state/store';
import styles from './KitEditor.module.css';

interface Props {
  team: Side;
  kit: TeamKit;
  /** Uniforme del otro equipo: su color principal no se puede repetir. */
  rival: TeamKit;
  onClose: () => void;
}

/**
 * Editor del uniforme de un equipo (solo el host): vista previa, color principal, secundario y
 * diseño. Se abre como diálogo modal (<dialog>: Esc y foco de serie) y guarda al pulsar "Guardar".
 */
export default function KitEditor({ team, kit, rival, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<TeamKit>(kit);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const change = (patch: Partial<TeamKit>) => {
    setError(null);
    setDraft((d) => {
      const next = { ...d, ...patch };
      // Si el principal pasa a ser igual que el secundario, el secundario cambia a otro color.
      if (next.primary === next.secondary) {
        next.secondary = KIT_COLORS.find((c) => c.value !== next.primary)!.value;
      }
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    const res = await setTeamKit(team, draft);
    setSaving(false);
    if (res.ok) onClose();
    else setError(res.error);
  };

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="uniforme-titulo"
      onClose={onClose}
      // Clic en el fondo (fuera de la tarjeta) cierra sin guardar.
      onClick={(e) => {
        if (e.target === e.currentTarget) dialog.current?.close();
      }}
    >
      <div className={styles.card}>
        <header className={styles.head}>
          <KitBadge kit={draft} size={72} />
          <div>
            <span className="label">Uniforme</span>
            <h2 id="uniforme-titulo">{TEAM_NAMES[team]}</h2>
          </div>
        </header>

        <fieldset className={styles.group}>
          <legend>Color principal</legend>
          <div className={styles.swatches}>
            {KIT_COLORS.map((c) => {
              const taken = c.value === rival.primary;
              return (
                <button
                  key={c.value}
                  type="button"
                  className={styles.swatch}
                  style={{ background: c.value }}
                  aria-pressed={draft.primary === c.value}
                  disabled={taken}
                  onClick={() => change({ primary: c.value })}
                  title={taken ? `${c.name} (lo usa el otro equipo)` : c.name}
                  aria-label={taken ? `${c.name}, lo usa el otro equipo` : c.name}
                />
              );
            })}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Color secundario</legend>
          <div className={styles.swatches}>
            {KIT_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                className={styles.swatch}
                style={{ background: c.value }}
                aria-pressed={draft.secondary === c.value}
                disabled={c.value === draft.primary}
                onClick={() => change({ secondary: c.value })}
                title={c.name}
                aria-label={c.name}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Diseño</legend>
          <div className={styles.patterns}>
            {KIT_PATTERNS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={styles.pattern}
                aria-pressed={draft.pattern === p.value}
                onClick={() => change({ pattern: p.value })}
              >
                <KitBadge kit={{ ...draft, pattern: p.value }} size={34} />
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {error && <p className="error">{error}</p>}

        <div className={styles.actions}>
          <button type="button" className="btn" onClick={() => dialog.current?.close()}>
            Cancelar
          </button>
          <button type="button" className="btn primary" onClick={() => void save()} disabled={saving} autoFocus>
            Guardar
          </button>
        </div>
      </div>
    </dialog>
  );
}
