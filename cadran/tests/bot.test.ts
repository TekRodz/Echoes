// Bot glouton : à chaque tour, essaie toutes les actions possibles via l'aperçu et garde la meilleure.
// Sert d'outil d'équilibrage (taux de victoire), sans seuil strict.
import { expect, it } from 'vitest';
import { canPlace, place, previewTour, resolveTour } from '../src/engine/combat';
import { CARDS } from '../src/engine/cards';
import { chooseNode, finishCombat, leaveAtelier, newRun, takeReward, buyCard, repair } from '../src/engine/run';
import type { CombatState } from '../src/engine/types';

function bestAction(s: CombatState): (() => void) | null {
  let best: { score: number; fn: () => void } | null = null;
  for (let h = 0; h < s.hand.length; h++) {
    for (let c = 0; c < 12; c++) {
      if (!canPlace(s, h, c)) continue;
      const clone = structuredClone(s);
      place(clone, h, c);
      const log = previewTour(clone);
      const score = log.dealt * 1.0 - log.taken * 1.3 + (log.outcome === 'win' ? 1000 : 0) - (log.outcome === 'lose' ? 1000 : 0);
      if (!best || score > best.score) best = { score, fn: () => place(s, h, c) };
    }
  }
  return best?.fn ?? null;
}

const lostTo: Record<string, number> = {};
const foughts: Record<string, number> = {};
function playRun(seed: number): { won: boolean; heure: number } {
  const run = newRun(seed);
  while (run.screen !== 'won' && run.screen !== 'lost') {
    if (run.screen === 'map') {
      chooseNode(run, run.nodes.length > 1 && run.hp > 40 ? 1 : 0);
      foughts[run.node!.enemy] = (foughts[run.node!.enemy] ?? 0) + 1;
    } else if (run.screen === 'combat') {
      const s = run.combat!;
      let guard = 0;
      while (!s.outcome && guard++ < 30) {
        while (s.energy > 0) {
          const a = bestAction(s);
          if (!a) break;
          a();
        }
        resolveTour(s);
      }
      if (!s.outcome) s.outcome = 'lose';
      if (s.outcome === 'lose') lostTo[s.enemy.id] = (lostTo[s.enemy.id] ?? 0) + 1;
      finishCombat(run);
    } else if (run.screen === 'reward') {
      const ids = run.reward!.cards;
      const pref = ids.find((id) => CARDS[id]!.archetype === 'precision' || id === 'parade') ?? ids[0] ?? null;
      takeReward(run, pref);
    } else if (run.screen === 'atelier') {
      repair(run);
      buyCard(run, 0);
      leaveAtelier(run);
    }
  }
  return { won: run.screen === 'won', heure: run.heure };
}

it('bot glouton : taux de victoire sur 40 runs', () => {
  const res = Array.from({ length: 40 }, (_, i) => playRun(1000 + i));
  const wins = res.filter((r) => r.won).length;
  const avg = res.reduce((a, r) => a + r.heure, 0) / res.length;
  const hist = [1, 2, 3, 4, 5, 6].map((h) => res.filter((r) => !r.won && r.heure === h).length);
  console.log(`victoires ${wins}/40 · heure moyenne atteinte ${avg.toFixed(2)} · défaites par heure ${hist.join(' ')}`);
  console.log('combats', JSON.stringify(foughts), 'défaites', JSON.stringify(lostTo));
  expect(res.length).toBe(40);
}, 120000);
