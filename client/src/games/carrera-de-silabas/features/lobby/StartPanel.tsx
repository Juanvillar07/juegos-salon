import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AUTO_START_MS } from '@typeracer/shared';
import type { RoomState } from '@typeracer/shared/carrera-de-silabas';
import { GAME_HOME } from '../../routes';
import { setReady, startRace } from '../../state/store';
import { useServerClock } from '../race/useServerClock';
import styles from '../../../rally-de-letras/features/lobby/StartPanel.module.css';

interface Props {
  room: RoomState;
  myId: string;
  isHost: boolean;
}

/**
 * Salida: cada piloto se marca "Listo". Con todos listos arranca sola; con más de la mitad,
 * tras una espera visible. El host puede empezar cuando quiera.
 */
export default function StartPanel({ room, myId, isHost }: Props) {
  const now = useServerClock(250);
  const [busy, setBusy] = useState(false);
  const me = room.players.find((p) => p.id === myId)!;
  const ready = room.players.filter((p) => p.ready).length;
  const total = room.players.length;
  const secondsLeft = room.autoStartAt === null ? null : Math.max(0, Math.ceil((room.autoStartAt - now) / 1000));
  const waitRatio = room.autoStartAt === null ? 0 : Math.min(1, Math.max(0, (room.autoStartAt - now) / AUTO_START_MS));

  const toggle = async () => {
    setBusy(true);
    await setReady(!me.ready);
    setBusy(false);
  };

  const status =
    secondsLeft !== null
      ? `Arranca en ${secondsLeft} s`
      : total === 1
        ? 'Márcate listo para practicar'
        : 'Arranca cuando todos estén listos';

  return (
    <section className={styles.panel}>
      <div className={styles.buttons}>
        <button
          className={`btn big ${me.ready ? styles.isReady : 'primary'} ${styles.ready}`}
          onClick={toggle}
          disabled={busy}
          aria-pressed={me.ready}
          title={me.ready ? 'Tocar para dejar de estar listo' : undefined}
        >
          {me.ready ? '✓ Listo' : 'Estoy listo'}
        </button>
        {isHost && (
          <button className="btn big" onClick={startRace} title="Empezar sin esperar a que todos estén listos">
            Empezar ya
          </button>
        )}
      </div>

      <div
        className={styles.status}
        title="Con todos listos la carrera arranca sola; con más de la mitad, después de 15 segundos."
      >
        <span className={styles.dots} aria-hidden="true">
          {room.players.map((p) => (
            <i key={p.id} className={p.ready ? styles.on : undefined} />
          ))}
        </span>
        <span className="num">
          {ready}/{total} listos
        </span>
        <span className={secondsLeft !== null ? styles.countdown : 'muted'}>· {status}</span>
      </div>
      {secondsLeft !== null && (
        <div className={styles.wait} aria-hidden="true">
          <div style={{ transform: `scaleX(${waitRatio})` }} />
        </div>
      )}

      <Link to={GAME_HOME} className={`btn ghost wide ${styles.leave}`}>
        Salir de la sala
      </Link>
    </section>
  );
}
