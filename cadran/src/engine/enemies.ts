// Automates : chaque tour, des intentions entièrement déterminées par (tour, phase, tirages seedés).
import type { EnemyId, Intent, IntentKind } from './types';

export interface EnemyDef {
  id: EnemyId;
  name: string;
  hp: number;
  tier: 'normal' | 'elite' | 'boss';
  text: string;
  /** Tour où sonne Minuit (6 par défaut). */
  minuit?: number;
  intents: (tour: number, phase: number, rolls: number[]) => Intent[];
}

const I = (cran: number, kind: IntentKind, value: number): Intent => ({ cran: ((cran % 12) + 12) % 12, kind, value });
const r = (rolls: number[], i: number, n: number): number => (rolls[i % rolls.length] ?? 0) % n;

/** Place n crans distincts à partir des tirages, en évitant `taken`. */
function spread(rolls: number[], salt: number, n: number, taken: Set<number>): number[] {
  const out: number[] = [];
  let k = 0;
  while (out.length < n && k < 200) {
    const c = r(rolls, salt + k * 7, 12);
    if (!taken.has(c)) {
      taken.add(c);
      out.push(c);
    }
    k++;
  }
  return out;
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  coucou: {
    id: 'coucou',
    name: 'Coucou',
    hp: 30,
    tier: 'normal',
    text: 'Frappe à heures fixes, un coup de plus chaque tour.',
    intents: (tour, _p, rolls) => {
      const taken = new Set<number>();
      const crans = [3 + r(rolls, 0, 6)];
      crans.forEach((c) => taken.add(c));
      for (let t = 2; t <= tour; t++) crans.push(...spread(rolls, 10 + t * 13, 1, taken));
      const v = 4 + Math.floor((tour - 1) / 2);
      return crans.map((c) => I(c, 'attack', v));
    },
  },
  metronome: {
    id: 'metronome',
    name: 'Métronome',
    hp: 28,
    tier: 'normal',
    text: 'Bat la mesure : chaque cran battu laissé vide te blesse. Il accélère au 3e tour.',
    intents: (tour, _p, rolls) => {
      const v = 2 + (tour >= 4 ? 1 : 0);
      const beats = tour >= 3 ? [1, 3, 5, 7, 9, 11] : [3, 7, 11];
      const out = beats.map((c) => I(c, 'gap', v));
      if (tour >= 2) out.push(I(2 * r(rolls, tour, 6), 'attack', 3 + tour));
      return out;
    },
  },
  sonnerie: {
    id: 'sonnerie',
    name: 'Sonnerie',
    hp: 36,
    tier: 'normal',
    text: 'Se charge sur 4 crans puis sonne fort. Annule une charge pour la faire taire.',
    intents: (tour, _p, rolls) => {
      if (tour === 1) return [I(3 + r(rolls, 0, 6), 'attack', 4)];
      const k = 1 + r(rolls, tour * 3, 6);
      const out = [0, 1, 2, 3].map((i) => I(k + i, 'charge', 0));
      out.push(I(k + 4, 'bigAttack', 9 + 3 * (tour - 2)));
      if (tour >= 3) out.push(I(k + 7, 'attack', 2 + tour));
      return out;
    },
  },
  remonteur: {
    id: 'remonteur',
    name: 'Remonteur',
    hp: 42,
    tier: 'elite',
    text: 'Se soigne et démonte chaque tour la carte posée sur un cran.',
    intents: (tour, _p, rolls) => {
      const taken = new Set<number>();
      const [a, b, h, e] = spread(rolls, tour * 17, 4, taken);
      const v = 5 + Math.floor(tour / 2);
      const out = [I(a!, 'attack', v), I(h!, 'heal', 3)];
      if (tour >= 2) out.push(I(e!, 'erase', 0));
      if (tour >= 4) out.push(I(b!, 'attack', v));
      return out;
    },
  },
  miroir: {
    id: 'miroir',
    name: 'Miroir',
    hp: 40,
    tier: 'elite',
    text: 'Te renvoie ton plus gros coup du tour précédent.',
    intents: (tour, _p, rolls) => {
      const copyAt = tour % 2 === 0 ? 11 : 5;
      const taken = new Set<number>([0, copyAt]);
      const [a, b] = spread(rolls, tour * 11, 2, taken);
      const v = 4 + Math.floor(tour / 2);
      const out = [I(0, 'block', 5), I(copyAt, 'copy', 3), I(a!, 'attack', v)];
      if (tour >= 4) out.push(I(b!, 'attack', v));
      return out;
    },
  },
  carillon: {
    id: 'carillon',
    name: 'Le Grand Carillon',
    hp: 90,
    tier: 'boss',
    minuit: 8,
    text: 'Trois phases. À chaque changement de phase, il fait tourner ton cadran d’un cran.',
    intents: (tour, phase, rolls) => {
      const s = Math.floor((tour - 1) / 2);
      if (phase === 0) return [I(2, 'attack', 5 + s), I(8, 'attack', 5 + s), ...(tour >= 3 ? [I(5, 'attack', 4 + s)] : [])];
      if (phase === 1) {
        const k = r(rolls, tour, 3);
        return [I(0, 'block', 8), I(2 + k, 'attack', 5 + s), I(8 + k, 'attack', 5 + s)];
      }
      const k = 1 + r(rolls, tour * 5, 4);
      return [...[0, 1, 2, 3].map((i) => I(k + i, 'charge', 0)), I(k + 4, 'bigAttack', 13 + 2 * s), I(k + 7, 'attack', 7 + s)];
    },
  },
};

export const NORMAL_POOL: EnemyId[] = ['coucou', 'metronome', 'sonnerie'];
export const ELITE_POOL: EnemyId[] = ['remonteur', 'miroir'];

/** Phase du boss selon ses PV restants. */
export function phaseFor(id: EnemyId, hp: number, maxHp: number): number {
  if (id !== 'carillon') return 0;
  if (hp > (maxHp * 2) / 3) return 0;
  if (hp > maxHp / 3) return 1;
  return 2;
}
