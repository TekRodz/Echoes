// PRNG seedé (mulberry32). L'état est un entier stocké dans le monde.

export function mulberry32(state: number): { value: number; state: number } {
  const next = (state + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = (t ^ (t >>> 14)) >>> 0;
  return { value, state: next };
}

export interface HasRng {
  rng: number;
}

/** Entier uniforme dans [0, n). */
export function randInt(w: HasRng, n: number): number {
  const r = mulberry32(w.rng);
  w.rng = r.state;
  return r.value % n;
}

/** Entier uniforme dans [lo, hi]. */
export function randRange(w: HasRng, lo: number, hi: number): number {
  return lo + randInt(w, hi - lo + 1);
}

/** Dérive une seed à partir d'une seed et d'un sel (pour les salles d'une run). */
export function deriveSeed(seed: number, salt: number): number {
  return mulberry32((seed ^ Math.imul(salt + 1, 0x9e3779b1)) | 0).value;
}
