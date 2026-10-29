import styles from './HomePage.module.css';

/** Los controles del partido, con las teclas dibujadas. */
export default function Controls() {
  return (
    <ul className={styles.controls}>
      <li>
        <span className={styles.keys}>
          <kbd>↑</kbd>
          <kbd>←</kbd>
          <kbd>↓</kbd>
          <kbd>→</kbd>
        </span>
        <span>
          <strong>Moverse</strong> · también con W A S D
        </span>
      </li>
      <li>
        <span className={styles.keys}>
          <kbd>X</kbd>
          <kbd className={styles.wide}>Espacio</kbd>
        </span>
        <span>
          <strong>Patear</strong> · con el balón pegado; mantén para patear al tocarlo
        </span>
      </li>
      <li>
        <span className={styles.keys}>
          <kbd className={styles.wide}>Enter</kbd>
        </span>
        <span>
          <strong>Chatear</strong> · Esc vuelve al partido
        </span>
      </li>
    </ul>
  );
}
