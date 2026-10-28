import type { PlayerInfo, RoomState } from '@typeracer/shared';
import CarSprite from './cars/CarSprite';
import StatusTag from './StatusTag';
import styles from './Track.module.css';

interface Props {
  room: RoomState;
  myId: string;
  /** Progreso local del jugador, para que su auto no espere la confirmación del servidor. */
  myProgress?: number;
  /** true mientras la carrera está en marcha: los autos que avanzan giran las ruedas. */
  live?: boolean;
  /** Ocupa el alto del contenedor: carriles y autos se encogen para que quepan todos. */
  fit?: boolean;
}

const CAR_WIDTH = 116;

/** Posición en vivo: primero los que llegaron (por orden), luego por avance. */
function liveRanking(players: PlayerInfo[], progressOf: (p: PlayerInfo) => number): Map<string, number> {
  const sorted = [...players].sort((a, b) => {
    if (a.position !== null && b.position !== null) return a.position - b.position;
    if (a.position !== null) return -1;
    if (b.position !== null) return 1;
    return progressOf(b) - progressOf(a);
  });
  return new Map(sorted.map((p, i) => [p.id, i + 1]));
}

export default function Track({ room, myId, myProgress, live = false, fit = false }: Props) {
  const total = room.text?.length ?? 1;
  const progressOf = (p: PlayerInfo) =>
    p.id === myId && myProgress !== undefined ? Math.max(myProgress, p.progress) : p.progress;
  const ranking = liveRanking(room.players, progressOf);

  return (
    <div className={`${styles.track} ${fit ? styles.fit : ''}`} style={{ ['--car-width' as string]: `${CAR_WIDTH}px` }}>
      {room.players.map((p) => {
        const mine = p.id === myId;
        const progress = progressOf(p);
        const ratio = Math.min(1, progress / total);
        // Volvió a la sala sin llegar: su auto se queda parado donde lo dejó.
        const retired = p.retired && p.position === null;
        const moving = live && p.status === 'connected' && !retired && p.position === null && progress > 0;
        const rank = p.position ?? ranking.get(p.id)!;
        const rowClass = [styles.row, mine && styles.mine, (p.status !== 'connected' || retired) && styles.away]
          .filter(Boolean)
          .join(' ');

        return (
          <div key={p.id} className={rowClass} style={{ ['--p' as string]: ratio, ['--car' as string]: p.color }}>
            <span className={`${styles.rank} num`}>P{rank}</span>

            <div className={styles.who}>
              <span className="nick">{p.nickname}</span>
              <span className={styles.sub}>
                {mine ? 'tú' : p.position !== null ? 'en meta' : `${Math.round(ratio * 100)}%`}
                {retired && <span className="tag">se retiró</span>}
                <StatusTag status={p.status} />
              </span>
            </div>

            <div className={styles.lane}>
              <div className={styles.trail} />
              <div className={styles.finish} />
              <div className={styles.runner}>
                <CarSprite
                  model={p.car}
                  color={p.color}
                  width={CAR_WIDTH}
                  moving={moving}
                  faded={p.status === 'left' || retired}
                />
              </div>
            </div>

            <span className={`${styles.wpm} num`}>
              {p.wpm}
              <small>wpm</small>
            </span>
          </div>
        );
      })}
    </div>
  );
}
