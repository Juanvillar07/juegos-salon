import { MAINTENANCE_MESSAGE, MAINTENANCE_TITLE, useServerStatus } from './serverStatus';
import styles from './MaintenanceNotice.module.css';

/** Franja bajo la cabecera, en todo el sitio, mientras el servidor no responde. */
export default function MaintenanceNotice() {
  if (useServerStatus() !== 'mantenimiento') return null;
  return (
    <div className={styles.notice} role="status">
      <span aria-hidden="true">🛠️</span>
      <p>
        <strong>{MAINTENANCE_TITLE}:</strong> {MAINTENANCE_MESSAGE}
      </p>
    </div>
  );
}

/**
 * Lo que muestra una sala mientras conecta: "Conectando con el servidor…" o, si el servidor está
 * apagado, el aviso de mantenimiento en vez de esperar para siempre.
 */
export function ConnectingCard({ sessionReady }: { sessionReady: boolean }) {
  const maintenance = useServerStatus() === 'mantenimiento';
  if (maintenance && !sessionReady) {
    return (
      <div className="card">
        <h2>🛠️ {MAINTENANCE_TITLE}</h2>
        <p className="muted">{MAINTENANCE_MESSAGE}</p>
      </div>
    );
  }
  return <div className="card muted">{sessionReady ? 'Entrando a la sala…' : 'Conectando con el servidor…'}</div>;
}
