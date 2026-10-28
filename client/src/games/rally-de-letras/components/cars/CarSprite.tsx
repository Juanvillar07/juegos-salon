import { useId } from 'react';
import type { CarModel } from '@typeracer/shared';
import { shade } from '../../lib/color';
import { CAR_SHAPES, CAR_VIEWBOX } from './carModels';
import styles from './CarSprite.module.css';

interface Props {
  model: CarModel;
  color: string;
  /** Ancho en píxeles; el alto sale de la proporción del viewBox. */
  width?: number;
  /** Ruedas girando y estela de velocidad. */
  moving?: boolean;
  /** En gris (jugador que abandonó). */
  faded?: boolean;
  /** Motor en ralentí: una vibración muy leve (parrilla de salida). */
  idle?: boolean;
}

const SPOKES = [0, 72, 144, 216, 288];

export default function CarSprite({ model, color, width = 120, moving = false, faded = false, idle = false }: Props) {
  const s = CAR_SHAPES[model];
  const id = useId().replace(/:/g, '');
  const paint = `paint-${id}`;
  const outline = shade(color, 0.3);
  const lineColor = shade(color, 0.22);
  const className = [styles.car, moving && styles.moving, faded && styles.faded, idle && !faded && styles.idle].filter(Boolean).join(' ');
  const { width: vw, height: vh } = CAR_VIEWBOX;

  return (
    <svg className={className} viewBox={`0 0 ${vw} ${vh}`} width={width} height={(width * vh) / vw} aria-hidden="true">
      <defs>
        {/* Pintura con luz cenital: más clara arriba, más oscura en los bajos */}
        <linearGradient id={paint} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(color, -0.28)} />
          <stop offset="0.45" stopColor={color} />
          <stop offset="1" stopColor={shade(color, 0.32)} />
        </linearGradient>
      </defs>

      {moving && (
        <g className={styles.trail}>
          <line x1="-18" y1="22" x2="-2" y2="22" />
          <line x1="-26" y1="29" x2="-4" y2="29" />
        </g>
      )}

      <ellipse cx="80" cy="45.5" rx="74" ry="2.4" className={styles.shadow} />
      <path d={s.body} fill={`url(#${paint})`} stroke={outline} strokeWidth="0.6" />
      {s.lines && <path d={s.lines} stroke={lineColor} strokeWidth="0.9" fill="none" strokeLinecap="round" />}
      {s.windows && <path d={s.windows} className={styles.glass} />}
      {s.carbon && <path d={s.carbon} className={styles.carbon} />}
      {s.helmet && <circle cx={s.helmet[0]} cy={s.helmet[1]} r="3.6" className={styles.helmet} />}

      <rect
        x={s.headlight[0] - s.headlight[2] / 2}
        y={s.headlight[1] - 0.9}
        width={s.headlight[2]}
        height="1.8"
        rx="0.9"
        className={styles.headlight}
      />
      <rect x={s.taillight[0] - 0.9} y={s.taillight[1]} width="1.8" height={s.taillight[2]} rx="0.9" className={styles.taillight} />

      {s.wheels.map((w) => (
        <g key={w.x} transform={`translate(${w.x} ${s.wheelY})`}>
          <circle r={w.r} className={styles.tire} />
          <circle r={w.r * 0.72} className={styles.rim} />
          <g className={styles.spokes}>
            {SPOKES.map((deg) => (
              <path key={deg} d={`M0 0 L${-w.r * 0.12} ${-w.r * 0.66} L${w.r * 0.12} ${-w.r * 0.66} Z`} transform={`rotate(${deg})`} />
            ))}
          </g>
          <circle r={w.r * 0.14} className={styles.hub} />
        </g>
      ))}
    </svg>
  );
}
