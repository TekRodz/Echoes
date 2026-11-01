# Échos — Game Design Document

Nov 1, 2026 · @Kevin

## Pitch & piliers

**Échos est un roguelite tactique en vue de dessus où chaque salle se rejoue en boucles de 20 s : tu montes ton escouade seul, un clone de toi-même à la fois.** Le jeu est complet en solo ; en coop à 2, chaque joueur enregistre ses propres clones.

- **Plateformes** : navigateur (mobile portrait + desktop) d'abord, puis Steam et iOS/Android à partir du même code web.
- **Sessions** : une salle dure 1 à 2 min, une run complète 25 à 40 min, la run quotidienne environ 10 min.
- **Ton** : mystique et horloger, encre sur papier.

**Piliers**

1. **Tu es ton équipe** : chaque boucle répare ce qui manquait à la précédente.
2. **Le paradoxe est une ressource** : un risque à éviter ou un build à exploiter.
3. **Lisible en un coup d'œil** : la forme dit la classe, la couleur dit l'état, même à 32 px sur téléphone.

## Boucle de jeu

**Une salle se gagne en accumulant des boucles : chaque boucle jouée devient un clone qui rejoue tes gestes à l'identique.** Le monde redémarre identique à chaque boucle (même seed, mêmes apparitions), donc seules tes actions créent des différences.

1. **Entrée** : aperçu de la salle pendant 2 s (ennemis, objectif).
2. **Choix** : tu poses une carte de classe de ta main. Chaque classe sert une seule fois par salle.
3. **Boucle** : 20 s de jeu. Tes inputs sont enregistrés à chaque tick.
4. **Rembobinage** : au chrono à 0 ou à ta mort, 1 s de retour en arrière visuel. Le monde revient à t = 0 et ta boucle devient un clone.
5. **Répétition** jusqu'au nombre maximal de boucles de la salle.

**Victoire** : l'objectif est atteint pendant n'importe quelle boucle, et la salle est gagnée aussitôt. **Échec** : les boucles sont épuisées. Tu perds 2 de stabilité, les clones sont effacés et la salle recommence. Stabilité à 0 = run perdue.

**Objectifs de salle** : Éliminer (tous les ennemis), Tenir (survivre jusqu'à la fin d'une boucle), Activer (plusieurs leviers tenus en même temps), Boss.

**Score** : 3 étoiles si la salle est gagnée avec le minimum de boucles, 2 avec une de plus, 1 sinon. Les étoiles rapportent des Rouages (la monnaie de run).

| Paramètre | Valeur de départ |
| --- | --- |
| Durée d'une boucle | 20 s |
| Boucles par salle | 3 (plafond 6) |
| Fréquence de simulation | 60 ticks/s |
| Stabilité | 5 au départ, maximum 8 |
| Grille de salle | 6 × 8 cases |

Toutes ces valeurs sont des points de départ à équilibrer en test.

## Paradoxes

**Un clone devient un paradoxe quand une action enregistrée n'est plus valable au même tick ; chaque nouveau paradoxe coûte 1 de stabilité.** Les clones rejouent tes inputs bruts (déplacement + action), pas des positions.

**Déclencheurs**

- **Cible disparue** : l'entité visée à l'enregistrement (son identifiant) est morte ou hors de portée.
- **Chemin bloqué** : le clone est bloqué plus de 0,5 s par un obstacle qui n'existait pas à l'enregistrement.
- Un clone qui meurt n'est **pas** un paradoxe : il disparaît, simplement.

**Effet** : le clone passe en état Paradoxe pour le reste de la boucle. Il continue ses inputs, mais chaque action vise l'entité la plus proche, alliés compris. Chaque clone ne coûte de la stabilité qu'une fois par salle.

**Feedback** : silhouette sanguine qui bave, trait pointillé vers la cible disparue + croix, son de verre fêlé.

**Reliques liées (pool de départ)**

| Relique | Effet | Build |
| --- | --- | --- |
| Encre vive | Un paradoxe explose à son apparition (30 dégâts de zone) | Chaos |
| Écho rebelle | Les paradoxes infligent ×2 dégâts | Chaos |
| Miroir brisé | Un paradoxe qui tue un ennemi rend 1 de stabilité | Chaos |
| Ancre | Le premier paradoxe de chaque salle est gratuit | Propre |
| Sablier fêlé | +1 boucle par salle, mais le premier paradoxe coûte 2 | Mixte |
| Plume fidèle | Les clones corrigent leur trajectoire d'1 case pour rester sur leur cible | Propre |

Deux styles émergent : un build **propre** (zéro paradoxe, timing précis) et un build **chaos** (provoquer les paradoxes volontairement).

## Run & carte

**Une run compte 3 actes de 8 étages, chacun terminé par un boss, sur une carte à embranchements générée par seed (façon Slay the Spire).** Chaque étage propose 2 à 4 nœuds ; chaque nœud mène à 1 à 3 nœuds de l'étage suivant, sans croisement de chemins.

| Nœud | Fréquence | Contenu |
| --- | --- | --- |
| Salle | 45 % | Combat standard. Récompense : 1 carte de capacité parmi 3 + Rouages |
| Énigme | 15 % | Événement à choix ou salle-puzzle (leviers, sans ennemis) |
| Élite | 12 % | Combat difficile. Relique garantie |
| Repos | 12 % | +2 de stabilité **ou** amélioration d'une classe |
| Marchand | 8 % | Achat de reliques et de capacités, retrait d'un malûs |
| Sanctuaire | 8 % | +1 boucle par salle pour toute la run (plafond 6) |
| Boss | fin d'acte | Combat à phases. Relique rare + choix de classe |

**Règles de génération** : jamais 2 élites d'affilée, un repos garanti avant chaque boss, au moins 1 marchand par acte, pas d'élite avant l'étage 3.

**Le deck, ce sont les classes** : la run démarre avec 4 classes au niveau 1. Chaque classe a 2 emplacements pour des cartes de capacité (exemple : « Provocation dure 2 s de plus » pour le Tank).

**Méta-progression (hors run)** : les succès débloquent de nouvelles classes, de nouvelles reliques dans le pool et des cosmétiques. Aucune statistique permanente, pour préserver l'équilibre et l'équité du classement quotidien.

## Classes, ennemis, boss

**4 classes de départ aux rôles complémentaires : l'action de base est automatique, seule la compétence se déclenche au bouton.** L'action de base vise l'ennemi le plus proche ; son identifiant est enregistré, c'est ce qui permet de détecter les paradoxes.

| Classe | Silhouette | PV | Vitesse | Action de base | Compétence (recharge) | Rôle |
| --- | --- | --- | --- | --- | --- | --- |
| Tank | Bloc carré + bouclier | 200 | 3 cases/s | 15 dégâts au contact, toutes les 0,8 s | Provocation : attire les ennemis pendant 3 s (6 s) | Encaisser |
| Archer | Losange + arc | 80 | 4 cases/s | 12 dégâts à 5 cases, toutes les 0,6 s | Volée : 3 flèches en cône (8 s) | Dégâts |
| Soigneur | Cercle en croix | 100 | 3,5 cases/s | Soigne 10 PV/s l'allié le plus blessé à 3 cases | Bulle : bouclier de 50 PV sur un allié pendant 4 s (10 s) | Soutien |
| Piégeur | Hexagone + mâchoire | 90 | 4 cases/s | Pose un piège toutes les 4 s (30 dégâts, immobilise 1,5 s) | Mine : 60 dégâts de zone (12 s) | Contrôle |

Les clones gardent les PV et capacités de leur classe. Le joueur et ses clones ne se bloquent pas entre eux.

**Ennemis (acte I)**

| Ennemi | Forme | PV | Comportement |
| --- | --- | --- | --- |
| Sbire | Triangle hachuré | 40 | Avance vers l'unité la plus proche, 8 dégâts au contact |
| Tireur | Triangle + point | 30 | Garde 5 cases de distance, tire toutes les 1,5 s |
| Brute | Grand triangle à double trait | 150 | Charge en ligne droite toutes les 4 s |
| Horloge (élite) | Petit engrenage | 250 | Déplace un clone de 2 cases : génère des paradoxes |

**Boss de l'acte I — Le Gardien des Heures** (1 200 PV, engrenage)

1. **100 à 66 %** : rafales circulaires toutes les 3 s.
2. **66 à 33 %** : invoque 4 sbires toutes les 6 s.
3. **Sous 33 %** : rembobine ses propres PV de 5 s, une seule fois. Il faut donc concentrer les dégâts.

**Règle de conception** : tous les patterns ennemis sont déterministes et calés sur le tick. C'est indispensable pour que les clones restent pertinents d'une boucle à l'autre.

## Coop

**En coop à 2, les joueurs jouent chaque boucle en même temps et créent chacun un clone par boucle : 3 boucles donnent une escouade de 6 unités.** Chacun a son propre avatar ; aucun contrôle partagé.

- **Rejoindre** : code de salle de 4 lettres + lien partageable. Pas de matchmaking public au départ.
- **Run partagée** : carte, stabilité et Rouages communs. Chaque joueur a sa main de classes et ses reliques.
- **Chemin sur la carte** : chacun vote pour un nœud ; en cas d'égalité, l'hôte tranche.
- **Entre deux boucles** : 10 s pour choisir sa classe (sans limite en solo).
- **Mort en cours de boucle** : le joueur regarde la fin de la boucle ; son clone s'arrête à l'endroit de sa mort.
- **Communication** : appui long = marqueur contextuel (« ici », « cible »). La voix passe par un outil externe (Discord, appel).
- **Déconnexion** : 30 s de grâce, la boucle est mise en pause.
- **Évolution** : 3 à 4 joueurs après validation du mode à 2.

Le modèle réseau est décrit dans les spécifications techniques.

## Contrôles & UX

**Le jeu se joue au pouce, en portrait : on glisse pour se déplacer, l'attaque est automatique, un seul bouton sert à la compétence.** L'écran de référence est 390 × 844 ; aucune zone tactile ne fait moins de 44 px.

| Action | Mobile | Desktop |
| --- | --- | --- |
| Se déplacer | Joystick flottant : glisser dans la moitié basse | ZQSD / flèches |
| Compétence | Bouton en bas à droite (dans la direction du déplacement) | Espace |
| Marqueur coop | Appui long | Clic droit |
| Choisir une classe | Toucher une carte (entre deux boucles) | Clic ou touches 1 à 4 |
| Pause | Solo uniquement | Échap |

**Aperçu de boucle** (clé de l'expérience) : avant de lancer une boucle, on fait défiler la frise du temps pour voir où seront les clones à chaque seconde, avec leurs trajets en pointillés.

**Onboarding** : 3 salles tutoriel. 1 : une classe, une boucle. 2 : premier clone. 3 : premier paradoxe, provoqué volontairement.

**Accessibilité** : la lisibilité passe par la forme, pas par la couleur seule. Options prévues : réduire les effets de glitch et de bavure, vitesse de jeu à 0,75×, taille des éléments d'interface.

## Direction artistique

**Encre sur papier, horloger, mystique : tout est vectoriel et généré en code, sans illustration à produire.** Référence visuelle complète : [canvas Échos — base graphique](https://claude.ai/artifact/CeAxoCBJRiUto6ER32pUPN).

| Couleur | Hex | Rôle |
| --- | --- | --- |
| Parchemin | #EFE4CC | Fond, sols |
| Encre | #1F1A14 | Joueur, texte, traits |
| Encre pâlie | #6B7C8C | Clones (contour), trajectoires |
| Corps de clone | #D5CFBF | Remplissage des clones |
| Sanguine | #9A2E1C | Paradoxes, danger |
| Laiton | #B08A3E | Interface, éléments interactifs, cœur du joueur |
| Papier vieilli | #D9C9A3 / #E6D8B8 | Murs, zones, cartes |
| Texte secondaire | #5A4A36 | Légendes (contraste AA sur parchemin) |

**Typographie** : Cormorant Garamond (titres, chiffres de jeu), Spectral (texte et interface), via Google Fonts.

**Codage visuel des unités**

- **La forme dit la classe** : Tank = bloc carré + bouclier, Archer = losange + arc, Soigneur = cercle en croix, Piégeur = hexagone + mâchoire.
- **La couleur dit l'état** : encre pleine = joué, encre pâlie + chiffre romain = clone, sanguine + double décalé + gouttes = paradoxe.
- **Le cœur dit qui joue** : carré laiton au centre, réservé à l'unité contrôlée.
- **Ennemis** : triangles hachurés, jamais de cœur. Boss : engrenage.
- Sprites dessinés sur une grille de 48 × 48, lisibles à 32 px.

**Icônes** : grille de 24 × 24, zone utile de 18 × 18 centrée, trait 1,75, bouts arrondis, toujours posées dans un carré.

**Règles** : aucun dégradé ni lueur ; seul le paradoxe est rouge ; le laiton signale ce qu'on peut toucher.

**Son** : tic-tac d'horlogerie pour le rythme de la boucle, plume qui gratte pour les actions, verre fêlé pour les paradoxes, rembobinage de bande pour la fin de boucle.

## Monétisation

**Trois leviers retenus : cosmétiques, extensions et run quotidienne ; rien de ce qui est vendu ne touche au gameplay.** Le modèle de base (premium ou gratuit) reste à trancher (voir Questions ouvertes).

| Levier | Contenu | Rôle |
| --- | --- | --- |
| Cosmétiques | Encres de clones (sépia, bleu de Prusse, or), traînées, effets de paradoxe, dos de cartes de classe | Revenu, très visible en coop |
| Extensions | Nouvel acte + 2 classes + reliques et ennemis associés | Revenu, durée de vie |
| Run quotidienne | Seed commune à tous, classement mondial et entre amis, cosmétique offert pour les séries de jours | Rétention (gratuite) |

**Interdits** : vendre des boucles, de la stabilité ou des reliques ; publicité pendant une run.

## Spécifications techniques (pour Claude Code)

**Règle n°1 : la simulation est pure, à pas fixe et strictement déterministe, séparée du rendu.** Tout le concept (clones, paradoxes, run quotidienne, coop) repose sur le fait qu'avec la même seed et les mêmes inputs, on obtient exactement le même résultat.

**Stack**

| Besoin | Choix |
| --- | --- |
| Langage / build | TypeScript strict + Vite |
| Rendu | Canvas 2D (sprites SVG convertis en Path2D) ; PixiJS seulement si les perfs l'exigent |
| Interface | HTML/CSS par-dessus le canvas (cartes, menus, HUD) |
| Tests | Vitest |
| Sauvegarde | localStorage (méta-progression, run en cours) |
| Classement quotidien | Supabase (phase 5) |
| Réseau coop | Colyseus sur Node (phase 4) |
| Packaging | Capacitor (iOS/Android), Tauri (Steam) |

**Règles de déterminisme** (à faire respecter dans `src/sim/`)

- Pas de `Math.random`, `Date.now` ni `performance.now` : un PRNG seedé (mulberry32) est passé au monde.
- Pas d'accès au DOM ni au rendu.
- Positions en entiers (1 case = 1 000 unités), vitesses en unités/tick, angles via une table précalculée.
- Entités mises à jour dans un ordre stable (identifiant croissant).
- La boucle de jeu avance la sim à 60 ticks/s avec un accumulateur ; le rendu interpole entre deux états.

**Modèle de données central**

```ts
type Tick = number;
interface InputFrame { tick: Tick; moveX: number; moveY: number; ability: boolean } // move quantifié -127..127
interface ActionEvent { tick: Tick; kind: 'basic' | 'ability'; targetId: number | null }
interface CloneRecord { loopIndex: number; classId: ClassId; ownerId: PlayerId; inputs: InputFrame[]; actions: ActionEvent[] }
interface RoomState { seed: number; tick: Tick; loop: number; entities: Entity[]; clones: CloneRecord[] }
```

**Rejouer un clone** : à chaque nouvelle boucle, le monde est recréé depuis la seed de la salle. `ReplaySystem` réinjecte les `inputs` de chaque clone tick par tick et compare chaque action à l'`ActionEvent` enregistré. Une cible morte, hors de portée ou un blocage de plus de 30 ticks passe le clone en Paradoxe.

**Arborescence**

```
echos/
  src/
    sim/        # pure, déterministe
      world.ts  rng.ts  fixed.ts
      systems/  movement.ts combat.ts ai.ts replay.ts paradox.ts
      content/  classes.ts enemies.ts relics.ts rooms.ts
    run/        # carte, génération par seed, économie, deck
    render/     # canvas, shapes.ts (silhouettes 48x48), icons.ts (24x24), fx/
    ui/         # HUD, cartes de classe, menus (HTML/CSS)
    input/      # tactile, clavier → InputFrame
    net/        # (phase 4) client Colyseus
    main.ts
  server/       # (phase 4) Colyseus
  tests/        # déterminisme, paradoxes, génération de carte
```

**Coop (phase 4)** : modèle hôte autoritaire. Le serveur relaie les `InputFrame` des 2 joueurs ; l'hôte simule et diffuse un instantané d'état 20 fois/s ; chaque client prédit son propre avatar localement. Comme la sim est déterministe, on pourra passer plus tard en lockstep si la bande passante l'exige.

**Tests obligatoires**

- [ ] Rejouer la même salle 2 fois avec les mêmes inputs donne le même hash d'état à chaque tick.
- [ ] Un clone dont la cible meurt plus tôt passe en Paradoxe au tick attendu.
- [ ] La même seed génère la même carte de run, en respectant ses règles.

**Cibles de performance** : 60 fps sur un téléphone milieu de gamme, avec jusqu'à 60 entités à l'écran.

## Roadmap

**On valide le fun d'une seule salle avant tout le reste : la coop et les stores n'arrivent qu'après une démo solo jouée par de vrais joueurs.** Les durées sont des estimations pour un développeur solo assisté par Claude Code.

1. **Prototype « une salle »** (1 à 2 semaines) : sim déterministe, 1 salle, Tank + Archer, 3 boucles, clones, paradoxe de base, formes provisoires.
   - Critère pour continuer : en 5 minutes, les testeurs ressentent le plaisir de « se coordonner avec soi-même ».
2. **Tranche verticale solo** (3 à 5 semaines) : 4 classes, 4 ennemis, boss de l'acte I, carte de l'acte I, 10 reliques, stabilité, aperçu de boucle, DA finale.
   - Critère : 5 testeurs terminent une run de 25 min et veulent relancer.
3. **Démo web publique** (2 semaines) : onboarding, sauvegarde, sons, publication sur itch.io.
   - Critère : rétention à J+1 mesurée et retours collectés.
4. **Coop à 2** (3 à 4 semaines) : salons par code, serveur Colyseus, synchronisation, marqueurs.
5. **Contenu complet** : actes II et III, run quotidienne et classement, méta-progression.
6. **Sortie** : packaging Steam et stores, boutique de cosmétiques, première extension en préparation.

**Premier prompt conseillé pour Claude Code** : « Lis le GDD. Monte le projet Vite + TypeScript avec l'arborescence décrite, puis implémente uniquement la phase 1. Commence par `src/sim/` et le test de déterminisme avant tout rendu. »

## Questions ouvertes

- [ ] **Modèle de base** : premium (démo gratuite + jeu payant) ou gratuit avec cosmétiques ? À trancher avant la phase 3.
- [ ] **Titre** : « Échos » est provisoire ; vérifier la disponibilité (marque, stores, domaine).
- [ ] **Durée de boucle** : 20 s fixes ou variable selon la salle ?
- [ ] **Coop** : main de classes individuelle (choix actuel) ou deck partagé ?
- [ ] **Icônes** : Sanctuaire et Boucle sont trop proches en petite taille ; prévoir un symbole distinct.
- [ ] **Narration** : qui est le joueur, et pourquoi le temps boucle-t-il ?
