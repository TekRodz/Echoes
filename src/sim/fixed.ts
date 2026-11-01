// Arithmétique entière déterministe. 1 case = 1 000 unités, 60 ticks/s.
// Aucune valeur flottante ne doit être stockée dans l'état de la simulation.

export const CELL = 1000;
export const TPS = 60;

/** Convertit des secondes en ticks (constantes de contenu uniquement). */
export const sec = (s: number): number => Math.round(s * TPS);
/** Convertit des cases/s en unités/tick (constantes de contenu uniquement). */
export const cps = (cellsPerSecond: number): number => Math.round((cellsPerSecond * CELL) / TPS);
/** Convertit des cases en unités. */
export const cells = (c: number): number => Math.round(c * CELL);

/** Division entière tronquée vers zéro. */
export const idiv = (a: number, b: number): number => Math.trunc(a / b);

/** Racine carrée entière exacte (plancher). */
export function isqrt(n: number): number {
  if (n <= 0) return 0;
  let x = Math.floor(Math.sqrt(n));
  while (x * x > n) x--;
  while ((x + 1) * (x + 1) <= n) x++;
  return x;
}

export const dist2 = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};

export const dist = (ax: number, ay: number, bx: number, by: number): number =>
  isqrt(dist2(ax, ay, bx, by));

/** Redimensionne le vecteur (dx, dy) à la longueur len. Vecteur nul -> [0, 0]. */
export function scaleTo(dx: number, dy: number, len: number): [number, number] {
  const m = isqrt(dx * dx + dy * dy);
  if (m === 0) return [0, 0];
  return [idiv(dx * len, m), idiv(dy * len, m)];
}

// Table d'angles précalculée (cos/sin × 1024), par pas de 15°.
const TRIG_STEP = 15;
const COS: readonly number[] = [1024, 989, 887, 724, 512, 265, 0, -265, -512, -724, -887, -989, -1024, -989, -887, -724, -512, -265, 0, 265, 512, 724, 887, 989];
const SIN: readonly number[] = [0, 265, 512, 724, 887, 989, 1024, 989, 887, 724, 512, 265, 0, -265, -512, -724, -887, -989, -1024, -989, -887, -724, -512, -265];

/** Tourne (dx, dy) d'un angle multiple de 15° (en degrés, positif = sens horaire à l'écran). */
export function rotate(dx: number, dy: number, degrees: number): [number, number] {
  const i = ((Math.round(degrees / TRIG_STEP) % 24) + 24) % 24;
  const c = COS[i] ?? 1024;
  const s = SIN[i] ?? 0;
  return [idiv(dx * c - dy * s, 1024), idiv(dx * s + dy * c, 1024)];
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
