import type { CSSProperties, ReactNode } from 'react';
import { gameForPath } from '../../portal/games';
// Las siluetas usan la maquetación de las pantallas reales: al cargar, todo aparece donde estaba.
import portal from '../../portal/PortalHome.module.css';
import home from '../../games/rally-de-letras/features/home/HomePage.module.css';
import lobby from '../../games/rally-de-letras/features/lobby/Lobby.module.css';
import styles from './Skeletons.module.css';

interface BoneProps {
  w?: number | string;
  h?: number | string;
  r?: number | string;
  className?: string;
  style?: CSSProperties;
}

/** Bloque gris con brillo: un renglón, un botón, un avatar… */
export function Bone({ w = '100%', h = 14, r, className, style }: BoneProps) {
  return (
    <span
      aria-hidden="true"
      className={`${styles.bone} ${className ?? ''}`}
      style={{ width: w, height: h, borderRadius: r, ...style }}
    />
  );
}

const PILL = 999;
const CIRCLE = '50%';

/**
 * Raíz de cada skeleton: la clase de maquetación de la pantalla real, el fundido de entrada y,
 * para lectores de pantalla, un "Cargando…" que no se ve.
 */
function SkeletonRoot({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div className={`${className} ${styles.skeleton}`} data-fit role="status" aria-busy="true">
      <span className={styles.srOnly}>Cargando…</span>
      {children}
    </div>
  );
}

/** Varios renglones de texto, el último más corto. */
function Lines({ count, h = 14, last = '60%' }: { count: number; h?: number; last?: string }) {
  return (
    <span className={styles.stack}>
      {Array.from({ length: count }, (_, i) => (
        <Bone key={i} h={h} w={i === count - 1 ? last : '100%'} />
      ))}
    </span>
  );
}

// -------------------------------------------------------------------- portal

export function PortalSkeleton() {
  return (
    <SkeletonRoot className={portal.portal}>
      <section className={portal.hero}>
        <Bone w={120} h={12} />
        <Bone w="min(520px, 75%)" h="clamp(2.8rem, min(6.4vw, 7.8vh), 5.1rem)" r={14} />
        {/* Dos renglones de 1.1rem con interlineado 1.55, como la entradilla real. */}
        <span className={styles.stack} style={{ maxWidth: 560, gap: 10, padding: '5px 0' }}>
          <Bone h={17} />
          <Bone h={17} w="70%" />
        </span>
      </section>
      <section className={portal.grid}>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className={portal.card}>
            <div className={`${portal.preview} ${styles.bone}`} style={{ borderRadius: 0 }} aria-hidden="true" />
            <div className={portal.body}>
              <Bone w={140} h={10} />
              <Bone w={190} h={26} />
              <Lines count={3} />
              <span className={styles.row} style={{ gap: 6 }}>
                <Bone w={78} h={20} r={PILL} />
                <Bone w={64} h={20} r={PILL} />
                <Bone w={48} h={20} r={PILL} />
              </span>
              <div className={portal.footer}>
                <Bone w={90} h={12} />
                <Bone w={96} h={40} r={PILL} />
              </div>
            </div>
          </div>
        ))}
      </section>
    </SkeletonRoot>
  );
}

// -------------------------------------------------------- portada de un juego

/** Portada de un juego: a la derecha, el garaje (Rally, Sílabas) o la cancha con los controles. */
export function GameHomeSkeleton({ variant }: { variant: 'garage' | 'pitch' }) {
  const titleLine = 'calc(clamp(3rem, min(8vw, 13vh - 30px), 6.4rem) * 0.92 - 6px)';
  return (
    <SkeletonRoot className={home.layout}>
      <section className={home.hero}>
        <Bone w={130} h={12} />
        <span className={styles.stack} style={{ gap: 6 }}>
          <Bone w="58%" h={titleLine} r={14} />
          <Bone w="70%" h={titleLine} r={14} />
          <Bone w="52%" h={titleLine} r={14} />
        </span>
        {/* Dos renglones de 1.1rem con interlineado 1.55, como la entradilla real. */}
        <span className={styles.stack} style={{ maxWidth: 520, gap: 10, padding: '5px 0' }}>
          <Bone h={17} />
          <Bone h={17} w="65%" />
        </span>
        <div className={home.cruise} aria-hidden="true" />
        <span className={styles.stack}>
          <Bone w={120} h={11} />
          <Bone h={52} r={12} />
        </span>
        <div className={home.options}>
          {[0, 1].map((i) => (
            <div key={i} className={home.option}>
              <span className={styles.stack}>
                <Bone w="55%" h={18} />
                <Lines count={2} h={12} last="75%" />
              </span>
              <Bone h={50} r={PILL} />
            </div>
          ))}
        </div>
      </section>

      <section className={home.garage}>
        <div className={home.garageHead}>
          <Bone w={90} h={11} />
          <Bone w={150} h={11} />
        </div>
        {variant === 'garage' ? (
          <>
            <Bone h={190} r={16} />
            <div className={styles.models}>
              {Array.from({ length: 6 }, (_, i) => (
                <Bone key={i} h={98} r={10} />
              ))}
            </div>
            <span className={styles.row} style={{ gap: 8 }}>
              {Array.from({ length: 10 }, (_, i) => (
                <Bone key={i} w={28} h={28} r={CIRCLE} />
              ))}
            </span>
          </>
        ) : (
          <>
            <Bone h="auto" r={10} style={{ aspectRatio: '1120 / 540' }} />
            <span className={styles.stack} style={{ gap: 12 }}>
              {[0, 1, 2].map((i) => (
                <span key={i} className={styles.controlRow}>
                  <Bone w={i === 0 ? 120 : 90} h={24} r={6} />
                  <Bone w={i === 1 ? '85%' : '60%'} h={13} />
                </span>
              ))}
            </span>
          </>
        )}
      </section>
    </SkeletonRoot>
  );
}

// ---------------------------------------------------------------------- sala

/** Sala de espera: parrilla de pilotos (Rally, Sílabas) o columnas de equipos (Cancha Rápida). */
export function RoomSkeleton({ variant }: { variant: 'grid' | 'teams' }) {
  return (
    <SkeletonRoot className={lobby.layout}>
      <div className={lobby.main}>
        <header className={lobby.head}>
          <span className={styles.stack}>
            <Bone w={44} h={10} />
            <Bone w={230} h="clamp(2.4rem, 4.2vw, 3.4rem)" r={12} />
          </span>
          <Bone w={132} h={42} r={PILL} />
        </header>

        <section className={lobby.section}>
          <div className={lobby.sectionHead}>
            <Bone w={130} h={10} />
            <Bone w={variant === 'teams' ? 220 : 36} h={10} />
          </div>
          {variant === 'grid' ? (
            <div>
              {[0, 1].map((i) => (
                <div key={i} className={styles.playerRow}>
                  <Bone w={24} h={14} />
                  <Bone w={88} h={30} r={8} />
                  <span className={`${styles.stack} ${styles.grow}`}>
                    <Bone w={i === 0 ? 120 : 96} h={14} />
                    <Bone w={80} h={10} />
                  </span>
                  <Bone w={44} h={20} r={PILL} />
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.teams}>
              {[0, 1, 2].map((i) => (
                <div key={i} className={styles.teamColumn}>
                  <span className={`${styles.row} ${styles.spread}`}>
                    <Bone w={i === 1 ? 100 : 60} h={13} />
                    {i !== 1 && <Bone w={26} h={12} />}
                  </span>
                  <span className={styles.row} style={{ gap: 8 }}>
                    <Bone w={26} h={26} r={CIRCLE} />
                    <Bone w="55%" h={13} />
                  </span>
                  <Bone h={32} r={PILL} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={lobby.section}>
          <div className={lobby.sectionHead}>
            <Bone w={160} h={10} />
          </div>
          <div className={styles.card}>
            {[0, 1, 2].slice(0, variant === 'teams' ? 2 : 3).map((i) => (
              <div key={i} className={styles.settingsRow}>
                <span className={styles.stack}>
                  <Bone w={120} h={14} />
                  <Bone w={220} h={10} />
                </span>
                <Bone w={i === 1 ? 300 : 220} h={36} r={PILL} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className={lobby.side}>
        {variant === 'grid' ? (
          <>
            <span className={styles.stack}>
              <Bone w={70} h={10} />
              <Bone h={120} r={16} />
            </span>
            <span className={styles.row} style={{ gap: 8 }}>
              <Bone h={52} r={PILL} className={styles.grow} />
              <Bone w={130} h={52} r={PILL} />
            </span>
          </>
        ) : (
          <span className={styles.stack} style={{ gap: 10, alignItems: 'center' }}>
            <Bone h={52} r={PILL} />
            <Bone w="60%" h={11} />
          </span>
        )}
        <Bone h={42} r={PILL} />
        <section className={`${lobby.section} ${lobby.chatSection}`}>
          <Bone w={50} h={10} />
          <Bone h="auto" r={12} className={styles.fill} />
        </section>
      </aside>
    </SkeletonRoot>
  );
}

// ------------------------------------------------------------------ por ruta

/** El skeleton de la pantalla a la que lleva la ruta (mientras se comprueba el servidor o carga el juego). */
export function RouteSkeleton({ pathname }: { pathname: string }) {
  const game = gameForPath(pathname);
  const cancha = game?.id === 'cancha-rapida';
  if (pathname.includes('/sala/')) return <RoomSkeleton variant={cancha ? 'teams' : 'grid'} />;
  if (game) return <GameHomeSkeleton variant={cancha ? 'pitch' : 'garage'} />;
  return <PortalSkeleton />;
}
