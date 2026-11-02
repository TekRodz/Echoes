// Une run : 6 Heures, de 1 h au Grand Carillon. Atelier entre les combats.
import { CARDS, STARTER_DECK } from './cards';
import { createCombat } from './combat';
import { ELITE_POOL, ENEMIES, NORMAL_POOL } from './enemies';
import { RELIC_ORDER } from './relics';
import { derive, pick, randInt } from './rng';
import type { CardInst, CombatState, EnemyId, Rarity, RelicId } from './types';

export const HEURES = 6;
export const START_HP = 50;

export interface RunNode {
  kind: 'normal' | 'elite' | 'boss';
  enemy: EnemyId;
}

export interface Offer {
  id: string;
  price: number;
  sold: boolean;
}

export interface RunState {
  seed: number;
  rng: number;
  heure: number;
  hp: number;
  maxHp: number;
  laiton: number;
  deck: CardInst[];
  relics: RelicId[];
  nextUid: number;
  screen: 'map' | 'combat' | 'reward' | 'atelier' | 'won' | 'lost';
  nodes: RunNode[];
  node: RunNode | null;
  combat: CombatState | null;
  reward: { cards: string[]; laiton: number; relic: RelicId | null; picked: boolean } | null;
  atelier: { cards: Offer[]; relic: { id: RelicId; price: number; sold: boolean } | null; removed: boolean; tempered: boolean; repaired: boolean } | null;
  stats: { combats: number; tours: number; dealt: number };
}

const PRICE: Record<Rarity, number> = { commune: 20, 'peu commune': 32, rare: 48 };
const REWARD_POOL = Object.values(CARDS).filter((c) => c.id !== 'frappe' && c.id !== 'bouclier');

export function newRun(seed: number): RunState {
  const run: RunState = {
    seed,
    rng: seed | 0,
    heure: 1,
    hp: START_HP,
    maxHp: START_HP,
    laiton: 0,
    deck: [],
    relics: [],
    nextUid: 1,
    screen: 'map',
    nodes: [],
    node: null,
    combat: null,
    reward: null,
    atelier: null,
    stats: { combats: 0, tours: 0, dealt: 0 },
  };
  for (const id of STARTER_DECK) addCard(run, id);
  run.nodes = makeNodes(run);
  return run;
}

export function addCard(run: RunState, id: string, tempered = false): void {
  run.deck.push({ uid: run.nextUid++, id, tempered, tension: 0, turns: 0 });
}

function makeNodes(run: RunState): RunNode[] {
  if (run.heure >= HEURES) return [{ kind: 'boss', enemy: 'carillon' }];
  const normal: RunNode = { kind: 'normal', enemy: pick(run, NORMAL_POOL) };
  if (run.heure === 1) return [normal];
  return [normal, { kind: 'elite', enemy: pick(run, ELITE_POOL) }];
}

export function chooseNode(run: RunState, i: number): void {
  const node = run.nodes[i];
  if (!node || run.screen !== 'map') return;
  run.node = node;
  run.combat = createCombat({
    seed: derive(run.seed, run.heure * 7 + i),
    deck: run.deck,
    hp: run.hp,
    maxHp: run.maxHp,
    relics: run.relics,
    enemy: node.enemy,
    hpScale: node.kind === 'boss' ? 1 : 1 + 0.1 * (run.heure - 1),
  });
  run.screen = 'combat';
}

function pickCard(run: RunState): string {
  const roll = randInt(run, 100);
  const rarity: Rarity = roll < 62 ? 'commune' : roll < 92 ? 'peu commune' : 'rare';
  const pool = REWARD_POOL.filter((c) => c.rarity === rarity);
  return pick(run, pool).id;
}

function distinctCards(run: RunState, n: number): string[] {
  const out: string[] = [];
  let guard = 0;
  while (out.length < n && guard++ < 50) {
    const id = pickCard(run);
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

function freeRelic(run: RunState): RelicId | null {
  const pool = RELIC_ORDER.filter((r) => !run.relics.includes(r));
  return pool.length ? pick(run, pool) : null;
}

/** À appeler quand le combat est terminé. */
export function finishCombat(run: RunState): void {
  const c = run.combat;
  if (!c || !c.outcome || run.screen !== 'combat') return;
  run.hp = Math.max(0, c.player.hp);
  run.stats.combats++;
  run.stats.tours += c.tour;
  if (c.outcome === 'lose') {
    run.screen = 'lost';
    return;
  }
  if (run.node?.kind === 'boss') {
    run.screen = 'won';
    return;
  }
  const elite = run.node?.kind === 'elite';
  const laiton = (elite ? 32 : 18) + run.heure * 2;
  run.laiton += laiton;
  const relic = elite ? freeRelic(run) : null;
  if (relic) run.relics.push(relic);
  run.reward = { cards: distinctCards(run, 3), laiton, relic, picked: false };
  run.screen = 'reward';
}

export function takeReward(run: RunState, id: string | null): void {
  if (run.screen !== 'reward' || !run.reward || run.reward.picked) return;
  if (id && run.reward.cards.includes(id)) addCard(run, id);
  run.reward.picked = true;
  openAtelier(run);
}

function openAtelier(run: RunState): void {
  const relic = freeRelic(run);
  run.atelier = {
    cards: distinctCards(run, 3).map((id) => ({ id, price: PRICE[CARDS[id]!.rarity], sold: false })),
    relic: relic ? { id: relic, price: 55, sold: false } : null,
    removed: false,
    tempered: false,
    repaired: false,
  };
  run.screen = 'atelier';
}

export const COST = { remove: 25, temper: 30, repair: 15, repairHp: 12 };

export function buyCard(run: RunState, i: number): boolean {
  const o = run.atelier?.cards[i];
  if (!o || o.sold || run.laiton < o.price) return false;
  run.laiton -= o.price;
  o.sold = true;
  addCard(run, o.id);
  return true;
}

export function buyRelic(run: RunState): boolean {
  const o = run.atelier?.relic;
  if (!o || o.sold || run.laiton < o.price) return false;
  run.laiton -= o.price;
  o.sold = true;
  run.relics.push(o.id);
  return true;
}

export function removeCard(run: RunState, uid: number): boolean {
  const a = run.atelier;
  if (!a || a.removed || run.laiton < COST.remove || run.deck.length <= 5) return false;
  const i = run.deck.findIndex((c) => c.uid === uid);
  if (i < 0) return false;
  run.deck.splice(i, 1);
  run.laiton -= COST.remove;
  a.removed = true;
  return true;
}

export function temperCard(run: RunState, uid: number): boolean {
  const a = run.atelier;
  const c = run.deck.find((x) => x.uid === uid);
  if (!a || a.tempered || !c || c.tempered || run.laiton < COST.temper) return false;
  c.tempered = true;
  run.laiton -= COST.temper;
  a.tempered = true;
  return true;
}

export function repair(run: RunState): boolean {
  const a = run.atelier;
  if (!a || a.repaired || run.laiton < COST.repair || run.hp >= run.maxHp) return false;
  run.hp = Math.min(run.maxHp, run.hp + COST.repairHp);
  run.laiton -= COST.repair;
  a.repaired = true;
  return true;
}

export function leaveAtelier(run: RunState): void {
  if (run.screen !== 'atelier') return;
  run.atelier = null;
  run.reward = null;
  run.combat = null;
  run.node = null;
  run.heure++;
  run.nodes = makeNodes(run);
  run.screen = 'map';
}

export const enemyName = (id: EnemyId): string => ENEMIES[id].name;
