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
  /** Esquinas redondeadas: el balón no se queda atascado en ellas. */
  cornerRadius: 60,
} as const;

export const PLAYER = {
  /** Algo menores que en HaxBall (15): con 4 por equipo queda más sitio para moverse y pasar. */
  radius: 13,
  invMass: 0.5,
  damping: 0.96,
  /** Aceleración por tick con una dirección pulsada; algo menor mientras se carga el tiro. */
  accel: 0.11,
  kickingAccel: 0.07,
  bounce: 0.5,
} as const;

export const BALL = { radius: 10, invMass: 1, damping: 0.99, bounce: 0.5 } as const;
export const POST_RADIUS = 8;
/**
 * Antes de la patada del penalti el arquero está en la línea: llega de lado hasta tocar los
 * postes (así no choca con ellos, y la predicción del cliente, que no tiene postes, coincide).
 */
export const KEEPER_LINE_MAX_Y =
  FIELD.goalHalfHeight - Math.sqrt((PLAYER.radius + POST_RADIUS) ** 2 - PLAYER.radius ** 2);
/** Rebote de paredes y postes (se multiplica por el del balón). */
const WALL_BOUNCE = 1;
/**
 * Rebote entre jugador y balón cuando no se patea: bajo, para poder llevar el balón pegado sin
 * que salga despedido en cada toque (el tiro depende de patear).
 */
const DRIBBLE_BOUNCE = 0.1;
/** Dentro de la portería la red frena el balón y casi no rebota: "muere" en ella. */
const NET_DAMPING = 0.9;
const NET_BOUNCE = 0.2;

/**
 * Dos formas de patear, según elija el host en la sala:
 * - Tiro cargado: patear se carga mientras se mantiene la tecla y sale al soltarla. Un toque es
 *   un pase suave; con la carga completa, el tiro más fuerte. Si al soltar el balón no está al
 *   alcance, la patada espera un momento por si llega.
 * - Clásico (como HaxBall): mientras se mantiene patear, la patada sale al tocar el balón, siempre
 *   con la misma fuerza; una por pulsación.
 */
export const KICK = {
  /** Fuerza de un toque rápido y con la carga completa. */
  minPower: 3.5,
  maxPower: 8,
  /** Fuerza fija de la patada clásica (algo más que en HaxBall: la cancha es más larga). */
  classicPower: 6,
  /** Pasos manteniendo patear hasta la carga completa (unos 0,67 s). */
  chargeTicks: 40,
  /** Distancia máxima entre los bordes del jugador y del balón para poder patear. */
  reach: 4,
  /** Pasos que la patada espera al balón tras soltar la tecla (unos 150 ms). */
  graceTicks: 9,
  /** Efecto: giro por cada px/paso de velocidad lateral del jugador, con tope, y lo que se conserva por paso. */
  spinPerSpeed: 0.009,
  maxSpin: 0.014,
  spinDecay: 0.97,
} as const;

/** Fuerza del tiro según los pasos que se mantuvo patear. */
export function kickPower(chargeTicks: number): number {
  const charge = Math.min(1, chargeTicks / KICK.chargeTicks);
  return KICK.minPower + (KICK.maxPower - KICK.minPower) * charge;
}

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
  /** Pasos que lleva manteniendo patear (la carga del tiro); 0 si no la mantiene. */
  charge: number;
  /** Patada soltada que espera al balón: su fuerza y los pasos que le quedan. */
  pendingKick: { power: number; ticks: number } | null;
}

export interface World {
  ball: Disc;
  players: PlayerBody[];
  /** Último jugador que tocó el balón: el autor del gol. */
  lastTouch: string | null;
  /** Efecto del balón: cuánto gira su dirección en cada paso (radianes); 0 = va recto. */
  ballSpin: number;
  /**
   * Equipo que saca, hasta que toca el balón. Mientras tanto nadie cruza la línea de medio campo
   * y el rival no puede entrar en el círculo central. null = juego libre.
   */
  kickoff: Side | null;
  /** Con tiro cargado (true) o patada clásica de fuerza fija (false). */
  chargedShot: boolean;
  /** En un penalti, el arquero y la portería que defiende: no puede salir de su área. */
  keeper: { id: string; side: Side } | null;
  /**
   * En un penalti, el que tira, hasta que patea: mientras tanto el balón no se mueve del punto
   * (chocarlo con el cuerpo no lo empuja ni cuenta como tiro) y el arquero no sale de la línea.
   */
  penaltyShooter: string | null;
}

/** Penaltis: distancia del punto a la línea de gol y área en la que se mueve el arquero. */
export const PENALTY = {
  spotDistance: 150,
  /** Tras la patada, el arquero puede adelantarse hasta aquí desde la línea… */
  keeperDepth: 60,
  /** …y salirse de los postes hasta aquí. */
  keeperSideMargin: 25,
} as const;

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

/** El primer saque del partido es del equipo rojo. Por defecto, con tiro cargado. */
export function createWorld(players: { id: string; team: Side }[], { chargedShot = true } = {}): World {
  const world: World = {
    ball: { x: 0, y: 0, vx: 0, vy: 0 },
    players: players.map((p) => ({
      id: p.id,
      team: p.team,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      keys: 0,
      charge: 0,
      pendingKick: null,
    })),
    lastTouch: null,
    ballSpin: 0,
    kickoff: null,
    chargedShot,
    keeper: null,
    penaltyShooter: null,
  };
  resetKickoff(world, 'red');
  return world;
}

/**
 * Coloca a todos en sus puestos de saque y el balón en el centro, quietos, con el saque para
 * `kickoff`. Si ese equipo no tiene a nadie en la cancha (alguien practicando solo), juego libre.
 */
export function resetKickoff(world: World, kickoff: Side): void {
  Object.assign(world.ball, { x: 0, y: 0, vx: 0, vy: 0 });
  world.lastTouch = null;
  world.ballSpin = 0;
  world.kickoff = world.players.some((p) => p.team === kickoff) ? kickoff : null;
  for (const team of ['red', 'blue'] as const) {
    const mirror = team === 'red' ? 1 : -1;
    world.players
      .filter((p) => p.team === team)
      .forEach((p, i) => {
        const [x, y] = KICKOFF_SPOTS[i % KICKOFF_SPOTS.length];
        Object.assign(p, { x: x * mirror, y, vx: 0, vy: 0, charge: 0, pendingKick: null });
      });
  }
}

/**
 * Prepara un penalti: en la cancha solo quedan el que tira y el arquero. El balón en el punto de
 * penalti frente a la portería que ataca `team`, el que tira detrás y el arquero sobre la línea.
 */
export function setupPenalty(world: World, shooter: PlayerBody, keeper: PlayerBody, team: Side): void {
  // El rojo ataca la portería de la derecha.
  const side = team === 'red' ? 1 : -1;
  const spot = side * (FIELD.halfWidth - PENALTY.spotDistance);
  world.players = [shooter, keeper];
  Object.assign(world.ball, { x: spot, y: 0, vx: 0, vy: 0 });
  Object.assign(shooter, { x: spot - side * 45, y: 0, vx: 0, vy: 0, keys: 0, charge: 0, pendingKick: null });
  Object.assign(keeper, { x: side * (FIELD.halfWidth - PLAYER.radius), y: 0, vx: 0, vy: 0, keys: 0, charge: 0, pendingKick: null });
  world.lastTouch = null;
  world.ballSpin = 0;
  world.kickoff = null;
  world.keeper = { id: keeper.id, side: team === 'red' ? 'blue' : 'red' };
  world.penaltyShooter = shooter.id;
}

/**
 * El arquero de un penalti no sale de su área (delante de la portería que defiende `side`).
 * Con `onLine` (antes de la patada) solo se mueve sobre la línea, de lado a lado.
 */
export function constrainKeeper(p: Disc, side: Side, onLine = false): void {
  // El azul defiende la portería de la derecha.
  const s = side === 'blue' ? 1 : -1;
  const back = FIELD.halfWidth - PLAYER.radius;
  const front = FIELD.halfWidth - PENALTY.keeperDepth;
  const depth = p.x * s;
  if (onLine) {
    p.x = s * back;
    p.vx = 0;
  } else if (depth > back) {
    p.x = s * back;
    if (p.vx * s > 0) p.vx = 0;
  } else if (depth < front) {
    p.x = s * front;
    if (p.vx * s < 0) p.vx = 0;
  }
  const maxY = onLine ? KEEPER_LINE_MAX_Y : FIELD.goalHalfHeight + PENALTY.keeperSideMargin;
  if (Math.abs(p.y) > maxY) {
    p.y = Math.sign(p.y) * maxY;
    p.vy = 0;
  }
}

/**
 * Nuevo estado de teclas de un jugador.
 * - Tiro cargado: al soltar patear, la carga acumulada se convierte en una patada que sale en
 *   cuanto el balón esté al alcance (o se pierde tras unos pasos).
 * - Clásico: al pulsar patear queda una patada de fuerza fija lista mientras se mantenga la tecla;
 *   sale al tocar el balón y al soltar se descarta.
 */
export function setKeys(player: PlayerBody, keys: number, chargedShot = true): void {
  const wasKicking = (player.keys & KEY.kick) !== 0;
  const kicking = (keys & KEY.kick) !== 0;
  if (chargedShot) {
    if (wasKicking && !kicking) {
      player.pendingKick = { power: kickPower(player.charge), ticks: KICK.graceTicks };
      player.charge = 0;
    }
  } else if (kicking && !wasKicking) {
    player.pendingKick = { power: KICK.classicPower, ticks: Number.POSITIVE_INFINITY };
  } else if (!kicking) {
    player.pendingKick = null;
  }
  player.keys = keys;
}

/** Un paso de simulación. */
export function stepWorld(world: World): void {
  const { ball, players } = world;
  for (const p of players) {
    accelerate(p);
    if (world.chargedShot && p.keys & KEY.kick) p.charge = Math.min(p.charge + 1, KICK.chargeTicks);
  }
  for (const p of players) {
    // En un penalti, hasta la patada solo puede patear el que tira.
    if (world.penaltyShooter !== null && p.id !== world.penaltyShooter) continue;
    const spin = kick(p, ball);
    if (spin !== null) {
      world.lastTouch = p.id;
      world.ballSpin = spin;
      world.penaltyShooter = null;
    }
  }
  // El balón del penalti, aún sin patear, es como un poste: quien lo choca rebota.
  const ballInvMass = world.penaltyShooter !== null ? 0 : BALL.invMass;
  for (const p of players) move(p, PLAYER.damping);
  move(ball, BALL.damping);
  curve(world);

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      collide(players[i], players[j], PLAYER.invMass, PLAYER.invMass, PLAYER.radius * 2, PLAYER.bounce ** 2);
    }
  }
  // Un toque, un poste o una pared le quitan el efecto al balón.
  for (const p of players) {
    if (collide(p, ball, PLAYER.invMass, ballInvMass, PLAYER.radius + BALL.radius, DRIBBLE_BOUNCE) && ballInvMass > 0) {
      world.lastTouch = p.id;
      world.ballSpin = 0;
    }
  }
  for (const post of POSTS) {
    const fixed = { ...post, vx: 0, vy: 0 };
    if (collide(fixed, ball, 0, BALL.invMass, POST_RADIUS + BALL.radius, BALL.bounce * WALL_BOUNCE)) world.ballSpin = 0;
    for (const p of players) collide(fixed, p, 0, PLAYER.invMass, POST_RADIUS + PLAYER.radius, PLAYER.bounce);
  }

  // El saque termina en cuanto alguien toca el balón (solo puede el equipo que saca), o si
  // ese equipo se quedó sin jugadores.
  if (world.kickoff && (world.lastTouch !== null || !players.some((p) => p.team === world.kickoff))) {
    world.kickoff = null;
  }

  if (constrainBall(ball)) world.ballSpin = 0;
  for (const p of players) {
    constrainPlayer(p);
    if (world.kickoff) kickoffBarrier(p, world.kickoff);
    if (world.keeper?.id === p.id) constrainKeeper(p, world.keeper.side, world.penaltyShooter !== null);
  }
}

/**
 * Paso de un jugador solo (sin choques): lo usa el cliente para que su propio jugador responda
 * al instante, antes de que llegue la posición del servidor. Respeta la barrera del saque y, si
 * es el arquero de un penalti, su área (`keeperSide`: la portería que defiende; `keeperOnLine`:
 * aún no patearon, así que no sale de la línea).
 */
export function stepLonePlayer(
  player: PlayerBody,
  kickoff: Side | null = null,
  keeperSide: Side | null = null,
  keeperOnLine = false,
): void {
  accelerate(player);
  move(player, PLAYER.damping);
  constrainPlayer(player);
  if (kickoff) kickoffBarrier(player, kickoff);
  if (keeperSide) constrainKeeper(player, keeperSide, keeperOnLine);
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

/**
 * Patada pendiente: si el balón está al alcance, sale empujado desde el jugador con la fuerza de
 * la carga, y devuelve el efecto que lleva (según cómo se movía el jugador de lado). Si no, la
 * espera se va agotando. Devuelve null si no pateó.
 */
function kick(p: PlayerBody, ball: Disc): number | null {
  const pending = p.pendingKick;
  if (!pending) return null;
  const dx = ball.x - p.x;
  const dy = ball.y - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist - PLAYER.radius - BALL.radius > KICK.reach) {
    pending.ticks--;
    if (pending.ticks <= 0) p.pendingKick = null;
    return null;
  }
  const nx = dist > 0 ? dx / dist : 1;
  const ny = dist > 0 ? dy / dist : 0;
  ball.vx += nx * pending.power * BALL.invMass;
  ball.vy += ny * pending.power * BALL.invMass;
  p.pendingKick = null;
  // Velocidad lateral del jugador respecto al tiro (producto vectorial): el balón curva hacia ese lado.
  const lateral = nx * p.vy - ny * p.vx;
  return Math.max(-KICK.maxSpin, Math.min(KICK.maxSpin, lateral * KICK.spinPerSpeed));
}

/** El efecto gira la dirección del balón un poco en cada paso (sin cambiar su rapidez) y se va perdiendo. */
function curve(world: World): void {
  const spin = world.ballSpin;
  if (spin === 0) return;
  const { ball } = world;
  const cos = Math.cos(spin);
  const sin = Math.sin(spin);
  const vx = ball.vx * cos - ball.vy * sin;
  ball.vy = ball.vx * sin + ball.vy * cos;
  ball.vx = vx;
  world.ballSpin = Math.abs(spin) < 1e-4 ? 0 : spin * KICK.spinDecay;
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

/**
 * El balón rebota en las líneas (con las esquinas redondeadas), salvo por la boca de las
 * porterías, donde lo contiene la red. Devuelve si rebotó en algo.
 */
function constrainBall(b: Disc): boolean {
  const r = BALL.radius;
  const bounce = BALL.bounce * WALL_BOUNCE;
  const { halfWidth: W, halfHeight: H, goalHalfHeight: G, goalDepth: D, cornerRadius: C } = FIELD;
  const side = b.x < 0 ? -1 : 1;
  let hit = false;

  if (Math.abs(b.x) > W) {
    // Dentro de la portería la red frena el balón y casi no rebota. Solo cuando ya cruzó la línea
    // entero (ya es gol): si frenara antes, un balón lento se quedaría parado sobre la línea.
    if (Math.abs(b.x) > W + r) {
      b.vx *= NET_DAMPING;
      b.vy *= NET_DAMPING;
    }
    if (Math.abs(b.x) > W + D - r) {
      b.x = side * (W + D - r);
      if (b.vx * side > 0) b.vx = -b.vx * NET_BOUNCE;
      hit = true;
    }
    if (Math.abs(b.y) > G - r) {
      const s = Math.sign(b.y);
      b.y = s * (G - r);
      if (b.vy * s > 0) b.vy = -b.vy * NET_BOUNCE;
      hit = true;
    }
    return hit;
  }

  // Esquina redondeada: el balón se mantiene dentro del arco y rebota según su normal.
  const cx = W - C;
  const cy = H - C;
  if (Math.abs(b.x) > cx && Math.abs(b.y) > cy) {
    const sy = b.y < 0 ? -1 : 1;
    const dx = Math.abs(b.x) - cx;
    const dy = Math.abs(b.y) - cy;
    const dist = Math.hypot(dx, dy);
    const limit = C - r;
    if (dist > limit) {
      const nx = (dx / dist) * side;
      const ny = (dy / dist) * sy;
      b.x = side * cx + nx * limit;
      b.y = sy * cy + ny * limit;
      const outward = b.vx * nx + b.vy * ny;
      if (outward > 0) {
        b.vx -= (1 + bounce) * outward * nx;
        b.vy -= (1 + bounce) * outward * ny;
      }
      hit = true;
    }
  }

  if (Math.abs(b.y) > H - r) {
    const s = Math.sign(b.y);
    b.y = s * (H - r);
    if (b.vy * s > 0) b.vy = -b.vy * bounce;
    hit = true;
  }
  // Fuera de la boca de la portería, la línea de fondo es una pared.
  if (Math.abs(b.y) > G && Math.abs(b.x) > W - r) {
    b.x = side * (W - r);
    if (b.vx * side > 0) b.vx = -b.vx * bounce;
    hit = true;
  }
  return hit;
}

/**
 * Barrera del saque: cada uno se queda en su mitad; el equipo que saca puede entrar en el
 * círculo central (para llegar al balón) y el rival no.
 */
function kickoffBarrier(p: PlayerBody, kicking: Side): void {
  const r = PLAYER.radius;
  const R = FIELD.centerRadius;
  // Lado propio: los rojos defienden la izquierda (x negativa) y los azules la derecha.
  const own = p.team === 'red' ? -1 : 1;
  const dist = Math.hypot(p.x, p.y);
  const intrudes = p.x * own < r;

  if (p.team !== kicking) {
    if (intrudes) {
      p.x = own * r;
      if (p.vx * own < 0) p.vx = 0;
    }
    const d = Math.hypot(p.x, p.y);
    if (d < R + r) pushRadially(p, d, R + r, own);
    return;
  }
  // El que saca solo puede pasar la línea dentro del círculo.
  if (!intrudes || dist <= R - r) return;
  if (Math.abs(p.y) < R) {
    pushRadially(p, dist, R - r, own);
  } else {
    p.x = own * r;
    if (p.vx * own < 0) p.vx = 0;
  }
}

/** Lleva el disco a `radius` del centro por la misma recta y quita la velocidad hacia fuera de ella. */
function pushRadially(p: Disc, dist: number, radius: number, fallbackSide: number): void {
  const nx = dist > 0 ? p.x / dist : fallbackSide;
  const ny = dist > 0 ? p.y / dist : 0;
  p.x = nx * radius;
  p.y = ny * radius;
  const radial = p.vx * nx + p.vy * ny;
  // Hacia fuera si está dentro del círculo y debía salir, hacia dentro si debía quedarse en él.
  const wrongWay = radius > dist ? radial < 0 : radial > 0;
  if (wrongWay) {
    p.vx -= radial * nx;
    p.vy -= radial * ny;
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
