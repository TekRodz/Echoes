import { dist2, scaleTo } from '../fixed';
import { BRUTE, ENEMIES, SHOOTER } from '../content/enemies';
import type { EnemyKind, Unit } from '../types';
import type { World } from '../world';
import { damage } from './combat';
import { moveUnit, separateEnemies } from './movement';

/** Cible : un Tank qui provoque (le plus proche), sinon l'allié le plus proche. Égalité : plus petit id. */
export function chooseTarget(w: World, e: Unit): Unit | null {
  let best: Unit | null = null;
  let bestD = Infinity;
  let bestProvoke = false;
  for (const a of w.units) {
    if (!a.alive || a.side !== 'ally') continue;
    const provoke = a.provokeTicks > 0;
    const d = dist2(e.x, e.y, a.x, a.y);
    if ((provoke && !bestProvoke) || (provoke === bestProvoke && d < bestD)) {
      best = a;
      bestD = d;
      bestProvoke = provoke;
    }
  }
  return best;
}

function stepToward(w: World, e: Unit, tx: number, ty: number, speed: number, away = false): void {
  if (e.rootTicks > 0) return;
  let [dx, dy] = scaleTo(tx - e.x, ty - e.y, speed);
  if (away) {
    dx = -dx;
    dy = -dy;
  }
  moveUnit(w, e, dx, dy);
}

export function updateEnemies(w: World): void {
  for (const e of w.units) {
    if (!e.alive || e.side !== 'enemy') continue;
    const def = ENEMIES[e.kind as EnemyKind];
    const t = chooseTarget(w, e);
    e.targetId = t ? t.id : 0;
    if (e.basicCd > 0) e.basicCd--;

    switch (e.kind) {
      case 'minion': {
        if (!t) break;
        const contact = e.r + t.r + 60;
        if (dist2(e.x, e.y, t.x, t.y) > contact * contact) stepToward(w, e, t.x, t.y, def.speed);
        else if (e.basicCd <= 0) {
          damage(w, t, def.dmg, e.id);
          e.basicCd = def.cd;
        }
        break;
      }
      case 'shooter': {
        if (!t) break;
        const d2 = dist2(e.x, e.y, t.x, t.y);
        if (d2 < SHOOTER.keepMin * SHOOTER.keepMin) stepToward(w, e, t.x, t.y, def.speed, true);
        else if (d2 > SHOOTER.keepMax * SHOOTER.keepMax) stepToward(w, e, t.x, t.y, def.speed);
        if (e.basicCd <= 0 && d2 <= SHOOTER.fireRange * SHOOTER.fireRange) {
          const [vx, vy] = scaleTo(t.x - e.x, t.y - e.y, SHOOTER.bulletSpeed);
          w.projectiles.push({
            id: w.nextFxId++, x: e.x, y: e.y, px: e.x, py: e.y, vx, vy,
            ticks: SHOOTER.bulletTicks, dmg: def.dmg, hits: 'ally', ownerId: e.id, r: 110,
          });
          w.events.push({ type: 'enemyShot', id: e.id });
          e.basicCd = def.cd;
        }
        break;
      }
      case 'brute':
        updateBrute(w, e, t);
        break;
    }
    if (e.rootTicks > 0) e.rootTicks--;
  }
  separateEnemies(w);
}

function updateBrute(w: World, e: Unit, t: Unit | null): void {
  const def = ENEMIES.brute;
  if (e.state === 'walk') {
    if (t) {
      const contact = e.r + t.r + 60;
      if (dist2(e.x, e.y, t.x, t.y) > contact * contact) stepToward(w, e, t.x, t.y, def.speed);
      else if (e.basicCd <= 0) {
        damage(w, t, BRUTE.contactDmg, e.id);
        e.basicCd = BRUTE.contactCd;
      }
    }
    e.stateTicks--;
    if (e.stateTicks <= 0 && t && e.rootTicks <= 0) {
      e.state = 'windup';
      e.stateTicks = BRUTE.windup;
      [e.chargeDx, e.chargeDy] = scaleTo(t.x - e.x, t.y - e.y, 1000);
      if (e.chargeDx === 0 && e.chargeDy === 0) e.chargeDy = 1000;
    }
    return;
  }
  if (e.state === 'windup') {
    e.stateTicks--;
    if (e.stateTicks <= 0) {
      e.state = 'charge';
      e.stateTicks = BRUTE.chargeTicks;
      e.hitIds = [];
      w.events.push({ type: 'charge', id: e.id });
    }
    return;
  }
  // Charge en ligne droite.
  const [dx, dy] = scaleTo(e.chargeDx, e.chargeDy, BRUTE.chargeSpeed);
  const bx = e.x;
  const by = e.y;
  moveUnit(w, e, dx, dy);
  for (const a of w.units) {
    if (!a.alive || a.side !== 'ally' || e.hitIds.includes(a.id)) continue;
    const rs = e.r + a.r;
    if (dist2(e.x, e.y, a.x, a.y) <= rs * rs) {
      e.hitIds.push(a.id);
      damage(w, a, def.dmg, e.id);
    }
  }
  const moved2 = dist2(bx, by, e.x, e.y);
  const want = BRUTE.chargeSpeed;
  e.stateTicks--;
  if (e.stateTicks <= 0 || moved2 * 4 < want * want) {
    e.state = 'walk';
    e.stateTicks = def.cd;
  }
}
