import { useEffect, useSyncExternalStore } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { HeaderSlot } from '../../shell/headerSlot';
import HomePage from './features/home/HomePage';
import RoomPage from './features/room/RoomPage';
import { getBestWpm, subscribeBestWpm } from './lib/storage';
import { leaveRoom, useClientState } from './state/store';
import styles from './RallyApp.module.css';

/** Raíz de Rally de Letras dentro del portal: sus rutas y sus datos en la cabecera. */
export default function RallyApp() {
  const { connected } = useClientState();
  const best = useSyncExternalStore(subscribeBestWpm, getBestWpm);

  // Volver al Salón de Juegos saca al jugador de la sala en la que estuviera.
  useEffect(() => () => leaveRoom(), []);

  return (
    <>
      <HeaderSlot>
        {best > 0 && (
          <span className={styles.record}>
            récord <strong className="num">{best}</strong> wpm
          </span>
        )}
        <span className={`${styles.status} ${connected ? styles.online : ''}`}>
          {connected ? 'en línea' : 'conectando'}
        </span>
      </HeaderSlot>
      <Routes>
        <Route index element={<HomePage />} />
        <Route path="sala/:code" element={<RoomPage />} />
        <Route path="*" element={<Navigate to="." replace />} />
      </Routes>
    </>
  );
}
