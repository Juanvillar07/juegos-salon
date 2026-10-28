import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { HeaderSlot } from '../../shell/headerSlot';
import HomePage from './features/home/HomePage';
import RoomPage from './features/room/RoomPage';
import { leaveRoom, useClientState } from './state/store';
import styles from '../rally-de-letras/RallyApp.module.css';

/** Raíz de Carrera de Sílabas dentro del portal: sus rutas y su estado de conexión en la cabecera. */
export default function SilabasApp() {
  const { connected } = useClientState();

  // Volver al Salón de Juegos saca al jugador de la sala en la que estuviera.
  useEffect(() => () => leaveRoom(), []);

  return (
    <>
      <HeaderSlot>
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
