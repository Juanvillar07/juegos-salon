import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TEAM_COLORS, TEAM_NAMES, type RoomState } from '@typeracer/shared/cancha-rapida';
import Chat from '../chat/Chat';
import { GAME_HOME } from '../../routes';
import { frames, serverNow, stopMatch, useClientState } from '../../state/store';
import { formatClock } from './format';
import Pitch from './Pitch';
import { isTyping, useKeyboard } from './useKeyboard';
import styles from './MatchView.module.css';

interface Props {
  room: RoomState;
  myId: string;
  isHost: boolean;
}

/** Cada cuánto se refrescan el reloj y la cuenta atrás (no hace falta en cada cuadro). */
const CLOCK_REFRESH_MS = 200;

export default function MatchView({ room, myId, isHost }: Props) {
  const { goal } = useClientState();
  const [menuOpen, setMenuOpen] = useState(false);
  const me = room.players.find((p) => p.id === myId);
  const playing = me !== undefined && me.slot !== null && me.team !== 'spectator';
  const keys = useKeyboard(playing && !menuOpen);
  const { now, clockMs } = useMatchClock();

  // Esc abre o cierra el menú; Enter lleva al chat (y Esc, desde el chat, vuelve al partido).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.key === 'Escape') setMenuOpen((open) => !open);
      if (e.key === 'Enter' && !menuOpen) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('[data-chat-input]')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const countdown = room.startAt !== null && now < room.startAt ? Math.ceil((room.startAt - now) / 1000) : null;
  const remaining = Math.max(0, room.settings.timeLimitMin * 60_000 - clockMs);

  return (
    <div className={styles.match} data-fit data-race>
      <div className={styles.stage}>
        <header className={styles.scoreboard}>
          <span className={styles.team}>
            <span className="dot" style={{ background: TEAM_COLORS.red }} />
            {TEAM_NAMES.red}
          </span>
          <span className={`${styles.score} num`} aria-live="polite">
            {room.score.red} <span className={styles.dash}>–</span> {room.score.blue}
          </span>
          <span className={styles.team}>
            {TEAM_NAMES.blue}
            <span className="dot" style={{ background: TEAM_COLORS.blue }} />
          </span>
          <span className={`${styles.clock} num ${remaining < 30_000 ? styles.hurry : ''}`}>{formatClock(remaining)}</span>
          <button type="button" className={`btn ghost ${styles.menuButton}`} onClick={() => setMenuOpen(true)}>
            Menú <kbd>Esc</kbd>
          </button>
        </header>

        <div className={styles.field}>
          <Pitch room={room} myId={myId} keys={keys} />

          {countdown !== null && (
            <div className={styles.overlay}>
              <span className={`${styles.countdown} num`} key={countdown}>
                {countdown}
              </span>
            </div>
          )}

          {goal && (
            <div className={styles.overlay}>
              <div className={styles.goal} style={{ color: TEAM_COLORS[goal.team] }} key={goal.id}>
                <strong>¡Gol!</strong>
                <span>
                  {goal.scorerName
                    ? goal.ownGoal
                      ? `En propia puerta de ${goal.scorerName}`
                      : `de ${goal.scorerName}`
                    : `para ${TEAM_NAMES[goal.team]}`}
                </span>
              </div>
            </div>
          )}

          {menuOpen && (
            <div className={styles.overlay}>
              <div className={styles.menu} role="dialog" aria-label="Menú del partido">
                <button className="btn primary wide" onClick={() => setMenuOpen(false)} autoFocus>
                  Seguir jugando
                </button>
                {isHost && (
                  <button className={`btn wide ${styles.danger}`} onClick={stopMatch}>
                    Terminar partido
                  </button>
                )}
                <Link to={GAME_HOME} className="btn ghost wide">
                  Salir de la sala
                </Link>
              </div>
            </div>
          )}
        </div>

        <p className={styles.hint}>
          {playing
            ? 'Flechas o WASD para moverte · X o espacio para patear · Enter para chatear'
            : 'Estás mirando como espectador: juegas en el próximo partido'}
        </p>
      </div>

      <aside className={styles.side}>
        <span className="label">Chat</span>
        <Chat compact fill noQuick />
      </aside>
    </div>
  );
}

/** Hora del servidor y reloj del partido (de la última instantánea), refrescados cada poco. */
function useMatchClock() {
  const [state, setState] = useState(() => ({ now: serverNow(), clockMs: frames.latest?.clockMs ?? 0 }));
  useEffect(() => {
    const id = setInterval(() => setState({ now: serverNow(), clockMs: frames.latest?.clockMs ?? 0 }), CLOCK_REFRESH_MS);
    return () => clearInterval(id);
  }, []);
  return state;
}
