import { PENALTY_ROUNDS, TEAM_NAMES, type Side, type TeamKit } from '@typeracer/shared/cancha-rapida';
import KitBadge from '../../components/KitBadge';
import styles from './PenaltyStrip.module.css';

interface Props {
  shots: Record<Side, boolean[]>;
  kits: Record<Side, TeamKit>;
  /** A la izquierda (en los resultados) en lugar de centrada (sobre la cancha). */
  alignStart?: boolean;
}

/**
 * Tanda de penaltis: por equipo, un hueco por lanzamiento (● gol, ✕ fallo, ○ por tirar).
 * Muestra al menos las rondas normales; en muerte súbita, los que se vayan tirando.
 */
export default function PenaltyStrip({ shots, kits, alignStart = false }: Props) {
  const slots = Math.max(PENALTY_ROUNDS, shots.red.length, shots.blue.length);
  const goals = (side: Side) => shots[side].filter(Boolean).length;
  return (
    <div
      className={`${styles.strip} ${alignStart ? styles.start : ''}`}
      role="img"
      aria-label={`Penaltis: ${TEAM_NAMES.red} ${goals('red')}, ${TEAM_NAMES.blue} ${goals('blue')}`}>
      {(['red', 'blue'] as const).map((side) => (
        <div key={side} className={`${styles.team} ${side === 'blue' ? styles.right : ''}`}>
          <KitBadge kit={kits[side]} size={18} />
          <span className={styles.name}>{TEAM_NAMES[side]}</span>
          <span className={styles.shots} aria-hidden="true">
            {Array.from({ length: slots }, (_, i) => {
              const shot = shots[side][i];
              const cls = shot === undefined ? styles.pending : shot ? styles.scored : styles.missed;
              return (
                <i key={i} className={cls}>
                  {shot === false ? '✕' : ''}
                </i>
              );
            })}
          </span>
          <strong className="num">{goals(side)}</strong>
        </div>
      ))}
    </div>
  );
}
