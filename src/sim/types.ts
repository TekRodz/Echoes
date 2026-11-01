// Modèle de données central de la simulation (cf. GDD, « Spécifications techniques »).

export type Tick = number;
export type PlayerId = number;
export type ClassId = 'tank' | 'archer' | 'healer' | 'trapper';
export type EnemyKind = 'minion' | 'shooter' | 'brute';
export type Side = 'ally' | 'enemy';

/** Déplacement quantifié -127..127. */
export interface InputFrame {
  tick: Tick;
  moveX: number;
  moveY: number;
  ability: boolean;
}

export interface ActionEvent {
  tick: Tick;
  kind: 'basic' | 'ability';
  targetId: number | null;
}

export interface CloneRecord {
  loopIndex: number;
  classId: ClassId;
  ownerId: PlayerId;
  inputs: InputFrame[];
  actions: ActionEvent[];
  /** Positions après chaque tick, à plat : [x0, y0, x1, y1, …]. Sert au rendu des trajets et à la détection de blocage. */
  path: number[];
  /** Nombre de ticks enregistrés (fin du chrono ou mort). */
  endTick: Tick;
}

export type BruteState = 'walk' | 'windup' | 'charge';
export type ParadoxReason = 'target' | 'blocked';

export interface Unit {
  id: number;
  side: Side;
  kind: ClassId | EnemyKind;
  alive: boolean;
  x: number;
  y: number;
  /** Position au tick précédent (interpolation du rendu, détection de blocage). */
  px: number;
  py: number;
  r: number;
  hp: number;
  maxHp: number;
  shield: number;
  shieldTicks: number;
  /** Direction de regard, normalisée à 1 000. */
  fx: number;
  fy: number;
  basicCd: number;
  abilityCd: number;

  // Alliés
  /** -1 = joueur actif, sinon numéro de boucle (0-based) du clone. */
  cloneIndex: number;
  paradox: boolean;
  paradoxTick: Tick;
  lostX: number;
  lostY: number;
  blockedTicks: number;
  provokeTicks: number;
  actionPtr: number;

  // Ennemis
  targetId: number;
  rootTicks: number;
  state: BruteState;
  stateTicks: number;
  chargeDx: number;
  chargeDy: number;
  hitIds: number[];
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  ticks: number;
  dmg: number;
  /** Camp touché : 'enemy', 'ally' ou 'any' (projectile d'un paradoxe). */
  hits: Side | 'any';
  ownerId: number;
  r: number;
}

export interface Trap {
  id: number;
  kind: 'trap' | 'mine';
  x: number;
  y: number;
  ticks: number;
  ownerId: number;
  /** Posé par un paradoxe : touche tout le monde. */
  wild: boolean;
}

export type SimEvent =
  | { type: 'spawn'; id: number }
  | { type: 'death'; id: number; x: number; y: number }
  | { type: 'fade'; id: number }
  | { type: 'hit'; from: number; to: number; amount: number; x: number; y: number }
  | { type: 'shot'; from: number; to: number; x1: number; y1: number; x2: number; y2: number }
  | { type: 'heal'; from: number; to: number; amount: number }
  | { type: 'shield'; from: number; to: number }
  | { type: 'taunt'; id: number }
  | { type: 'volley'; id: number }
  | { type: 'trap'; id: number; x: number; y: number }
  | { type: 'snap'; x: number; y: number }
  | { type: 'boom'; x: number; y: number; r: number }
  | { type: 'enemyShot'; id: number }
  | { type: 'charge'; id: number }
  | { type: 'paradox'; id: number; cloneIndex: number; reason: ParadoxReason; x: number; y: number; lostX: number; lostY: number }
  | { type: 'levers'; held: number; total: number };

export type Outcome = null | 'win' | 'playerDead' | 'timeUp';
