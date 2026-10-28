import { clearError, useClientState } from '../../state/store';
import styles from './Toasts.module.css';

export default function Toasts() {
  const { notices, error } = useClientState();
  return (
    <div className={styles.toasts}>
      {notices.map((n) => (
        <div key={n.id} className={styles.toast}>
          {n.text}
        </div>
      ))}
      {error && (
        <div className={`${styles.toast} ${styles.error}`} onClick={clearError}>
          {error}
        </div>
      )}
    </div>
  );
}
