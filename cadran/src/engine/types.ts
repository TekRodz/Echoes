// Modèle de données du moteur de Cadran : pur, sérialisable (JSON), déterministe.

export type Archetype = 'base' | 'precision' | 'engrenage' | 'ressort' | 'rare';
export type Rarity = 'commune' | 'peu commune' | 'rare';

export interface CardInst {
  uid: number;
  id: string;
  tempered: boolean;
  /** Tension accumulée (Ressort), conservée tant que la carte reste sur le cadran. */
  tension: number;
  /** Nombre de tours passés sur le cadran (Spirale). */
  turns: number;
}

export type IntentKind = 'attack' | 'block' | 'heal' | 'charge' | 'bigAttack' | 'gap' | 'erase' | 'copy';

export interface Intent {
  /** 0..11 = crans 1 à 12. */
  cran: number;
  kind: IntentKind;
  value: number;
}

export interface Fighter {
  hp: number;
  maxHp: number;
  block: number;
}

export type EnemyId = 'coucou' | 'metronome' | 'sonnerie' | 'remonteur' | 'miroir' | 'carillon';
export type RelicId = 'echappement' | 'complication' | 'verre' | 'contrepoids' | 'remontoir' | 'spiral' | 'fusee' | 'sablier';

export interface CombatState {
  seed: number;
  rng: number;
  tour: number;
  dial: (CardInst | null)[];
  draw: CardInst[];
  discard: CardInst[];
  hand: CardInst[];
  player: Fighter;
  enemy: Fighter & { id: EnemyId; phase: number; rolls: number[] };
  relics: RelicId[];
  coupleMax: number;
  actionsLeft: number;
  extraDraw: number;
  /** Plus gros coup d'une seule carte au tour précédent (Miroir). */
  lastBestHit: number;
  /** Rotation du cadran à appliquer au prochain rembobinage (Grand Carillon). */
  rotatePending: number;
  outcome: null | 'win' | 'lose';
}

export type StepEvent =
  | { t: 'hit'; cran: number; v: number; blocked: number }
  | { t: 'hurt'; v: number; blocked: number; cran: number }
  | { t: 'block'; who: 'player' | 'enemy'; v: number }
  | { t: 'parry'; reflect: number }
  | { t: 'heal'; v: number }
  | { t: 'annul'; intentCran: number }
  | { t: 'fizzle' }
  | { t: 'gapBlocked' }
  | { t: 'erase'; uid: number }
  | { t: 'move'; from: number; to: number }
  | { t: 'tension'; v: number }
  | { t: 'rust'; v: number };

export interface CranStep {
  cran: number;
  events: StepEvent[];
  enemyActed: boolean;
  player: Fighter;
  enemy: Fighter;
  /** Positions des intentions après les manipulations de ce cran. */
  intents: Intent[];
  annulled: number[];
}

export interface TourLog {
  tour: number;
  steps: CranStep[];
  dealt: number;
  taken: number;
  outcome: null | 'win' | 'lose';
}
