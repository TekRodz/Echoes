import { cells, cps, sec } from '../fixed';
import type { EnemyKind } from '../types';

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  hp: number;
  radius: number;
  speed: number;
  dmg: number;
  cd: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  minion: { kind: 'minion', name: 'Sbire', hp: 40, radius: 330, speed: cps(2.2), dmg: 8, cd: sec(1) },
  shooter: { kind: 'shooter', name: 'Tireur', hp: 30, radius: 320, speed: cps(1.6), dmg: 10, cd: sec(1.5) },
  brute: { kind: 'brute', name: 'Brute', hp: 150, radius: 450, speed: cps(1), dmg: 25, cd: sec(4) },
};

export const SHOOTER = {
  keepMin: cells(4.2),
  keepMax: cells(5.2),
  fireRange: cells(6.5),
  bulletSpeed: cps(5),
  bulletTicks: sec(1.8),
};

export const BRUTE = {
  windup: sec(0.6),
  chargeTicks: sec(0.8),
  chargeSpeed: cps(7),
  contactCd: sec(1),
  contactDmg: 10,
};
