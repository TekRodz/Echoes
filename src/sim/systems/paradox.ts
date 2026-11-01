import { dist, idiv, isqrt } from '../fixed';
import { CLASSES } from '../content/classes';
import type { CloneRecord, ParadoxReason, Unit } from '../types';
import type { World } from '../world';

/** Seuil de blocage : plus de 0,5 s (30 ticks). */
export const BLOCK_TICKS = 30;

export function triggerParadox(w: World, u: Unit, reason: ParadoxReason, lostX: number, lostY: number): void {
  if (u.paradox || u.cloneIndex < 0) return;
  u.paradox = true;
  u.paradoxTick = w.tick;
  u.lostX = lostX;
  u.lostY = lostY;
  w.events.push({ type: 'paradox', id: u.id, cloneIndex: u.cloneIndex, reason, x: u.x, y: u.y, lostX, lostY });
}

/**
 * Chemin bloqué : le clone veut avancer mais n'avance presque pas,
 * alors qu'à l'enregistrement il avançait au même tick.
 */
export function checkBlocked(w: World, u: Unit, rec: CloneRecord): void {
  if (u.paradox) return;
  const t = w.tick;
  const inp = rec.inputs[t];
  if (!inp) return;
  const speed = CLASSES[u.kind as keyof typeof CLASSES].speed;
  const mag = Math.min(127, isqrt(inp.moveX * inp.moveX + inp.moveY * inp.moveY));
  const intended = idiv(speed * mag, 127);
  if (intended < 4) {
    u.blockedTicks = 0;
    return;
  }
  const actual = dist(u.px, u.py, u.x, u.y);
  const prevX = t === 0 ? w.room.startX : (rec.path[(t - 1) * 2] ?? u.px);
  const prevY = t === 0 ? w.room.startY : (rec.path[(t - 1) * 2 + 1] ?? u.py);
  const nowX = rec.path[t * 2] ?? u.x;
  const nowY = rec.path[t * 2 + 1] ?? u.y;
  const recorded = dist(prevX, prevY, nowX, nowY);
  if (actual * 4 < intended && recorded * 2 >= intended) u.blockedTicks++;
  else u.blockedTicks = 0;
  if (u.blockedTicks > BLOCK_TICKS) triggerParadox(w, u, 'blocked', nowX, nowY);
}
