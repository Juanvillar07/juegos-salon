import PitchSvg from '../../games/cancha-rapida/components/PitchSvg';
import styles from './CanchaPreview.module.css';

/** La cancha con un pase de un lado a otro. */
export default function CanchaPreview() {
  return (
    <div className={styles.preview} aria-hidden="true">
      <PitchSvg />
    </div>
  );
}
