import {
  CAR_COLORS,
  CAR_COLOR_NAMES,
  CAR_MODELS,
  CAR_MODEL_DESCRIPTIONS,
  CAR_MODEL_NAMES,
  type CarColor,
  type CarModel,
} from '@typeracer/shared';
import type { CarChoice } from '../lib/storage';
import CarSprite from './cars/CarSprite';
import styles from './Garage.module.css';

interface Props {
  value: CarChoice;
  onChange: (choice: CarChoice) => void;
  /** Colores que ya usan otros jugadores de la sala. */
  takenColors?: Set<string>;
  /** Versión compacta (lobby): sin descripciones. */
  compact?: boolean;
}

/** Selector de auto y pintura con vista previa. */
export default function Garage({ value, onChange, takenColors, compact = false }: Props) {
  const pickCar = (car: CarModel) => onChange({ ...value, car });
  const pickColor = (color: string) => onChange({ ...value, color });

  return (
    <div className={`${styles.garage} ${compact ? styles.compact : ''}`}>
      <div className={styles.stage}>
        <div className={styles.car} key={value.car}>
          <CarSprite model={value.car} color={value.color} width={compact ? 220 : 320} />
        </div>
        <div className={styles.caption}>
          <span className={styles.modelName}>{CAR_MODEL_NAMES[value.car]}</span>
          <span className={styles.paintName}>{CAR_COLOR_NAMES[value.color as CarColor] ?? ''}</span>
        </div>
      </div>

      <div className={styles.models} role="listbox" aria-label="Modelo">
        {CAR_MODELS.map((model) => (
          <button
            key={model}
            type="button"
            role="option"
            aria-selected={model === value.car}
            className={`${styles.model} ${model === value.car ? styles.selected : ''}`}
            onClick={() => pickCar(model)}
            aria-label={CAR_MODEL_NAMES[model]}
            title={CAR_MODEL_NAMES[model]}
          >
            <CarSprite model={model} color={value.color} width={compact ? 72 : 84} />
            {!compact && <span className={styles.modelLabel}>{CAR_MODEL_NAMES[model]}</span>}
            {!compact && <span className={styles.modelDesc}>{CAR_MODEL_DESCRIPTIONS[model]}</span>}
          </button>
        ))}
      </div>

      <div className={styles.colors} role="listbox" aria-label="Pintura">
        {CAR_COLORS.map((color) => {
          const taken = takenColors?.has(color) ?? false;
          return (
            <button
              key={color}
              type="button"
              role="option"
              aria-selected={color === value.color}
              className={`${styles.swatch} ${color === value.color ? styles.selected : ''}`}
              style={{ ['--swatch' as string]: color }}
              onClick={() => pickColor(color)}
              disabled={taken}
              title={taken ? `${CAR_COLOR_NAMES[color]} · ya lo tiene otro jugador` : CAR_COLOR_NAMES[color]}
            />
          );
        })}
      </div>
    </div>
  );
}
