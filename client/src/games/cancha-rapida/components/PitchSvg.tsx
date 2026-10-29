import { BALL, FIELD, PLAYER, POSTS, POST_RADIUS, TEAM_COLORS } from '@typeracer/shared/cancha-rapida';
import { PITCH } from './pitchStyle';
import styles from './PitchSvg.module.css';

const W = FIELD.outerHalfWidth;
const H = FIELD.outerHalfHeight;
const { halfWidth: FW, halfHeight: FH, goalHalfHeight: G, goalDepth: D } = FIELD;

/**
 * Cancha en SVG para la portada y la vista previa del portal: dos jugadores por equipo y un
 * balón que va de un lado a otro (animado con CSS).
 */
export default function PitchSvg({ animated = true }: { animated?: boolean }) {
  return (
    <svg
      className={`${styles.pitch} ${animated ? styles.animated : ''}`}
      viewBox={`${-W} ${-H} ${W * 2} ${H * 2}`}
      role="img"
      aria-label="Cancha de fútbol vista desde arriba"
    >
      <rect x={-W} y={-H} width={W * 2} height={H * 2} fill={PITCH.outside} />
      <rect x={-FW} y={-FH} width={FW * 2} height={FH * 2} fill={PITCH.grass} />
      {/* Franjas de césped de 60 cada 120, como en el canvas del partido. */}
      {Array.from({ length: Math.ceil((FW * 2) / 120) }, (_, i) => (
        <rect key={i} x={-FW + i * 120} y={-FH} width={60} height={FH * 2} fill={PITCH.stripe} />
      ))}
      <g fill="none" stroke={PITCH.line} strokeWidth={3}>
        <rect x={-FW} y={-FH} width={FW * 2} height={FH * 2} />
        <line x1={0} y1={-FH} x2={0} y2={FH} />
        <circle r={FIELD.centerRadius} />
      </g>
      <g fill="none" stroke={PITCH.net} strokeWidth={3}>
        <path d={`M${FW} ${-G} h${D} v${G * 2} h${-D}`} />
        <path d={`M${-FW} ${-G} h${-D} v${G * 2} h${D}`} />
      </g>
      {POSTS.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={POST_RADIUS} fill={PITCH.post} stroke={PITCH.outline} strokeWidth={2} />
      ))}
      <Player x={-240} y={0} team="red" />
      <Player x={-320} y={-110} team="red" className={styles.runner} />
      <Player x={240} y={0} team="blue" />
      <Player x={320} y={110} team="blue" className={styles.runnerAlt} />
      <circle className={styles.ball} r={BALL.radius} fill={PITCH.ball} stroke={PITCH.outline} strokeWidth={2} />
    </svg>
  );
}

function Player({ x, y, team, className }: { x: number; y: number; team: 'red' | 'blue'; className?: string }) {
  return (
    <g className={className}>
      <circle cx={x} cy={y} r={PLAYER.radius} fill={TEAM_COLORS[team]} stroke={PITCH.outline} strokeWidth={2} />
    </g>
  );
}
