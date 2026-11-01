import { CLASSES } from '../content/classes';
import type { ActionEvent, ClassId, CloneRecord, Unit } from '../types';
import type { World } from '../world';
import { unitById } from '../world';
import { actionRange, inRange, paradoxTarget, performAction } from './combat';
import { applyInputMove } from './movement';
import { triggerParadox } from './paradox';

/** Réinjecte l'entrée de déplacement enregistrée au tick courant. */
export function replayMove(w: World, u: Unit, rec: CloneRecord): void {
  if (w.tick >= rec.endTick) {
    // Fin de l'enregistrement (mort pendant sa boucle) : le clone s'efface.
    u.alive = false;
    w.events.push({ type: 'fade', id: u.id });
    return;
  }
  const inp = rec.inputs[w.tick];
  if (!inp) return;
  applyInputMove(w, u, inp.moveX, inp.moveY, CLASSES[u.kind as ClassId].speed);
}

/**
 * Rejoue les actions enregistrées à ce tick. Chaque action est comparée à l'ActionEvent :
 * si la cible enregistrée est morte ou hors de portée, le clone devient un paradoxe.
 */
export function replayActions(w: World, u: Unit, rec: CloneRecord): void {
  while (u.actionPtr < rec.actions.length) {
    const ev = rec.actions[u.actionPtr]!;
    if (ev.tick > w.tick) break;
    u.actionPtr++;
    if (ev.tick < w.tick) continue;
    replayOne(w, u, ev);
    if (!u.alive) return;
  }
}

function replayOne(w: World, u: Unit, ev: ActionEvent): void {
  let target: Unit | null = null;
  if (!u.paradox && ev.targetId !== null) {
    const t = unitById(w, ev.targetId);
    const valid = !!t && t.alive && inRange(u, t, actionRange(u, ev.kind, t));
    if (!valid) triggerParadox(w, u, 'target', t ? t.x : u.x, t ? t.y : u.y);
    else target = t;
  }
  if (u.paradox) {
    target = paradoxTarget(w, u, ev.kind);
    const needsTarget = ev.kind === 'basic' ? u.kind !== 'trapper' : u.kind === 'healer';
    if (needsTarget && !target) return;
  }
  performAction(w, u, ev.kind, target, u.paradox);
}
