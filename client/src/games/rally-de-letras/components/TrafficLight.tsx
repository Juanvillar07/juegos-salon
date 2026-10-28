import styles from './TrafficLight.module.css';

/** Cuenta regresiva: un número grande y tres luces que se encienden; en la salida, "ya". */
export default function TrafficLight({ secondsLeft }: { secondsLeft: number }) {
  const go = secondsLeft <= 0;
  const lit = go ? 3 : 4 - Math.min(3, secondsLeft);
  return (
    <div className={`${styles.wrap} ${go ? styles.go : ''}`}>
      <span className={`${styles.number} num`} key={secondsLeft}>
        {go ? 'ya' : secondsLeft}
      </span>
      <div className={styles.lights}>
        {[1, 2, 3].map((i) => (
          <span key={i} className={`${styles.light} ${i <= lit ? styles.on : ''}`} />
        ))}
      </div>
    </div>
  );
}
