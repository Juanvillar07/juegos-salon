import { Toast } from '../../../../shell/transitions';
import { clearError, useClientState } from '../../state/store';
import styles from './Toasts.module.css';

/** El store retira cada aviso a los 4 s; la salida empieza antes para que se vea completa. */
const NOTICE_VISIBLE_MS = 3700;

export default function Toasts() {
  const { notices, error } = useClientState();
  return (
    <div className={styles.toasts}>
      {notices.map((n) => (
        <Toast key={n.id} className={styles.toast} closeAfterMs={NOTICE_VISIBLE_MS}>
          {n.text}
        </Toast>
      ))}
      {error && (
        <Toast key={error} className={`${styles.toast} ${styles.error}`} onClick={clearError}>
          {error}
        </Toast>
      )}
    </div>
  );
}
