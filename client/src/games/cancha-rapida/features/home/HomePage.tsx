import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { MAX_NICKNAME_LENGTH, ROOM_CODE_LENGTH } from '@typeracer/shared';
import { MAX_PER_TEAM } from '@typeracer/shared/cancha-rapida';
import { revealDelay, useReveal } from '../../../../shell/transitions';
import PitchSvg from '../../components/PitchSvg';
import { getLastNickname, saveNickname } from '../../lib/storage';
import { createRoom, leaveRoom, useClientState } from '../../state/store';
import { roomPath } from '../../routes';
import Controls from './Controls';
import styles from '../../../rally-de-letras/features/home/HomePage.module.css';
import own from './HomePage.module.css';

export default function HomePage() {
  const navigate = useNavigate();
  const reveal = useReveal();
  const { sessionReady } = useClientState();
  const [nickname, setNickname] = useState(getLastNickname);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Estar en el inicio equivale a no estar en ninguna sala, incluso si el servidor
  // nos reincorporó a una al recargar esta página.
  useEffect(() => {
    if (sessionReady) leaveRoom();
  }, [sessionReady]);

  const name = nickname.trim();
  const codeComplete = code.trim().length === ROOM_CODE_LENGTH;
  const joining = code.trim().length > 0;

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name) return setError('Escribe tu nombre de jugador');
    saveNickname(name);
    setBusy(true);
    const res = await createRoom(name);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    navigate(roomPath(res.code));
  };

  const onJoin = (e: FormEvent) => {
    e.preventDefault();
    if (!name) return setError('Escribe tu nombre de jugador');
    const clean = code.trim().toUpperCase();
    if (clean.length !== ROOM_CODE_LENGTH) return setError(`El código tiene ${ROOM_CODE_LENGTH} caracteres`);
    saveNickname(name);
    navigate(roomPath(clean));
  };

  return (
    <div className={styles.layout} data-fit>
      <section className={`${styles.hero} ${reveal}`}>
        <span className="label t-stagger-line" style={revealDelay(0)}>
          Cancha Rápida
        </span>
        <h1 className={styles.title}>
          <span className="t-stagger-line" style={revealDelay(1)}>
            Corre.
          </span>
          <span className={`t-stagger-line ${styles.dim}`} style={revealDelay(2)}>
            Patea.
          </span>
          <span className="t-stagger-line" style={revealDelay(3)}>
            Golea.
          </span>
        </h1>
        <p className={`${styles.lead} t-stagger-line`} style={revealDelay(4)}>
          Fútbol en tiempo real, rojos contra azules, hasta {MAX_PER_TEAM} por equipo. Gana quien meta más goles antes
          de que se acabe el tiempo.
        </p>

        <div className={styles.cruise} aria-hidden="true">
          <div className={styles.cruiseCar}>
            <span className={own.rollingBall} />
          </div>
        </div>

        <label className="field">
          <span className="label">Nombre de jugador</span>
          <input
            className={styles.nameInput}
            value={nickname}
            maxLength={MAX_NICKNAME_LENGTH}
            onChange={(e) => {
              setNickname(e.target.value);
              setError(null);
            }}
            placeholder="¿Cómo te llamas?"
            autoFocus
          />
        </label>

        <div className={styles.options}>
          <form className={styles.option} onSubmit={onCreate}>
            <div>
              <h2 className={styles.optionTitle}>Crear una sala</h2>
              <p className={styles.optionText}>Arma los equipos y comparte el enlace para invitar.</p>
            </div>
            <button
              className="btn primary big"
              type="submit"
              disabled={!sessionReady || busy || joining}
              title={joining ? 'Borra el código para crear una sala nueva' : undefined}
            >
              Crear sala <span aria-hidden="true">→</span>
            </button>
          </form>

          <form className={styles.option} onSubmit={onJoin}>
            <div>
              <h2 className={styles.optionTitle}>Unirse a una sala</h2>
              <p className={styles.optionText}>Escribe el código de {ROOM_CODE_LENGTH} letras que te pasaron.</p>
            </div>
            <div className={styles.joinRow}>
              <input
                className={`${styles.codeInput} num`}
                value={code}
                maxLength={ROOM_CODE_LENGTH}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                placeholder="ABCDE"
                aria-label="Código de sala"
              />
              <button
                className={`btn big ${codeComplete ? 'primary' : ''}`}
                type="submit"
                disabled={!sessionReady || !codeComplete}
              >
                Unirse
              </button>
            </div>
          </form>
        </div>

        {error && <p className="error">{error}</p>}
      </section>

      <section className={styles.garage}>
        <div className={styles.garageHead}>
          <span className="label">Cómo se juega</span>
          <span className="muted">Solo con teclado</span>
        </div>
        <PitchSvg />
        <Controls />
      </section>
    </div>
  );
}
