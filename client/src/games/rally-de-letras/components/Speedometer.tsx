import styles from './Speedometer.module.css';

interface Props {
  value: number;
  /** Tope de la escala; si se supera, la escala crece. */
  max?: number;
  label?: string;
  /** Ancho en píxeles; todo lo demás escala con él. */
  size?: number;
}

const START = -120;
const END = 120;
const R = 52;

function polar(deg: number, r = R): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [60 + r * Math.cos(rad), 60 + r * Math.sin(rad)];
}

function arc(from: number, to: number): string {
  const [x1, y1] = polar(from);
  const [x2, y2] = polar(to);
  return `M${x1} ${y1} A${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

/** Velocímetro: arco de 240° con aguja, marcas y el valor en el centro. */
export default function Speedometer({ value, max = 120, label = 'wpm', size = 168 }: Props) {
  const scale = Math.max(max, Math.ceil(value / 20) * 20);
  const ratio = Math.min(1, value / scale);
  const angle = START + (END - START) * ratio;
  const ticks = Array.from({ length: 7 }, (_, i) => START + ((END - START) * i) / 6);

  return (
    <div className={styles.gauge} style={{ width: size, fontSize: size / 10.5 }}>
      <svg viewBox="0 0 120 104" aria-hidden="true">
        <path d={arc(START, END)} className={styles.track} />
        {ratio > 0 && <path d={arc(START, angle)} className={styles.fill} />}
        {ticks.map((t) => {
          const [x1, y1] = polar(t, R - 9);
          const [x2, y2] = polar(t, R - 5);
          return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} className={styles.tick} />;
        })}
        <g className={styles.needle} style={{ transform: `rotate(${angle}deg)` }}>
          <line x1="60" y1="60" x2="60" y2="20" />
          <circle cx="60" cy="60" r="3.5" />
        </g>
      </svg>
      <div className={styles.readout}>
        <span className={`${styles.value} num`}>{value}</span>
        <span className={styles.label}>{label}</span>
      </div>
    </div>
  );
}
