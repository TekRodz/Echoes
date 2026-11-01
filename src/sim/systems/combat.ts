import { CELL, clamp, dist2, rotate, scaleTo } from '../fixed';
import { ABILITY, CLASSES } from '../content/classes';
import type { ClassId, Side, Unit } from '../types';
import type { World } from '../world';

export const isClass = (u: Unit): u is Unit & { kind: ClassId } => u.side === 'ally';

/** Portée d'une action de base ou de compétence pour la validation et le ciblage. */
export function actionRange(u: Unit, kind: 'basic' | 'ability', target: Unit | null): number {
  const def = CLASSES[u.kind as ClassId];
  if (kind === 'ability') return ABILITY.bubbleRange;
  if (u.kind === 'tank') return u.r + (target ? target.r : 0) + def.basic.range;
  return def.basic.range;
}

export function inRange(u: Unit, t: Unit, range: number): boolean {
  return dist2(u.x, u.y, t.x, t.y) <= range * range;
}

export function damage(w: World, t: Unit, amount: number, from: number): void {
  if (!t.alive || amount <= 0) return;
  let rest = amount;
  if (t.shield > 0) {
    const absorbed = Math.min(t.shield, rest);
    t.shield -= absorbed;
    rest -= absorbed;
  }
  t.hp -= rest;
  w.events.push({ type: 'hit', from, to: t.id, amount, x: t.x, y: t.y });
  if (t.hp <= 0) {
    t.hp = 0;
    t.alive = false;
    w.events.push({ type: 'death', id: t.id, x: t.x, y: t.y });
  }
}

export function heal(w: World, t: Unit, amount: number, from: number): void {
  if (!t.alive) return;
  const before = t.hp;
  t.hp = Math.min(t.maxHp, t.hp + amount);
  if (t.hp > before) w.events.push({ type: 'heal', from, to: t.id, amount: t.hp - before });
}

/** Unité vivante la plus proche d'un camp (ou de tous), à portée, hors soi. Égalité : plus petit id. */
export function nearest(w: World, u: Unit, side: Side | 'any', range: number, rangeAddsRadius = false): Unit | null {
  let best: Unit | null = null;
  let bestD = Infinity;
  for (const o of w.units) {
    if (!o.alive || o.id === u.id) continue;
    if (side !== 'any' && o.side !== side) continue;
    const r = rangeAddsRadius ? range + o.r : range;
    const d = dist2(u.x, u.y, o.x, o.y);
    if (d > r * r) continue;
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

/** Allié le plus blessé à portée (soi compris). Rien si tout le monde est à fond. */
export function mostWounded(w: World, u: Unit, range: number, allowFull: boolean): Unit | null {
  let best: Unit | null = null;
  let bestMissing = allowFull ? -1 : 0;
  for (const o of w.units) {
    if (!o.alive || o.side !== 'ally') continue;
    if (!inRange(u, o, range)) continue;
    const missing = o.maxHp - o.hp;
    if (missing > bestMissing) {
      bestMissing = missing;
      best = o;
    }
  }
  return best;
}

/** Choix de cible d'une action jouée en direct (le joueur). */
export function liveTarget(w: World, u: Unit, kind: 'basic' | 'ability'): { ok: boolean; target: Unit | null } {
  const def = CLASSES[u.kind as ClassId];
  if (kind === 'basic') {
    switch (u.kind) {
      case 'tank': {
        const t = nearest(w, u, 'enemy', u.r + def.basic.range, true);
        return { ok: t !== null, target: t };
      }
      case 'archer': {
        const t = nearest(w, u, 'enemy', def.basic.range);
        return { ok: t !== null, target: t };
      }
      case 'healer': {
        const t = mostWounded(w, u, def.basic.range, false);
        return { ok: t !== null, target: t };
      }
      default:
        return { ok: true, target: null };
    }
  }
  if (u.kind === 'healer') {
    const t = mostWounded(w, u, ABILITY.bubbleRange, false) ?? u;
    return { ok: true, target: t };
  }
  return { ok: true, target: null };
}

/** Cible d'un paradoxe : l'entité la plus proche, alliés compris. */
export function paradoxTarget(w: World, u: Unit, kind: 'basic' | 'ability'): Unit | null {
  if (kind === 'basic') {
    if (u.kind === 'tank') return nearest(w, u, 'any', u.r + CLASSES.tank.basic.range, true);
    if (u.kind === 'archer') return nearest(w, u, 'any', CLASSES.archer.basic.range);
    if (u.kind === 'healer') return nearest(w, u, 'any', CLASSES.healer.basic.range);
    return null;
  }
  if (u.kind === 'healer') return nearest(w, u, 'any', ABILITY.bubbleRange);
  if (u.kind === 'archer') return nearest(w, u, 'any', CELL * 6);
  return null;
}

/** Exécute l'action. `wild` = le clone est en paradoxe (ses effets touchent tout le monde). */
export function performAction(w: World, u: Unit, kind: 'basic' | 'ability', target: Unit | null, wild: boolean): void {
  const def = CLASSES[u.kind as ClassId];
  if (kind === 'basic') {
    switch (u.kind) {
      case 'tank':
        if (target) damage(w, target, def.basic.power, u.id);
        return;
      case 'archer':
        if (target) {
          w.events.push({ type: 'shot', from: u.id, to: target.id, x1: u.x, y1: u.y, x2: target.x, y2: target.y });
          damage(w, target, def.basic.power, u.id);
        }
        return;
      case 'healer':
        if (target) heal(w, target, def.basic.power, u.id);
        return;
      case 'trapper':
        placeTrap(w, u, 'trap', u.x, u.y, wild);
        return;
    }
    return;
  }
  switch (u.kind) {
    case 'tank':
      u.provokeTicks = ABILITY.provokeTicks;
      w.events.push({ type: 'taunt', id: u.id });
      return;
    case 'archer': {
      let dx = u.fx;
      let dy = u.fy;
      if (wild && target) [dx, dy] = scaleTo(target.x - u.x, target.y - u.y, 1000);
      const n = ABILITY.volleyCount;
      for (let i = 0; i < n; i++) {
        const angle = (i - (n - 1) / 2) * ABILITY.volleySpread;
        const [rx, ry] = rotate(dx, dy, angle);
        const [vx, vy] = scaleTo(rx, ry, ABILITY.volleySpeed);
        w.projectiles.push({
          id: w.nextFxId++, x: u.x, y: u.y, px: u.x, py: u.y, vx, vy,
          ticks: ABILITY.volleyTicks, dmg: ABILITY.volleyDmg, hits: wild ? 'any' : 'enemy', ownerId: u.id, r: 120,
        });
      }
      w.events.push({ type: 'volley', id: u.id });
      return;
    }
    case 'healer':
      if (target && target.alive) {
        target.shield = ABILITY.shield;
        target.shieldTicks = ABILITY.shieldTicks;
        w.events.push({ type: 'shield', from: u.id, to: target.id });
      }
      return;
    case 'trapper': {
      const [ox, oy] = scaleTo(u.fx, u.fy, ABILITY.mineDistance);
      const W = w.room.cols * CELL;
      const H = w.room.rows * CELL;
      placeTrap(w, u, 'mine', clamp(u.x + ox, 200, W - 200), clamp(u.y + oy, 200, H - 200), wild);
      return;
    }
  }
}

function placeTrap(w: World, u: Unit, kind: 'trap' | 'mine', x: number, y: number, wild: boolean): void {
  w.traps.push({ id: w.nextFxId++, kind, x, y, ticks: 0, ownerId: u.id, wild });
  w.events.push({ type: 'trap', id: u.id, x, y });
}

export function updateProjectiles(w: World): void {
  const W = w.room.cols * CELL;
  const H = w.room.rows * CELL;
  const keep = [];
  for (const p of w.projectiles) {
    p.px = p.x;
    p.py = p.y;
    p.x += p.vx;
    p.y += p.vy;
    p.ticks--;
    let dead = p.ticks <= 0 || p.x < 0 || p.y < 0 || p.x > W || p.y > H;
    if (!dead) {
      for (const [col, row] of w.room.walls) {
        if (p.x >= col * CELL && p.x < (col + 1) * CELL && p.y >= row * CELL && p.y < (row + 1) * CELL) {
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const u of w.units) {
        if (!u.alive || u.id === p.ownerId) continue;
        if (p.hits !== 'any' && u.side !== p.hits) continue;
        const rs = u.r + p.r;
        if (dist2(p.x, p.y, u.x, u.y) <= rs * rs) {
          damage(w, u, p.dmg, p.ownerId);
          dead = true;
          break;
        }
      }
    }
    if (!dead) keep.push(p);
  }
  w.projectiles = keep;
}

export function updateTraps(w: World): void {
  const keep = [];
  for (const tr of w.traps) {
    tr.ticks++;
    let gone = false;
    if (tr.kind === 'trap') {
      if (tr.ticks >= ABILITY.trapArm) {
        for (const u of w.units) {
          if (!u.alive || u.id === tr.ownerId) continue;
          if (!tr.wild && u.side !== 'enemy') continue;
          const rs = ABILITY.trapRadius;
          if (dist2(tr.x, tr.y, u.x, u.y) <= rs * rs) {
            damage(w, u, CLASSES.trapper.basic.power, tr.ownerId);
            u.rootTicks = ABILITY.trapRoot;
            if (u.state === 'charge' || u.state === 'windup') {
              u.state = 'walk';
              u.stateTicks = 60;
            }
            w.events.push({ type: 'snap', x: tr.x, y: tr.y });
            gone = true;
            break;
          }
        }
      }
    } else if (tr.ticks >= ABILITY.mineFuse) {
      const rs = ABILITY.mineRadius;
      for (const u of w.units) {
        if (!u.alive) continue;
        if (!tr.wild && u.side !== 'enemy') continue;
        if (dist2(tr.x, tr.y, u.x, u.y) <= rs * rs) damage(w, u, ABILITY.mineDmg, tr.ownerId);
      }
      w.events.push({ type: 'boom', x: tr.x, y: tr.y, r: rs });
      gone = true;
    }
    if (!gone) keep.push(tr);
  }
  w.traps = keep;
}

