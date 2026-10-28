import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RaceResult, RoomState } from '@typeracer/shared';
import StatusTag from '../../components/StatusTag';
import CarSprite from '../../components/cars/CarSprite';
import { ordinal } from '../../lib/format';
import { getBestWpm, recordWpm } from '../../lib/storage';
import { playAgain } from '../../state/store';
import { GAME_HOME } from '../../routes';
import Chat from '../chat/Chat';
import styles from './Results.module.css';

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
  const [previousBest] = useState(getBestWpm);
  const [newRecord, setNewRecord] = useState(false);

  // Solo cuentan para el récord las carreras terminadas.
  useEffect(() => {
    if (mine?.position != null) setNewRecord(recordWpm(mine.wpm));
  }, [mine?.position, mine?.wpm]);

  return (
    <div className={styles.layout}>
      <section className={styles.podiumSide}>
        <span className="label">Resultados</span>
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
            {newRecord ? (
              <>
                <strong>Nuevo récord personal: {mine.wpm} wpm.</strong>
                {previousBest > 0 && <span> Antes: {previousBest} wpm.</span>}
              </>
            ) : (
              <>
                <strong>
                  {mine.position !== null ? `Llegaste ${ordinal(mine.position)}` : 'No llegaste a la meta'}
                </strong>
                <span>
                  {' '}
                  · {mine.wpm} wpm · {mine.accuracy}% de precisión
                </span>
              </>
            )}
          </p>
        )}
      </section>

      <section className={styles.tableSide}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Piloto</th>
              <th className={styles.right}>wpm</th>
              <th className={styles.right}>precisión</th>
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
                    {r.position === null && <span className="tag">{r.retired ? 'se retiró' : 'sin terminar'}</span>}
                    <StatusTag status={r.status} />
                  </span>
                </td>
                <td className={`${styles.right} num`}>{r.wpm}</td>
                <td className={`${styles.right} num`}>{r.accuracy}%</td>
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
          <Link to={GAME_HOME} className="btn ghost">
            Salir
          </Link>
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
      <span className={`${styles.stepWpm} num`}>{result.wpm} wpm</span>
      <div className={styles.block}>
        <span className="num">{pos}</span>
      </div>
    </div>
  );
}
