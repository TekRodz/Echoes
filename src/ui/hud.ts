// Interface HTML par-dessus le canvas : en-tête, frise, cartes de classe, panneaux.
import type { CardState, Game } from '../game';
import { STABILITY_START } from '../game';
import { CLASS_ORDER, CLASSES } from '../sim/content/classes';
import { LOOP_TICKS, ROOMS } from '../sim/content/rooms';
import type { ClassId } from '../sim/types';
import { roman } from '../render/palette';
import { icon } from '../render/shapes';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} introuvable`);
  return el as T;
};

export const fmtTime = (ticks: number): string => {
  const s = Math.max(0, Math.floor(ticks / 60));
  return `00:${String(Math.min(s, 99)).padStart(2, '0')}`;
};

export class Hud {
  loopTitle = $('loopTitle');
  loopSub = $('loopSub');
  stab = $('stab');
  barFill = $('barFill');
  barMarks = $('barMarks');
  barCursor = $('barCursor');
  scrub = $<HTMLInputElement>('scrub');
  time = $('time');
  objective = $('objective');
  cards = $('cards');
  classinfo = $('classinfo');
  launchBtn = $<HTMLButtonElement>('launchBtn');
  actionrow = $('actionrow');
  abilityBtn = $<HTMLButtonElement>('abilityBtn');
  overlay = $('overlay');
  toastEl = $('toast');
  pauseBtn = $<HTMLButtonElement>('pauseBtn');

  private cardSig = '';
  private stabSig = '';
  private lostUntil = 0;
  private toastTimer = 0;
  onCard: ((c: ClassId) => void) | null = null;

  constructor() {
    $('loopIcon').innerHTML = icon('loop', 26, '#1f1a14');
    this.pauseBtn.innerHTML = icon('pause', 22, '#1f1a14');
    this.scrub.max = String(LOOP_TICKS);
    const marks: string[] = [];
    for (let s = 0; s <= 20; s += 2) marks.push(`<i class="${s % 10 === 0 ? 'big' : ''}" style="left:${(s / 20) * 100}%"></i>`);
    this.barMarks.innerHTML = marks.join('');
  }

  markStabilityLoss(): void {
    this.lostUntil = performance.now() + 1600;
    this.stabSig = '';
  }

  update(g: Game, tickShown: number, now: number): void {
    const loop = Math.min(g.loopIndex, g.maxLoops - 1);
    this.loopTitle.textContent = `Boucle ${roman(loop)}`;
    this.loopSub.textContent = `sur ${roman(g.maxLoops - 1)} · ${g.room.name}`;

    // Stabilité
    const lostActive = now < this.lostUntil;
    const sig = `${g.stability}|${lostActive}`;
    if (sig !== this.stabSig) {
      this.stabSig = sig;
      const n = Math.max(STABILITY_START, g.stability);
      const cells: string[] = [];
      for (let i = 0; i < n; i++) {
        const cls = i < g.stability ? 'on' : i === g.stability && lostActive ? 'lost' : '';
        cells.push(`<div class="stab-cell ${cls}"></div>`);
      }
      this.stab.innerHTML = `${icon('stability', 20, '#1f1a14')}<div class="stab-cells">${cells.join('')}</div>`;
      this.stab.setAttribute('aria-label', `Stabilité ${g.stability} sur ${n}`);
    }

    // Frise
    const k = Math.max(0, Math.min(1, tickShown / LOOP_TICKS));
    this.barFill.style.width = `${k * 100}%`;
    this.barCursor.style.left = `${k * 100}%`;
    this.time.textContent = fmtTime(tickShown);
    this.scrub.disabled = g.phase !== 'choose';

    // Objectif
    const w = g.world;
    let progress = '';
    if (g.room.objective === 'activate') progress = `${w.leversHeld}/${g.room.levers.length} leviers`;
    else if (g.room.objective === 'eliminate') {
      const alive = w.units.filter((u) => u.side === 'enemy' && u.alive).length;
      const pending = g.room.spawns.length - w.spawnIdx;
      progress = `${alive + pending} ennemi${alive + pending > 1 ? 's' : ''}`;
    } else progress = 'tenir 20 s';
    this.objective.innerHTML = `<span><strong>Salle ${roman(g.roomIndex)}/${roman(ROOMS.length - 1)}</strong> · ${g.room.objectiveText}</span><span>${progress}</span>`;

    this.updateCards(g);
    this.updateActionRow(g);
    this.updateAbility(g);
  }

  private updateCards(g: Game): void {
    const states = CLASS_ORDER.map((c) => g.cardState(c));
    const sig = `${g.phase}|${JSON.stringify(states)}`;
    if (sig === this.cardSig) return;
    this.cardSig = sig;
    this.cards.innerHTML = '';
    CLASS_ORDER.forEach((c, i) => {
      const st = states[i]!;
      const def = CLASSES[c];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = st.kind;
      b.disabled = !g.canSelect(c);
      const color = st.kind === 'current' ? '#b08a3e' : st.kind === 'paradox' ? '#9a2e1c' : st.kind === 'available' || st.kind === 'selected' ? '#1f1a14' : '#5a4a36';
      const status = cardStatus(st);
      b.innerHTML = `<span class="key">${i + 1}</span>${icon(c, 24, color)}<span class="name">${def.name}</span><span class="status">${status}</span>`;
      b.setAttribute('aria-label', `${def.name}, ${status}`);
      b.addEventListener('click', () => this.onCard?.(c));
      this.cards.appendChild(b);
    });
  }

  private updateActionRow(g: Game): void {
    const choosing = g.phase === 'choose';
    this.actionrow.classList.toggle('playing', !choosing);
    if (choosing) {
      const c = g.selected;
      this.launchBtn.disabled = !c;
      if (c) {
        const d = CLASSES[c];
        this.classinfo.innerHTML = `<strong>${d.name}</strong> · ${d.hp} PV · ${d.role}<br>${d.basicText}<br>${d.abilityText}`;
      } else this.classinfo.textContent = 'Choisis une classe.';
    } else if (g.phase === 'playing') {
      const fine = matchMedia('(pointer: fine)').matches;
      this.classinfo.textContent = fine ? 'ZQSD / flèches : se déplacer · Espace : compétence · Échap : pause' : 'Glisse pour te déplacer · bouton : compétence';
    } else this.classinfo.textContent = '';
  }

  private updateAbility(g: Game): void {
    const show = g.phase === 'playing';
    this.abilityBtn.classList.toggle('show', show);
    if (!show || g.world.playerId === null) return;
    const p = g.world.byId.get(g.world.playerId);
    if (!p) return;
    const def = CLASSES[p.kind as ClassId];
    const k = p.abilityCd / def.ability.cd;
    const sig = `${p.kind}|${Math.round(k * 20)}`;
    if (this.abilityBtn.dataset.sig === sig) return;
    this.abilityBtn.dataset.sig = sig;
    this.abilityBtn.classList.toggle('ready', k <= 0);
    this.abilityBtn.innerHTML = `<div class="cd" style="height:${k * 100}%"></div>${icon(p.kind, 24, '#b08a3e')}<span>${def.ability.name}</span>`;
    this.abilityBtn.setAttribute('aria-label', `${def.ability.name}${k > 0 ? ' (en recharge)' : ''}`);
  }

  /** Marqueurs de fin des clones sur la frise (aperçu). */
  setCloneMarks(g: Game): void {
    const extra = g.records
      .filter((r) => r.endTick < LOOP_TICKS)
      .map((r) => `<b style="left:${(r.endTick / LOOP_TICKS) * 100}%" title="Clone ${roman(r.loopIndex)} s'efface"></b>`);
    const marks: string[] = [];
    for (let s = 0; s <= 20; s += 2) marks.push(`<i class="${s % 10 === 0 ? 'big' : ''}" style="left:${(s / 20) * 100}%"></i>`);
    this.barMarks.innerHTML = marks.join('') + extra.join('');
  }

  toast(html: string, ms = 3200, danger = false): void {
    this.toastEl.innerHTML = html;
    this.toastEl.classList.toggle('danger', danger);
    this.toastEl.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  hideToast(): void {
    this.toastEl.classList.remove('show');
  }

  showOverlay(html: string): void {
    this.overlay.innerHTML = `<div class="card">${html}</div>`;
    this.overlay.hidden = false;
  }

  hideOverlay(): void {
    this.overlay.hidden = true;
    this.overlay.innerHTML = '';
  }
}

function cardStatus(st: CardState): string {
  switch (st.kind) {
    case 'available':
      return 'Disponible';
    case 'selected':
      return 'Choisie';
    case 'current':
      return `En cours · ${roman(st.loop)}`;
    case 'played':
      return `Jouée · ${roman(st.loop)}`;
    case 'paradox':
      return `Paradoxe · ${roman(st.loop)}`;
  }
}

export const starsHtml = (n: number, size = 30): string =>
  [0, 1, 2].map((i) => icon('star', size, i < n ? '#b08a3e' : '#d9c9a3', i < n ? '#b08a3e' : 'none')).join('');
