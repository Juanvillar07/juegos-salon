import { useState } from 'react';
import { KickIcon } from './icons';
import styles from './KickButton.module.css';

/** Expulsar a un jugador (solo lo ve el host): pide confirmación antes de hacerlo. */
export default function KickButton({ nickname, onKick }: { nickname: string; onKick: () => void }) {
  const [confirm, setConfirm] = useState(false);
  if (confirm) {
    return (
      <span className={styles.confirm}>
        ¿Expulsar?
        <button type="button" className={styles.yes} onClick={onKick}>
          Sí
        </button>
        <button type="button" className={styles.no} onClick={() => setConfirm(false)}>
          No
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      className={styles.kick}
      onClick={() => setConfirm(true)}
      aria-label={`Expulsar a ${nickname}`}
      title={`Expulsar a ${nickname}`}
    >
      <KickIcon />
    </button>
  );
}
