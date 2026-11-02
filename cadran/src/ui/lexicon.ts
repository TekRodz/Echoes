// Lexique : les termes du jeu, et leur mise en lien dans les textes de cartes.

export interface Term {
  id: string;
  name: string;
  text: string;
  match: RegExp;
}

const L = '(?<![\\p{L}])';
const R = '(?![\\p{L}])';
const re = (src: string): RegExp => new RegExp(`${L}(?:${src})${R}`, 'giu');

export const TERMS: Term[] = [
  { id: 'cran', name: 'Cran', match: re('crans?'), text: 'Une des 12 positions du cadran, de I à XII. « Le cran suivant » est le suivant dans le sens des aiguilles d’une montre.' },
  { id: 'intention', name: 'Intention', match: re('intentions?'), text: 'Ce que l’automate fera sur un cran : attaque (pastille rouge), coup chargé (double cercle), battement (carré pointillé), bouclier, soin, démontage (croix) ou reflet (cercle pointillé). Le chiffre tient déjà compte de Minuit.' },
  { id: 'remontage', name: 'Remontage', match: re('remontage'), text: 'Ton énergie pour un tour : 3 points. Poser une carte coûte son poids (ses losanges), déplacer une carte posée coûte 1, la retirer est gratuit. Ce qui n’est pas dépensé est perdu au rembobinage.' },
  { id: 'couple', name: 'Couple', match: re('couple'), text: 'Le poids total que le cadran supporte : 10. Chaque carte posée pèse son nombre de losanges. Pour poser une grosse pièce, retire-en une vieille.' },
  { id: 'rembobinage', name: 'Rembobinage', match: re('rembobinages?|rembobine'), text: 'La fin d’un tour. L’aiguille revient à XII ; tes cartes restent posées et tournent d’un cran ; tes boucliers disparaissent ; tu pioches 4 nouvelles cartes et récupères ton Remontage.' },
  { id: 'rotation', name: 'Rotation du cadran', match: re('tourne|tournent|rotation'), text: 'À chaque rembobinage, toutes tes cartes avancent d’un cran dans le sens des aiguilles d’une montre. Les intentions de l’automate, elles, ne tournent pas. Le bouton « Tour suivant » montre où seront tes cartes.' },
  { id: 'tension', name: 'Tension', match: re('tension'), text: 'Une réserve stockée sur chaque Ressort. Un Ressort posé gagne 2 de Tension à chaque tour (3 s’il est trempé) ; Remonter et Cliquet en ajoutent. Elle ne se rembobine pas : elle s’accumule tant que le Ressort reste sur le cadran. Déclic la convertit en dégâts (3 par point) puis la vide ; Barillet la convertit en bouclier sans la vider. Un Ressort retiré ou démonté perd toute sa Tension.' },
  { id: 'bouclier', name: 'Bouclier', match: re('bouclier'), text: 'Absorbe les dégâts avant ton Intégrité. Il disparaît au rembobinage. Les automates peuvent aussi en avoir : tes coups l’entament d’abord.' },
  { id: 'parade', name: 'Parade', match: re('parade|paré'), text: 'Annule la première attaque qui tombe sur son cran et en renvoie une partie à l’automate. Elle n’arrête ni les battements ni les démontages.' },
  { id: 'fixe', name: 'Fixe', match: re('fixe'), text: 'Une carte fixe ne tourne pas avec le cadran : elle reste au cran où tu l’as posée.' },
  { id: 'minuit', name: 'Minuit', match: re('minuit'), text: 'Au 6e tour d’un combat (8e contre le boss), l’automate double ses dégâts, puis les redouble à chaque tour. Les combats longs se paient.' },
  { id: 'charge', name: 'Charge', match: re('charges?'), text: 'La Sonnerie et le Grand Carillon se chargent sur 4 crans avant un coup puissant. Annule une seule charge (Grippage) et le coup fait long feu.' },
  { id: 'battement', name: 'Battement', match: re('battu|battements?'), text: 'Le Métronome frappe chaque cran battu laissé vide. N’importe quelle carte posée sur ce cran bloque le battement.' },
  { id: 'demontage', name: 'Démontage', match: re('démonte|démontée|démontage'), text: 'Le Remonteur retire la carte posée sur le cran visé et la remet dans ta défausse. Déplace-la ou laisse ce cran vide.' },
  { id: 'reflet', name: 'Reflet', match: re('plus gros coup'), text: 'Le Miroir te renvoie le plus gros coup porté par une seule de tes cartes au tour précédent. Étaler tes dégâts sur plusieurs cartes le désarme.' },
  { id: 'rouille', name: 'Rouille', match: re('rouille'), text: 'L’automate perd des PV à la fin de chaque cran restant du tour. Plus tu la poses tôt sur le cadran, plus elle ronge.' },
  { id: 'trempe', name: 'Trempe', match: re('trempe|trempée?|tremper'), text: 'Amélioration d’une carte à l’Atelier, notée +. Ses valeurs augmentent, et parfois son poids baisse.' },
  { id: 'engrenage', name: 'Carte Engrenage', match: re('carte engrenage'), text: 'Élan, Engrenage, Chaîne, Doublé, Pignon et Courroie. Le Pignon compte combien il y en a sur le cadran.' },
  { id: 'rouage', name: 'Rouage', match: re('rouages?'), text: 'Une relique qui agit pendant toute la run. Garantie après un élite, ou à acheter à l’Atelier.' },
  { id: 'laiton', name: 'Laiton', match: re('laiton'), text: 'La monnaie de la run, gagnée en démontant des automates et dépensée à l’Atelier.' },
  { id: 'integrite', name: 'Intégrité', match: re('intégrité'), text: 'Tes points de vie, conservés d’un combat à l’autre. À 0, la run s’arrête.' },
];

/** Entoure les termes connus d'un bouton qui ouvre le lexique. Le texte d'entrée est du texte brut. */
export function linkTerms(text: string): string {
  const hits: { start: number; end: number; id: string }[] = [];
  for (const t of TERMS) {
    t.match.lastIndex = 0;
    for (const m of text.matchAll(t.match)) hits.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, id: t.id });
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  let out = '';
  let pos = 0;
  for (const h of hits) {
    if (h.start < pos) continue;
    out += text.slice(pos, h.start);
    out += `<button type="button" class="term" data-act="term" data-arg="${h.id}">${text.slice(h.start, h.end)}</button>`;
    pos = h.end;
  }
  return out + text.slice(pos);
}
