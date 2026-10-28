import CarSprite from '../../games/rally-de-letras/components/cars/CarSprite';
import styles from './SilabasPreview.module.css';

/** Palabras que van apareciendo con la sílaba resaltada, y dos autos que avanzan con ellas. */
const WORDS = [
  { before: '', syllable: 'tra', after: 'bajo', points: 7 },
  { before: 'maes', syllable: 'tra', after: '', points: 7 },
  { before: 'ex', syllable: 'tra', after: 'ño', points: 6 },
];

export default function SilabasPreview() {
  return (
    <div className={styles.preview} aria-hidden="true">
      <div className={styles.syllable}>TRA</div>
      <ul className={styles.words}>
        {WORDS.map((w, i) => (
          <li key={i} style={{ animationDelay: `${i * 1.2}s` }}>
            {w.before}
            <mark>{w.syllable}</mark>
            {w.after}
            <span>+{w.points}</span>
          </li>
        ))}
      </ul>
      <div className={styles.lanes}>
        <div className={styles.lane}>
          <div className={styles.car} style={{ animationDuration: '7s' }}>
            <CarSprite model="lmp" color="#2f5d50" width={70} moving />
          </div>
        </div>
        <div className={styles.lane}>
          <div className={styles.car} style={{ animationDuration: '8.5s', animationDelay: '-2s' }}>
            <CarSprite model="gt" color="#6a5d7b" width={70} moving />
          </div>
        </div>
      </div>
    </div>
  );
}
