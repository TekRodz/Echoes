// Le cadran en SVG : anneau extérieur = intentions de l'automate, anneau intérieur = tes cartes.
import { def } from '../engine/cards';
import type { CardInst, Intent } from '../engine/types';
import { glyphAt, ROMAN } from './icons';

export interface DialView {
  dial: (CardInst | null)[];
  intents: Intent[];
  annulled: Set<number>;
  moved: { from: number; to: number }[];
  mult: number;
  lastBestHit: number;
  targets: Set<number>;
  selected: number | null;
  active: number | null;
  forecast: { dealt: number[]; taken: number[] } | null;
  ghost: boolean;
  title: string;
  sub: string;
  badge: (c: CardInst) => string;
  hand: number;
  erased: Set<number>;
}

const S = 380;
const CX = S / 2;
const R_INTENT = 145;
const R_CARD = 100;
const R_NUM = 187;
const R_FORE = 62;
const SLOT = 44; // diamètre d'un pion de carte

const C = { ink: '#1f1a14', parch: '#efe4cc', brass: '#b08a3e', brassD: '#8a6a2f', aged: '#d9c9a3', agedL: '#e6d8b8', san: '#9a2e1c', pale: '#6b7c8c', text2: '#5a4a36' };

const ang = (cran: number): number => ((cran + 1) * 30 * Math.PI) / 180;
export const pos = (r: number, cran: number): [number, number] => [CX + r * Math.sin(ang(cran)), CX - r * Math.cos(ang(cran))];
const f = (n: number): string => n.toFixed(1);

function intentSvg(it: Intent, x: number, y: number, mult: number, lastBest: number): string {
  const num = (v: number, color: string, size = 14): string =>
    `<text x="${f(x)}" y="${f(y + size * 0.36)}" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-weight="700" font-size="${size}" fill="${color}">${v}</text>`;
  switch (it.kind) {
    case 'attack':
      return `<circle cx="${f(x)}" cy="${f(y)}" r="16" fill="${C.san}"/>${num(it.value * mult, C.parch)}`;
    case 'bigAttack':
      return `<circle cx="${f(x)}" cy="${f(y)}" r="19.5" fill="none" stroke="${C.san}" stroke-width="1.5"/><circle cx="${f(x)}" cy="${f(y)}" r="16" fill="${C.san}"/>${num(it.value * mult, C.parch, 15)}`;
    case 'copy':
      return `<circle cx="${f(x)}" cy="${f(y)}" r="16" fill="${C.parch}" stroke="${C.san}" stroke-width="2" stroke-dasharray="3 2.5"/>${num(Math.max(4, lastBest) * mult, C.san)}`;
    case 'gap':
      return `<rect x="${f(x - 13)}" y="${f(y - 13)}" width="26" height="26" fill="${C.parch}" stroke="${C.san}" stroke-width="1.75" stroke-dasharray="4 3"/>${num(it.value * mult, C.san)}`;
    case 'block':
      return `<circle cx="${f(x)}" cy="${f(y)}" r="16" fill="${C.agedL}" stroke="${C.ink}" stroke-width="1.2"/>${glyphAt('block', x, y - 4, 16, C.ink)}<text x="${f(x)}" y="${f(y + 12)}" text-anchor="middle" font-size="9" font-family="Spectral, Georgia, serif" fill="${C.ink}">${it.value}</text>`;
    case 'heal':
      return `<circle cx="${f(x)}" cy="${f(y)}" r="16" fill="${C.agedL}" stroke="${C.ink}" stroke-width="1.2"/>${num(it.value, C.ink, 13).replace('>' + it.value + '<', '>+' + it.value + '<')}`;
    case 'charge':
      return `<circle cx="${f(x)}" cy="${f(y)}" r="10" fill="${C.parch}" stroke="${C.san}" stroke-width="1.5" stroke-dasharray="2 2.5"/><circle cx="${f(x)}" cy="${f(y)}" r="3" fill="${C.san}"/>`;
    case 'erase':
      return `<rect x="${f(x - 13)}" y="${f(y - 13)}" width="26" height="26" fill="${C.agedL}" stroke="${C.ink}" stroke-width="1.5"/><path d="M${f(x - 7)} ${f(y - 7)}l14 14M${f(x + 7)} ${f(y - 7)}l-14 14" stroke="${C.san}" stroke-width="2.2" stroke-linecap="round"/>`;
  }
}

export function renderDial(v: DialView): string {
  const parts: string[] = [];
  parts.push(`<circle cx="${CX}" cy="${CX}" r="188" fill="${C.agedL}" stroke="${C.ink}" stroke-width="1.5"/>`);
  parts.push(`<circle cx="${CX}" cy="${CX}" r="125" fill="${C.parch}" stroke="${C.brassD}" stroke-width="0.8"/>`);

  // Graduations et chiffres romains.
  for (let i = 0; i < 12; i++) {
    const [x1, y1] = pos(125, i);
    const [x2, y2] = pos(131, i);
    parts.push(`<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke="${C.brassD}" stroke-width="1.2"/>`);
    const [nx, ny] = pos(R_NUM - 7, i);
    parts.push(`<text x="${f(nx)}" y="${f(ny + 4)}" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-size="10.5" font-weight="600" fill="${v.active === i ? C.ink : C.text2}">${ROMAN[i]}</text>`);
  }

  // Liens d'engrenage entre cartes voisines (Élan, Doublé, Chaîne).
  v.dial.forEach((c, i) => {
    if (!c) return;
    const links: number[] = c.id === 'elan' || c.id === 'double' ? [i + 1] : c.id === 'chaine' ? [i - 1, i - 2] : [];
    for (const j of links) {
      if (j < 0 || j > 11) continue;
      const [x1, y1] = pos(R_CARD + 30, i);
      const [x2, y2] = pos(R_CARD + 30, j);
      parts.push(`<path d="M${f(x1)} ${f(y1)}A${R_CARD + 30} ${R_CARD + 30} 0 0 ${j > i ? 1 : 0} ${f(x2)} ${f(y2)}" fill="none" stroke="${C.brass}" stroke-width="2" stroke-dasharray="1 4" stroke-linecap="round"/>`);
    }
  });

  // Prévisions par cran.
  if (v.forecast) {
    for (let i = 0; i < 12; i++) {
      const d = v.forecast.dealt[i] ?? 0;
      const t = v.forecast.taken[i] ?? 0;
      if (!d && !t) continue;
      const [x, y] = pos(R_FORE, i);
      if (d) parts.push(`<text x="${f(x)}" y="${f(t ? y - 1 : y + 4)}" text-anchor="middle" font-family="Spectral, Georgia, serif" font-size="11" font-weight="600" fill="${C.ink}">${d}</text>`);
      if (t) parts.push(`<text x="${f(x)}" y="${f(d ? y + 10 : y + 4)}" text-anchor="middle" font-family="Spectral, Georgia, serif" font-size="11" font-weight="600" fill="${C.san}">−${t}</text>`);
    }
  }

  // Centre et aiguille.
  parts.push(`<circle cx="${CX}" cy="${CX}" r="44" fill="${C.parch}" stroke="${C.ink}" stroke-width="1.2"/>`);
  const [hx, hy] = pos(118, v.hand - 1);
  parts.push(`<path d="M${CX} ${CX}L${f(hx)} ${f(hy)}" stroke="${C.brass}" stroke-width="2.5" stroke-linecap="round" opacity="0.9"/>`);
  parts.push(`<circle cx="${CX}" cy="${CX}" r="4" fill="${C.brass}"/>`);
  parts.push(`<text x="${CX}" y="${CX - 6}" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-size="19" font-weight="700" fill="${C.ink}">${v.title}</text>`);
  parts.push(`<text x="${CX}" y="${CX + 14}" text-anchor="middle" font-family="Spectral, Georgia, serif" font-size="10" fill="${v.sub.startsWith('!') ? C.san : C.text2}">${v.sub.replace(/^!/, '')}</text>`);

  // Emplacements de cartes.
  for (let i = 0; i < 12; i++) {
    const [x, y] = pos(R_CARD, i);
    const c = v.dial[i];
    const target = v.targets.has(i);
    const sel = v.selected === i;
    let g = `<g class="slot" data-cran="${i}" role="button" aria-label="Cran ${i + 1}${c ? ' : ' + def(c).name : ', libre'}">`;
    g += `<circle cx="${f(x)}" cy="${f(y)}" r="${SLOT / 2 + 3}" fill="transparent"/>`;
    if (v.active === i) g += `<circle cx="${f(x)}" cy="${f(y)}" r="29" fill="none" stroke="${C.brass}" stroke-width="2.5"/>`;
    if (c && !v.erased.has(c.uid)) {
      g += `<circle cx="${f(x)}" cy="${f(y)}" r="${SLOT / 2}" fill="${C.ink}"/>`;
      g += glyphAt(def(c).glyph, x, y - 6, 20, C.parch);
      const b = v.badge(c);
      if (b) g += `<text x="${f(x)}" y="${f(y + 16)}" text-anchor="middle" font-family="Spectral, Georgia, serif" font-size="10.5" font-weight="600" fill="${C.agedL}">${b}</text>`;
      if (c.tempered) g += `<circle cx="${f(x + 15)}" cy="${f(y - 15)}" r="5" fill="${C.brass}" stroke="${C.parch}" stroke-width="1.5"/>`;
      if (sel) g += `<circle cx="${f(x)}" cy="${f(y)}" r="${SLOT / 2 + 3}" fill="none" stroke="${C.brass}" stroke-width="3"/>`;
    } else {
      g += `<circle cx="${f(x)}" cy="${f(y)}" r="${SLOT / 2}" fill="${target ? '#f6eedb' : C.parch}" stroke="${target ? C.brass : C.brassD}" stroke-width="${target ? 2.2 : 1}" ${target ? '' : 'stroke-dasharray="3 3"'}/>`;
    }
    g += '</g>';
    parts.push(g);
  }

  // Intentions de l'automate.
  const seen = new Map<number, number>();
  v.moved.forEach(({ from, to }) => {
    const [x1, y1] = pos(R_INTENT, from);
    const [x2, y2] = pos(R_INTENT, to);
    parts.push(`<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke="${C.ink}" stroke-width="1.2" stroke-dasharray="2 3"/>`);
  });
  v.intents.forEach((it, idx) => {
    const k = seen.get(it.cran) ?? 0;
    seen.set(it.cran, k + 1);
    const [x, y] = pos(R_INTENT - k * 30, it.cran);
    const dim = v.annulled.has(idx);
    let s = `<g opacity="${dim ? 0.35 : v.ghost ? 0.6 : 1}">${intentSvg(it, x, y, v.mult, v.lastBestHit)}`;
    if (dim) s += `<path d="M${f(x - 16)} ${f(y + 16)}L${f(x + 16)} ${f(y - 16)}" stroke="${C.ink}" stroke-width="2.5" stroke-linecap="round"/>`;
    s += '</g>';
    parts.push(s);
  });

  return `<svg viewBox="0 0 ${S} ${S}" class="dial-svg" role="img" aria-label="Cadran à 12 crans">${parts.join('')}</svg>`;
}

/** Position d'un cran en pourcentage du cadran (pour les textes flottants en HTML). */
export function cranPercent(cran: number, r = R_CARD): [number, number] {
  const [x, y] = pos(r, cran);
  return [(x / S) * 100, (y / S) * 100];
}
