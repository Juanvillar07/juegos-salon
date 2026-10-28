import { useState } from 'react';
import type { RoomState } from '@typeracer/shared/carrera-de-silabas';
import { formatCountdown } from '../../../rally-de-letras/lib/format';
import { cancelRace } from '../../state/store';
import { GAME_HOME } from '../../routes';
import { useServerClock } from '../race/useServerClock';
import race from '../../../rally-de-letras/features/race/Race.module.css';
import styles from '../../../rally-de-letras/features/lobby/StartPanel.module.css';
import ExitRoomLink from '../../../../shell/ExitRoomLink';

interface Props {
  room: RoomState;
  isHost: boolean;
}

/**
 * Lo que ve en el lobby quien volvió a la sala mientras los demás siguen corriendo:
 * cuánto falta y, si es host, la opción de cancelar la carrera para empezar otra.
 */
export default function RaceInProgress({ room, isHost }: Props) {
  const now = useServerClock(250);
  const [confirm, setConfirm] = useState(false);
  const remaining = (room.endsAt ?? now) - now;
  const running = room.players.filter((p) => p.status !== 'left' && !p.retired && p.position === null).length;

  return (
    <section className={styles.panel}>
      <div className={styles.status}>
        <span className="num">{formatCountdown(remaining)}</span>
        <span className="muted">
          · {running === 1 ? 'queda 1 piloto' : `quedan ${running} pilotos`} en carrera
        </span>
      </div>
      <p className={`muted ${styles.status}`}>Verás los resultados cuando termine.</p>

      {isHost &&
        (confirm ? (
          <div className={styles.buttons}>
            <button className="btn big" onClick={() => setConfirm(false)}>
              Seguir
            </button>
            <button className={`btn big ${race.danger} ${styles.ready}`} onClick={cancelRace}>
              Sí, cancelar
            </button>
          </div>
        ) : (
          <button className="btn big" onClick={() => setConfirm(true)} title="Todos vuelven a la sala, sin resultados">
            Cancelar carrera
          </button>
        ))}

      <ExitRoomLink to={GAME_HOME} wide />
    </section>
  );
}
