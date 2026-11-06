import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TEAM_NAMES, type PenaltyState, type RoomState, type Side } from '@typeracer/shared/cancha-rapida';
import KitBadge from '../../components/KitBadge';
import PenaltyStrip from './PenaltyStrip';
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
/** Se recuerda si el chat estaba abierto (solo en este navegador). */
const CHAT_OPEN_KEY = 'cancha:chatOpen';

function loadChatOpen(): boolean {
  try {
    return localStorage.getItem(CHAT_OPEN_KEY) === '1';
  } catch {
    return false;
  }
}

export default function MatchView({ room, myId, isHost }: Props) {
  const { goal, chat } = useClientState();
  const [menuOpen, setMenuOpen] = useState(false);
  // Chat plegable: cerrado, la cancha ocupa todo el ancho.
  const [chatOpen, setChatOpen] = useState(loadChatOpen);
  const [focusChat, setFocusChat] = useState(false);
  // Mensajes vistos con el panel abierto; los que llegan con él cerrado cuentan como no leídos.
  const [seen, setSeen] = useState(chat.length);
  const unread = chatOpen ? 0 : Math.max(0, chat.length - seen);
  const me = room.players.find((p) => p.id === myId);
  const playing = me !== undefined && me.slot !== null && me.team !== 'spectator';
  const keys = useKeyboard(playing && !menuOpen);
  const { now, clockMs } = useMatchClock();

  const toggleChat = (open: boolean) => {
    setChatOpen(open);
    try {
      localStorage.setItem(CHAT_OPEN_KEY, open ? '1' : '0');
    } catch {
      // sin almacenamiento: no se recuerda
    }
  };

  useEffect(() => {
    if (chatOpen) setSeen(chat.length);
  }, [chatOpen, chat.length]);

  // Al abrir el chat con Enter, el campo se enfoca cuando ya está en pantalla.
  useEffect(() => {
    if (!focusChat || !chatOpen) return;
    document.querySelector<HTMLInputElement>('[data-chat-input]')?.focus();
    setFocusChat(false);
  }, [focusChat, chatOpen]);

  // Esc abre o cierra el menú; Enter abre el chat y lo enfoca (y Esc, desde el chat, vuelve al partido).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.key === 'Escape') setMenuOpen((open) => !open);
      if (e.key === 'Enter' && !menuOpen) {
        e.preventDefault();
        if (!chatOpen) toggleChat(true);
        setFocusChat(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen, chatOpen]);

  const countdown = room.startAt !== null && now < room.startAt ? Math.ceil((room.startAt - now) / 1000) : null;
  const remaining = Math.max(0, room.settings.timeLimitMin * 60_000 - clockMs);
  const pen = room.penalties;
  const nickname = (id: string | null) => room.players.find((p) => p.id === id)?.nickname ?? '—';
  const penaltyFlash = usePenaltyFlash(pen, nickname);
  // Segundos que le quedan al que tira (mientras no patea).
  const shotLeft = pen?.deadline != null ? Math.max(0, Math.ceil((pen.deadline - now) / 1000)) : null;

  return (
    <div className={`${styles.match} ${chatOpen ? styles.chatOpen : ''}`} data-fit data-race>
      <div className={styles.stage}>
        <header className={styles.scoreboard}>
          <span className={styles.team}>
            <KitBadge kit={room.kits.red} size={20} />
            {TEAM_NAMES.red}
          </span>
          <span className={`${styles.score} num`} aria-live="polite">
            {room.score.red} <span className={styles.dash}>–</span> {room.score.blue}
          </span>
          <span className={styles.team}>
            {TEAM_NAMES.blue}
            <KitBadge kit={room.kits.blue} size={20} />
          </span>
          {room.stage === 'goldenGoal' ? (
            <span className={`${styles.clock} ${styles.extra}`} title="El primero que marque gana">
              Gol de oro
            </span>
          ) : room.stage === 'penalties' ? (
            <span className={`${styles.clock} ${styles.extra}`}>Penaltis</span>
          ) : (
            <span className={`${styles.clock} num ${remaining < 30_000 ? styles.hurry : ''}`}>{formatClock(remaining)}</span>
          )}
          <button
            type="button"
            className={`btn ghost ${styles.menuButton}`}
            onClick={() => toggleChat(!chatOpen)}
            aria-pressed={chatOpen}
            aria-label={unread > 0 ? `Chat, ${unread} sin leer` : 'Chat'}
          >
            Chat
            {unread > 0 && <span className={`${styles.unread} num`}>{unread > 9 ? '9+' : unread}</span>}
          </button>
          <button type="button" className={`btn ghost ${styles.menuButton}`} onClick={() => setMenuOpen(true)}>
            Menú <kbd>Esc</kbd>
          </button>
        </header>

        <div className={styles.field}>
          <Pitch room={room} myId={myId} keys={keys} />

          {pen && (
            <div className={styles.penaltyBar}>
              <PenaltyStrip shots={pen.shots} kits={room.kits} />
              <span className={styles.penaltyTurn}>
                Tira <strong>{nickname(pen.shooterId)}</strong> · Ataja <strong>{nickname(pen.keeperId)}</strong>
                {shotLeft !== null && (
                  <>
                    {' · '}
                    <strong className={`num ${shotLeft <= 2 ? styles.penaltyHurry : ''}`}>{shotLeft} s</strong>
                  </>
                )}
              </span>
            </div>
          )}

          {penaltyFlash && (
            <div className={styles.overlay}>
              <div className={styles.goal} key={penaltyFlash.id}>
                <KitBadge kit={room.kits[penaltyFlash.team]} size={40} label={`Uniforme de ${TEAM_NAMES[penaltyFlash.team]}`} />
                <strong>{penaltyFlash.scored ? '¡Gol!' : '¡Fallado!'}</strong>
                <span>{penaltyFlash.scored ? `de ${penaltyFlash.shooter}` : `${penaltyFlash.shooter} no marca`}</span>
              </div>
            </div>
          )}

          {countdown !== null && (
            <div className={styles.overlay}>
              <span className={`${styles.countdown} num`} key={countdown}>
                {countdown}
              </span>
            </div>
          )}

          {goal && (
            <div className={styles.overlay}>
              <div className={styles.goal} key={goal.id}>
                <KitBadge kit={room.kits[goal.team]} size={40} label={`Uniforme de ${TEAM_NAMES[goal.team]}`} />
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

        <p className={styles.hint}>{hintText(room, myId, playing)}</p>
      </div>

      <aside className={styles.side} aria-hidden={!chatOpen}>
        {chatOpen && (
          <>
            <div className={styles.sideHead}>
              <span className="label">Chat</span>
              <button type="button" className={styles.close} onClick={() => toggleChat(false)} aria-label="Cerrar el chat">
                ×
              </button>
            </div>
            <Chat compact fill noQuick />
          </>
        )}
      </aside>
    </div>
  );
}

/** La pista bajo la cancha: controles, o qué te toca en la tanda de penaltis. */
function hintText(room: RoomState, myId: string, playing: boolean): string {
  if (!playing) return 'Estás mirando como espectador: juegas en el próximo partido';
  const pen = room.penalties;
  if (pen) {
    if (pen.shooterId === myId) {
      return pen.shotTaken
        ? 'Ya tiraste: a ver si entra'
        : 'Tiras tú: el balón no se mueve hasta que patees · acércate, apunta y patea (una sola patada)';
    }
    if (pen.keeperId === myId) {
      return pen.shotTaken
        ? 'Atajas tú: ¡ya patearon! Puedes salir de la línea'
        : 'Atajas tú: quédate en la línea (muévete de lado) hasta que patee';
    }
    return 'Tanda de penaltis: espera tu turno para tirar o atajar';
  }
  return room.settings.chargedShot
    ? 'Flechas o WASD para moverte · X o espacio: toque = pase, mantén y suelta = tiro · Enter para chatear'
    : 'Flechas o WASD para moverte · X o espacio para patear al tocar el balón · Enter para chatear';
}

interface PenaltyFlash {
  id: number;
  team: Side;
  scored: boolean;
  shooter: string;
}

/** Cuánto se ve el cartel de cada penalti (el servidor espera 1,5 s antes del siguiente). */
const PENALTY_FLASH_MS = 1400;

/**
 * Cartel breve tras cada penalti ("¡Gol!" o "¡Fallado!"). Se detecta al crecer la tanda: tira
 * primero el local, así que el último en tirar es el equipo con más lanzamientos (o el
 * visitante, si van parejos).
 */
function usePenaltyFlash(pen: PenaltyState | null, nickname: (id: string | null) => string): PenaltyFlash | null {
  const [flash, setFlash] = useState<PenaltyFlash | null>(null);
  const total = pen ? pen.shots.red.length + pen.shots.blue.length : 0;
  const seen = useRef(total);
  useEffect(() => {
    if (!pen || total <= seen.current) {
      seen.current = total;
      return;
    }
    seen.current = total;
    const team: Side = pen.shots.red.length > pen.shots.blue.length ? 'red' : 'blue';
    const shots = pen.shots[team];
    const next = { id: total, team, scored: shots[shots.length - 1], shooter: nickname(pen.shooterId) };
    setFlash(next);
    const timer = setTimeout(() => setFlash((f) => (f?.id === next.id ? null : f)), PENALTY_FLASH_MS);
    return () => clearTimeout(timer);
    // Solo al llegar un lanzamiento nuevo (el resto de la tanda puede cambiar sin cartel).
  }, [total]);
  return flash;
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
