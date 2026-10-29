import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { MAX_WORD_LENGTH, checkWordShape, normalizeWord, type RoomState } from '@typeracer/shared/carrera-de-silabas';
import Speedometer from '../../../rally-de-letras/components/Speedometer';
import TrafficLight from '../../../rally-de-letras/components/TrafficLight';
import { formatCountdown } from '../../../rally-de-letras/lib/format';
import { PopNumber, SwapIn, useShake } from '../../../../shell/transitions';
import ScoreTrack, { liveRanking } from '../../components/ScoreTrack';
import { skipCost } from '../../lib/skip';
import { cancelRace, retireFromRace, skipSyllable, submitWord } from '../../state/store';
import { GAME_HOME } from '../../routes';
import { useServerClock } from './useServerClock';
import rally from '../../../rally-de-letras/features/race/Race.module.css';
import styles from './Race.module.css';

interface Props {
  room: RoomState;
  myId: string;
}

/** Cuánto tiempo sigue visible el semáforo en verde tras la salida. */
const GO_VISIBLE_MS = 900;
/** Por debajo de este tiempo restante el reloj se resalta. */
const HURRY_MS = 10_000;
/** Sílabas siguientes que se dejan ver. */
const UPCOMING = 3;

type Feedback = { id: number; ok: boolean; text: string };

export default function Race({ room, myId }: Props) {
  const navigate = useNavigate();
  const syllables = room.syllables!;
  const startAt = room.startAt!;
  const target = room.settings.target;
  const me = room.players.find((p) => p.id === myId);
  const isHost = room.hostId === myId;
  const score = me?.score ?? 0;
  const index = me?.syllableIndex ?? 0;
  const syllable = syllables[index % syllables.length];
  const finished = me?.position != null;

  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Tras pasar con penalización de tiempo: no se puede escribir hasta entonces (reloj del servidor).
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const now = useServerClock();
  const started = now >= startAt;
  const blocked = blockedUntil !== null && now < blockedUntil;
  const elapsed = Math.max(0, now - startAt);
  const remaining = (room.endsAt ?? startAt) - now;
  const rank = me?.position ?? liveRanking(room.players).get(myId) ?? 1;

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (started && !confirmLeave && !blocked) inputRef.current?.focus();
  }, [started, confirmLeave, blocked]);

  // Esc abre/cierra la confirmación para abandonar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmLeave((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const word = normalizeWord(draft);
  const containsSyllable = word.length > 0 && word.includes(syllable);

  // Palabra rechazada: el campo se sacude y queda marcado mientras se lee el aviso.
  const { ref: shakeRef, shake, clear: clearShake } = useShake<HTMLDivElement>();
  const show = (ok: boolean, text: string) => {
    setFeedback({ id: Date.now(), ok, text });
    if (ok) clearShake();
    else shake();
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!started || pending || finished) return;
    // Los errores de forma se avisan al momento; el diccionario solo lo conoce el servidor.
    const shapeError = checkWordShape(word, syllable);
    if (shapeError) return show(false, shapeError);
    setPending(true);
    const res = await submitWord(draft);
    setPending(false);
    if (res.ok) {
      setDraft('');
      show(true, `+${res.points} · ${res.word}`);
    } else {
      show(false, res.error);
    }
  };

  // Pasar a la siguiente sílaba (botón o Shift+Enter), pagando la penalización de la sala.
  const skip = async () => {
    if (!started || pending || finished || blocked) return;
    setPending(true);
    const res = await skipSyllable();
    setPending(false);
    if (!res.ok) return show(false, res.error);
    setDraft('');
    setBlockedUntil(res.blockedUntil);
    show(true, `Pasaste · ${skipCost(room.settings.skipPenalty)}`);
  };

  // Volver a la sala: dejamos de correr pero seguimos en ella (vemos el lobby hasta que termine).
  // Salir de la sala lleva al inicio, que avisa al servidor; en la pista quedamos como "se fue".
  const leave = () => navigate(GAME_HOME);
  const block = (e: { preventDefault: () => void }) => e.preventDefault();

  return (
    <div className={rally.race} data-fit data-race>
      <div className={rally.hud}>
        <Speedometer value={score} max={target} label="pts" size={112} />
        <div className={rally.position}>
          <span className={`${rally.pos} num`}>P{rank}</span>
          <span className={rally.posOf}>de {room.players.length}</span>
        </div>
        <div className={rally.stats}>
          <Stat label="palabras" value={String(me?.words ?? 0)} pop />
          <Stat label="faltan" value={`${Math.max(0, target - score)} pts`} pop />
          <Stat label="restante" value={formatCountdown(remaining)} hurry={started && remaining < HURRY_MS} />
        </div>
        <div className={rally.leave}>
          {confirmLeave ? (
            <div className={rally.confirm}>
              <span>¿Salir de la carrera?</span>
              <button className="btn" onClick={() => setConfirmLeave(false)}>
                Seguir
              </button>
              <button className="btn primary" onClick={retireFromRace}>
                Volver a la sala
              </button>
              {isHost && (
                <button className={`btn ${rally.danger}`} onClick={cancelRace} title="Todos vuelven a la sala">
                  Cancelar carrera
                </button>
              )}
              <button className="btn ghost" onClick={leave}>
                Salir de la sala
              </button>
            </div>
          ) : (
            <button className="btn ghost" onClick={() => setConfirmLeave(true)}>
              Salir <kbd>Esc</kbd>
            </button>
          )}
        </div>
      </div>

      <div className={styles.play}>
        {elapsed < GO_VISIBLE_MS && (
          <div className={`${rally.overlay} ${started ? rally.fadeOut : ''}`}>
            <TrafficLight secondsLeft={Math.ceil((startAt - now) / 1000)} />
          </div>
        )}

        <div className={styles.board}>
          {finished ? (
            <div className={rally.finish}>
              <span className={rally.flag} aria-hidden="true" />
              <div>
                <span className={`${rally.finishPos} num`}>P{me!.position}</span>
                <p>
                  ¡Meta! {score} puntos con {me!.words} palabras
                </p>
                <p className="muted">Esperando a los demás pilotos.</p>
                <button className={`btn ${rally.toRoom}`} onClick={retireFromRace}>
                  Volver a la sala
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className={styles.prompt}>
                <span className="label">Escribe una palabra con</span>
                {/* La sílaba nueva entra al instante (solo la mitad de entrada del Text states swap). */}
                <span className={`${styles.syllable} num`}>
                  <SwapIn key={index}>{syllable.toUpperCase()}</SwapIn>
                </span>
                <span className={styles.upcoming}>
                  después:{' '}
                  {Array.from({ length: UPCOMING }, (_, i) => syllables[(index + 1 + i) % syllables.length])
                    .map((s) => s.toUpperCase())
                    .join(' · ')}
                </span>
              </div>

              <form className={styles.form} onSubmit={onSubmit}>
                <div className={styles.entry}>
                  <div ref={shakeRef} className={`t-input ${styles.inputWrap}`}>
                    <input
                      ref={inputRef}
                      className={`${styles.input} ${containsSyllable ? styles.contains : ''}`}
                      value={draft}
                      maxLength={MAX_WORD_LENGTH}
                      onChange={(e) => {
                        setDraft(e.target.value);
                        clearShake();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.shiftKey) {
                          e.preventDefault();
                          void skip();
                        }
                      }}
                      onPaste={block}
                      onDrop={block}
                      onContextMenu={block}
                      disabled={!started || confirmLeave || blocked}
                      placeholder={
                        !started
                          ? 'prepárate…'
                          : blocked
                            ? `puedes escribir en ${Math.ceil((blockedUntil! - now) / 1000)} s`
                            : 'escribe y pulsa Enter'
                      }
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      aria-label={`Palabra que contenga ${syllable}`}
                    />
                  </div>
                  <button
                    type="button"
                    className={`btn ${styles.skip}`}
                    onClick={() => void skip()}
                    disabled={!started || pending || blocked || confirmLeave}
                    title="Pasar a la siguiente sílaba (Shift + Enter)"
                  >
                    Pasar <span className={styles.cost}>{skipCost(room.settings.skipPenalty)}</span>
                  </button>
                </div>
                {/* Siempre ocupa su línea, para que la pista no salte al aparecer un aviso. */}
                <span
                  className={`${styles.feedback} ${feedback ? (feedback.ok ? styles.ok : styles.bad) : ''}`}
                  role="status"
                >
                  {feedback && <SwapIn key={feedback.id}>{feedback.text}</SwapIn>}
                </span>
              </form>
            </>
          )}
        </div>
      </div>

      <div className={rally.trackArea}>
        <ScoreTrack room={room} myId={myId} live={started} fit />
      </div>
    </div>
  );
}

/** `pop`: las cifras que cambian entran con el Number pop-in (no para el reloj, que cambia cada segundo). */
function Stat({ label, value, hurry, pop }: { label: string; value: string; hurry?: boolean; pop?: boolean }) {
  return (
    <div className={`${rally.stat} ${hurry ? rally.hurry : ''}`}>
      <span className={rally.statLabel}>{label}</span>
      <span className={`${rally.statValue} num`}>{pop ? <PopNumber value={value} /> : value}</span>
    </div>
  );
}
