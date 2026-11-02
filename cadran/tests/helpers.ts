import { createCombat } from '../src/engine/combat';
import type { CardInst, CombatState, EnemyId, RelicId } from '../src/engine/types';

let uid = 1;
export const card = (id: string, tempered = false): CardInst => ({ uid: uid++, id, tempered, tension: 0, turns: 0 });

/** Combat de test : pioche vide, cartes posées à la main sur le cadran. */
export function bareCombat(enemy: EnemyId, dial: Record<number, string>, relics: RelicId[] = [], hp = 50): CombatState {
  const s = createCombat({ seed: 42, deck: [], hp, maxHp: 50, relics, enemy });
  for (const [cran, id] of Object.entries(dial)) s.dial[Number(cran)] = card(id);
  return s;
}
