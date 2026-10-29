import { useEffect, useRef, type MutableRefObject } from 'react';
import type { RoomState } from '@typeracer/shared/cancha-rapida';
import { avatar } from '../../components/pitchStyle';
import { project } from '../../lib/interpolation';
import { Predictor } from '../../lib/prediction';
import { clock, frames, serverNow } from '../../state/store';
import { WORLD_HEIGHT, WORLD_WIDTH, drawPitch, type PitchPlayer } from './render';
import styles from './MatchView.module.css';

/** Margen mínimo de interpolación; con más ping se dibuja un poco más atrás. */
const MIN_DELAY_MS = 80;
const MAX_DELAY_MS = 250;
/** No se proyecta la posición del servidor más allá de esto (si dejan de llegar instantáneas). */
const MAX_AHEAD_MS = 250;

interface Props {
  room: RoomState;
  myId: string;
  /** Teclas actuales del jugador propio (para predecir su movimiento). */
  keys: MutableRefObject<number>;
}

/**
 * La cancha en un canvas, redibujada en cada cuadro del navegador:
 * - los demás jugadores y el balón, interpolados un poco en el pasado (se ven suaves);
 * - el jugador propio, predicho en el presente con sus teclas (responde al instante) y
 *   corregido poco a poco hacia la posición del servidor.
 */
export default function Pitch({ room, myId, keys }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // El bucle de dibujo vive fuera de React: lee la sala más reciente por una ref.
  const roomRef = useRef(room);
  roomRef.current = room;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // El canvas toma el mayor tamaño 2:1 que quepa, a la resolución real de la pantalla.
    const resize = () => {
      const scale = Math.min(wrap.clientWidth / WORLD_WIDTH, wrap.clientHeight / WORLD_HEIGHT);
      const cssWidth = Math.floor(WORLD_WIDTH * scale);
      const cssHeight = Math.floor(WORLD_HEIGHT * scale);
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    let predictor: Predictor | null = null;
    let last = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const elapsed = Math.min(now - last, 100);
      last = now;
      const current = roomRef.current;
      const me = current.players.find((p) => p.id === myId);
      const mySlot = me?.slot ?? null;
      const players = new Map<number, PitchPlayer>();
      for (const p of current.players) {
        if (p.slot !== null && p.team !== 'spectator') {
          players.set(p.slot, { nickname: p.nickname, avatar: avatar(p.nickname), team: p.team });
        }
      }

      const sNow = serverNow();
      const delay = Math.min(MAX_DELAY_MS, Math.max(MIN_DELAY_MS, clock.roundTrip / 2 + 60));
      const view = frames.viewAt(sNow - delay);

      // Predicción propia: solo si juego en este partido y ya llegó mi posición del servidor.
      const latest = frames.latest;
      const serverMe = mySlot !== null ? latest?.players.get(mySlot) : undefined;
      if (latest && serverMe && me && me.team !== 'spectator') {
        predictor ??= new Predictor(myId, me.team, serverMe);
        // Durante la cuenta atrás la cancha está quieta: no se predice movimiento.
        if (current.startAt === null || sNow >= current.startAt) predictor.advance(elapsed, keys.current);
        // El servidor aplicará mis teclas de ahora dentro de medio viaje: se proyecta hasta ahí.
        const ahead = Math.min(MAX_AHEAD_MS, sNow + clock.roundTrip / 2 - latest.serverTime);
        predictor.correct(project(serverMe, ahead), elapsed);
      }

      drawPitch(ctx, canvas.width, canvas.height, view, players, mySlot, predictor?.body ?? null);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [myId, keys]);

  return (
    <div className={styles.pitchWrap} ref={wrapRef}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label="Cancha del partido" />
    </div>
  );
}
