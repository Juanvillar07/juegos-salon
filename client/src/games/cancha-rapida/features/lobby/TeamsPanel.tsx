import { useState, type DragEvent } from 'react';
import {
  MAX_PER_TEAM,
  SPECTATOR_COLOR,
  TEAM_NAMES,
  type PlayerInfo,
  type RoomState,
  type Side,
  type Team,
} from '@typeracer/shared/cancha-rapida';
import StatusTag from '../../../rally-de-letras/components/StatusTag';
import KickButton from '../../../../shell/KickButton';
import KitBadge from '../../components/KitBadge';
import { avatar } from '../../components/pitchStyle';
import { joinTeam, kickPlayer, movePlayer } from '../../state/store';
import KitEditor from './KitEditor';
import styles from './TeamsPanel.module.css';

/** Columnas de izquierda a derecha, como en la cancha: rojos atacan hacia la derecha. */
const COLUMNS: Team[] = ['red', 'spectator', 'blue'];

/** "1 partido", "3 partidos". */
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

interface Props {
  room: RoomState;
  myId: string;
  isHost: boolean;
}

/**
 * Equipos: los jugadores se arrastran de una columna a otra. Cada uno puede arrastrarse a sí
 * mismo (o usar "Unirme"); el host puede arrastrar a cualquiera y expulsar.
 */
export default function TeamsPanel({ room, myId, isHost }: Props) {
  const me = room.players.find((p) => p.id === myId)!;
  // Quién se está arrastrando y sobre qué columna (para resaltarla).
  const [dragId, setDragId] = useState<string | null>(null);
  const [overTeam, setOverTeam] = useState<Team | null>(null);
  // Equipo cuyo uniforme está editando el host.
  const [editingKit, setEditingKit] = useState<Side | null>(null);
  const dragged = dragId ? room.players.find((p) => p.id === dragId) : undefined;

  const count = (team: Team) => room.players.filter((p) => p.team === team).length;
  const isFull = (team: Team) => team !== 'spectator' && count(team) >= MAX_PER_TEAM;
  const canDrag = (p: PlayerInfo) => isHost || p.id === myId;
  const canDrop = (team: Team) => dragged !== undefined && dragged.team !== team && !isFull(team);

  const move = (player: PlayerInfo, team: Team) => {
    if (player.id === myId) void joinTeam(team);
    else void movePlayer(player.id, team);
  };

  const endDrag = () => {
    setDragId(null);
    setOverTeam(null);
  };

  const onDragOver = (e: DragEvent, team: Team) => {
    if (!canDrop(team)) return;
    // Permitir soltar aquí (por defecto el navegador no deja).
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overTeam !== team) setOverTeam(team);
  };

  const onDragLeave = (e: DragEvent<HTMLElement>, team: Team) => {
    // Solo cuando el puntero sale de la columna, no al pasar entre sus hijos.
    if (overTeam === team && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOverTeam(null);
  };

  const onDrop = (e: DragEvent, team: Team) => {
    e.preventDefault();
    if (dragged && canDrop(team)) move(dragged, team);
    endDrag();
  };

  return (
    <div className={`${styles.columns} ${dragged ? styles.dragging : ''}`}>
      {COLUMNS.map((team) => {
        const members = room.players.filter((p) => p.team === team);
        const full = isFull(team);
        const droppable = canDrop(team);
        const kit = team === 'spectator' ? null : room.kits[team];
        const columnClass = [
          styles.column,
          team === 'spectator' && styles.spectator,
          dragged && droppable && styles.droppable,
          dragged && !droppable && dragged.team !== team && styles.blocked,
          overTeam === team && styles.over,
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <section
            key={team}
            className={columnClass}
            aria-label={TEAM_NAMES[team]}
            // La franja de arriba lleva el color del uniforme.
            style={kit ? { boxShadow: `inset 0 3px 0 ${kit.primary}` } : undefined}
            onDragOver={(e) => onDragOver(e, team)}
            onDragLeave={(e) => onDragLeave(e, team)}
            onDrop={(e) => onDrop(e, team)}
          >
            <header className={styles.head}>
              <span className={styles.name}>
                {kit && <KitBadge kit={kit} size={20} />}
                {TEAM_NAMES[team]}
              </span>
              {kit && isHost && team !== 'spectator' && (
                <button
                  type="button"
                  className={styles.kitButton}
                  onClick={() => setEditingKit(team)}
                  title={`Cambiar el uniforme de ${TEAM_NAMES[team]}`}
                >
                  Uniforme
                </button>
              )}
              {team !== 'spectator' && (
                <span className={`num ${full ? styles.fullCount : 'muted'}`}>
                  {members.length}/{MAX_PER_TEAM}
                </span>
              )}
            </header>

            <ul className={styles.list}>
              {members.map((p) => {
                const draggable = canDrag(p);
                return (
                  <li
                    key={p.id}
                    className={[
                      styles.player,
                      p.id === myId && styles.mine,
                      draggable && styles.draggable,
                      p.id === dragId && styles.lifted,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    draggable={draggable}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', p.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDragId(p.id);
                    }}
                    onDragEnd={endDrag}
                    title={[
                      p.record.played > 0
                        ? `${plural(p.record.played, 'partido')} · ${plural(p.record.wins, 'victoria')} · ${plural(p.record.goals, 'gol', 'goles')} en esta sala`
                        : null,
                      draggable ? 'Arrastra a otra columna para cambiar de equipo' : null,
                    ]
                      .filter(Boolean)
                      .join('\n') || undefined}
                  >
                    {draggable && (
                      <span className={styles.grip} aria-hidden="true">
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                    {p.team === 'spectator' ? (
                      <span className={styles.avatar} style={{ background: SPECTATOR_COLOR }}>
                        {avatar(p.nickname)}
                      </span>
                    ) : (
                      <KitBadge kit={room.kits[p.team]} size={28}>
                        {avatar(p.nickname)}
                      </KitBadge>
                    )}
                    <span className={`nick ${styles.nick}`}>{p.nickname}</span>
                    {p.id === room.hostId && <span className="tag">host</span>}
                    {p.id === myId && <span className="tag me">tú</span>}
                    <StatusTag status={p.status} />
                    {isHost && p.id !== myId && (
                      <span className={styles.kick}>
                        <KickButton nickname={p.nickname} onKick={() => void kickPlayer(p.id)} />
                      </span>
                    )}
                  </li>
                );
              })}
              {/* Mientras se arrastra, cada columna dice si se puede soltar ahí. */}
              {dragged && dragged.team !== team && (
                <li className={styles.dropHint}>{droppable ? 'Suelta aquí' : 'Equipo completo'}</li>
              )}
              {!dragged && members.length === 0 && <li className={styles.empty}>Nadie todavía</li>}
            </ul>

            {me.team !== team && !dragged && (
              <button
                type="button"
                className={`btn ${styles.join}`}
                onClick={() => void joinTeam(team)}
                disabled={full}
                title={full ? 'Equipo completo' : undefined}
              >
                {team === 'spectator' ? 'Solo mirar' : full ? 'Completo' : 'Unirme'}
              </button>
            )}
          </section>
        );
      })}
      {editingKit && (
        <KitEditor
          team={editingKit}
          kit={room.kits[editingKit]}
          rival={room.kits[editingKit === 'red' ? 'blue' : 'red']}
          onClose={() => setEditingKit(null)}
        />
      )}
    </div>
  );
}
