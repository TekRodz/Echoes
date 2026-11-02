// Interface de Cadran : écrans de run, cadran interactif, animation des tours.
import './style.css';
import { Sound } from '../../../src/audio';
import { ARCHETYPE_NAME, CARDS, coupleOf, def, textOf } from '../engine/cards';
import { canMove, canPlace, canRemove, cardBadge, coupleUsed, intentsFor, minuitMult, minuitTour, move, place, previewTour, remove, resolveTour } from '../engine/combat';
import { ENEMIES } from '../engine/enemies';
import { RELICS } from '../engine/relics';
import { buyCard, buyRelic, chooseNode, COST, finishCombat, HEURES, leaveAtelier, newRun, removeCard, repair, takeReward, temperCard, type RunState } from '../engine/run';
import type { CardInst, CombatState, TourLog } from '../engine/types';
import { cranPercent, renderDial } from './dial';
import { glyph, ROMAN, sprite } from './icons';

// ——— État de l'interface ———

type Sel = { kind: 'hand'; i: number } | { kind: 'slot'; c: number } | null;
type Overlay = null | { kind: 'deck'; mode: 'view' | 'remove' | 'temper' } | { kind: 'rules' } | { kind: 'menu'; confirm?: boolean } | { kind: 'end' };

interface Anim {
  pre: CombatState;
  log: TourLog;
  k: number;
  erased: Set<number>;
  floats: string;
}

const SAVE_KEY = 'cadran.run.v1';
const SETTINGS_KEY = 'cadran.settings';
const app = document.getElementById('app')!;
const sound = new Sound();

let run: RunState | null = null;
let onTitle = true;
let sel: Sel = null;
let undo: CombatState[] = [];
let peek = 0; // 0 = tour courant, 1 = tour suivant, 2 = dans 2 tours (Verre de montre)
let anim: Anim | null = null;
let overlay: Overlay = null;
let settings = { speed: 1, sound: true };

function store<T>(key: string, value?: T): T | null {
  try {
    if (value === undefined) {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    }
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible : on joue sans sauvegarde */
  }
  return null;
}

settings = { ...settings, ...(store<typeof settings>(SETTINGS_KEY) ?? {}) };
sound.enabled = settings.sound;
const saved = store<RunState>(SAVE_KEY);
const canResume = (): boolean => !!saved && saved.screen !== 'won' && saved.screen !== 'lost';

function save(): void {
  if (run) store(SAVE_KEY, run);
}

// ——— Briques HTML ———

const roman = (n: number): string => ROMAN[n - 1] ?? String(n);
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function hpBar(hp: number, max: number, enemy = false): string {
  return `<span class="hpbar${enemy ? ' enemy' : ''}"><i style="width:${Math.max(0, (hp / max) * 100)}%"></i></span>`;
}

function cardHtml(c: CardInst | string, o: { selected?: boolean; cant?: boolean; act?: string; arg?: string | number; ghost?: boolean } = {}): string {
  const inst: CardInst = typeof c === 'string' ? { uid: 0, id: c, tempered: false, tension: 0, turns: 0 } : c;
  const d = def(inst);
  const pips = Array.from({ length: coupleOf(inst) }, () => '<i></i>').join('');
  const cls = ['card', o.selected ? 'selected' : '', o.cant ? 'cant' : '', o.ghost ? 'ghost' : ''].join(' ');
  const attrs = o.act ? `data-act="${o.act}" data-arg="${o.arg ?? ''}"` : 'disabled';
  return `<button type="button" class="${cls}" ${attrs} aria-label="${esc(d.name)} : ${esc(textOf(inst))}">
    <span class="top"><span class="nm${inst.tempered ? ' tempered' : ''}">${d.name}</span><span class="pips" title="Couple ${coupleOf(inst)}">${pips}</span></span>
    <span class="tx">${textOf(inst)}</span>
    <span class="arch">${glyph(d.glyph, 12, '#5a4a36')}${ARCHETYPE_NAME[d.archetype]}</span>
  </button>`;
}

function topBar(r: RunState, hp = r.hp): string {
  return `<div class="bar">
    <span class="heure">Heure ${roman(r.heure)}</span>
    <span class="stat" title="Intégrité">${glyph('heart', 16, '#1f1a14')}${hpBar(hp, r.maxHp)} ${hp}/${r.maxHp}</span>
    <span class="spacer"></span>
    <span class="stat" title="Laiton">${glyph('laiton', 16, '#8a6a2f')}${r.laiton}</span>
    <button type="button" class="icon-btn" data-act="deck" aria-label="Voir le deck">${glyph('deck', 18, '#1f1a14')}${r.deck.length}</button>
    <button type="button" class="icon-btn" data-act="menu" aria-label="Menu">${glyph('clock', 18, '#1f1a14')}</button>
  </div>`;
}

function relicsHtml(r: RunState): string {
  if (!r.relics.length) return '';
  return `<div class="relics">${r.relics.map((id) => `<span class="relic" title="${esc(RELICS[id].text)}">${glyph('relic', 13, '#8a6a2f')}${RELICS[id].name}</span>`).join('')}</div>`;
}

const RULES = `
  <p><b>Le cadran.</b> 12 crans. L’anneau extérieur montre ce que l’automate fera à chaque cran ; l’anneau intérieur porte tes cartes.</p>
  <p><b>Un tour.</b> Tu pioches 3 cartes et tu fais <b>une</b> action : poser une carte, déplacer une carte posée, ou en retirer une. (Deux au premier tour.)</p>
  <p><b>Le cadran tourne.</b> À chaque cran : ta défense, puis l’automate, puis ton attaque. Les chiffres au centre du cadran sont la prévision exacte du tour.</p>
  <p><b>Le temps se rembobine.</b> Tes cartes restent posées et rejouent à chaque tour. La machine grandit d’une pièce par tour.</p>
  <p><b>Couple.</b> Le poids total des cartes posées est limité (losanges sur chaque carte).</p>
  <p><b>Minuit.</b> Au 6e tour, l’automate double ses dégâts, puis encore à chaque tour. Ne traîne pas.</p>`;

// ——— Écrans ———

function titleScreen(): string {
  return `<div class="scroll">
    <div class="hero">
      <p class="kicker">Prototype · deckbuilder horloger</p>
      <h1>Cadran</h1>
      <p>Pose des instants sur le cadran. À chaque tour, le temps se rembobine et ta machine rejoue, avec une pièce de plus.</p>
    </div>
    <div class="stack">
      ${canResume() ? `<button type="button" class="primary" data-act="resume">Reprendre la run · Heure ${roman(saved!.heure)}</button>` : ''}
      <button type="button" class="${canResume() ? 'secondary' : 'primary'}" data-act="new">Nouvelle run</button>
      <button type="button" class="secondary" data-act="daily">Cadran du jour</button>
      <button type="button" class="secondary" data-act="rules">Comment jouer</button>
    </div>
    <p class="kicker" style="margin-top:auto">L’Horlogère · 25 cartes · 6 Heures · 8 rouages</p>
  </div>`;
}

function mapScreen(r: RunState): string {
  const nodes = r.nodes
    .map((n, i) => {
      const e = ENEMIES[n.enemy];
      const hp = n.kind === 'boss' ? e.hp : Math.round(e.hp * (1 + 0.1 * (r.heure - 1)));
      const tag = n.kind === 'boss' ? '<span class="tag boss">Boss</span>' : n.kind === 'elite' ? '<span class="tag elite">Élite · rouage garanti</span>' : '<span class="tag">Automate</span>';
      return `<button type="button" class="node ${n.kind}" data-act="node" data-arg="${i}">
        ${sprite(n.enemy, 52)}
        <span class="nd">${tag}<b>${e.name}</b><small>${hp} PV · ${e.text}</small></span>
      </button>`;
    })
    .join('');
  return `${topBar(r)}
  <div class="scroll">
    <div class="stack">
      <p class="kicker">${r.heure === HEURES ? 'Dernière heure' : `Heure ${roman(r.heure)} sur ${roman(HEURES)}`}</p>
      <h2 style="font-size:34px">${r.heure === HEURES ? 'Minuit approche' : 'Choisis ton automate'}</h2>
      ${relicsHtml(r)}
    </div>
    <div class="stack">${nodes}</div>
  </div>`;
}

function forecastOf(log: TourLog): { dealt: number[]; taken: number[] } {
  const dealt = Array<number>(12).fill(0);
  const taken = Array<number>(12).fill(0);
  for (const st of log.steps) {
    for (const e of st.events) {
      if (e.t === 'hit') dealt[st.cran] = dealt[st.cran]! + e.v - e.blocked;
      if (e.t === 'rust') dealt[st.cran] = dealt[st.cran]! + e.v;
      if (e.t === 'hurt') taken[st.cran] = taken[st.cran]! + e.v - e.blocked;
    }
  }
  return { dealt, taken };
}

function combatScreen(r: RunState): string {
  const s = r.combat!;
  const view = anim ? anim.pre : s;
  const step = anim && anim.k >= 0 ? anim.log.steps[anim.k] : null;
  const enemy = step ? step.enemy : s.enemy;
  const player = step ? step.player : s.player;
  const e = ENEMIES[s.enemy.id];

  let intents = intentsFor(view, view.tour + (anim ? 0 : peek));
  let annulled = new Set<number>();
  let moved: { from: number; to: number }[] = [];
  let forecast: { dealt: number[]; taken: number[] } | null = null;
  let log: TourLog | null = null;
  if (anim) {
    const st = step ?? anim.log.steps[0];
    if (st) {
      const base = intentsFor(view, view.tour);
      intents = st.intents;
      annulled = new Set(st.annulled);
      moved = base.map((b, i) => ({ from: b.cran, to: intents[i]?.cran ?? b.cran })).filter((m) => m.from !== m.to);
    }
  } else if (peek === 0) {
    log = previewTour(s);
    const last = log.steps[log.steps.length - 1];
    if (last) {
      intents = last.intents;
      annulled = new Set(last.annulled);
      const base = intentsFor(s, s.tour);
      moved = base.map((b, i) => ({ from: b.cran, to: intents[i]?.cran ?? b.cran })).filter((m) => m.from !== m.to);
    }
    forecast = forecastOf(log);
  }

  const tourShown = view.tour + (anim ? 0 : peek);
  const mult = minuitMult(view, tourShown);
  const toMinuit = minuitTour(view) - tourShown;
  const targets = new Set<number>();
  if (!anim && sel?.kind === 'hand') for (let c = 0; c < 12; c++) if (canPlace(s, sel.i, c)) targets.add(c);
  if (!anim && sel?.kind === 'slot') for (let c = 0; c < 12; c++) if (canMove(s, sel.c, c)) targets.add(c);

  const dial = renderDial({
    dial: view.dial,
    intents,
    annulled,
    moved,
    mult,
    lastBestHit: view.lastBestHit,
    targets,
    selected: sel?.kind === 'slot' ? sel.c : null,
    active: step ? step.cran : null,
    forecast,
    ghost: peek > 0 && !anim,
    title: peek > 0 && !anim ? `Tour ${tourShown}` : `Tour ${view.tour}`,
    sub: mult > 1 ? `!Minuit ×${mult}` : toMinuit <= 2 ? `!Minuit dans ${toMinuit}` : `Minuit au tour ${minuitTour(view)}`,
    badge: (c) => cardBadge(view, c),
    hand: step ? step.cran + 1 : 0,
    erased: anim?.erased ?? new Set(),
  });

  // Ligne de prévision
  let fore: string;
  if (anim) fore = `<span>Le cadran tourne…</span><button type="button" class="toggle" data-act="skip">Passer</button>`;
  else if (peek > 0) fore = `<span>Intentions du tour ${tourShown} (aperçu)</span>${peekBtn(s)}`;
  else fore = `<span>Prévu : tu infliges <strong>${log!.dealt}</strong> · tu subis <strong class="${log!.taken ? 'bad' : ''}">${log!.taken}</strong>${log!.outcome === 'win' ? ' · <strong>victoire</strong>' : log!.outcome === 'lose' ? ' · <strong class="bad">défaite</strong>' : ''}</span>${peekBtn(s)}`;

  // Ligne de détail
  let detail = '';
  if (anim) detail = '<span class="grow"></span>';
  else if (sel?.kind === 'hand') {
    const c = s.hand[sel.i]!;
    const fits = coupleUsed(s) + coupleOf(c) <= s.coupleMax;
    detail = `<span class="grow"><strong>${def(c).name}</strong> · ${fits ? 'touche un cran libre pour la poser.' : '<span class="danger">Couple insuffisant : retire d’abord une carte du cadran.</span>'}</span>`;
  } else if (sel?.kind === 'slot') {
    const c = s.dial[sel.c]!;
    detail = `<span class="grow"><strong>${def(c).name}${c.tempered ? '+' : ''}</strong> · cran ${sel.c + 1} · ${textOf(c)}${c.id === 'ressort' ? ` Tension : ${c.tension}.` : ''} ${s.actionsLeft ? 'Touche un cran libre pour la déplacer.' : ''}</span>${canRemove(s, sel.c) ? '<button type="button" class="toggle" data-act="remove">Retirer</button>' : ''}`;
  } else {
    const firstFight = r.heure === 1 && s.tour <= 2;
    const tip = firstFight
      ? 'Les pastilles rouges sont ses coups. Une Parade posée sur le même cran l’annule et la renvoie.'
      : 'Choisis une carte de ta main, puis un cran. Touche une carte posée pour la déplacer ou la retirer.';
    detail = `<span class="grow">${s.actionsLeft > 0 ? tip : 'Plus d’action pour ce tour : lance le cadran.'}</span>`;
  }

  const hand = (anim ? anim.pre.hand : s.hand)
    .map((c, i) => cardHtml(c, { selected: sel?.kind === 'hand' && sel.i === i, cant: !anim && s.actionsLeft > 0 && coupleUsed(s) + coupleOf(c) > s.coupleMax, act: anim ? undefined : 'hand', arg: i }))
    .join('');
  const pad = Array.from({ length: Math.max(0, 3 - (anim ? anim.pre.hand.length : s.hand.length)) }, () => cardHtml('frappe', { ghost: true })).join('');

  return `${topBar(r, player.hp)}
  <div class="enemy" id="enemy">
    ${sprite(s.enemy.id, 50)}
    <div class="who">
      <span class="name">${e.name}<small>${e.tier === 'boss' ? `Boss · phase ${s.enemy.phase + 1}/3` : e.tier === 'elite' ? 'Élite' : 'Automate'}</small></span>
      <span class="row">${hpBar(enemy.hp, enemy.maxHp, true)} ${enemy.hp}/${enemy.maxHp}${enemy.block ? ` <span class="shieldv">${glyph('block', 13, '#1f1a14')} ${enemy.block}</span>` : ''}</span>
      <span class="text">${e.text}</span>
    </div>
  </div>
  <div class="dial-wrap"><div class="dial-box" id="dialBox">${dial}${anim?.floats ?? ''}</div></div>
  <div class="forecast">${fore}</div>
  <div class="detail">${detail}</div>
  <div class="hand">${hand}${pad}</div>
  <div class="actions">
    <button type="button" class="secondary" data-act="undo" ${anim || !undo.length ? 'disabled' : ''}>Annuler</button>
    <span class="info">Couple <b>${coupleUsed(view)}/${view.coupleMax}</b> · ${view.actionsLeft} action${view.actionsLeft > 1 ? 's' : ''}${player.block ? ` · ${glyph('block', 11, '#1f1a14')} ${player.block}` : ''}</span>
    <button type="button" class="primary" data-act="launch" ${anim ? 'disabled' : ''}>Lancer</button>
  </div>`;
}

function peekBtn(s: CombatState): string {
  const max = s.relics.includes('verre') ? 2 : 1;
  const label = peek === 0 ? 'Tour suivant' : peek < max ? `Tour +${peek + 1}` : 'Tour actuel';
  return `<button type="button" class="toggle ${peek ? 'on' : ''}" data-act="peek">${label}</button>`;
}

function rewardScreen(r: RunState): string {
  const rw = r.reward!;
  return `${topBar(r)}
  <div class="scroll">
    <div class="stack">
      <p class="kicker">Heure ${roman(r.heure)} · automate démonté</p>
      <h2 style="font-size:32px">Butin</h2>
      <p>${glyph('laiton', 16, '#8a6a2f')} +${rw.laiton} de laiton</p>
      ${rw.relic ? `<div class="service"><span><b>${RELICS[rw.relic].name}</b><small>${RELICS[rw.relic].text}</small></span>${glyph('relic', 22, '#8a6a2f')}</div>` : ''}
    </div>
    <div class="section-title">Ajoute une carte<small>ou passe</small></div>
    <div class="grid3">${rw.cards.map((id) => cardHtml(id, { act: 'pick', arg: id })).join('')}</div>
    <button type="button" class="secondary" data-act="pick" data-arg="">Passer</button>
  </div>`;
}

function atelierScreen(r: RunState): string {
  const a = r.atelier!;
  const cards = a.cards
    .map((o, i) => `<div>${cardHtml(o.id, { act: o.sold || r.laiton < o.price ? undefined : 'buy', arg: i, cant: o.sold })}<p class="price">${o.sold ? 'Vendue' : `${glyph('laiton', 12, '#8a6a2f')} ${o.price}`}</p></div>`)
    .join('');
  const relic = a.relic
    ? `<div class="service"><span><b>${RELICS[a.relic.id].name}</b><small>${RELICS[a.relic.id].text}</small></span><button type="button" class="toggle" data-act="buyRelic" ${a.relic.sold || r.laiton < a.relic.price ? 'disabled' : ''}>${a.relic.sold ? 'Acheté' : `${a.relic.price}`}</button></div>`
    : '';
  const svc = (label: string, small: string, act: string, price: number, used: boolean, extra = true): string =>
    `<div class="service"><span><b>${label}</b><small>${small}</small></span><button type="button" class="toggle" data-act="${act}" ${used || r.laiton < price || !extra ? 'disabled' : ''}>${used ? 'Fait' : price}</button></div>`;
  return `${topBar(r)}
  <div class="scroll">
    <div class="stack">
      <p class="kicker">Heure ${roman(r.heure)} · entre deux heures</p>
      <h2 style="font-size:32px">L’Atelier</h2>
      ${relicsHtml(r)}
    </div>
    <div class="section-title">Cartes<small>${glyph('laiton', 12, '#8a6a2f')} ${r.laiton} de laiton</small></div>
    <div class="grid3">${cards}</div>
    ${relic ? `<div class="section-title">Rouage</div>${relic}` : ''}
    <div class="section-title">Services<small>un de chaque par visite</small></div>
    ${svc('Retirer une carte', 'Allège ton deck.', 'svcRemove', COST.remove, a.removed, r.deck.length > 5)}
    ${svc('Tremper une carte', 'Améliore une carte (+).', 'svcTemper', COST.temper, a.tempered)}
    ${svc('Réparer', `+${COST.repairHp} d’Intégrité.`, 'svcRepair', COST.repair, a.repaired, r.hp < r.maxHp)}
    <button type="button" class="primary" data-act="leave">${r.heure + 1 >= HEURES ? 'Affronter le Grand Carillon' : `Passer à l’Heure ${roman(r.heure + 1)}`}</button>
  </div>`;
}

function endScreen(r: RunState): string {
  const won = r.screen === 'won';
  return `<div class="scroll">
    <div class="hero">
      <p class="kicker">${won ? 'Minuit est passé' : `Brisée à l’Heure ${roman(r.heure)}`}</p>
      <h1 style="font-size:46px">${won ? 'Le Carillon s’est tu' : 'L’horloge t’a eue'}</h1>
      <p>${r.stats.combats} combat${r.stats.combats > 1 ? 's' : ''} · ${r.stats.tours} tours de cadran · ${r.deck.length} cartes · ${r.relics.length} rouage${r.relics.length > 1 ? 's' : ''}</p>
      ${relicsHtml(r)}
    </div>
    <div class="stack">
      <button type="button" class="primary" data-act="new">Nouvelle run</button>
      <button type="button" class="secondary" data-act="deck">Voir le deck final</button>
      <button type="button" class="secondary" data-act="title">Écran titre</button>
    </div>
  </div>`;
}

function overlayHtml(): string {
  if (!overlay) return '';
  if (overlay.kind === 'rules') return `<div class="overlay" data-act="close"><div class="panel" data-stop><h2>Comment jouer</h2><div class="rules">${RULES}</div><button type="button" class="primary" data-act="close">Compris</button></div></div>`;
  if (overlay.kind === 'menu') {
    return `<div class="overlay" data-act="close"><div class="panel" data-stop>
      <h2>Pause</h2>
      <div class="service"><span><b>Vitesse du cadran</b></span><button type="button" class="toggle" data-act="speed">×${settings.speed}</button></div>
      <div class="service"><span><b>Son</b></span><button type="button" class="toggle" data-act="sound">${settings.sound ? 'Oui' : 'Non'}</button></div>
      <button type="button" class="secondary" data-act="rules">Comment jouer</button>
      <button type="button" class="secondary danger" data-act="abandon">${overlay.confirm ? 'Confirmer l’abandon' : 'Abandonner la run'}</button>
      <button type="button" class="primary" data-act="close">Reprendre</button>
    </div></div>`;
  }
  if (overlay.kind === 'end' && run?.combat) {
    const s = run.combat;
    const win = s.outcome === 'win';
    return `<div class="overlay"><div class="panel">
      <p class="kicker center">${ENEMIES[s.enemy.id].name}</p>
      <h2>${win ? 'Automate démonté' : 'Intégrité brisée'}</h2>
      <p class="muted">${win ? `En ${s.tour} tour${s.tour > 1 ? 's' : ''} de cadran. Il te reste ${s.player.hp} d’Intégrité.` : 'La run s’arrête ici.'}</p>
      <button type="button" class="primary" data-act="endCombat">Continuer</button>
    </div></div>`;
  }
  if (overlay.kind === 'deck' && run) {
    const mode = overlay.mode;
    const list = [...run.deck].sort((a, b) => def(a).name.localeCompare(def(b).name));
    const can = (c: CardInst): boolean => (mode === 'remove' ? true : mode === 'temper' ? !c.tempered : false);
    const title = mode === 'remove' ? `Retirer une carte · ${COST.remove}` : mode === 'temper' ? `Tremper une carte · ${COST.temper}` : `Deck · ${run.deck.length} cartes`;
    return `<div class="overlay" data-act="close"><div class="panel" data-stop>
      <h2 style="font-size:24px">${title}</h2>
      ${mode === 'temper' ? '<p class="muted">Une carte trempée gagne en puissance (+).</p>' : ''}
      <div class="deck-grid">${list.map((c) => cardHtml(c, { act: can(c) ? (mode === 'remove' ? 'doRemove' : 'doTemper') : undefined, arg: c.uid, cant: mode !== 'view' && !can(c) })).join('')}</div>
      <button type="button" class="secondary" data-act="close">Fermer</button>
    </div></div>`;
  }
  return '';
}

// ——— Rendu ———

function render(): void {
  let html: string;
  if (onTitle || !run) html = titleScreen();
  else if (run.screen === 'map') html = mapScreen(run);
  else if (run.screen === 'combat') html = combatScreen(run);
  else if (run.screen === 'reward') html = rewardScreen(run);
  else if (run.screen === 'atelier') html = atelierScreen(run);
  else html = endScreen(run);
  app.innerHTML = html + overlayHtml();
}

// ——— Combat : actions et animation ———

function pushUndo(s: CombatState): void {
  undo.push(structuredClone(s));
}

function onSlot(c: number): void {
  const s = run?.combat;
  if (!s || anim) return;
  if (peek) peek = 0;
  if (sel?.kind === 'hand') {
    if (canPlace(s, sel.i, c)) {
      pushUndo(s);
      place(s, sel.i, c);
      sel = null;
      sound.click();
    } else if (s.dial[c]) sel = { kind: 'slot', c };
  } else if (sel?.kind === 'slot') {
    if (sel.c === c) sel = null;
    else if (canMove(s, sel.c, c)) {
      pushUndo(s);
      move(s, sel.c, c);
      sel = null;
      sound.click();
    } else if (s.dial[c]) sel = { kind: 'slot', c };
  } else if (s.dial[c]) sel = { kind: 'slot', c };
  render();
}

function launch(): void {
  const s = run?.combat;
  if (!s || anim || s.outcome) return;
  sound.unlock();
  sel = null;
  peek = 0;
  const pre = structuredClone(s);
  const log = resolveTour(s);
  undo = [];
  anim = { pre, log, k: -1, erased: new Set(), floats: '' };
  render();
  tickAnim();
}

let animTimer = 0;
function tickAnim(): void {
  if (!anim) return;
  anim.k++;
  const st = anim.log.steps[anim.k];
  if (!st) {
    endAnim();
    return;
  }
  const floats: string[] = [];
  const at = (cran: number, r: number, text: string, cls = ''): void => {
    const [x, y] = cranPercent(cran, r);
    floats.push(`<span class="float ${cls}" style="left:${x}%;top:${y}%">${text}</span>`);
  };
  let hurt = false;
  let hit = false;
  for (const e of st.events) {
    if (e.t === 'hit') {
      at(st.cran, 98, String(e.v - e.blocked || '0'));
      hit = true;
    } else if (e.t === 'hurt') {
      if (e.v - e.blocked > 0) {
        at(st.cran, 122, `−${e.v - e.blocked}`, 'hurt');
        hurt = true;
      } else at(st.cran, 122, 'absorbé', 'info');
    } else if (e.t === 'parry') at(st.cran, 122, 'paré', 'info');
    else if (e.t === 'block' && e.who === 'player') at(st.cran, 70, `+${e.v}`, 'info');
    else if (e.t === 'fizzle') at(st.cran, 122, 'silence', 'info');
    else if (e.t === 'annul') at(e.intentCran, 122, 'annulée', 'info');
    else if (e.t === 'gapBlocked') at(st.cran, 122, 'bloqué', 'info');
    else if (e.t === 'erase') {
      anim.erased.add(e.uid);
      at(st.cran, 98, 'démontée', 'hurt');
    } else if (e.t === 'rust') at(st.cran, 70, `−${e.v}`, 'info');
  }
  anim.floats = floats.join('');
  sound.tick(st.cran === 11);
  if (hit) sound.scratch();
  if (hurt) sound.fail();
  if (st.events.some((e) => e.t === 'parry' || e.t === 'fizzle' || e.t === 'annul')) sound.glass();
  render();
  if (hurt) document.getElementById('dialBox')?.classList.add('shake');
  animTimer = window.setTimeout(tickAnim, 460 / settings.speed);
}

function endAnim(): void {
  window.clearTimeout(animTimer);
  anim = null;
  const s = run?.combat;
  if (s?.outcome) {
    overlay = { kind: 'end' };
    if (s.outcome === 'win') sound.win();
    else sound.fail();
  } else sound.rewind();
  save();
  render();
}

// ——— Événements ———

app.addEventListener('click', (ev) => {
  const target = ev.target as Element;
  const slot = target.closest('.slot') as SVGGElement | null;
  if (slot && !overlay) {
    onSlot(Number(slot.dataset.cran));
    return;
  }
  const el = target.closest('[data-act]') as HTMLElement | null;
  if (!el) return;
  if (el.classList.contains('overlay') && target.closest('[data-stop]')) return;
  sound.unlock();
  const act = el.dataset.act!;
  const arg = el.dataset.arg ?? '';
  const s = run?.combat ?? null;
  switch (act) {
    case 'new':
    case 'daily': {
      const d = new Date();
      const seed = act === 'daily' ? d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() : (Math.random() * 2 ** 31) >>> 0;
      run = newRun(seed);
      onTitle = false;
      overlay = store<boolean>('cadran.seenRules') ? null : { kind: 'rules' };
      store('cadran.seenRules', true);
      save();
      break;
    }
    case 'resume':
      run = saved;
      onTitle = false;
      break;
    case 'title':
      onTitle = true;
      overlay = null;
      break;
    case 'rules':
      overlay = { kind: 'rules' };
      break;
    case 'menu':
      overlay = { kind: 'menu' };
      break;
    case 'close':
      overlay = null;
      break;
    case 'speed':
      settings.speed = settings.speed === 1 ? 2 : 1;
      store(SETTINGS_KEY, settings);
      break;
    case 'sound':
      settings.sound = !settings.sound;
      sound.enabled = settings.sound;
      store(SETTINGS_KEY, settings);
      break;
    case 'abandon':
      if (overlay?.kind === 'menu' && overlay.confirm && run) {
        run.screen = 'lost';
        overlay = null;
        anim = null;
        save();
      } else overlay = { kind: 'menu', confirm: true };
      break;
    case 'deck':
      overlay = { kind: 'deck', mode: 'view' };
      break;
    case 'node':
      if (run) {
        chooseNode(run, Number(arg));
        sel = null;
        undo = [];
        peek = 0;
        save();
      }
      break;
    case 'hand':
      if (s && !anim) {
        const i = Number(arg);
        sel = sel?.kind === 'hand' && sel.i === i ? null : { kind: 'hand', i };
        peek = 0;
      }
      break;
    case 'remove':
      if (s && sel?.kind === 'slot' && canRemove(s, sel.c)) {
        pushUndo(s);
        remove(s, sel.c);
        sel = null;
      }
      break;
    case 'undo':
      if (run && undo.length) {
        run.combat = undo.pop()!;
        sel = null;
      }
      break;
    case 'peek':
      if (s) peek = (peek + 1) % ((s.relics.includes('verre') ? 2 : 1) + 1);
      sel = null;
      break;
    case 'launch':
      launch();
      return;
    case 'skip':
      if (anim) {
        window.clearTimeout(animTimer);
        endAnim();
      }
      return;
    case 'endCombat':
      if (run) {
        finishCombat(run);
        overlay = null;
        save();
      }
      break;
    case 'pick':
      if (run) {
        takeReward(run, arg || null);
        save();
      }
      break;
    case 'buy':
      if (run && buyCard(run, Number(arg))) sound.click();
      save();
      break;
    case 'buyRelic':
      if (run && buyRelic(run)) sound.click();
      save();
      break;
    case 'svcRemove':
      overlay = { kind: 'deck', mode: 'remove' };
      break;
    case 'svcTemper':
      overlay = { kind: 'deck', mode: 'temper' };
      break;
    case 'svcRepair':
      if (run) repair(run);
      save();
      break;
    case 'doRemove':
      if (run && removeCard(run, Number(arg))) overlay = null;
      save();
      break;
    case 'doTemper':
      if (run && temperCard(run, Number(arg))) overlay = null;
      save();
      break;
    case 'leave':
      if (run) leaveAtelier(run);
      save();
      break;
  }
  render();
});

window.addEventListener('keydown', (e) => {
  const s = run?.combat;
  if (onTitle || !run || run.screen !== 'combat' || !s || overlay) return;
  if (/^Digit[1-3]$/.test(e.code) && !anim) {
    const i = Number(e.code.slice(5)) - 1;
    if (s.hand[i]) sel = sel?.kind === 'hand' && sel.i === i ? null : { kind: 'hand', i };
    render();
  } else if (e.code === 'Enter') launch();
  else if ((e.code === 'Backspace' || e.code === 'KeyU') && undo.length && !anim) {
    run.combat = undo.pop()!;
    sel = null;
    render();
  } else if (e.code === 'Escape') {
    sel = null;
    render();
  }
});

render();

// Accès console pour le réglage.
(window as unknown as { cadran: unknown }).cadran = { get run() { return run; }, CARDS };
