import { CELL, clamp, dist2, idiv, isqrt } from '../fixed';
import type { Unit } from '../types';
import type { World } from '../world';

/** Résout la collision d'un cercle avec les bords de la salle et les murs (cases pleines). */
export function resolveWalls(w: World, u: Unit): void {
  const W = w.room.cols * CELL;
  const H = w.room.rows * CELL;
  for (const [col, row] of w.room.walls) {
    const x0 = col * CELL;
    const y0 = row * CELL;
    const x1 = x0 + CELL;
    const y1 = y0 + CELL;
    const cx = clamp(u.x, x0, x1);
    const cy = clamp(u.y, y0, y1);
    const dx = u.x - cx;
    const dy = u.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= u.r * u.r) continue;
    if (d2 > 0) {
      const d = isqrt(d2);
      const push = u.r - d + 1;
      u.x += idiv(dx * push, Math.max(d, 1));
      u.y += idiv(dy * push, Math.max(d, 1));
    } else {
      // Centre à l'intérieur du mur : sortie par le côté le plus proche.
      const l = u.x - x0;
      const r = x1 - u.x;
      const t = u.y - y0;
      const b = y1 - u.y;
      const m = Math.min(l, r, t, b);
      if (m === l) u.x = x0 - u.r;
      else if (m === r) u.x = x1 + u.r;
      else if (m === t) u.y = y0 - u.r;
      else u.y = y1 + u.r;
    }
  }
  u.x = clamp(u.x, u.r, W - u.r);
  u.y = clamp(u.y, u.r, H - u.r);
}

export function moveUnit(w: World, u: Unit, dx: number, dy: number): void {
  u.x += dx;
  u.y += dy;
  resolveWalls(w, u);
}

/** Pousse u hors de o (o ne bouge pas). */
export function pushOut(u: Unit, o: Unit): void {
  const rs = u.r + o.r;
  const d2 = dist2(u.x, u.y, o.x, o.y);
  if (d2 >= rs * rs) return;
  let dx = u.x - o.x;
  let dy = u.y - o.y;
  let d = isqrt(d2);
  if (d === 0) {
    dx = 0;
    dy = 1;
    d = 1;
  }
  u.x = o.x + idiv(dx * rs, d);
  u.y = o.y + idiv(dy * rs, d);
}

/** Les alliés ne se bloquent pas entre eux, mais sont repoussés par les ennemis. */
export function pushAllyOutOfEnemies(w: World, u: Unit): void {
  for (const e of w.units) {
    if (e.side !== 'enemy' || !e.alive) continue;
    pushOut(u, e);
  }
  resolveWalls(w, u);
}

/** Séparation douce entre ennemis, ordre stable par identifiant. */
export function separateEnemies(w: World): void {
  const es = w.units.filter((u) => u.side === 'enemy' && u.alive);
  for (let i = 0; i < es.length; i++) {
    for (let j = i + 1; j < es.length; j++) {
      const a = es[i]!;
      const b = es[j]!;
      const rs = a.r + b.r - 40;
      const d2 = dist2(a.x, a.y, b.x, b.y);
      if (d2 >= rs * rs) continue;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d = isqrt(d2);
      if (d === 0) {
        dx = 1;
        dy = 0;
        d = 1;
      }
      const push = idiv(rs - d, 2) + 1;
      const ox = idiv(dx * push, d);
      const oy = idiv(dy * push, d);
      a.x -= ox;
      a.y -= oy;
      b.x += ox;
      b.y += oy;
      resolveWalls(w, a);
      resolveWalls(w, b);
    }
  }
}

/** Vecteur de déplacement depuis une entrée quantifiée -127..127. */
export function inputVelocity(mx: number, my: number, speed: number): [number, number] {
  let x = clamp(mx, -127, 127);
  let y = clamp(my, -127, 127);
  const m = isqrt(x * x + y * y);
  if (m > 127) {
    x = idiv(x * 127, m);
    y = idiv(y * 127, m);
  }
  return [idiv(x * speed, 127), idiv(y * speed, 127)];
}

/** Applique une entrée de déplacement à un allié (joueur ou clone). */
export function applyInputMove(w: World, u: Unit, mx: number, my: number, speed: number): void {
  const [dx, dy] = inputVelocity(mx, my, speed);
  if (mx !== 0 || my !== 0) {
    const m = isqrt(mx * mx + my * my);
    if (m > 0) {
      u.fx = idiv(mx * 1000, m);
      u.fy = idiv(my * 1000, m);
    }
  }
  moveUnit(w, u, dx, dy);
  pushAllyOutOfEnemies(w, u);
}
