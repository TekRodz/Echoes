// mulberry32, état entier stocké dans l'état de jeu.
export function next(state: number): { value: number; state: number } {
  const s = (state + 0x6d2b79f5) | 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: (t ^ (t >>> 14)) >>> 0, state: s };
}

export interface HasRng {
  rng: number;
}

export function randInt(o: HasRng, n: number): number {
  const r = next(o.rng);
  o.rng = r.state;
  return r.value % n;
}

/** Mélange de Fisher-Yates seedé. */
export function shuffle<T>(o: HasRng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(o, i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function pick<T>(o: HasRng, arr: readonly T[]): T {
  return arr[randInt(o, arr.length)]!;
}

export function derive(seed: number, salt: number): number {
  return next((seed ^ Math.imul(salt + 1, 0x9e3779b1)) | 0).value;
}
