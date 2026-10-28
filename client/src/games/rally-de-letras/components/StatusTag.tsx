import type { PlayerStatus } from '@typeracer/shared';

/** Etiqueta para jugadores que no están conectados normalmente. */
export default function StatusTag({ status }: { status: PlayerStatus }) {
  if (status === 'reconnecting') return <span className="tag warn">reconectando</span>;
  if (status === 'left') return <span className="tag danger">se fue</span>;
  return null;
}
