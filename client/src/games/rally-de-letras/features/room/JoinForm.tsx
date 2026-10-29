import { useState, type FormEvent } from 'react';
import { MAX_NICKNAME_LENGTH, MAX_ROOM_PASSWORD_LENGTH } from '@typeracer/shared';
import { getLastNickname, saveNickname } from '../../lib/storage';

interface Props {
  code: string;
  onSubmit: (nickname: string, password?: string) => void;
  /** La sala tiene contraseña: se pide junto al nickname. */
  askPassword?: boolean;
  /** Por qué no se pudo entrar con la contraseña anterior (incorrecta, demasiados intentos…). */
  error?: string | null;
}

/** Se muestra al abrir un enlace /sala/CODIGO sin nickname, o cuando la sala pide contraseña. */
export default function JoinForm({ code, onSubmit, askPassword = false, error = null }: Props) {
  const [draft, setDraft] = useState(getLastNickname);
  const [password, setPassword] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = draft.trim();
    if (!name || (askPassword && !password.trim())) return;
    saveNickname(name);
    onSubmit(name, askPassword ? password.trim() : undefined);
  };

  return (
    <form className="card narrow" onSubmit={submit}>
      <h2>Unirse a la sala {code}</h2>
      {askPassword && <p className="muted">Esta sala tiene contraseña: pídesela a quien te invitó.</p>}
      <label className="field">
        <span>Tu nickname</span>
        <input
          value={draft}
          maxLength={MAX_NICKNAME_LENGTH}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus={!askPassword}
        />
      </label>
      {askPassword && (
        <label className="field">
          <span>Contraseña de la sala</span>
          <input
            value={password}
            maxLength={MAX_ROOM_PASSWORD_LENGTH}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
        </label>
      )}
      {error && <p className="error">{error}</p>}
      <button
        className="btn primary wide"
        type="submit"
        disabled={!draft.trim() || (askPassword && !password.trim())}
      >
        Entrar
      </button>
    </form>
  );
}
