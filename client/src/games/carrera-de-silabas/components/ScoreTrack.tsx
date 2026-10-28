import type { PlayerInfo, RoomState } from '@typeracer/shared/carrera-de-silabas';
import CarSprite from '../../rally-de-letras/components/cars/CarSprite';
import StatusTag from '../../rally-de-letras/components/StatusTag';
import styles from '../../rally-de-letras/components/Track.module.css';

interface Props {
  room: RoomState;
  myId: string;
  /** true mientras la carrera está en marcha: los autos que avanzan giran las ruedas. */
  live?: boolean;
  /** Ocupa el alto del contenedor: carriles y autos se encogen para que quepan todos. */
  fit?: boolean;
}

const CAR_WIDTH = 116;

/** Posición en vivo: primero los que llegaron (por orden), luego por puntos. */
export function liveRanking(players: PlayerInfo[]): Map<string, number> {
  const sorted = [...players].sort((a, b) => {
    if (a.position !== null && b.position !== null) return a.position - b.position;
    if (a.position !== null) return -1;
    if (b.position !== null) return 1;
    return b.score - a.score;
  });
  return new Map(sorted.map((p, i) => [p.id, i + 1]));
}

/** La pista de Rally de Letras, pero cada auto avanza según sus puntos frente a la meta. */
export default function ScoreTrack({ room, myId, live = false, fit = false }: Props) {
  const target = room.settings.target;
  const ranking = liveRanking(room.players);

  return (
    <div className={`${styles.track} ${fit ? styles.fit : ''}`} style={{ ['--car-width' as string]: `${CAR_WIDTH}px` }}>
      {room.players.map((p) => {
        const mine = p.id === myId;
        const ratio = Math.min(1, p.score / target);
        // Volvió a la sala sin llegar: su auto se queda parado donde lo dejó.
        const retired = p.retired && p.position === null;
        const moving = live && p.status === 'connected' && !retired && p.position === null && p.score > 0;
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
                {mine ? 'tú' : p.position !== null ? 'en meta' : `${p.words} ${p.words === 1 ? 'palabra' : 'palabras'}`}
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
              {p.score}
              <small>/{target}</small>
            </span>
          </div>
        );
      })}
    </div>
  );
}
