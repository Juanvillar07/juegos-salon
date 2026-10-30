import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import JoinForm from '../../../rally-de-letras/features/room/JoinForm';
import { getTabNickname } from '../../lib/storage';
import { joinRoom, useClientState } from '../../state/store';
import Lobby from '../lobby/Lobby';
import MatchView from '../match/MatchView';
import Results from '../results/Results';
import { GAME_HOME } from '../../routes';
import Toasts from './Toasts';
import { ConnectingCard } from '../../../../shell/MaintenanceNotice';

export default function RoomPage() {
  const code = (useParams().code ?? '').toUpperCase();
  const { connected, sessionReady, replaced, myId, room } = useClientState();
  // Nickname con el que esta pestaña entró. Si llegó por enlace directo, se pide con un formulario.
  const [nickname, setNickname] = useState(getTabNickname);
  const [joinError, setJoinError] = useState<string | null>(null);

  const inRoom = room?.code === code;

  // Solo se manda room:join cuando el servidor confirmó la sesión y no nos reincorporó él mismo.
  useEffect(() => {
    if (!sessionReady || inRoom || !nickname || joinError) return;
    let cancelled = false;
    joinRoom(code, nickname).then((res) => {
      if (!cancelled && !res.ok) setJoinError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionReady, inRoom, nickname, code, joinError]);

  if (replaced) {
    return (
      <Message title="Abriste esta partida en otra pestaña">
        <p className="muted">Sigue jugando desde la pestaña nueva, o recarga esta para volver a tomar el control.</p>
      </Message>
    );
  }

  if (inRoom && room && myId) {
    const isHost = room.hostId === myId;
    return (
      <>
        <Toasts />
        {!connected && <p className="tag warn">Reconectando con el servidor…</p>}
        {room.phase === 'lobby' && <Lobby room={room} myId={myId} isHost={isHost} />}
        {room.phase === 'playing' && <MatchView key={room.startAt} room={room} myId={myId} isHost={isHost} />}
        {room.phase === 'finished' && <Results room={room} myId={myId} isHost={isHost} />}
      </>
    );
  }

  if (joinError) {
    return (
      <Message title={`No pudiste entrar a la sala ${code}`}>
        <p className="error">{joinError}</p>
        <Link to={GAME_HOME} className="btn primary">
          Volver al inicio
        </Link>
      </Message>
    );
  }

  if (sessionReady && !nickname) return <JoinForm code={code} onSubmit={setNickname} />;

  return <ConnectingCard sessionReady={sessionReady} />;
}

function Message({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card narrow">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
