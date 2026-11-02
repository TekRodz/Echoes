// Moteur de combat de Cadran. Pur et déterministe : mêmes graine et mêmes actions => mêmes résultats.
import { coupleOf, def, ENGRENAGE_IDS, vOf, wOf } from './cards';
import { ENEMIES, phaseFor, tunedHp, tunedIntents } from './enemies';
import { next, shuffle } from './rng';
import type { CardInst, CombatState, CranStep, EnemyId, Intent, RelicId, StepEvent, TourLog } from './types';

export const CRANS = 12;
export const HAND_SIZE = 4;
export const BASE_COUPLE = 10;
/** Remontage par tour : poser coûte le poids de la carte, déplacer coûte 1, retirer est gratuit. */
export const ENERGY = 3;
export const MOVE_COST = 1;
export const MINUIT = 6;

export interface CombatOptions {
  seed: number;
  deck: CardInst[];
  hp: number;
  maxHp: number;
  relics: RelicId[];
  enemy: EnemyId;
  hpScale?: number;
}

export function createCombat(o: CombatOptions): CombatState {
  const maxHp = Math.round(tunedHp(o.enemy) * (o.hpScale ?? 1));
  const s: CombatState = {
    seed: o.seed,
    rng: o.seed | 0,
    tour: 1,
    dial: Array<CardInst | null>(CRANS).fill(null),
    draw: [],
    discard: [],
    hand: [],
    player: { hp: o.hp, maxHp: o.maxHp, block: 0 },
    enemy: { id: o.enemy, hp: maxHp, maxHp, block: 0, phase: 0, rolls: [] },
    relics: [...o.relics],
    coupleMax: BASE_COUPLE + (o.relics.includes('spiral') ? 3 : 0),
    energy: 0,
    energyMax: 0,
    extraDraw: 0,
    lastBestHit: 0,
    rotatePending: 0,
    outcome: null,
  };
  for (let i = 0; i < 64; i++) {
    const r = next(s.rng);
    s.rng = r.state;
    s.enemy.rolls.push(r.value);
  }
  s.draw = shuffle(s, o.deck.map((c) => ({ ...c, tension: 0, turns: 0 })));
  startTour(s);
  return s;
}

const has = (s: CombatState, r: RelicId): boolean => s.relics.includes(r);

function drawCards(s: CombatState, n: number): void {
  for (let i = 0; i < n; i++) {
    if (s.draw.length === 0) {
      if (s.discard.length === 0) return;
      s.draw = shuffle(s, s.discard);
      s.discard = [];
    }
    s.hand.push(s.draw.pop()!);
  }
}

/** Cartes qui ne tournent pas avec le cadran. */
export const isFixed = (c: CardInst): boolean => !!def(c).fixed;

/**
 * Le cadran tourne de n crans dans le sens des aiguilles d'une montre.
 * Les cartes fixes restent en place ; une carte qui tomberait sur une carte fixe avance jusqu'au cran libre suivant.
 */
export function rotatedDial(dial: (CardInst | null)[], n: number): (CardInst | null)[] {
  const d = Array<CardInst | null>(CRANS).fill(null);
  dial.forEach((c, i) => {
    if (c && isFixed(c)) d[i] = c;
  });
  dial.forEach((c, i) => {
    if (!c || isFixed(c)) return;
    let t = (((i + n) % CRANS) + CRANS) % CRANS;
    for (let k = 0; k < CRANS && d[t]; k++) t = (t + 1) % CRANS;
    d[t] = c;
  });
  return d;
}

/** Rotation appliquée à chaque rembobinage : 1 cran, plus l'éventuel quart de tour du Grand Carillon. */
export const ROTATION = 1;

/** Préparation d'un tour : rotation du cadran, main défaussée, pioche, Remontage. */
function startTour(s: CombatState): void {
  if (s.tour > 1) {
    s.dial = rotatedDial(s.dial, ROTATION + s.rotatePending);
    s.rotatePending = 0;
  }
  s.discard.push(...s.hand);
  s.hand = [];
  drawCards(s, HAND_SIZE + s.extraDraw);
  s.extraDraw = 0;
  s.energy = ENERGY + (has(s, 'sablier') ? 1 : 0) + (s.tour === 1 && has(s, 'remontoir') ? 2 : 0);
  s.energyMax = s.energy;
  s.player.block = has(s, 'contrepoids') ? 4 : 0;
  s.enemy.block = 0;
  if (s.tour > 1 && has(s, 'sablier')) {
    s.player.hp -= 1;
    if (s.player.hp <= 0) s.outcome = 'lose';
  }
}

export const coupleUsed = (s: CombatState): number => s.dial.reduce((a, c) => a + (c ? coupleOf(c) : 0), 0);

export function canPlace(s: CombatState, handIdx: number, cran: number): boolean {
  const c = s.hand[handIdx];
  return !!c && !s.outcome && s.energy >= coupleOf(c) && !s.dial[cran] && coupleUsed(s) + coupleOf(c) <= s.coupleMax;
}

export function place(s: CombatState, handIdx: number, cran: number): boolean {
  if (!canPlace(s, handIdx, cran)) return false;
  const c = s.hand.splice(handIdx, 1)[0]!;
  s.dial[cran] = c;
  s.energy -= coupleOf(c);
  return true;
}

export function canMove(s: CombatState, from: number, to: number): boolean {
  return !s.outcome && s.energy >= MOVE_COST && !!s.dial[from] && !s.dial[to] && from !== to;
}

export function move(s: CombatState, from: number, to: number): boolean {
  if (!canMove(s, from, to)) return false;
  s.dial[to] = s.dial[from]!;
  s.dial[from] = null;
  s.energy -= MOVE_COST;
  return true;
}

export function canRemove(s: CombatState, cran: number): boolean {
  return !s.outcome && !!s.dial[cran];
}

export function remove(s: CombatState, cran: number): boolean {
  if (!canRemove(s, cran)) return false;
  const c = s.dial[cran]!;
  s.dial[cran] = null;
  c.tension = 0;
  c.turns = 0;
  s.discard.push(c);
  return true;
}

export function intentsFor(s: CombatState, tour: number): Intent[] {
  return tunedIntents(s.enemy.id, tour, s.enemy.phase, s.enemy.rolls).sort((a, b) => a.cran - b.cran);
}

export const minuitTour = (s: CombatState): number => (ENEMIES[s.enemy.id].minuit ?? MINUIT) + (has(s, 'fusee') ? 1 : 0);
export const minuitMult = (s: CombatState, tour: number): number => (tour >= minuitTour(s) ? 2 ** (tour - minuitTour(s) + 1) : 1);

/** Résout un tour complet (12 crans), puis prépare le suivant. Mute l'état. */
export function resolveTour(s: CombatState): TourLog {
  const intents = intentsFor(s, s.tour).map((i) => ({ ...i }));
  const annulled = new Set<number>();
  const bonus = Array<number>(CRANS).fill(0);
  const acts = Array<number>(CRANS).fill(1);
  const parry = Array<number>(CRANS).fill(0);
  const dealtAt = Array<number>(CRANS).fill(0);
  const perCard = new Map<number, number>();
  const mult = minuitMult(s, s.tour);
  let parried = false;
  let rust = 0;
  let dealt = 0;
  let taken = 0;
  const steps: CranStep[] = [];
  let ev: StepEvent[] = [];
  let enemyActed = false;

  const ressorts = (): CardInst[] => s.dial.filter((c): c is CardInst => !!c && c.id === 'ressort');
  const tension = (): number => ressorts().reduce((a, c) => a + c.tension, 0);

  // Début du tour : les cartes vieillissent, les Ressorts se tendent.
  for (const c of s.dial) {
    if (!c) continue;
    c.turns++;
    if (c.id === 'ressort') c.tension += vOf(c);
  }

  const val = (c: number, base: number, factor: number): number => {
    let x = base + bonus[c]!;
    if (has(s, 'complication') && (c + 1) % 3 === 0) x = Math.floor(x * 1.5);
    return Math.floor(x * factor);
  };

  const hit = (c: number, card: CardInst | null, amount: number): void => {
    if (amount <= 0 || s.enemy.hp <= 0) return;
    const blocked = Math.min(s.enemy.block, amount);
    s.enemy.block -= blocked;
    s.enemy.hp -= amount - blocked;
    dealtAt[c] = dealtAt[c]! + amount;
    dealt += amount - blocked;
    if (card) perCard.set(card.uid, (perCard.get(card.uid) ?? 0) + amount);
    ev.push({ t: 'hit', cran: c, v: amount, blocked });
  };

  const hurt = (c: number, amount: number): void => {
    if (amount <= 0) return;
    const blocked = Math.min(s.player.block, amount);
    s.player.block -= blocked;
    s.player.hp -= amount - blocked;
    taken += amount - blocked;
    ev.push({ t: 'hurt', v: amount, blocked, cran: c });
  };

  const block = (v: number): void => {
    if (v <= 0) return;
    s.player.block += v;
    ev.push({ t: 'block', who: 'player', v });
  };

  const moveIntent = (from: number, to: number): void => {
    if (from > 11 || to > 11 || from < 0 || to < 0) return;
    for (const it of intents) {
      if (it.cran === from) it.cran = -1;
    }
    for (const it of intents) if (it.cran === to) it.cran = from;
    for (const it of intents) if (it.cran === -1) it.cran = to;
    ev.push({ t: 'move', from, to });
  };

  const CHAIN_PRE = new Set(['bouclier', 'garde', 'barillet', 'remonter']);

  const pre = (card: CardInst, c: number, factor: number): void => {
    const v = vOf(card);
    const w = wOf(card);
    switch (card.id) {
      case 'bouclier':
      case 'garde':
        block(val(c, v, factor));
        break;
      case 'barillet':
        block(val(c, v + w * tension(), factor));
        break;
      case 'remonter':
        block(val(c, v, factor));
        for (const r of ressorts()) r.tension += 1;
        ev.push({ t: 'tension', v: 1 });
        break;
      case 'parade':
        parry[c] = v / 100;
        break;
      case 'retard':
        moveIntent(c + 1, c + 2);
        break;
      case 'avance':
        moveIntent(c + 2, c + 1);
        break;
      case 'grippage': {
        let bestI = -1;
        intents.forEach((it, i) => {
          if (annulled.has(i) || it.cran < c) return;
          if (bestI < 0 || it.cran < intents[bestI]!.cran) bestI = i;
        });
        if (bestI >= 0) {
          annulled.add(bestI);
          ev.push({ t: 'annul', intentCran: intents[bestI]!.cran });
        }
        break;
      }
      case 'elan':
        if (c < 11) bonus[c + 1] = bonus[c + 1]! + v;
        break;
      case 'double':
        if (c < 11) acts[c + 1] = acts[c + 1]! * 2;
        break;
    }
  };

  const act = (card: CardInst, c: number, factor: number): void => {
    const v = vOf(card);
    const w = wOf(card);
    switch (card.id) {
      case 'retard':
      case 'avance':
        if (v > 0) hit(c, card, val(c, v, factor));
        break;
      case 'frappe':
        hit(c, card, val(c, v, factor));
        break;
      case 'coupDouble':
        hit(c, card, val(c, v, factor));
        hit(c, card, val(c, v, factor));
        break;
      case 'garde':
        hit(c, card, val(c, w, factor));
        break;
      case 'contretemps':
        if (enemyActed) hit(c, card, val(c, v, factor));
        break;
      case 'riposte':
        hit(c, card, val(c, v + (parried ? w : 0), factor));
        break;
      case 'lecture':
        hit(c, card, val(c, v, factor));
        s.extraDraw = Math.min(2, s.extraDraw + 1);
        break;
      case 'engrenage': {
        const n = (c > 0 && s.dial[c - 1] ? 1 : 0) + (c < 11 && s.dial[c + 1] ? 1 : 0);
        hit(c, card, val(c, v + w * n, factor));
        break;
      }
      case 'chaine':
        for (const c2 of [c - 1, c - 2]) {
          const other = c2 >= 0 ? s.dial[c2] : null;
          if (!other || other.id === 'chaine') continue;
          if (CHAIN_PRE.has(other.id)) pre(other, c2, factor * (v / 100));
          act(other, c2, factor * (v / 100));
        }
        break;
      case 'pignon': {
        const n = s.dial.filter((x) => x && ENGRENAGE_IDS.has(x.id)).length;
        hit(c, card, val(c, v + w * n, factor));
        break;
      }
      case 'courroie':
        hit(c, card, val(c, v + (c > 0 && dealtAt[c - 1]! > 0 ? w : 0), factor));
        break;
      case 'declic': {
        const t = tension();
        if (t > 0) {
          hit(c, card, val(c, v * t, factor));
          for (const r of ressorts()) r.tension = 0;
        }
        break;
      }
      case 'spirale':
        hit(c, card, val(c, v * 2 ** Math.min(6, card.turns - 1), factor));
        break;
      case 'cliquet': {
        hit(c, card, val(c, v, factor));
        let best: CardInst | null = null;
        let bd = 99;
        s.dial.forEach((x, i) => {
          if (x && x.id === 'ressort' && Math.abs(i - c) < bd) {
            bd = Math.abs(i - c);
            best = x;
          }
        });
        if (best) {
          (best as CardInst).tension += 1;
          ev.push({ t: 'tension', v: 1 });
        }
        break;
      }
      case 'midi':
        if (c === 11) hit(c, card, val(c, v, factor));
        break;
      case 'rouille':
        rust += Math.max(1, Math.floor(v * factor));
        break;
    }
  };

  const attack = (c: number, dmg: number): void => {
    if (parry[c]! > 0) {
      const reflect = Math.floor(dmg * parry[c]!);
      parry[c] = 0;
      parried = true;
      ev.push({ t: 'parry', reflect });
      hit(c, null, reflect);
    } else hurt(c, dmg);
  };

  for (let c = 0; c < CRANS; c++) {
    ev = [];
    enemyActed = false;
    const card = s.dial[c];
    const n = acts[c]! * (has(s, 'echappement') && c === 11 ? 2 : 1);

    // A. Préparation de ta carte (boucliers, parades, manipulations du temps).
    if (card) for (let k = 0; k < n; k++) pre(card, c, 1);

    // B. Intentions de l'automate sur ce cran.
    intents.forEach((it, i) => {
      if (it.cran !== c) return;
      if (annulled.has(i)) return;
      enemyActed = true;
      switch (it.kind) {
        case 'attack':
          attack(c, it.value * mult);
          break;
        case 'copy':
          attack(c, Math.max(4, s.lastBestHit) * mult);
          break;
        case 'bigAttack':
          if (intents.some((x, j) => x.kind === 'charge' && annulled.has(j))) ev.push({ t: 'fizzle' });
          else attack(c, it.value * mult);
          break;
        case 'gap':
          if (s.dial[c]) ev.push({ t: 'gapBlocked' });
          else hurt(c, it.value * mult);
          break;
        case 'block':
          s.enemy.block += it.value;
          ev.push({ t: 'block', who: 'enemy', v: it.value });
          break;
        case 'heal': {
          const before = s.enemy.hp;
          s.enemy.hp = Math.min(s.enemy.maxHp, s.enemy.hp + it.value);
          ev.push({ t: 'heal', v: s.enemy.hp - before });
          break;
        }
        case 'erase': {
          const x = s.dial[c];
          if (x) {
            s.dial[c] = null;
            x.tension = 0;
            x.turns = 0;
            s.discard.push(x);
            ev.push({ t: 'erase', uid: x.uid });
          }
          break;
        }
        case 'charge':
          break;
      }
    });

    // Si l'automate t'a brisée, ta carte n'a pas le temps d'agir.
    if (s.player.hp <= 0) {
      s.player.hp = 0;
      s.outcome = 'lose';
    }

    // C. Action de ta carte (si elle n'a pas été démontée).
    if (!s.outcome && card && s.dial[c] === card) for (let k = 0; k < n; k++) act(card, c, 1);

    // D. Fin de cran.
    if (rust > 0 && s.enemy.hp > 0) {
      s.enemy.hp -= rust;
      dealt += rust;
      ev.push({ t: 'rust', v: rust });
    }

    if (!s.outcome && s.enemy.hp <= 0) {
      s.enemy.hp = 0;
      s.outcome = 'win';
    }
    steps.push({
      cran: c,
      events: ev,
      enemyActed,
      player: { ...s.player },
      enemy: { hp: s.enemy.hp, maxHp: s.enemy.maxHp, block: s.enemy.block },
      intents: intents.map((i) => ({ ...i })),
      annulled: [...annulled],
    });
    if (s.outcome) break;
  }

  const log: TourLog = { tour: s.tour, steps, dealt, taken, outcome: s.outcome };
  s.lastBestHit = Math.max(0, ...perCard.values());
  if (!s.outcome) {
    const ph = phaseFor(s.enemy.id, s.enemy.hp, s.enemy.maxHp);
    if (ph > s.enemy.phase) {
      s.rotatePending += 3 * (ph - s.enemy.phase);
      s.enemy.phase = ph;
    }
    s.tour++;
    startTour(s);
  }
  return log;
}

/** Aperçu exact du tour, sans toucher à l'état. */
export function previewTour(s: CombatState): TourLog {
  return resolveTour(structuredClone(s));
}

/** Valeur affichée sur une carte posée (estimation hors bonus de cran). */
export function cardBadge(s: CombatState, c: CardInst): string {
  const d = def(c);
  if (c.id === 'ressort') return `T${c.tension}`;
  if (c.id === 'declic') {
    const t = s.dial.reduce((a, x) => a + (x && x.id === 'ressort' ? x.tension : 0), 0);
    return String(vOf(c) * t);
  }
  if (c.id === 'spirale') return String(vOf(c) * 2 ** Math.min(6, Math.max(0, c.turns)));
  if (c.id === 'retard' || c.id === 'avance') return vOf(c) ? String(vOf(c)) : '';
  if (['grippage', 'double'].includes(c.id)) return '';
  if (c.id === 'parade') return `${vOf(c)}%`;
  if (c.id === 'elan') return `+${vOf(c)}`;
  if (c.id === 'chaine') return `${vOf(c)}%`;
  if (c.id === 'rouille') return `${vOf(c)}/c`;
  return d.v ? String(vOf(c)) : '';
}
