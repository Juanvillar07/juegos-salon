import {
  BALL,
  FIELD,
  PLAYER,
  POSTS,
  POST_RADIUS,
  TEAM_COLORS,
  type Disc,
  type Side,
} from '@typeracer/shared/cancha-rapida';
import { PITCH } from '../../components/pitchStyle';
import type { View } from '../../lib/interpolation';

export interface PitchPlayer {
  nickname: string;
  avatar: string;
  team: Side;
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
  mySlot: number | null,
  own: Disc | null,
): void {
  const scale = Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.setTransform(scale, 0, 0, scale, width / 2, height / 2);

  drawField(ctx);
  if (!view) return;

  for (const [slot, p] of view.players) {
    const info = players.get(slot);
    if (!info) continue;
    const mine = slot === mySlot;
    drawPlayer(ctx, mine && own ? own : p, info, mine, p.kicking);
  }
  drawDisc(ctx, view.ball, BALL.radius, PITCH.ball, 2);
}

function drawField(ctx: CanvasRenderingContext2D): void {
  const { halfWidth: W, halfHeight: H, goalHalfHeight: G, goalDepth: D } = FIELD;
  ctx.fillStyle = PITCH.outside;
  ctx.fillRect(-FIELD.outerHalfWidth, -FIELD.outerHalfHeight, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.fillStyle = PITCH.grass;
  ctx.fillRect(-W, -H, W * 2, H * 2);
  ctx.fillStyle = PITCH.stripe;
  for (let x = -W; x < W; x += 120) ctx.fillRect(x, -H, 60, H * 2);

  ctx.strokeStyle = PITCH.line;
  ctx.lineWidth = 3;
  ctx.strokeRect(-W, -H, W * 2, H * 2);
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

function drawDisc(ctx: CanvasRenderingContext2D, d: Disc, radius: number, fill: string, outline: number): void {
  ctx.beginPath();
  ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = outline;
  ctx.strokeStyle = PITCH.outline;
  ctx.stroke();
}

function drawPlayer(ctx: CanvasRenderingContext2D, d: Disc, info: PitchPlayer, mine: boolean, kicking: boolean): void {
  const r = PLAYER.radius;
  // Tu jugador lleva un halo, para encontrarlo de un vistazo.
  if (mine) {
    ctx.beginPath();
    ctx.arc(d.x, d.y, r + 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
  ctx.fillStyle = TEAM_COLORS[info.team];
  ctx.fill();
  // Con patear pulsado, el borde se vuelve blanco (como en HaxBall).
  ctx.lineWidth = kicking ? 3 : 2;
  ctx.strokeStyle = kicking ? '#ffffff' : PITCH.outline;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.fillText(info.avatar, d.x, d.y + 0.5);

  ctx.font = '500 11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText(info.nickname, d.x, d.y + r + 11);
}
