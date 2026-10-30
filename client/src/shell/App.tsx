import { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import PortalHome from '../portal/PortalHome';
import { gameForPath, type GameEntry } from '../portal/games';
import { HEADER_SLOT_ID } from './headerSlot';
import { BackIcon } from './icons';
import MaintenanceNotice from './MaintenanceNotice';
import ThemeToggle from './ThemeToggle';
import styles from './App.module.css';

// Cada juego se carga solo cuando se entra en él (y con él, su conexión al servidor).
const RallyDeLetras = lazy(() => import('../games/rally-de-letras/RallyApp'));
const CarreraDeSilabas = lazy(() => import('../games/carrera-de-silabas/SilabasApp'));
const CanchaRapida = lazy(() => import('../games/cancha-rapida/CanchaApp'));

/** Los enlaces antiguos /sala/CODIGO siguen funcionando. */
function LegacyRoomRedirect() {
  const { code = '' } = useParams();
  return <Navigate to={`/rally-de-letras/sala/${code}`} replace />;
}

/**
 * A dónde lleva "Volver": de la portada de un juego al portal; de una sala, a la portada del
 * juego (que la abandona). En el portal no hay a dónde volver.
 */
function backTarget(pathname: string, game: GameEntry | undefined): string | null {
  if (!game?.path) return null;
  return pathname === game.path || pathname === `${game.path}/` ? '/' : game.path;
}

export default function App() {
  const { pathname } = useLocation();
  const game = gameForPath(pathname);
  const back = backTarget(pathname, game);

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <nav className={styles.crumbs} aria-label="Ubicación">
          {/* Se oculta durante la carrera (el CSS lo detecta con [data-race]): ahí se sale con "Salir". */}
          {back && (
            <Link to={back} className={styles.back} aria-label="Volver" title="Volver">
              <BackIcon />
            </Link>
          )}
          <Link to="/" className={styles.logo}>
            <span className={styles.mark} aria-hidden="true">
              <i />
              <i />
            </span>
            Salón de Juegos
          </Link>
          {game && game.path && (
            <>
              <span className={styles.sep} aria-hidden="true">
                /
              </span>
              <Link to={game.path} className={styles.gameName}>
                {game.name}
              </Link>
            </>
          )}
        </nav>
        <div className={styles.headerRight}>
          {/* Cada juego pone aquí sus datos (conexión, récord…) con un portal de React. */}
          <div id={HEADER_SLOT_ID} className={styles.slot} />
          <ThemeToggle />
        </div>
      </header>
      <MaintenanceNotice />
      <main className={styles.main}>
        <Suspense fallback={<p className="muted">Cargando…</p>}>
          <Routes>
            <Route path="/" element={<PortalHome />} />
            <Route path="/rally-de-letras/*" element={<RallyDeLetras />} />
            <Route path="/carrera-de-silabas/*" element={<CarreraDeSilabas />} />
            <Route path="/cancha-rapida/*" element={<CanchaRapida />} />
            <Route path="/sala/:code" element={<LegacyRoomRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
