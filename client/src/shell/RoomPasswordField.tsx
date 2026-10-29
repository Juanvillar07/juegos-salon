import { useState, type FormEvent } from 'react';
import { MAX_ROOM_PASSWORD_LENGTH, type Ack } from '@typeracer/shared';
import { LockIcon } from './icons';
import styles from './RoomPasswordField.module.css';

interface Props {
  locked: boolean;
  /** Pone (texto) o quita (null) la contraseña en el servidor. */
  save: (password: string | null) => Promise<Ack>;
}

/**
 * Contraseña de la sala (solo el host). El servidor nunca la devuelve: aquí solo se sabe si la sala
 * tiene contraseña, y la que puso esta pestaña, para recordársela al host.
 */
export default function RoomPasswordField({ locked, save }: Props) {
  const [draft, setDraft] = useState('');
  const [current, setCurrent] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (password: string | null) => {
    setBusy(true);
    const res = await save(password);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setError(null);
    setCurrent(password);
    setDraft('');
    setEditing(false);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (draft.trim()) void run(draft.trim());
  };

  if (locked && !editing) {
    return (
      <div className={styles.row}>
        <span className={styles.status}>
          <LockIcon />
          {current ? (
            <>
              Contraseña: <strong>{current}</strong>
            </>
          ) : (
            'Con contraseña'
          )}
        </span>
        <div className={styles.actions}>
          <button type="button" className="btn" onClick={() => setEditing(true)} disabled={busy}>
            Cambiar
          </button>
          <button type="button" className="btn ghost" onClick={() => void run(null)} disabled={busy}>
            Quitar
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <form className={styles.row} onSubmit={submit}>
      <input
        className={styles.input}
        value={draft}
        maxLength={MAX_ROOM_PASSWORD_LENGTH}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(null);
        }}
        placeholder={locked ? 'Nueva contraseña' : 'Sala abierta: escribe una para cerrarla'}
        aria-label="Contraseña de la sala"
        autoComplete="off"
        spellCheck={false}
      />
      <div className={styles.actions}>
        <button type="submit" className="btn primary" disabled={!draft.trim() || busy}>
          {locked ? 'Guardar' : 'Poner'}
        </button>
        {locked && (
          <button type="button" className="btn ghost" onClick={() => setEditing(false)}>
            Cancelar
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
