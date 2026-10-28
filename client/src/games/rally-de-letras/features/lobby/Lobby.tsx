import { useState } from 'react';
import { CAR_MODEL_NAMES, MAX_PLAYERS, type RoomState } from '@typeracer/shared';
import Garage from '../../components/Garage';
import StatusTag from '../../components/StatusTag';
import CarSprite from '../../components/cars/CarSprite';
import { saveCarChoice, type CarChoice } from '../../lib/storage';
import { customizeCar } from '../../state/store';
import Chat from '../chat/Chat';
import { roomPath } from '../../routes';
import RoomSettingsPanel from './RoomSettingsPanel';
import StartPanel from './StartPanel';
import styles from './Lobby.module.css';

interface Props {
  room: RoomState;
  myId: string;
  isHost: boolean;
}

export default function Lobby({ room, myId, isHost }: Props) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${roomPath(room.code)}`;
  const me = room.players.find((p) => p.id === myId)!;
  const takenColors = new Set(room.players.filter((p) => p.id !== myId).map((p) => p.color));
  const freeSlots = MAX_PLAYERS - room.players.length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // portapapeles no disponible: el enlace sigue visible para copiarlo a mano
    }
  };

  const changeCar = (choice: CarChoice) => {
    saveCarChoice(choice);
    void customizeCar(choice);
  };

  return (
    <div className={styles.layout} data-fit>
      <div className={styles.main}>
        <header className={styles.head}>
          <div>
            <span className="label">Sala</span>
            <h1 className={`${styles.code} num`}>{room.code}</h1>
          </div>
          <button className="btn" onClick={copy}>
            {copied ? 'Enlace copiado' : 'Copiar enlace'}
          </button>
        </header>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className="label">Parrilla de salida</span>
            <span className="muted num">
              {room.players.length}/{MAX_PLAYERS}
            </span>
          </div>
          <ul className={styles.players}>
            {room.players.map((p, i) => (
              <li key={p.id} className={p.id === myId ? styles.mine : undefined}>
                <span className={`${styles.slot} num`}>P{i + 1}</span>
                <div className={styles.gridCar}>
                  <CarSprite model={p.car} color={p.color} width={88} faded={p.status !== 'connected'} idle />
                </div>
                <div className={styles.playerInfo}>
                  <span className="nick">{p.nickname}</span>
                  <span className={styles.model}>{CAR_MODEL_NAMES[p.car]}</span>
                </div>
                <div className={styles.tags}>
                  {p.ready && <span className="tag ready">listo</span>}
                  {p.id === room.hostId && <span className="tag">host</span>}
                  {p.id === myId && <span className="tag me">tú</span>}
                  <StatusTag status={p.status} />
                </div>
              </li>
            ))}
          </ul>
          {freeSlots > 0 && (
            <p className={styles.free}>
              {freeSlots === 1 ? 'Queda 1 lugar libre' : `Quedan ${freeSlots} lugares libres`}. Comparte el enlace para
              invitar.
            </p>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className="label">Ajustes de la carrera</span>
            {!isHost && <span className="muted">Los elige el host</span>}
          </div>
          <RoomSettingsPanel settings={room.settings} isHost={isHost} />
        </section>
      </div>

      <aside className={styles.side}>
        <section className={styles.section}>
          <span className="label">Tu auto</span>
          <Garage value={{ car: me.car, color: me.color }} onChange={changeCar} takenColors={takenColors} compact />
        </section>

        <StartPanel room={room} myId={myId} isHost={isHost} />

        <section className={`${styles.section} ${styles.chatSection}`}>
          <span className="label">Chat</span>
          <Chat compact fill />
        </section>
      </aside>
    </div>
  );
}
