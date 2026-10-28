import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { calcWpm, type RoomState } from '@typeracer/shared';
import Speedometer from '../../components/Speedometer';
import Track from '../../components/Track';
import TrafficLight from '../../components/TrafficLight';
import { formatCountdown } from '../../lib/format';
import { serverNow } from '../../state/store';
import { GAME_HOME } from '../../routes';
import TextDisplay from './TextDisplay';
import { applyInput, createTypingState, splitWords, viewOf } from './typing';
import { useProgressSync } from './useProgressSync';
import { useServerClock } from './useServerClock';
import styles from './Race.module.css';

interface Props {
  room: RoomState;
  myId: string;
}

/** Cuánto tiempo sigue visible el semáforo en verde tras la salida. */
const GO_VISIBLE_MS = 900;
/** A partir de esta racha se muestra el contador. */
const STREAK_MIN = 3;
/** Por debajo de este tiempo restante el reloj se resalta. */
const HURRY_MS = 10_000;

export default function Race({ room, myId }: Props) {
  const navigate = useNavigate();
  const text = room.text!;
  const startAt = room.startAt!;
  const me = room.players.find((p) => p.id === myId);
  const words = useMemo(() => splitWords(text), [text]);

  // Si volvemos a una carrera ya empezada (recarga), se retoma desde lo que confirmó el servidor.
  const [typing, setTyping] = useState(() => createTypingState(text, me?.progress ?? 0));
  const view = viewOf(words, typing);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const now = useServerClock();
  const started = now >= startAt;
  const elapsed = Math.max(0, now - startAt);
  const remaining = (room.endsAt ?? startAt) - now;

  useProgressSync(startAt, view.correctChars, typing.errors, me?.progress ?? 0);

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (started && !confirmLeave) inputRef.current?.focus();
  }, [started, confirmLeave]);

  // Esc abre/cierra la confirmación para abandonar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmLeave((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Al llegar a la meta el WPM se congela; si ya veníamos terminados (recarga), se usa el del servidor.
  const wpm = !started
    ? 0
    : finishedAt !== null
      ? Math.round(calcWpm(view.correctChars, finishedAt - startAt))
      : view.finished
        ? (me?.wpm ?? 0)
        : Math.round(calcWpm(view.correctChars, elapsed));
  const typed = view.correctChars + typing.errors;
  const accuracy = typed === 0 ? 100 : Math.round((view.correctChars / typed) * 100);
  const percent = Math.round((view.correctChars / text.length) * 100);
  const rank =
    me?.position ??
    1 + room.players.filter((p) => p.id !== myId && (p.position !== null || p.progress > view.correctChars)).length;

  // Salir lleva al inicio, que avisa al servidor; en la pista quedamos como "se fue".
  const leave = () => navigate(GAME_HOME);
  const block = (e: { preventDefault: () => void }) => e.preventDefault();

  return (
    <div className={styles.race} data-fit>
      <div className={styles.hud}>
        <Speedometer value={wpm} size={112} />
        <div className={styles.position}>
          <span className={`${styles.pos} num`}>P{rank}</span>
          <span className={styles.posOf}>de {room.players.length}</span>
        </div>
        <div className={styles.stats}>
          <Stat label="precisión" value={`${accuracy}%`} />
          <Stat label="progreso" value={`${percent}%`} />
          <Stat label="restante" value={formatCountdown(remaining)} hurry={started && remaining < HURRY_MS} />
        </div>
        <div className={styles.leave}>
          {confirmLeave ? (
            <div className={styles.confirm}>
              <span>¿Abandonar?</span>
              <button className="btn" onClick={() => setConfirmLeave(false)}>
                Seguir
              </button>
              <button className={`btn ${styles.danger}`} onClick={leave}>
                Abandonar
              </button>
            </div>
          ) : (
            <button className="btn ghost" onClick={() => setConfirmLeave(true)}>
              Salir <kbd>Esc</kbd>
            </button>
          )}
        </div>
        {typing.streak >= STREAK_MIN && !view.finished && (
          <div className={styles.streak} key={typing.streak}>
            <span className="num">×{typing.streak}</span>
            <span>racha</span>
          </div>
        )}
      </div>

      <div className={styles.typing}>
        {elapsed < GO_VISIBLE_MS && (
          <div className={`${styles.overlay} ${started ? styles.fadeOut : ''}`}>
            <TrafficLight secondsLeft={Math.ceil((startAt - now) / 1000)} />
          </div>
        )}

        <div className={styles.progressBar}>
          <div style={{ width: `${percent}%` }} />
        </div>

        <TextDisplay
          text={text}
          committed={view.committed}
          correctInWord={view.correctInWord}
          typedInWord={typing.input.length}
        />

        {view.finished ? (
          <div className={styles.finish}>
            <span className={styles.flag} aria-hidden="true" />
            <div>
              <span className={`${styles.finishPos} num`}>{me?.position ? `P${me.position}` : '…'}</span>
              <p>
                ¡Meta! {wpm} wpm · {accuracy}% de precisión
                {typing.bestStreak >= STREAK_MIN && ` · mejor racha ×${typing.bestStreak}`}
              </p>
              <p className="muted">Esperando a los demás pilotos.</p>
            </div>
          </div>
        ) : (
          <input
            ref={inputRef}
            className={`${styles.input} ${typing.input.length > view.correctInWord ? styles.hasError : ''}`}
            value={typing.input}
            onChange={(e) => {
              if (!started) return;
              const next = applyInput(words, typing, e.target.value);
              setTyping(next);
              if (viewOf(words, next).finished) setFinishedAt(serverNow());
            }}
            onPaste={block}
            onDrop={block}
            onContextMenu={block}
            disabled={!started || confirmLeave}
            placeholder={started ? 'escribe aquí' : 'prepárate…'}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        )}
      </div>

      <div className={styles.trackArea}>
        <Track room={room} myId={myId} myProgress={view.correctChars} live={started} fit />
      </div>
    </div>
  );
}

function Stat({ label, value, hurry }: { label: string; value: string; hurry?: boolean }) {
  return (
    <div className={`${styles.stat} ${hurry ? styles.hurry : ''}`}>
      <span className={styles.statLabel}>{label}</span>
      <span className={`${styles.statValue} num`}>{value}</span>
    </div>
  );
}
