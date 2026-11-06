import type { RoomState } from '@typeracer/shared/cancha-rapida';
import CopyLinkButton from '../../../../shell/CopyLinkButton';
import ExitRoomLink from '../../../../shell/ExitRoomLink';
import Controls from '../home/Controls';
import Chat from '../chat/Chat';
import { GAME_HOME, roomPath } from '../../routes';
import { shuffleTeams, startMatch } from '../../state/store';
import RoomSettingsPanel from './RoomSettingsPanel';
import TeamsPanel from './TeamsPanel';
import styles from '../../../rally-de-letras/features/lobby/Lobby.module.css';
import own from './Lobby.module.css';

interface Props {
  room: RoomState;
  myId: string;
  isHost: boolean;
}

export default function Lobby({ room, myId, isHost }: Props) {
  const link = `${window.location.origin}${roomPath(room.code)}`;
  const playing = room.players.filter((p) => p.team !== 'spectator').length;
  const host = room.players.find((p) => p.id === room.hostId);

  return (
    <div className={styles.layout} data-fit>
      <div className={styles.main}>
        <header className={styles.head}>
          <div>
            <span className="label">Sala</span>
            <h1 className={`${styles.code} num`}>{room.code}</h1>
          </div>
          <CopyLinkButton link={link} />
        </header>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className="label">Equipos</span>
            {isHost ? (
              // Además de arrastrar, el host puede repartir a todos de una vez.
              <span className={own.shuffle} title="Arrastra a los jugadores para cambiarlos de equipo">
                <span className="muted">Repartir</span>
                <button
                  type="button"
                  onClick={() => void shuffleTeams('random')}
                  disabled={playing < 2}
                  title="Mezcla a los jugadores al azar, mitad y mitad"
                >
                  Al azar
                </button>
                <button
                  type="button"
                  onClick={() => void shuffleTeams('balanced')}
                  disabled={playing < 2}
                  title="Reparte según las victorias y los goles en esta sala, para que los equipos queden parejos"
                >
                  Equilibrado
                </button>
              </span>
            ) : (
              <span className="muted">Arrástrate a un equipo o pulsa Unirme</span>
            )}
          </div>
          <TeamsPanel room={room} myId={myId} isHost={isHost} />
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className="label">Ajustes del partido</span>
            {!isHost && <span className="muted">Los elige el host</span>}
          </div>
          <RoomSettingsPanel settings={room.settings} isHost={isHost} />
        </section>
      </div>

      <aside className={styles.side}>
        <section className={own.start}>
          {isHost ? (
            <button
              className="btn primary big wide"
              onClick={() => void startMatch()}
              disabled={playing === 0}
              title={playing === 0 ? 'Tiene que haber al menos un jugador en un equipo' : undefined}
            >
              Empezar partido
            </button>
          ) : (
            <p className={own.waiting}>Esperando a que {host?.nickname ?? 'el host'} empiece el partido…</p>
          )}
          <p className="muted">
            {playing === 1 ? 'Solo hay un jugador en la cancha: sirve para practicar.' : `${playing} jugadores en la cancha.`}
          </p>
          <ExitRoomLink to={GAME_HOME} wide />
        </section>

        <section className={own.controls}>
          <span className="label">Controles</span>
          <Controls />
        </section>

        <section className={`${styles.section} ${styles.chatSection}`}>
          <span className="label">Chat</span>
          <Chat compact fill />
        </section>
      </aside>
    </div>
  );
}
