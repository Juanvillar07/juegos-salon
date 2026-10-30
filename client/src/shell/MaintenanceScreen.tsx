import { MAINTENANCE_MESSAGE, MAINTENANCE_TITLE } from './serverStatus';
import styles from './MaintenanceScreen.module.css';

/**
 * Ocupa todo el sitio mientras el servidor no responde: ni el portal ni los juegos se muestran,
 * así nadie entra a una sala que no puede funcionar. Se quita solo al volver el servidor.
 */
export default function MaintenanceScreen() {
  return (
    <section className={styles.screen} role="status" aria-live="polite" data-fit>
      <span className={styles.icon} aria-hidden="true">
        🛠️
      </span>
      <h1 className={styles.title}>{MAINTENANCE_TITLE}</h1>
      <p className={styles.message}>{MAINTENANCE_MESSAGE}</p>
      <p className={styles.hint}>Esta página se actualizará sola cuando los juegos vuelvan.</p>
    </section>
  );
}
