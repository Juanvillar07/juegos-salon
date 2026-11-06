import { TEAM_NAMES, type MatchResult, type RoomState, type Side } from '@typeracer/shared/cancha-rapida';
import KitBadge from '../../components/KitBadge';
import PenaltyStrip from '../match/PenaltyStrip';
import ExitRoomLink from '../../../../shell/ExitRoomLink';
import { revealDelay, useReveal } from '../../../../shell/transitions';
import Chat from '../chat/Chat';
import { formatClock, goalMinute } from '../match/format';
import { GAME_HOME } from '../../routes';
import { backToLobby, startMatch } from '../../state/store';
import styles from './Results.module.css';

interface Props {
  room: RoomState;
  myId: string;
  isHost: boolean;
}

/** Cómo se rompió el empate, si hizo falta: "Ganó Local 3–2 en los penaltis". */
function describeTiebreak(result: MatchResult): string | null {
  if (!result.winner) return null;
  if (result.tiebreak === 'goldenGoal') return `${TEAM_NAMES[result.winner]} ganó con gol de oro en la prórroga`;
  const shots = result.penalties;
  if (result.tiebreak === 'penalties' && shots) {
    const goals = (team: Side) => shots[team].filter(Boolean).length;
    return `${TEAM_NAMES[result.winner]} ganó ${goals('red')}–${goals('blue')} en los penaltis`;
  }
  return null;
}

/** Resultado del partido: ganador, marcador, la tanda de penaltis y cada gol con su autor y su minuto. */
export default function Results({ room, myId, isHost }: Props) {
  const reveal = useReveal();
  const result = room.result;
  if (!result) return null;
  const myTeam = result.players.find((p) => p.id === myId)?.team ?? null;
  const headline = result.winner
    ? myTeam === result.winner
      ? '¡Ganaste!'
      : myTeam
        ? 'Perdiste'
        : `Ganó ${TEAM_NAMES[result.winner]}`
    : 'Empate';
  const host = room.players.find((p) => p.id === room.hostId);
  const tiebreakLine = describeTiebreak(result);

  return (
    <div className={styles.layout} data-fit>
      <div className={`${styles.main} ${reveal}`}>
        <span className="label t-stagger-line" style={revealDelay(0)}>
          Resultado · {formatClock(result.durationMs)} de juego
        </span>
        <h1 className={`${styles.headline} t-stagger-line`} style={revealDelay(1)}>
          {result.winner && <KitBadge kit={room.kits[result.winner]} size={44} />}
          {headline}
        </h1>
        {tiebreakLine && (
          <p className={`${styles.tiebreak} t-stagger-line`} style={revealDelay(1)}>
            {tiebreakLine}
          </p>
        )}

        <div className={`${styles.board} t-stagger-line`} style={revealDelay(2)}>
          {(['red', 'blue'] as const).map((team) => (
            <div key={team} className={`${styles.side} ${result.winner === team ? styles.winner : ''}`}>
              <span className={styles.teamName}>
                <KitBadge kit={room.kits[team]} size={20} />
                {TEAM_NAMES[team]}
              </span>
              <span className={`${styles.goals} num`}>{result.score[team]}</span>
              <ul className={styles.roster}>
                {result.players
                  .filter((p) => p.team === team)
                  .map((p) => (
                    <li key={p.id} className={p.id === myId ? styles.mine : undefined}>
                      {p.nickname}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>

        {result.penalties && (
          <section className={`${styles.timeline} t-stagger-line`} style={revealDelay(3)}>
            <span className="label">Penaltis</span>
            <PenaltyStrip shots={result.penalties} kits={room.kits} alignStart />
          </section>
        )}

        <section className={`${styles.timeline} t-stagger-line`} style={revealDelay(3)}>
          <span className="label">Goles</span>
          {result.goals.length === 0 ? (
            <p className="muted">Nadie marcó.</p>
          ) : (
            <ol>
              {result.goals.map((g, i) => (
                <li key={i}>
                  <span className={`${styles.minute} num`}>{goalMinute(g.clockMs)}</span>
                  <KitBadge kit={room.kits[g.team]} size={16} />
                  <span>
                    {g.scorerName ?? 'Sin autor'}
                    {g.ownGoal && <span className={styles.own}> (en propia)</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className={styles.actions}>
          {isHost ? (
            <>
              <button className="btn primary big" onClick={() => void startMatch()}>
                Revancha
              </button>
              <button className="btn big" onClick={backToLobby} title="Volver a la sala para cambiar equipos o ajustes">
                Volver a la sala
              </button>
            </>
          ) : (
            <p className="muted">Esperando a que {host?.nickname ?? 'el host'} empiece la revancha o vuelva a la sala…</p>
          )}
          <ExitRoomLink to={GAME_HOME} />
        </div>
      </div>

      <aside className={styles.chat}>
        <span className="label">Chat</span>
        <Chat compact fill />
      </aside>
    </div>
  );
}
