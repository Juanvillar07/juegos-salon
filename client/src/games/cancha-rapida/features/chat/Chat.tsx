import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MAX_CHAT_LENGTH } from '@typeracer/shared';
import { sendChat, useClientState } from '../../state/store';
import styles from '../../../rally-de-letras/features/chat/Chat.module.css';

/** Respuestas rápidas, típicas de un partido. */
const QUICK = ['¡Golazo!', 'gg', '¿Listos?', 'Revancha', '👋', '🔥'];

function time(at: number): string {
  return new Date(at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  compact?: boolean;
  /** Ocupa todo el alto del contenedor (la lista crece; el input queda abajo). */
  fill?: boolean;
  /** Sin respuestas rápidas (en la cancha, para dejar más sitio a los mensajes). */
  noQuick?: boolean;
}

/**
 * Chat de la sala. En la cancha, Enter lo enfoca (ver useKeyboard) y Esc o enviar devuelven
 * el teclado al partido.
 */
export default function Chat({ compact = false, fill = false, noQuick = false }: Props) {
  const { chat, myId } = useClientState();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    // En la cancha, tras enviar se vuelve a jugar.
    if (noQuick) inputRef.current?.blur();
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

      {!noQuick && (
        <div className={styles.quick}>
          {QUICK.map((q) => (
            <button key={q} type="button" onClick={() => void send(q)}>
              {q}
            </button>
          ))}
        </div>
      )}

      <form className={styles.form} onSubmit={onSubmit}>
        <input
          ref={inputRef}
          data-chat-input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') e.currentTarget.blur();
          }}
          maxLength={MAX_CHAT_LENGTH}
          placeholder={noQuick ? 'Enter para escribir…' : 'Escribe un mensaje…'}
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
