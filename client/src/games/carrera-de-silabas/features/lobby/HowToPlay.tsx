import { useRef } from 'react';
import { MIN_WORD_LENGTH, wordPoints, type RoomSettings } from '@typeracer/shared/carrera-de-silabas';
import { formatDuration } from '../../../rally-de-letras/lib/format';
import { skipCost } from '../../lib/skip';
import styles from './HowToPlay.module.css';

/** Sílaba y palabras del ejemplo: de más corta a más larga, para que se vea que el largo suma. */
const EXAMPLE_SYLLABLE = 'ca';
const EXAMPLE_WORDS = ['boca', 'camino', 'escalera', 'comunicación'];

/**
 * Reglas de la partida. En el lobby se ve lo esencial (una línea y un ejemplo) para que quepa sin
 * desplazar la columna; el detalle, con la meta, el tiempo y el coste de pasar de la sala, se abre aparte.
 */
export default function HowToPlay({ settings }: { settings: RoomSettings }) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <div className={styles.summary}>
      <div className={styles.lead}>
        <p>
          Escribe palabras que contengan la sílaba. <strong>Cada letra es un punto: cuanto más larga, más puntos.</strong>
        </p>
        <button type="button" className={`btn ${styles.more}`} onClick={() => dialog.current?.showModal()}>
          Ver reglas
        </button>
      </div>
      <ul className={styles.chips} aria-label={`Ejemplo con la sílaba ${EXAMPLE_SYLLABLE}`}>
        <li className={styles.syllable}>{EXAMPLE_SYLLABLE.toUpperCase()}</li>
        {EXAMPLE_WORDS.map((word) => (
          <li key={word} className={styles.chip}>
            <Highlight word={word} syllable={EXAMPLE_SYLLABLE} />
            <span className={`${styles.points} num`}>+{wordPoints(word)}</span>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="reglas-titulo"
        // Clic fuera de la tarjeta (en el fondo) la cierra; Esc la cierra de serie.
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className={styles.card}>
          <h2 id="reglas-titulo">Cómo se juega</h2>
          <ol className={styles.steps}>
            <li>
              <strong>Escribe una palabra con la sílaba.</strong> Puede ir en cualquier parte: con «{EXAMPLE_SYLLABLE}»
              valen <em>casa</em>, <em>boca</em> o <em>escalera</em>.
            </li>
            <li>
              <strong>Cada letra es un punto.</strong> Cuanto más larga la palabra, más puntos ganas (mínimo{' '}
              {MIN_WORD_LENGTH} letras).
            </li>
            <li>
              <strong>Llega a la meta.</strong> Gana quien llegue primero a {settings.target} puntos. Si se acaban
              los {formatDuration(settings.timeLimitSec)}, gana quien tenga más.
            </li>
            <li>
              <strong>Sin repetir.</strong> No puedes usar dos veces la misma palabra. Las tildes dan igual; la ñ
              cuenta.
            </li>
            <li>
              <strong>¿Atascado?</strong> Pasa a la siguiente sílaba con el botón o con Shift + Enter (
              {skipCost(settings.skipPoints)}).
            </li>
          </ol>
          <button type="button" className="btn primary wide" onClick={() => dialog.current?.close()} autoFocus>
            Entendido
          </button>
        </div>
      </dialog>
    </div>
  );
}

/** La palabra con la sílaba resaltada. */
function Highlight({ word, syllable }: { word: string; syllable: string }) {
  const at = word.indexOf(syllable);
  if (at < 0) return <span>{word}</span>;
  return (
    <span>
      {word.slice(0, at)}
      <mark>{word.slice(at, at + syllable.length)}</mark>
      {word.slice(at + syllable.length)}
    </span>
  );
}
