// Monde de la simulation : pur, à pas fixe, strictement déterministe.
// Pas de Math.random, Date.now, performance.now, ni d'accès au DOM dans src/sim/.

import { CELL } from './fixed';
import { randRange } from './rng';
import { CLASSES } from './content/classes';
import { ENEMIES } from './content/enemies';
import { LOOP_TICKS, type RoomDef } from './content/rooms';
import type { ClassId, CloneRecord, EnemyKind, InputFrame, Outcome, PlayerId, Projectile, SimEvent, Trap, Unit } from './types';
import { liveTarget, performAction, updateProjectiles, updateTraps } from './systems/combat';
import { applyInputMove, resolveWalls } from './systems/movement';
import { updateEnemies } from './systems/ai';
import { replayActions, replayMove } from './systems/replay';
import { checkBlocked } from './systems/paradox';

export interface World {
  room: RoomDef;
  seed: number;
  rng: number;
  tick: number;
  loopIndex: number;
  units: Unit[];
  byId: Map<number, Unit>;
  projectiles: Projectile[];
  traps: Trap[];
  clones: CloneRecord[];
  playerId: number | null;
  /** Enregistrement de la boucle en cours (devient un clone). */
  record: CloneRecord | null;
  nextFxId: number;
  spawnIdx: number;
  leversHeld: number;
  leverTicks: number;
  outcome: Outcome;
  events: SimEvent[];
}

export interface WorldOptions {
  room: RoomDef;
  seed: number;
  clones: CloneRecord[];
  /** Classe jouée cette boucle ; null = monde « fantôme » (aperçu de boucle, clones seuls). */
  playerClass: ClassId | null;
  loopIndex: number;
  ownerId?: PlayerId;
}

/** Identifiant stable d'un allié d'une boucle à l'autre : le joueur de la boucle k devient le clone k. */
export const allyId = (loopIndex: number): number => 1000 + loopIndex;
/** Identifiant stable d'un ennemi : son rang dans la liste d'apparitions de la salle. */
export const enemyId = (spawnIndex: number): number => 1 + spawnIndex;

export function unitById(w: World, id: number): Unit | undefined {
  return w.byId.get(id);
}

function baseUnit(id: number): Unit {
  return {
    id, side: 'ally', kind: 'tank', alive: true, x: 0, y: 0, px: 0, py: 0, r: 350,
    hp: 1, maxHp: 1, shield: 0, shieldTicks: 0, fx: 0, fy: -1000, basicCd: 0, abilityCd: 0,
    cloneIndex: -1, paradox: false, paradoxTick: -1, lostX: 0, lostY: 0, blockedTicks: 0, provokeTicks: 0, actionPtr: 0,
    targetId: 0, rootTicks: 0, state: 'walk', stateTicks: 0, chargeDx: 0, chargeDy: 0, hitIds: [],
  };
}

function addUnit(w: World, u: Unit): void {
  w.units.push(u);
  w.units.sort((a, b) => a.id - b.id);
  w.byId.set(u.id, u);
}

function makeAlly(w: World, id: number, classId: ClassId, cloneIndex: number): Unit {
  const def = CLASSES[classId];
  const u = baseUnit(id);
  u.kind = classId;
  u.side = 'ally';
  u.x = u.px = w.room.startX;
  u.y = u.py = w.room.startY;
  u.r = def.radius;
  u.hp = u.maxHp = def.hp;
  u.basicCd = def.basic.firstCd;
  u.cloneIndex = cloneIndex;
  return u;
}

function spawnEnemies(w: World): void {
  const spawns = w.room.spawns;
  while (w.spawnIdx < spawns.length && spawns[w.spawnIdx]!.tick <= w.tick) {
    const s = spawns[w.spawnIdx]!;
    const def = ENEMIES[s.kind as EnemyKind];
    const u = baseUnit(enemyId(w.spawnIdx));
    u.side = 'enemy';
    u.kind = s.kind;
    u.x = s.x + randRange(w, -120, 120);
    u.y = s.y + randRange(w, -120, 120);
    u.r = def.radius;
    resolveWalls(w, u);
    u.px = u.x;
    u.py = u.y;
    u.hp = u.maxHp = def.hp;
    u.basicCd = def.cd >> 1;
    u.stateTicks = s.kind === 'brute' ? 120 : 0;
    addUnit(w, u);
    w.events.push({ type: 'spawn', id: u.id });
    w.spawnIdx++;
  }
}

export function createWorld(o: WorldOptions): World {
  const w: World = {
    room: o.room,
    seed: o.seed,
    rng: o.seed | 0,
    tick: 0,
    loopIndex: o.loopIndex,
    units: [],
    byId: new Map(),
    projectiles: [],
    traps: [],
    clones: o.clones,
    playerId: null,
    record: null,
    nextFxId: 100000,
    spawnIdx: 0,
    leversHeld: 0,
    leverTicks: 0,
    outcome: null,
    events: [],
  };
  for (const rec of o.clones) addUnit(w, makeAlly(w, allyId(rec.loopIndex), rec.classId, rec.loopIndex));
  if (o.playerClass) {
    const id = allyId(o.loopIndex);
    addUnit(w, makeAlly(w, id, o.playerClass, -1));
    w.playerId = id;
    w.record = { loopIndex: o.loopIndex, classId: o.playerClass, ownerId: o.ownerId ?? 0, inputs: [], actions: [], path: [], endTick: 0 };
  }
  spawnEnemies(w);
  return w;
}

export const EMPTY_INPUT = (tick: number): InputFrame => ({ tick, moveX: 0, moveY: 0, ability: false });

/** Avance la simulation d'un tick. `input` = entrée du joueur (ignorée dans un monde fantôme). */
export function stepWorld(w: World, input: InputFrame | null): void {
  if (w.outcome) return;
  w.events = [];
  const t = w.tick;
  const inp: InputFrame = input ? { ...input, tick: t } : EMPTY_INPUT(t);

  for (const u of w.units) {
    u.px = u.x;
    u.py = u.y;
  }
  if (t > 0) spawnEnemies(w);

  const recordOf = (u: Unit): CloneRecord | undefined => w.clones.find((c) => c.loopIndex === u.cloneIndex);
  const allies = w.units.filter((u) => u.side === 'ally');

  // 1. Déplacements (clones : entrées rejouées ; joueur : entrée live).
  for (const u of allies) {
    if (!u.alive) continue;
    if (u.cloneIndex >= 0) {
      const rec = recordOf(u);
      if (rec) replayMove(w, u, rec);
    } else {
      applyInputMove(w, u, inp.moveX, inp.moveY, CLASSES[u.kind as ClassId].speed);
    }
  }
  // 2. Détection de chemin bloqué.
  for (const u of allies) {
    if (!u.alive || u.cloneIndex < 0) continue;
    const rec = recordOf(u);
    if (rec) checkBlocked(w, u, rec);
  }
  // 3. Actions.
  for (const u of allies) {
    if (!u.alive) continue;
    if (u.cloneIndex >= 0) {
      const rec = recordOf(u);
      if (rec) replayActions(w, u, rec);
      continue;
    }
    playerActions(w, u, inp);
  }
  if (w.record && w.playerId !== null) {
    const p = unitById(w, w.playerId)!;
    w.record.inputs.push(inp);
    w.record.path.push(p.x, p.y);
    w.record.endTick = t + 1;
  }

  // 4. Ennemis, projectiles, pièges.
  updateEnemies(w);
  updateProjectiles(w);
  updateTraps(w);

  // 5. Minuteurs.
  for (const u of w.units) {
    if (u.shieldTicks > 0 && --u.shieldTicks === 0) u.shield = 0;
    if (u.provokeTicks > 0) u.provokeTicks--;
  }

  // 6. Objectif.
  checkObjective(w);
  w.tick++;
  if (!w.outcome && w.tick >= LOOP_TICKS) {
    const player = w.playerId !== null ? unitById(w, w.playerId) : undefined;
    w.outcome = w.room.objective === 'survive' && player?.alive ? 'win' : 'timeUp';
  }
}

function playerActions(w: World, u: Unit, inp: InputFrame): void {
  const def = CLASSES[u.kind as ClassId];
  if (u.basicCd > 0) u.basicCd--;
  if (u.abilityCd > 0) u.abilityCd--;
  if (u.basicCd <= 0) {
    const { ok, target } = liveTarget(w, u, 'basic');
    if (ok) {
      performAction(w, u, 'basic', target, false);
      w.record?.actions.push({ tick: w.tick, kind: 'basic', targetId: target ? target.id : null });
      u.basicCd = def.basic.cd;
    }
  }
  if (inp.ability && u.abilityCd <= 0 && u.alive) {
    const { target } = liveTarget(w, u, 'ability');
    performAction(w, u, 'ability', target, false);
    w.record?.actions.push({ tick: w.tick, kind: 'ability', targetId: target ? target.id : null });
    u.abilityCd = def.ability.cd;
  }
}

export function leverHeld(w: World, col: number, row: number): boolean {
  const cx = col * CELL + CELL / 2;
  const cy = row * CELL + CELL / 2;
  const half = CELL / 2;
  return w.units.some((u) => u.alive && u.side === 'ally' && Math.abs(u.x - cx) <= half && Math.abs(u.y - cy) <= half);
}

function checkObjective(w: World): void {
  const room = w.room;
  if (room.objective === 'activate') {
    let held = 0;
    for (const [col, row] of room.levers) if (leverHeld(w, col, row)) held++;
    if (held !== w.leversHeld) {
      w.leversHeld = held;
      w.events.push({ type: 'levers', held, total: room.levers.length });
    }
    w.leverTicks = held === room.levers.length ? w.leverTicks + 1 : 0;
    if (w.leverTicks >= room.leverHold) w.outcome = 'win';
  } else if (room.objective === 'eliminate') {
    if (w.spawnIdx >= room.spawns.length && !w.units.some((u) => u.side === 'enemy' && u.alive)) w.outcome = 'win';
  }
  if (!w.outcome && w.playerId !== null) {
    const p = unitById(w, w.playerId);
    if (!p || !p.alive) w.outcome = 'playerDead';
  }
}

/** Hash FNV-1a de l'état complet (tests de déterminisme). */
export function hashWorld(w: World): number {
  let h = 0x811c9dc5;
  const mix = (v: number): void => {
    h = Math.imul(h ^ (v | 0), 0x01000193);
  };
  mix(w.tick);
  mix(w.rng);
  mix(w.spawnIdx);
  mix(w.leverTicks);
  for (const u of w.units) {
    mix(u.id); mix(u.alive ? 1 : 0); mix(u.x); mix(u.y); mix(u.hp); mix(u.shield); mix(u.shieldTicks);
    mix(u.fx); mix(u.fy); mix(u.basicCd); mix(u.abilityCd); mix(u.paradox ? 1 : 0); mix(u.blockedTicks);
    mix(u.provokeTicks); mix(u.actionPtr); mix(u.targetId); mix(u.rootTicks);
    mix(u.state === 'walk' ? 0 : u.state === 'windup' ? 1 : 2); mix(u.stateTicks); mix(u.chargeDx); mix(u.chargeDy);
  }
  for (const p of w.projectiles) {
    mix(p.id); mix(p.x); mix(p.y); mix(p.ticks);
  }
  for (const tr of w.traps) {
    mix(tr.id); mix(tr.x); mix(tr.y); mix(tr.ticks);
  }
  return h >>> 0;
}

// Utilisé par le rendu : un instantané léger (copie) de l'état visible.
export interface Frame {
  tick: number;
  units: Unit[];
  projectiles: Projectile[];
  traps: Trap[];
  leversHeld: boolean[];
}

export function snapshot(w: World): Frame {
  return {
    tick: w.tick,
    units: w.units.map((u) => ({ ...u, hitIds: [] })),
    projectiles: w.projectiles.map((p) => ({ ...p })),
    traps: w.traps.map((t) => ({ ...t })),
    leversHeld: w.room.levers.map(([c, r]) => leverHeld(w, c, r)),
  };
}

