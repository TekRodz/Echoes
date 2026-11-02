# Cadran — prototype

Deckbuilder roguelite horloger : tes cartes sont des **instants** posés sur un cadran de 12 crans.
Le cadran tourne, puis le temps se rembobine : tes cartes restent et rejouent, avec une pièce de plus à chaque tour.

```bash
npm run cadran:dev       # http://localhost:5174
npm run cadran:test      # moteur (cartes, automates, minuit, boss) + bot d'équilibrage
npm run cadran:artifact  # dist-cadran/cadran.html, un seul fichier pour le test sur téléphone
```

## Contenu

- L'Horlogère, 25 cartes (Base, Précision, Engrenages, Ressort, Rares), deck de départ de 10 cartes.
- 5 automates (Coucou, Métronome, Sonnerie, élites Remonteur et Miroir) et le boss, le Grand Carillon (3 phases, fait tourner ton cadran).
- 8 rouages, une run de 6 Heures avec Atelier (achat, retrait, trempe, réparation), sauvegarde locale, Cadran du jour.

## Règles du moteur

- Chaque tour : pioche de 3, **une** action (poser, déplacer, retirer) ; deux au premier tour.
- Par cran : ta préparation (boucliers, parades, manipulations du temps), puis l'automate, puis ton attaque.
- Couple maximum 6 ; Minuit au tour 6 (8 contre le boss) double les dégâts de l'automate à chaque tour.
- L'aperçu chiffré est exact : le moteur (`src/engine/`) est pur et déterministe, l'aperçu rejoue le tour sur une copie.

## Équilibrage

Toutes les valeurs sont dans `src/engine/cards.ts` et `src/engine/enemies.ts`.
`tests/bot.test.ts` fait jouer 40 runs à un bot glouton (qui ne voit qu'un tour à l'avance) : il en gagne 8 sur 40.
