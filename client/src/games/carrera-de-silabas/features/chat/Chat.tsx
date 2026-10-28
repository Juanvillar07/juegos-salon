import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MAX_CHAT_LENGTH } from '@typeracer/shared';
import { sendChat, useClientState } from '../../state/store';
import styles from '../../../rally-de-letras/features/chat/Chat.module.css';

/** Respuestas rápidas, típicas de una sala de juego. */
const QUICK = ['¡Suerte!', 'gg', '¿Listos?', 'Revancha', '👋', '🔥'];

function time(at: number): string {
  return new Date(at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  /** Versión pequeña para columnas laterales. */
  compact?: boolean;
  /** Ocupa todo el alto del contenedor (la lista crece; el input queda abajo). */
  fill?: boolean;
}

export default function Chat({ compact = false, fill = false }: Props) {
  const { chat, myId } = useClientState();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Siempre mostrar lo último que llegó.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [chat.length]);

  const send = async (text: string) => {
    if (!text.trim()) return;
    const res = await sendChat(text);
    if (res.ok) {
      setDraft('');
      setError(null);
    } else {
      setError(res.error);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(draft);
  };

  return (
    <div className={`${styles.chat} ${compact ? styles.compact : ''} ${fill ? styles.fill : ''}`}>
      <div className={styles.list} ref={listRef} aria-live="polite">
        {chat.length === 0 && <p className={styles.empty}>Aún no hay mensajes.</p>}
        {chat.map((m) =>
          m.kind === 'system' ? (
            <p key={m.id} className={styles.system}>
              {m.text}
            </p>
          ) : (
            <div key={m.id} className={`${styles.message} ${m.playerId === myId ? styles.mine : ''}`}>
              <span className={styles.author}>
                <span className="dot" style={{ background: m.color }} />
                {m.playerId === myId ? 'Tú' : m.nickname}
                <time className={styles.time}>{time(m.at)}</time>
              </span>
              <span className={styles.text}>{m.text}</span>
            </div>
          ),
        )}
      </div>

      <div className={styles.quick}>
        {QUICK.map((q) => (
          <button key={q} type="button" onClick={() => void send(q)}>
            {q}
          </button>
        ))}
      </div>

      <form className={styles.form} onSubmit={onSubmit}>
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          maxLength={MAX_CHAT_LENGTH}
          placeholder="Escribe un mensaje…"
          aria-label="Mensaje"
        />
        <button className="btn primary" type="submit" disabled={!draft.trim()}>
          Enviar
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
