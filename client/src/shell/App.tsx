import { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import PortalHome from '../portal/PortalHome';
import { gameForPath } from '../portal/games';
import { HEADER_SLOT_ID } from './headerSlot';
import ThemeToggle from './ThemeToggle';
import styles from './App.module.css';

// Cada juego se carga solo cuando se entra en él (y con él, su conexión al servidor).
const RallyDeLetras = lazy(() => import('../games/rally-de-letras/RallyApp'));

/** Los enlaces antiguos /sala/CODIGO siguen funcionando. */
function LegacyRoomRedirect() {
  const { code = '' } = useParams();
  return <Navigate to={`/rally-de-letras/sala/${code}`} replace />;
}

export default function App() {
  const game = gameForPath(useLocation().pathname);

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <nav className={styles.crumbs} aria-label="Ubicación">
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
      <main className={styles.main}>
        <Suspense fallback={<p className="muted">Cargando…</p>}>
          <Routes>
            <Route path="/" element={<PortalHome />} />
            <Route path="/rally-de-letras/*" element={<RallyDeLetras />} />
            <Route path="/sala/:code" element={<LegacyRoomRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
