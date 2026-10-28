import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { MAX_NICKNAME_LENGTH, MAX_PLAYERS, ROOM_CODE_LENGTH } from '@typeracer/shared';
import Garage from '../../components/Garage';
import CarSprite from '../../components/cars/CarSprite';
import { getCarChoice, getLastNickname, saveCarChoice, saveNickname, type CarChoice } from '../../lib/storage';
import { createRoom, leaveRoom, useClientState } from '../../state/store';
import { roomPath } from '../../routes';
import styles from './HomePage.module.css';

export default function HomePage() {
  const navigate = useNavigate();
  const { sessionReady } = useClientState();
  const [nickname, setNickname] = useState(getLastNickname);
  const [car, setCar] = useState(getCarChoice);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Estar en el inicio equivale a no estar en ninguna sala, incluso si el servidor
  // nos reincorporó a una al recargar esta página.
  useEffect(() => {
    if (sessionReady) leaveRoom();
  }, [sessionReady]);

  const name = nickname.trim();

  const changeCar = (choice: CarChoice) => {
    setCar(choice);
    saveCarChoice(choice);
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name) return setError('Escribe tu nombre de piloto');
    saveNickname(name);
    setBusy(true);
    const res = await createRoom(name);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    navigate(roomPath(res.code));
  };

  const onJoin = (e: FormEvent) => {
    e.preventDefault();
    if (!name) return setError('Escribe tu nombre de piloto');
    const clean = code.trim().toUpperCase();
    if (clean.length !== ROOM_CODE_LENGTH) return setError(`El código tiene ${ROOM_CODE_LENGTH} caracteres`);
    saveNickname(name);
    navigate(roomPath(clean));
  };

  return (
    <div className={styles.layout}>
      <section className={styles.hero}>
        <span className="label">Rally de Letras</span>
        <h1 className={styles.title}>
          Escribe.
          <br />
          <span>Acelera.</span>
          <br />
          Gana.
        </h1>
        <p className={styles.lead}>
          Carreras de mecanografía en tiempo real para hasta {MAX_PLAYERS} pilotos. Cada palabra correcta mueve tu
          auto.
        </p>

        <div className={styles.cruise} aria-hidden="true">
          <div className={styles.cruiseCar}>
            <CarSprite model={car.car} color={car.color} width={110} moving />
          </div>
        </div>

        <form className={styles.form} onSubmit={onCreate}>
          <label className="field">
            <span className="label">Nombre de piloto</span>
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
          <button className="btn primary big" type="submit" disabled={!sessionReady || busy}>
            Crear sala <span aria-hidden="true">→</span>
          </button>
        </form>

        <form className={styles.join} onSubmit={onJoin}>
          <span className="muted">¿Tienes un código?</span>
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
          <button className="btn" type="submit" disabled={!sessionReady || code.trim().length !== ROOM_CODE_LENGTH}>
            Unirse
          </button>
        </form>

        {error && <p className="error">{error}</p>}
      </section>

      <section className={styles.garage}>
        <div className={styles.garageHead}>
          <span className="label">Garaje</span>
          <span className="muted">Elige modelo y pintura</span>
        </div>
        <Garage value={car} onChange={changeCar} />
      </section>
    </div>
  );
}
