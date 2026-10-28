import { Link } from 'react-router-dom';
import { revealDelay, useReveal } from '../shell/transitions';
import { GAMES, type GameEntry } from './games';
import RallyPreview from './previews/RallyPreview';
import SilabasPreview from './previews/SilabasPreview';
import styles from './PortalHome.module.css';

/** Vista previa animada de cada juego en su tarjeta. */
const PREVIEWS: Record<string, () => JSX.Element> = {
  'rally-de-letras': RallyPreview,
  'carrera-de-silabas': SilabasPreview,
};

export default function PortalHome() {
  const reveal = useReveal();
  return (
    <div className={styles.portal} data-fit>
      <section className={`${styles.hero} ${reveal}`}>
        <span className="label t-stagger-line" style={revealDelay(0)}>
          Salón de Juegos
        </span>
        <h1 className={`${styles.title} t-stagger-line`} style={revealDelay(1)}>
          Elige tu <span>juego.</span>
        </h1>
        <p className={`${styles.lead} t-stagger-line`} style={revealDelay(2)}>
          Juegos multijugador para jugar con amigos desde el navegador, sin instalar nada. Crea una sala, comparte el
          enlace y a jugar.
        </p>
      </section>

      <section className={styles.grid} aria-label="Juegos disponibles">
        {GAMES.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
        <div className={`${styles.card} ${styles.soon}`}>
          <div className={styles.soonMark} aria-hidden="true">
            +
          </div>
          <h2 className={styles.name}>Más juegos en camino</h2>
          <p className="muted">Pronto habrá nuevos juegos en el salón.</p>
        </div>
      </section>
    </div>
  );
}

function GameCard({ game }: { game: GameEntry }) {
  const Preview = PREVIEWS[game.id];
  const content = (
    <>
      <div className={styles.preview}>{Preview && <Preview />}</div>
      <div className={styles.body}>
        <span className={styles.tagline}>{game.tagline}</span>
        <h2 className={styles.name}>{game.name}</h2>
        <p className={styles.description}>{game.description}</p>
        <div className={styles.tags}>
          {game.tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
        <div className={styles.footer}>
          <span className="muted">{game.players}</span>
          <span className={`btn primary ${styles.play}`}>
            Jugar <span aria-hidden="true">→</span>
          </span>
        </div>
      </div>
    </>
  );

  return game.path ? (
    <Link to={game.path} className={styles.card} aria-label={`Jugar ${game.name}`}>
      {content}
    </Link>
  ) : (
    <div className={styles.card}>{content}</div>
  );
}
