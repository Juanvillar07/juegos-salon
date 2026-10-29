/**
 * Física de la cancha, al estilo HaxBall: jugadores y balón son discos que aceleran, frenan por
 * rozamiento y chocan entre sí y con las paredes. Es pura y determinista (un paso = un tick):
 * el servidor la usa para simular, el cliente para predecir su propio jugador y los tests para
 * comprobarla. Las unidades son píxeles de la cancha y velocidades en píxeles por tick.
 */

/**
 * Medidas de la cancha (1040×480): algo mayor que la clásica de HaxBall (840×400), para que
 * con 4 por equipo haya sitio para moverse sin amontonarse.
 */
export const FIELD = {
  /** Mitad del ancho y del alto de la cancha: las líneas que el balón no cruza. */
  halfWidth: 520,
  halfHeight: 240,
  /** Mitad de la boca de cada portería y su profundidad (la red, detrás de la línea). */
  goalHalfHeight: 75,
  goalDepth: 32,
  /** Los jugadores pueden salir un poco de la línea, hasta aquí. */
  outerHalfWidth: 560,
  outerHalfHeight: 270,
  /** Círculo central (solo se dibuja). */
  centerRadius: 80,
} as const;

export const PLAYER = {
  radius: 15,
  invMass: 0.5,
  damping: 0.96,
  /** Aceleración por tick con una dirección pulsada; algo menor mientras se mantiene patear. */
  accel: 0.1,
  kickingAccel: 0.07,
  bounce: 0.5,
} as const;

export const BALL = { radius: 10, invMass: 1, damping: 0.99, bounce: 0.5 } as const;
export const POST_RADIUS = 8;
/** Rebote de paredes y postes (se multiplica por el del balón). */
const WALL_BOUNCE = 1;

export const KICK = {
  /** Impulso que recibe el balón. */
  strength: 5,
  /** Distancia máxima entre los bordes del jugador y del balón para poder patear. */
  reach: 4,
} as const;

/** Teclas como máscara de bits: es lo único que manda el cliente. */
export const KEY = { up: 1, down: 2, left: 4, right: 8, kick: 16 } as const;
const ALL_KEYS = 31;

export function isValidKeys(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= ALL_KEYS;
}

export type Side = 'red' | 'blue';

export interface Disc {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface PlayerBody extends Disc {
  id: string;
  team: Side;
  keys: number;
  /** Pulsó patear y todavía no pateó: una patada por pulsación (mantener no patea en ráfaga). */
  kickArmed: boolean;
}

export interface World {
  ball: Disc;
  players: PlayerBody[];
  /** Último jugador que tocó el balón: el autor del gol. */
  lastTouch: string | null;
}

/** Postes de las porterías: discos fijos en las esquinas de cada boca. */
export const POSTS: readonly { x: number; y: number }[] = [
  { x: FIELD.halfWidth, y: FIELD.goalHalfHeight },
  { x: FIELD.halfWidth, y: -FIELD.goalHalfHeight },
  { x: -FIELD.halfWidth, y: FIELD.goalHalfHeight },
  { x: -FIELD.halfWidth, y: -FIELD.goalHalfHeight },
];

/** Puestos de saque del equipo rojo (que ataca hacia la derecha); el azul es su reflejo. */
const KICKOFF_SPOTS: readonly [number, number][] = [
  [-240, 0],
  [-320, -110],
  [-320, 110],
  [-430, 0],
];

export function createWorld(players: { id: string; team: Side }[]): World {
  const world: World = {
    ball: { x: 0, y: 0, vx: 0, vy: 0 },
    players: players.map((p) => ({ id: p.id, team: p.team, x: 0, y: 0, vx: 0, vy: 0, keys: 0, kickArmed: false })),
    lastTouch: null,
  };
  resetKickoff(world);
  return world;
}

/** Coloca a todos en sus puestos de saque y el balón en el centro, quietos. */
export function resetKickoff(world: World): void {
  Object.assign(world.ball, { x: 0, y: 0, vx: 0, vy: 0 });
  world.lastTouch = null;
  for (const team of ['red', 'blue'] as const) {
    const mirror = team === 'red' ? 1 : -1;
    world.players
      .filter((p) => p.team === team)
      .forEach((p, i) => {
        const [x, y] = KICKOFF_SPOTS[i % KICKOFF_SPOTS.length];
        Object.assign(p, { x: x * mirror, y, vx: 0, vy: 0, kickArmed: false });
      });
  }
}

/** Nuevo estado de teclas de un jugador. Patear se "arma" al pulsar y se gasta al patear. */
export function setKeys(player: PlayerBody, keys: number): void {
  const kick = (keys & KEY.kick) !== 0;
  if (kick && (player.keys & KEY.kick) === 0) player.kickArmed = true;
  if (!kick) player.kickArmed = false;
  player.keys = keys;
}

/** Un paso de simulación. */
export function stepWorld(world: World): void {
  const { ball, players } = world;
  for (const p of players) accelerate(p);
  for (const p of players) {
    if (kick(p, ball)) world.lastTouch = p.id;
  }
  for (const p of players) move(p, PLAYER.damping);
  move(ball, BALL.damping);

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      collide(players[i], players[j], PLAYER.invMass, PLAYER.invMass, PLAYER.radius * 2, PLAYER.bounce ** 2);
    }
  }
  for (const p of players) {
    if (collide(p, ball, PLAYER.invMass, BALL.invMass, PLAYER.radius + BALL.radius, PLAYER.bounce * BALL.bounce)) {
      world.lastTouch = p.id;
    }
  }
  for (const post of POSTS) {
    const fixed = { ...post, vx: 0, vy: 0 };
    collide(fixed, ball, 0, BALL.invMass, POST_RADIUS + BALL.radius, BALL.bounce * WALL_BOUNCE);
    for (const p of players) collide(fixed, p, 0, PLAYER.invMass, POST_RADIUS + PLAYER.radius, PLAYER.bounce);
  }

  constrainBall(ball);
  for (const p of players) constrainPlayer(p);
}

/**
 * Paso de un jugador solo (sin choques): lo usa el cliente para que su propio jugador responda
 * al instante, antes de que llegue la posición del servidor.
 */
export function stepLonePlayer(player: PlayerBody): void {
  accelerate(player);
  move(player, PLAYER.damping);
  constrainPlayer(player);
}

/** Gol si el balón cruzó entero la línea dentro de una portería: anota el equipo que atacaba ese lado. */
export function detectGoal(world: World): Side | null {
  const limit = FIELD.halfWidth + BALL.radius;
  if (world.ball.x > limit) return 'red';
  if (world.ball.x < -limit) return 'blue';
  return null;
}

function accelerate(p: PlayerBody): void {
  const dx = (p.keys & KEY.right ? 1 : 0) - (p.keys & KEY.left ? 1 : 0);
  const dy = (p.keys & KEY.down ? 1 : 0) - (p.keys & KEY.up ? 1 : 0);
  if (dx === 0 && dy === 0) return;
  const len = Math.hypot(dx, dy);
  const accel = p.keys & KEY.kick ? PLAYER.kickingAccel : PLAYER.accel;
  p.vx += (dx / len) * accel;
  p.vy += (dy / len) * accel;
}

function move(d: Disc, damping: number): void {
  d.x += d.vx;
  d.y += d.vy;
  d.vx *= damping;
  d.vy *= damping;
}

/** Patada: con patear armado y el balón al alcance, el balón sale empujado desde el jugador. */
function kick(p: PlayerBody, ball: Disc): boolean {
  if (!p.kickArmed || (p.keys & KEY.kick) === 0) return false;
  const dx = ball.x - p.x;
  const dy = ball.y - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist - PLAYER.radius - BALL.radius > KICK.reach) return false;
  const nx = dist > 0 ? dx / dist : 1;
  const ny = dist > 0 ? dy / dist : 0;
  ball.vx += nx * KICK.strength * BALL.invMass;
  ball.vy += ny * KICK.strength * BALL.invMass;
  p.kickArmed = false;
  return true;
}

/**
 * Choque entre dos discos: se separan según su masa y, si se acercaban, rebotan.
 * Masa inversa 0 = disco fijo (los postes). Devuelve si se tocaron.
 */
function collide(a: Disc, b: Disc, invA: number, invB: number, minDist: number, bounce: number): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist2 = dx * dx + dy * dy;
  if (dist2 >= minDist * minDist) return false;
  const total = invA + invB;
  if (total === 0) return true;
  const dist = Math.sqrt(dist2);
  const nx = dist > 0 ? dx / dist : 1;
  const ny = dist > 0 ? dy / dist : 0;

  const overlap = minDist - dist;
  a.x -= nx * overlap * (invA / total);
  a.y -= ny * overlap * (invA / total);
  b.x += nx * overlap * (invB / total);
  b.y += ny * overlap * (invB / total);

  const approach = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (approach < 0) {
    const impulse = (-(1 + bounce) * approach) / total;
    a.vx -= nx * impulse * invA;
    a.vy -= ny * impulse * invA;
    b.vx += nx * impulse * invB;
    b.vy += ny * impulse * invB;
  }
  return true;
}

/** El balón rebota en las líneas, salvo por la boca de las porterías, donde lo contiene la red. */
function constrainBall(b: Disc): void {
  const r = BALL.radius;
  const bounce = BALL.bounce * WALL_BOUNCE;
  const { halfWidth: W, halfHeight: H, goalHalfHeight: G, goalDepth: D } = FIELD;
  const side = b.x < 0 ? -1 : 1;

  if (Math.abs(b.x) > W) {
    // Dentro de la portería: fondo y laterales de la red.
    if (Math.abs(b.x) > W + D - r) {
      b.x = side * (W + D - r);
      if (b.vx * side > 0) b.vx = -b.vx * bounce;
    }
    if (Math.abs(b.y) > G - r) {
      const s = Math.sign(b.y);
      b.y = s * (G - r);
      if (b.vy * s > 0) b.vy = -b.vy * bounce;
    }
    return;
  }
  if (Math.abs(b.y) > H - r) {
    const s = Math.sign(b.y);
    b.y = s * (H - r);
    if (b.vy * s > 0) b.vy = -b.vy * bounce;
  }
  // Fuera de la boca de la portería, la línea de fondo es una pared.
  if (Math.abs(b.y) > G && Math.abs(b.x) > W - r) {
    b.x = side * (W - r);
    if (b.vx * side > 0) b.vx = -b.vx * bounce;
  }
}

/** Los jugadores pueden salir un poco de la cancha, no más allá. */
function constrainPlayer(p: Disc): void {
  const r = PLAYER.radius;
  const maxX = FIELD.outerHalfWidth - r;
  const maxY = FIELD.outerHalfHeight - r;
  if (Math.abs(p.x) > maxX) {
    p.x = Math.sign(p.x) * maxX;
    p.vx = 0;
  }
  if (Math.abs(p.y) > maxY) {
    p.y = Math.sign(p.y) * maxY;
    p.vy = 0;
  }
}
