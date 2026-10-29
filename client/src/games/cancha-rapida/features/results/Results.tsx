import { TEAM_COLORS, TEAM_NAMES, type RoomState } from '@typeracer/shared/cancha-rapida';
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

/** Resultado del partido: ganador, marcador y cada gol con su autor y su minuto. */
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

  return (
    <div className={styles.layout} data-fit>
      <div className={`${styles.main} ${reveal}`}>
        <span className="label t-stagger-line" style={revealDelay(0)}>
          Resultado · {formatClock(result.durationMs)} de juego
        </span>
        <h1
          className={`${styles.headline} t-stagger-line`}
          style={{ ...revealDelay(1), color: result.winner ? TEAM_COLORS[result.winner] : undefined }}
        >
          {headline}
        </h1>

        <div className={`${styles.board} t-stagger-line`} style={revealDelay(2)}>
          {(['red', 'blue'] as const).map((team) => (
            <div key={team} className={`${styles.side} ${result.winner === team ? styles.winner : ''}`}>
              <span className={styles.teamName}>
                <span className="dot" style={{ background: TEAM_COLORS[team] }} />
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

        <section className={`${styles.timeline} t-stagger-line`} style={revealDelay(3)}>
          <span className="label">Goles</span>
          {result.goals.length === 0 ? (
            <p className="muted">Nadie marcó.</p>
          ) : (
            <ol>
              {result.goals.map((g, i) => (
                <li key={i}>
                  <span className={`${styles.minute} num`}>{goalMinute(g.clockMs)}</span>
                  <span className="dot" style={{ background: TEAM_COLORS[g.team] }} />
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
