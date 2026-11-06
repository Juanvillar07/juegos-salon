import { useId, type ReactNode } from 'react';
import { kitInk, kitShapes, type TeamKit } from '@typeracer/shared/cancha-rapida';

interface Props {
  kit: TeamKit;
  /** Lado en píxeles. */
  size?: number;
  /** Texto sobre la camiseta (p. ej. las iniciales del jugador), del color que se lea mejor. */
  children?: ReactNode;
  /** Para lectores de pantalla; sin él, es decorativo. */
  label?: string;
}

/**
 * El uniforme como un disco en SVG, con la misma geometría que el canvas del partido (kitShapes):
 * escudo del equipo en la sala, el marcador y los resultados, y avatar de cada jugador.
 */
export default function KitBadge({ kit, size = 22, children, label }: Props) {
  // useId trae dos puntos (":r1:"), que no valen dentro de url(#…).
  const clipId = `kit${useId().replace(/:/g, '')}`;
  return (
    <span
      style={{ position: 'relative', display: 'inline-grid', placeItems: 'center', width: size, height: size, flexShrink: 0 }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg width={size} height={size} viewBox="-1.12 -1.12 2.24 2.24" style={{ position: 'absolute', inset: 0 }}>
        <clipPath id={clipId}>
          <circle r={1} />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>
          <rect x={-1} y={-1} width={2} height={2} fill={kit.primary} />
          {kitShapes(kit.pattern).map((shape, i) => (
            <polygon key={i} points={shape.map(([x, y]) => `${x},${y}`).join(' ')} fill={kit.secondary} />
          ))}
        </g>
        <circle r={1} fill="none" stroke="#151517" strokeWidth={0.13} />
      </svg>
      {children !== undefined && (
        <span
          style={{
            position: 'relative',
            color: kitInk(kit.primary),
            fontSize: size * 0.36,
            fontWeight: 700,
            letterSpacing: '0.02em',
            textShadow: kitInk(kit.primary) === '#ffffff' ? '0 0 2px rgba(21,21,23,0.7)' : '0 0 2px rgba(255,255,255,0.8)',
          }}
        >
          {children}
        </span>
      )}
    </span>
  );
}
