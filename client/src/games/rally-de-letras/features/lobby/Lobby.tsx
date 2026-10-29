import { CAR_MODEL_NAMES, MAX_PLAYERS, type RoomState } from '@typeracer/shared';
import Garage from '../../components/Garage';
import StatusTag from '../../components/StatusTag';
import Track from '../../components/Track';
import CarSprite from '../../components/cars/CarSprite';
import { saveCarChoice, type CarChoice } from '../../lib/storage';
import { customizeCar, kickPlayer, setRoomPassword } from '../../state/store';
import InvitePanel from '../../../../shell/InvitePanel';
import KickButton from '../../../../shell/KickButton';
import RoomPasswordField from '../../../../shell/RoomPasswordField';
import { LockIcon } from '../../../../shell/icons';
import Chat from '../chat/Chat';
import { roomPath } from '../../routes';
import RaceInProgress from './RaceInProgress';
import RoomSettingsPanel from './RoomSettingsPanel';
import StartPanel from './StartPanel';
import styles from './Lobby.module.css';

interface Props {
  room: RoomState;
  myId: string;
  isHost: boolean;
}

export default function Lobby({ room, myId, isHost }: Props) {
  const link = `${window.location.origin}${roomPath(room.code)}`;
  const me = room.players.find((p) => p.id === myId)!;
  const takenColors = new Set(room.players.filter((p) => p.id !== myId).map((p) => p.color));
  const freeSlots = MAX_PLAYERS - room.players.length;
  // Volvimos a la sala con la carrera en marcha: se ve en vivo en lugar de la parrilla.
  const racing = room.phase === 'racing';

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
            <h1 className={`${styles.code} num`}>
              {room.code}
              {room.locked && (
                <span className={styles.lock} title="Sala con contraseña" aria-label="Sala con contraseña">
                  <LockIcon />
                </span>
              )}
            </h1>
          </div>
          <InvitePanel link={link} code={room.code} gameName="Rally de Letras" locked={room.locked} />
        </header>

        {racing ? (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span className="label">Carrera en curso</span>
            </div>
            <Track room={room} myId={myId} live />
          </section>
        ) : (
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
                    <span className={styles.model}>
                      {CAR_MODEL_NAMES[p.car]}
                      {p.stats.bestWpm > 0 && ` · mejor ${p.stats.bestWpm} wpm`}
                    </span>
                  </div>
                  <div className={styles.tags}>
                    {p.stats.wins > 0 && (
                      <span className="tag">
                        {p.stats.wins} {p.stats.wins === 1 ? 'victoria' : 'victorias'}
                      </span>
                    )}
                    {p.ready && <span className="tag ready">listo</span>}
                    {p.id === room.hostId && <span className="tag">host</span>}
                    {p.id === myId && <span className="tag me">tú</span>}
                    <StatusTag status={p.status} />
                    {isHost && p.id !== myId && (
                      <KickButton nickname={p.nickname} onKick={() => void kickPlayer(p.id)} />
                    )}
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
        )}

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className="label">Ajustes de la carrera</span>
            {!isHost ? (
              <span className="muted">Los elige el host</span>
            ) : (
              racing && <span className="muted">Se cambian al terminar la carrera</span>
            )}
          </div>
          <RoomSettingsPanel settings={room.settings} isHost={isHost && !racing} />
        </section>

        {isHost && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span className="label">Contraseña de la sala</span>
            </div>
            <RoomPasswordField locked={room.locked} save={setRoomPassword} />
          </section>
        )}
      </div>

      <aside className={styles.side}>
        <section className={styles.section}>
          <span className="label">Tu auto</span>
          <Garage value={{ car: me.car, color: me.color }} onChange={changeCar} takenColors={takenColors} compact />
        </section>

        {racing ? (
          <RaceInProgress room={room} isHost={isHost} spectator={me.spectator} />
        ) : (
          <StartPanel room={room} myId={myId} isHost={isHost} />
        )}

        <section className={`${styles.section} ${styles.chatSection}`}>
          <span className="label">Chat</span>
          <Chat compact fill />
        </section>
      </aside>
    </div>
  );
}
