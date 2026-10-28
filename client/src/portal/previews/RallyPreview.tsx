import CarSprite from '../../games/rally-de-letras/components/cars/CarSprite';
import styles from './RallyPreview.module.css';

const CARS = [
  { model: 'f1', color: '#b8463c', duration: 6.5 },
  { model: 'wedge', color: '#3c5a7d', duration: 8 },
  { model: 'hyper', color: '#c99a3d', duration: 9.5 },
] as const;

/** Tres carriles con autos que avanzan en bucle, como una carrera en miniatura. */
export default function RallyPreview() {
  return (
    <div className={styles.track} aria-hidden="true">
      {CARS.map((c, i) => (
        <div key={c.model} className={styles.lane}>
          <div className={styles.car} style={{ animationDuration: `${c.duration}s`, animationDelay: `${-i * 1.7}s` }}>
            <CarSprite model={c.model} color={c.color} width={84} moving />
          </div>
        </div>
      ))}
      <div className={styles.finish} />
    </div>
  );
}
