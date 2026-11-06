import {
  BALL,
  FIELD,
  PLAYER,
  POSTS,
  POST_RADIUS,
  TEAM_NAMES,
  kitInk,
  kitShapes,
  type Disc,
  type Side,
  type TeamKit,
} from '@typeracer/shared/cancha-rapida';
import { PITCH } from '../../components/pitchStyle';
import type { View } from '../../lib/interpolation';

export interface PitchPlayer {
  nickname: string;
  avatar: string;
  kit: TeamKit;
}

/** Tamaño de todo lo dibujable (la cancha más el margen por donde pueden salir los jugadores). */
export const WORLD_WIDTH = FIELD.outerHalfWidth * 2;
export const WORLD_HEIGHT = FIELD.outerHalfHeight * 2;

/**
 * Dibuja la cancha en el canvas. Trabaja en coordenadas de la cancha (las de la física): la
 * transformación escala al tamaño del canvas, así líneas y textos crecen con él.
 */
export function drawPitch(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  view: View | null,
  players: Map<number, PitchPlayer>,
  kits: Record<Side, TeamKit>,
  mySlot: number | null,
  own: Disc | null,
  /** Carga del tiro propio (0–1), calculada en el cliente para que el aro se llene sin retraso. */
  ownCharge: number,
): void {
  const scale = Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.setTransform(scale, 0, 0, scale, width / 2, height / 2);

  drawField(ctx);
  if (!view) return;
  if (view.kickoff) drawKickoff(ctx, view.kickoff, kits[view.kickoff]);

  for (const [slot, p] of view.players) {
    const info = players.get(slot);
    if (!info) continue;
    const mine = slot === mySlot;
    drawPlayer(ctx, mine && own ? own : p, info, mine, p.kicking, mine ? ownCharge : p.charge);
  }
  drawDisc(ctx, view.ball, BALL.radius, PITCH.ball, 2);
}

function drawField(ctx: CanvasRenderingContext2D): void {
  const { halfWidth: W, halfHeight: H, goalHalfHeight: G, goalDepth: D } = FIELD;
  ctx.fillStyle = PITCH.outside;
  ctx.fillRect(-FIELD.outerHalfWidth, -FIELD.outerHalfHeight, WORLD_WIDTH, WORLD_HEIGHT);
  // El césped y sus franjas, recortados a la cancha con las esquinas redondeadas.
  ctx.save();
  fieldPath(ctx);
  ctx.clip();
  ctx.fillStyle = PITCH.grass;
  ctx.fillRect(-W, -H, W * 2, H * 2);
  ctx.fillStyle = PITCH.stripe;
  for (let x = -W; x < W; x += 120) ctx.fillRect(x, -H, 60, H * 2);
  ctx.restore();

  ctx.strokeStyle = PITCH.line;
  ctx.lineWidth = 3;
  fieldPath(ctx);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -H);
  ctx.lineTo(0, H);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, FIELD.centerRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Redes: fondo y laterales de cada portería.
  ctx.strokeStyle = PITCH.net;
  for (const side of [1, -1]) {
    ctx.beginPath();
    ctx.moveTo(side * W, -G);
    ctx.lineTo(side * (W + D), -G);
    ctx.lineTo(side * (W + D), G);
    ctx.lineTo(side * W, G);
    ctx.stroke();
  }
  for (const post of POSTS) drawDisc(ctx, { ...post, vx: 0, vy: 0 }, POST_RADIUS, PITCH.post, 2);
}

/** Contorno de la cancha: un rectángulo con las esquinas redondeadas (las mismas que la física). */
function fieldPath(ctx: CanvasRenderingContext2D): void {
  const { halfWidth: W, halfHeight: H, cornerRadius: C } = FIELD;
  ctx.beginPath();
  ctx.moveTo(-W + C, -H);
  ctx.arcTo(W, -H, W, H, C);
  ctx.arcTo(W, H, -W, H, C);
  ctx.arcTo(-W, H, -W, -H, C);
  ctx.arcTo(-W, -H, W, -H, C);
  ctx.closePath();
}

/** Saque pendiente: el círculo central toma el color del equipo que saca, con su nombre debajo. */
function drawKickoff(ctx: CanvasRenderingContext2D, team: Side, kit: TeamKit): void {
  ctx.beginPath();
  ctx.arc(0, 0, FIELD.centerRadius, 0, Math.PI * 2);
  // Un trazo claro debajo: así el color se ve aunque el uniforme sea verde como el césped.
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = kit.primary;
  ctx.stroke();
  const label = `SACA ${TEAM_NAMES[team].toUpperCase()}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 13px system-ui, sans-serif';
  // Contorno oscuro: el rótulo cae sobre la línea de medio campo y así se lee igual.
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(21, 21, 23, 0.6)';
  ctx.strokeText(label, 0, FIELD.centerRadius + 18);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, 0, FIELD.centerRadius + 18);
}

function drawDisc(ctx: CanvasRenderingContext2D, d: Disc, radius: number, fill: string, outline: number): void {
  ctx.beginPath();
  ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = outline;
  ctx.strokeStyle = PITCH.outline;
  ctx.stroke();
}

/** La camiseta: color principal y el diseño en el secundario, recortado al círculo del jugador. */
function drawKit(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, kit: TeamKit): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = kit.primary;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.fillStyle = kit.secondary;
  for (const shape of kitShapes(kit.pattern)) {
    ctx.beginPath();
    shape.forEach(([sx, sy], i) => (i === 0 ? ctx.moveTo(x + sx * r, y + sy * r) : ctx.lineTo(x + sx * r, y + sy * r)));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  d: Disc,
  info: PitchPlayer,
  mine: boolean,
  kicking: boolean,
  charge: number,
): void {
  const r = PLAYER.radius;
  // Tu jugador lleva un halo, para encontrarlo de un vistazo.
  if (mine) {
    ctx.beginPath();
    ctx.arc(d.x, d.y, r + 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fill();
  }
  drawKit(ctx, d.x, d.y, r, info.kit);
  ctx.beginPath();
  ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
  // Con patear pulsado, el borde se vuelve blanco (como en HaxBall).
  ctx.lineWidth = kicking ? 3 : 2;
  ctx.strokeStyle = kicking ? '#ffffff' : PITCH.outline;
  ctx.stroke();
  if (charge > 0) drawCharge(ctx, d, r, charge);

  // Iniciales del color que se lea sobre la camiseta, con un contorno por si caen sobre el diseño.
  const ink = kitInk(info.kit.primary);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 10.5px system-ui, sans-serif';
  ctx.lineWidth = 3;
  ctx.strokeStyle = ink === '#ffffff' ? 'rgba(21, 21, 23, 0.55)' : 'rgba(255, 255, 255, 0.6)';
  ctx.strokeText(info.avatar, d.x, d.y + 0.5);
  ctx.fillStyle = ink;
  ctx.fillText(info.avatar, d.x, d.y + 0.5);

  ctx.font = '500 11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText(info.nickname, d.x, d.y + r + 11);
}

/** Aro de carga del tiro: se llena desde arriba en el sentido de las agujas del reloj; lleno, en amarillo. */
function drawCharge(ctx: CanvasRenderingContext2D, d: Disc, r: number, charge: number): void {
  const start = -Math.PI / 2;
  ctx.beginPath();
  ctx.arc(d.x, d.y, r + 5, start, start + Math.PI * 2 * Math.min(1, charge));
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.strokeStyle = charge >= 1 ? '#ffd54a' : 'rgba(255, 255, 255, 0.9)';
  ctx.stroke();
  ctx.lineCap = 'butt';
}
