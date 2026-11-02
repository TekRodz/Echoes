// Les 25 cartes de l'Horlogère. Les effets sont codés dans combat.ts ; ici, les données et les textes.
import type { Archetype, CardInst, Rarity } from './types';

export type Glyph = 'hit' | 'block' | 'parry' | 'later' | 'sooner' | 'jam' | 'gear' | 'chain' | 'double' | 'spring' | 'click' | 'spiral' | 'star' | 'rust' | 'read' | 'mixed';

export interface CardDef {
  id: string;
  name: string;
  archetype: Archetype;
  rarity: Rarity;
  glyph: Glyph;
  /** Couple [normal, trempé]. */
  couple: [number, number];
  /** Valeur principale [normal, trempé]. */
  v: [number, number];
  /** Valeur secondaire éventuelle [normal, trempé]. */
  w?: [number, number];
  text: (v: number, w: number) => string;
}

const d = (def: CardDef): CardDef => def;

export const CARDS: Record<string, CardDef> = Object.fromEntries(
  [
    // Base
    d({ id: 'frappe', name: 'Frappe', archetype: 'base', rarity: 'commune', glyph: 'hit', couple: [1, 1], v: [5, 8], text: (v) => `${v} dégâts.` }),
    d({ id: 'bouclier', name: 'Bouclier', archetype: 'base', rarity: 'commune', glyph: 'block', couple: [1, 1], v: [7, 10], text: (v) => `${v} de bouclier jusqu’au rembobinage.` }),
    d({ id: 'coupDouble', name: 'Coup double', archetype: 'base', rarity: 'commune', glyph: 'hit', couple: [2, 2], v: [4, 6], text: (v) => `${v} dégâts, deux fois.` }),
    d({ id: 'garde', name: 'Garde', archetype: 'base', rarity: 'commune', glyph: 'mixed', couple: [2, 2], v: [5, 7], w: [4, 6], text: (v, w) => `${v} de bouclier, puis ${w} dégâts.` }),
    // Précision
    d({ id: 'parade', name: 'Parade', archetype: 'precision', rarity: 'commune', glyph: 'parry', couple: [1, 1], v: [50, 100], text: (v) => `Annule une attaque sur ce cran et en renvoie ${v} %.` }),
    d({ id: 'contretemps', name: 'Contretemps', archetype: 'precision', rarity: 'peu commune', glyph: 'hit', couple: [2, 2], v: [12, 16], text: (v) => `${v} dégâts, seulement si l’automate agit sur ce cran.` }),
    d({ id: 'retard', name: 'Retard', archetype: 'precision', rarity: 'commune', glyph: 'later', couple: [1, 0], v: [1, 1], text: () => 'Décale l’intention du cran suivant d’un cran plus loin.' }),
    d({ id: 'avance', name: 'Avance', archetype: 'precision', rarity: 'commune', glyph: 'sooner', couple: [1, 0], v: [1, 1], text: () => 'L’intention située 2 crans plus loin avance d’un cran.' }),
    d({ id: 'grippage', name: 'Grippage', archetype: 'precision', rarity: 'peu commune', glyph: 'jam', couple: [2, 1], v: [1, 1], text: () => 'Annule la prochaine intention de l’automate (ce cran compris).' }),
    d({ id: 'riposte', name: 'Riposte', archetype: 'precision', rarity: 'commune', glyph: 'hit', couple: [1, 1], v: [3, 4], w: [6, 9], text: (v, w) => `${v} dégâts, +${w} si tu as paré pendant ce tour.` }),
    d({ id: 'lecture', name: 'Lecture', archetype: 'precision', rarity: 'commune', glyph: 'read', couple: [1, 1], v: [3, 5], text: (v) => `${v} dégâts. Pioche une carte de plus au prochain rembobinage.` }),
    // Engrenages
    d({ id: 'elan', name: 'Élan', archetype: 'engrenage', rarity: 'commune', glyph: 'gear', couple: [1, 1], v: [3, 5], text: (v) => `La carte du cran suivant gagne +${v}.` }),
    d({ id: 'engrenage', name: 'Engrenage', archetype: 'engrenage', rarity: 'commune', glyph: 'gear', couple: [1, 1], v: [2, 3], w: [3, 4], text: (v, w) => `${v} dégâts, +${w} par carte sur les crans voisins.` }),
    d({ id: 'chaine', name: 'Chaîne', archetype: 'engrenage', rarity: 'peu commune', glyph: 'chain', couple: [2, 2], v: [50, 75], text: (v) => `Réactive les 2 cartes précédentes à ${v} %.` }),
    d({ id: 'double', name: 'Doublé', archetype: 'engrenage', rarity: 'peu commune', glyph: 'double', couple: [2, 1], v: [2, 2], text: () => 'La carte du cran suivant s’active deux fois.' }),
    d({ id: 'pignon', name: 'Pignon', archetype: 'engrenage', rarity: 'commune', glyph: 'gear', couple: [1, 1], v: [3, 5], w: [2, 2], text: (v, w) => `${v} dégâts, +${w} par carte Engrenage sur le cadran.` }),
    d({ id: 'courroie', name: 'Courroie', archetype: 'engrenage', rarity: 'commune', glyph: 'hit', couple: [1, 1], v: [3, 4], w: [5, 7], text: (v, w) => `${v} dégâts, +${w} si le cran précédent a infligé des dégâts.` }),
    // Ressort
    d({ id: 'ressort', name: 'Ressort', archetype: 'ressort', rarity: 'commune', glyph: 'spring', couple: [1, 1], v: [2, 3], text: (v) => `Gagne ${v} de Tension à chaque tour. Elle ne se rembobine pas.` }),
    d({ id: 'declic', name: 'Déclic', archetype: 'ressort', rarity: 'peu commune', glyph: 'click', couple: [2, 2], v: [3, 4], text: (v) => `${v} dégâts par point de Tension de tes Ressorts, puis les vide.` }),
    d({ id: 'remonter', name: 'Remonter', archetype: 'ressort', rarity: 'commune', glyph: 'spring', couple: [1, 1], v: [3, 5], text: (v) => `${v} de bouclier. +1 Tension à tous tes Ressorts.` }),
    d({ id: 'spirale', name: 'Spirale', archetype: 'ressort', rarity: 'rare', glyph: 'spiral', couple: [3, 2], v: [2, 3], text: (v) => `${v} dégâts, doublés à chaque tour passé sur le cadran.` }),
    d({ id: 'barillet', name: 'Barillet', archetype: 'ressort', rarity: 'peu commune', glyph: 'block', couple: [2, 2], v: [5, 7], w: [2, 3], text: (v, w) => `${v} de bouclier, +${w} par point de Tension.` }),
    d({ id: 'cliquet', name: 'Cliquet', archetype: 'ressort', rarity: 'commune', glyph: 'hit', couple: [1, 1], v: [4, 6], text: (v) => `${v} dégâts. +1 Tension au Ressort le plus proche.` }),
    // Rares
    d({ id: 'midi', name: 'Coup de midi', archetype: 'rare', rarity: 'rare', glyph: 'star', couple: [3, 3], v: [25, 35], text: (v) => `${v} dégâts, seulement au cran 12.` }),
    d({ id: 'rouille', name: 'Rouille', archetype: 'rare', rarity: 'rare', glyph: 'rust', couple: [2, 2], v: [1, 2], text: (v) => `L’automate perd ${v} PV à chaque cran restant de ce tour.` }),
  ].map((c) => [c.id, c]),
);

export const ENGRENAGE_IDS = new Set(['elan', 'engrenage', 'chaine', 'double', 'pignon', 'courroie']);

export const STARTER_DECK = ['frappe', 'frappe', 'frappe', 'frappe', 'bouclier', 'bouclier', 'bouclier', 'parade', 'elan', 'ressort'];

export const def = (c: CardInst | string): CardDef => {
  const id = typeof c === 'string' ? c : c.id;
  const x = CARDS[id];
  if (!x) throw new Error(`Carte inconnue : ${id}`);
  return x;
};

export const coupleOf = (c: CardInst): number => def(c).couple[c.tempered ? 1 : 0];
export const vOf = (c: CardInst): number => def(c).v[c.tempered ? 1 : 0];
export const wOf = (c: CardInst): number => def(c).w?.[c.tempered ? 1 : 0] ?? 0;
export const textOf = (c: CardInst): string => def(c).text(vOf(c), wOf(c));

export const ARCHETYPE_NAME: Record<Archetype, string> = {
  base: 'Base',
  precision: 'Précision',
  engrenage: 'Engrenages',
  ressort: 'Ressort',
  rare: 'Rare',
};
