// Couche « session » : enchaîne les boucles d'une salle, la stabilité et les étoiles.
// Elle pilote la sim mais n'en fait pas partie (pas de contrainte de déterminisme ici).

import { CLASS_ORDER } from './sim/content/classes';
import { LOOP_TICKS, ROOMS, type RoomDef } from './sim/content/rooms';
import { deriveSeed } from './sim/rng';
import type { ClassId, CloneRecord, InputFrame, SimEvent } from './sim/types';
import { createWorld, snapshot, stepWorld, type Frame, type World } from './sim/world';

export type Phase = 'intro' | 'choose' | 'playing' | 'rewind' | 'won' | 'failed' | 'over' | 'end';

export const STABILITY_START = 5;
export const STABILITY_MAX = 8;
export const FAIL_COST = 2;
export const HISTORY_STEP = 2; // un instantané tous les 2 ticks (rembobinage, aperçu)

export type CardState =
  | { kind: 'available' }
  | { kind: 'selected' }
  | { kind: 'current'; loop: number }
  | { kind: 'played'; loop: number }
  | { kind: 'paradox'; loop: number };

export interface GameListener {
  onEvents?(events: SimEvent[], w: World): void;
  onPhase?(phase: Phase, g: Game): void;
  onStability?(delta: number, g: Game): void;
}

export class Game {
  runSeed: number;
  roomIndex = 0;
  stability = STABILITY_START;
  stars: number[] = [];
  phase: Phase = 'intro';

  room: RoomDef = ROOMS[0]!;
  roomSeed = 0;
  records: CloneRecord[] = [];
  used = new Map<ClassId, number>();
  /** Clones ayant déjà coûté de la stabilité dans cette salle. */
  charged = new Set<number>();
  loopIndex = 0;
  selected: ClassId | null = null;
  attempts = 0;
  lastOutcomeReason: 'time' | 'death' | null = null;

  world: World;
  history: Frame[] = [];
  preview: Frame[] = [];
  previewWin = -1;

  private listeners: GameListener[] = [];

  constructor(runSeed: number) {
    this.runSeed = runSeed;
    this.world = this.makeGhost();
    this.startRoom(0);
  }

  on(l: GameListener): void {
    this.listeners.push(l);
  }

  private emitPhase(): void {
    for (const l of this.listeners) l.onPhase?.(this.phase, this);
  }

  setPhase(p: Phase): void {
    this.phase = p;
    this.emitPhase();
  }

  get maxLoops(): number {
    return this.room.maxLoops;
  }

  startRoom(index: number): void {
    this.roomIndex = index;
    this.room = ROOMS[index]!;
    this.roomSeed = deriveSeed(this.runSeed, index * 31);
    this.records = [];
    this.used.clear();
    this.charged.clear();
    this.loopIndex = 0;
    this.selected = null;
    this.world = this.makeGhost();
    this.history = [];
    this.buildPreview();
    this.setPhase('intro');
  }

  private makeGhost(): World {
    return createWorld({ room: this.room, seed: this.roomSeed, clones: this.records, playerClass: null, loopIndex: this.loopIndex });
  }

  /** Aperçu de boucle : on simule la prochaine boucle avec les clones seuls (déterminisme oblige). */
  buildPreview(): void {
    const ghost = this.makeGhost();
    const frames: Frame[] = [snapshot(ghost)];
    this.previewWin = -1;
    while (!ghost.outcome && ghost.tick < LOOP_TICKS) {
      stepWorld(ghost, null);
      if (ghost.tick % HISTORY_STEP === 0 || ghost.outcome) frames.push(snapshot(ghost));
    }
    if (ghost.outcome === 'win') this.previewWin = ghost.tick;
    this.preview = frames;
    this.world = this.makeGhost();
  }

  cardState(c: ClassId): CardState {
    const loop = this.used.get(c);
    if (loop !== undefined) {
      if (this.phase === 'playing' || this.phase === 'rewind') {
        const u = this.world.units.find((x) => x.cloneIndex === loop);
        if (u?.paradox) return { kind: 'paradox', loop };
      }
      return { kind: 'played', loop };
    }
    if ((this.phase === 'playing' || this.phase === 'rewind') && this.world.record?.classId === c) return { kind: 'current', loop: this.loopIndex };
    if (this.selected === c) return { kind: 'selected' };
    return { kind: 'available' };
  }

  enterChoose(): void {
    if (this.phase !== 'intro') return;
    this.autoSelect();
    this.setPhase('choose');
  }

  canSelect(c: ClassId): boolean {
    return this.phase === 'choose' && !this.used.has(c);
  }

  select(c: ClassId): void {
    if (this.canSelect(c)) this.selected = c;
  }

  autoSelect(): void {
    if (this.selected && !this.used.has(this.selected)) return;
    this.selected = CLASS_ORDER.find((c) => !this.used.has(c)) ?? null;
  }

  launch(): boolean {
    if (this.phase !== 'choose' || !this.selected) return false;
    this.world = createWorld({ room: this.room, seed: this.roomSeed, clones: this.records, playerClass: this.selected, loopIndex: this.loopIndex });
    this.history = [snapshot(this.world)];
    this.setPhase('playing');
    return true;
  }

  /** Avance d'un tick de simulation pendant une boucle jouée. */
  tick(input: InputFrame): void {
    if (this.phase !== 'playing') return;
    const w = this.world;
    stepWorld(w, input);
    if (w.tick % HISTORY_STEP === 0 || w.outcome) this.history.push(snapshot(w));
    for (const l of this.listeners) l.onEvents?.(w.events, w);
    for (const e of w.events) {
      if (e.type === 'paradox' && !this.charged.has(e.cloneIndex)) {
        this.charged.add(e.cloneIndex);
        this.changeStability(-1);
        if (this.stability <= 0) {
          this.setPhase('over');
          return;
        }
      }
    }
    if (!w.outcome) return;
    if (w.outcome === 'win') {
      const loops = this.loopIndex + 1;
      const par = this.room.par;
      this.stars[this.roomIndex] = Math.max(this.stars[this.roomIndex] ?? 0, loops <= par ? 3 : loops === par + 1 ? 2 : 1);
      this.setPhase('won');
      return;
    }
    this.lastOutcomeReason = w.outcome === 'playerDead' ? 'death' : 'time';
    this.setPhase('rewind');
  }

  /** Fin du rembobinage : la boucle devient un clone. */
  finishRewind(): void {
    const rec = this.world.record;
    if (rec && this.selected) {
      this.records = [...this.records, rec];
      this.used.set(rec.classId, rec.loopIndex);
    }
    this.loopIndex++;
    this.selected = null;
    if (this.loopIndex >= this.maxLoops) {
      this.changeStability(-FAIL_COST);
      this.setPhase(this.stability <= 0 ? 'over' : 'failed');
      return;
    }
    this.buildPreview();
    this.autoSelect();
    this.setPhase('choose');
  }

  retryRoom(): void {
    this.attempts++;
    this.startRoom(this.roomIndex);
  }

  nextRoom(): void {
    this.attempts = 0;
    if (this.roomIndex + 1 >= ROOMS.length) {
      this.setPhase('end');
      return;
    }
    this.startRoom(this.roomIndex + 1);
  }

  newRun(seed: number): void {
    this.runSeed = seed;
    this.stability = STABILITY_START;
    this.stars = [];
    this.attempts = 0;
    this.startRoom(0);
  }

  private changeStability(d: number): void {
    this.stability = Math.max(0, Math.min(STABILITY_MAX, this.stability + d));
    for (const l of this.listeners) l.onStability?.(d, this);
  }
}
