import { Link } from 'react-router-dom';
import { ExitIcon } from './icons';

/**
 * "Salir de la sala": vuelve a la portada del juego (que avisa al servidor de la salida).
 * Botón secundario con icono que se tiñe de rojo al pasar el ratón, para que se note que sales.
 */
export default function ExitRoomLink({ to, wide = false }: { to: string; wide?: boolean }) {
  return (
    <Link to={to} className={`btn exit ${wide ? 'wide' : ''}`}>
      <ExitIcon />
      Salir de la sala
    </Link>
  );
}
