import { CELL, sec } from '../fixed';
import type { EnemyKind } from '../types';

export type Objective = 'eliminate' | 'survive' | 'activate';

export interface SpawnDef {
  tick: number;
  kind: EnemyKind;
  x: number;
  y: number;
}

export interface RoomDef {
  id: string;
  name: string;
  objective: Objective;
  objectiveText: string;
  hint: string;
  /** Boucles maximales dans la salle. */
  maxLoops: number;
  /** Nombre minimal de boucles visé (3 étoiles). */
  par: number;
  cols: number;
  rows: number;
  walls: [number, number][];
  levers: [number, number][];
  leverHold: number;
  spawns: SpawnDef[];
  startX: number;
  startY: number;
}

export const LOOP_TICKS = sec(20);
export const GRID_COLS = 6;
export const GRID_ROWS = 8;

/** Centre de la case (col, row) en unités. */
const c = (col: number): number => Math.round(col * CELL + CELL / 2);
const at = (t: number, kind: EnemyKind, col: number, row: number): SpawnDef => ({ tick: sec(t), kind, x: c(col), y: c(row) });

const base = {
  cols: GRID_COLS,
  rows: GRID_ROWS,
  startX: 3 * CELL,
  startY: 7 * CELL + 300,
  leverHold: sec(0.5),
};

export const ROOMS: RoomDef[] = [
  {
    ...base,
    id: 'vestibule',
    name: 'Le Vestibule',
    objective: 'activate',
    objectiveText: 'Tenir les 2 leviers en même temps',
    hint: 'Un seul corps ne peut pas tout tenir. Ta boucle suivante, si.',
    maxLoops: 3,
    par: 2,
    walls: [[2, 3], [3, 3]],
    levers: [[0, 0], [5, 0]],
    spawns: [at(7, 'minion', 2, 0), at(7, 'minion', 3, 0), at(13, 'minion', 0, 4), at(13, 'minion', 5, 4)],
  },
  {
    ...base,
    id: 'rouages',
    name: 'La Salle des Rouages',
    objective: 'eliminate',
    objectiveText: 'Éliminer tous les ennemis',
    hint: 'Si ta cible meurt plus tôt, ton clone devient un paradoxe.',
    maxLoops: 3,
    par: 2,
    walls: [[1, 4], [4, 4]],
    levers: [],
    spawns: [
      at(0, 'minion', 1, 1), at(0, 'minion', 4, 1), at(0, 'minion', 2, 0),
      at(4, 'shooter', 0, 0), at(4, 'shooter', 5, 0),
      at(8, 'brute', 3, 0),
      at(12, 'minion', 0, 2), at(12, 'minion', 5, 2), at(12, 'minion', 3, 0),
    ],
  },
  {
    ...base,
    id: 'veille',
    name: 'La Veille',
    objective: 'survive',
    objectiveText: 'Survivre jusqu’à la fin d’une boucle',
    hint: 'Tes clones peuvent encaisser pour toi.',
    maxLoops: 3,
    par: 2,
    walls: [[1, 2], [4, 2], [1, 5], [4, 5]],
    levers: [],
    spawns: [
      at(0, 'minion', 0, 0), at(0, 'minion', 5, 0), at(0, 'minion', 3, 0),
      at(2, 'brute', 2, 0),
      at(4, 'shooter', 0, 3), at(4, 'shooter', 5, 3),
      at(6, 'minion', 0, 7), at(6, 'minion', 5, 7),
      at(9, 'minion', 0, 0), at(9, 'minion', 5, 0), at(9, 'minion', 3, 0),
      at(11, 'brute', 3, 0),
      at(13, 'minion', 0, 4), at(13, 'minion', 5, 4),
      at(16, 'minion', 2, 0), at(16, 'minion', 3, 0),
    ],
  },
];
