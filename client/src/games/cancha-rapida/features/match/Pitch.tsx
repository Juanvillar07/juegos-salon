import { useEffect, useRef, type MutableRefObject } from 'react';
import { KEY, KICK, TICK_MS, type RoomState } from '@typeracer/shared/cancha-rapida';
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
/** Tras un cambio de tamaño, cuánto se espera a que se quede quieto para cambiar la resolución. */
const RESOLUTION_SETTLE_MS = 150;

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

    /**
     * El canvas toma el mayor tamaño que quepa, a la resolución real de la pantalla.
     * Cambiar `canvas.width`/`height` borra el dibujo, y el observador corre justo antes de que
     * el navegador pinte: si se hiciera en cada cuadro de una transición (al abrir el chat), la
     * cancha se vería en blanco. Por eso, mientras el tamaño cambia, solo se ajusta el tamaño CSS
     * (el navegador escala el último dibujo) y la resolución se actualiza cuando se queda quieto,
     * redibujando en el acto.
     */
    let cssWidth = 0;
    let cssHeight = 0;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const applyResolution = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = Math.round(cssWidth * dpr);
      const height = Math.round(cssHeight * dpr);
      if (canvas.width === width && canvas.height === height) return;
      canvas.width = width;
      canvas.height = height;
      draw(performance.now());
    };
    const fit = () => {
      const scale = Math.min(wrap.clientWidth / WORLD_WIDTH, wrap.clientHeight / WORLD_HEIGHT);
      cssWidth = Math.floor(WORLD_WIDTH * scale);
      cssHeight = Math.floor(WORLD_HEIGHT * scale);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      clearTimeout(settle);
      settle = setTimeout(applyResolution, RESOLUTION_SETTLE_MS);
    };

    let predictor: Predictor | null = null;
    // Desde cuándo se mantiene patear (para el aro de carga propio, sin esperar al servidor).
    let chargeStart: number | null = null;
    let last = performance.now();
    let raf = 0;

    /** Un cuadro: predicción propia y dibujo (lo llama el bucle y, al cambiar la resolución, el ajuste). */
    const draw = (now: number) => {
      const elapsed = Math.min(Math.max(0, now - last), 100);
      last = now;
      const current = roomRef.current;
      const me = current.players.find((p) => p.id === myId);
      const mySlot = me?.slot ?? null;
      const players = new Map<number, PitchPlayer>();
      for (const p of current.players) {
        if (p.slot !== null && p.team !== 'spectator') {
          players.set(p.slot, { nickname: p.nickname, avatar: avatar(p.nickname), kit: current.kits[p.team] });
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
        // En un penalti, si soy el arquero, mi predicción tampoco sale del área (ni de la línea
        // antes de la patada); si soy el que tira y ya pateé, el servidor me deja quieto.
        const pen = current.penalties;
        const keeperSide = pen?.keeperId === myId ? me.team : null;
        const spent = pen?.shooterId === myId && pen.shotTaken;
        if (current.startAt === null || sNow >= current.startAt) {
          predictor.advance(elapsed, spent ? 0 : keys.current, latest.kickoff, keeperSide, !pen?.shotTaken);
        }
        // El servidor aplicará mis teclas de ahora dentro de medio viaje: se proyecta hasta ahí.
        const ahead = Math.min(MAX_AHEAD_MS, sNow + clock.roundTrip / 2 - latest.serverTime);
        predictor.correct(project(serverMe, ahead), elapsed);
      }

      // Con la patada clásica no hay carga (ni aro).
      if (current.settings.chargedShot && keys.current & KEY.kick) chargeStart ??= now;
      else chargeStart = null;
      const ownCharge = chargeStart === null ? 0 : Math.min(1, (now - chargeStart) / (KICK.chargeTicks * TICK_MS));

      drawPitch(ctx, canvas.width, canvas.height, view, players, current.kits, mySlot, predictor?.body ?? null, ownCharge);
    };

    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };

    // Primer ajuste con la resolución ya aplicada; después, cada cambio de tamaño pasa por `fit`.
    fit();
    clearTimeout(settle);
    applyResolution();
    const observer = new ResizeObserver(fit);
    observer.observe(wrap);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settle);
      observer.disconnect();
    };
  }, [myId, keys]);

  return (
    <div className={styles.pitchWrap} ref={wrapRef}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label="Cancha del partido" />
    </div>
  );
}
