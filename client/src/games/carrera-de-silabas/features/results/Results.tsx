import type { RaceResult, RoomState } from '@typeracer/shared/carrera-de-silabas';
import StatusTag from '../../../rally-de-letras/components/StatusTag';
import CarSprite from '../../../rally-de-letras/components/cars/CarSprite';
import { ordinal } from '../../../rally-de-letras/lib/format';
import { playAgain } from '../../state/store';
import { GAME_HOME } from '../../routes';
import Chat from '../chat/Chat';
import styles from '../../../rally-de-letras/features/results/Results.module.css';
import ExitRoomLink from '../../../../shell/ExitRoomLink';

interface Props {
  room: RoomState;
  myId: string;
  isHost: boolean;
}

// Orden visual del podio: 2.º a la izquierda, 1.º al centro, 3.º a la derecha.
const PODIUM_ORDER = [1, 0, 2];

export default function Results({ room, myId, isHost }: Props) {
  const results = room.results ?? [];
  const mine = results.find((r) => r.playerId === myId);
  const finishers = results.filter((r) => r.position !== null);

  return (
    <div className={styles.layout}>
      <section className={styles.podiumSide}>
        <span className="label">Resultados · meta de {room.settings.target} puntos</span>
        <h1 className={styles.title}>
          {finishers.length > 0 ? (
            <>
              {finishers[0].nickname}
              <span> gana.</span>
            </>
          ) : (
            'Nadie llegó a la meta.'
          )}
        </h1>

        {finishers.length > 0 && (
          <div className={styles.podium}>
            {PODIUM_ORDER.map((i) => finishers[i]).map((r, i) =>
              r ? <Step key={r.playerId} result={r} /> : <div key={`empty-${i}`} />,
            )}
          </div>
        )}

        {mine && (
          <p className={styles.you}>
            <strong>{mine.position !== null ? `Llegaste ${ordinal(mine.position)}` : 'No llegaste a la meta'}</strong>
            <span>
              {' '}
              · {mine.score} puntos · {mine.words} palabras
              {mine.longestWord && ` · la más larga: ${mine.longestWord}`}
            </span>
          </p>
        )}
      </section>

      <section className={styles.tableSide}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Piloto</th>
              <th className={styles.right}>puntos</th>
              <th className={styles.right}>palabras</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.playerId} className={r.playerId === myId ? styles.mine : undefined}>
                <td className={`${styles.pos} num`}>{r.position !== null ? `P${r.position}` : '–'}</td>
                <td>
                  <span className={styles.player}>
                    <CarSprite model={r.car} color={r.color} width={64} faded={r.status === 'left' || r.retired} />
                    <span className="nick">{r.nickname}</span>
                    {r.position === null && <span className="tag">{r.retired ? 'se retiró' : 'sin llegar'}</span>}
                    <StatusTag status={r.status} />
                  </span>
                </td>
                <td className={`${styles.right} num`}>{r.score}</td>
                <td className={`${styles.right} num`} title={r.longestWord ? `La más larga: ${r.longestWord}` : undefined}>
                  {r.words}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="actions">
          {isHost ? (
            <button className="btn primary big" onClick={playAgain}>
              Otra carrera
            </button>
          ) : (
            <p className="muted">Esperando a que el host inicie otra carrera…</p>
          )}
          <ExitRoomLink to={GAME_HOME} />
        </div>

        <div className={styles.chat}>
          <span className="label">Chat</span>
          <Chat compact />
        </div>
      </section>
    </div>
  );
}

function Step({ result }: { result: RaceResult }) {
  const pos = result.position!;
  return (
    <div className={`${styles.step} ${styles[`p${pos}`]}`}>
      <div className={styles.stepCar}>
        <CarSprite model={result.car} color={result.color} width={pos === 1 ? 150 : 120} />
      </div>
      <span className="nick">{result.nickname}</span>
      <span className={`${styles.stepWpm} num`}>{result.score} pts</span>
      <div className={styles.block}>
        <span className="num">{pos}</span>
      </div>
    </div>
  );
}
