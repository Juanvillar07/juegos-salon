import { useState, type FormEvent } from 'react';
import { MAX_NICKNAME_LENGTH } from '@typeracer/shared';
import { getLastNickname, saveNickname } from '../../lib/storage';

interface Props {
  code: string;
  onSubmit: (nickname: string) => void;
}

/** Se muestra al abrir un enlace /sala/CODIGO en una pestaña que aún no tiene nickname. */
export default function JoinForm({ code, onSubmit }: Props) {
  const [draft, setDraft] = useState(getLastNickname);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    saveNickname(name);
    onSubmit(name);
  };

  return (
    <form className="card narrow" onSubmit={submit}>
      <h2>Unirse a la sala {code}</h2>
      <label className="field">
        <span>Tu nickname</span>
        <input value={draft} maxLength={MAX_NICKNAME_LENGTH} onChange={(e) => setDraft(e.target.value)} autoFocus />
      </label>
      <button className="btn primary wide" type="submit" disabled={!draft.trim()}>
        Entrar
      </button>
    </form>
  );
}
