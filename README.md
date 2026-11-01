# Échos — prototype « une salle » (phase 1)

POC jouable du GDD d'**Échos** : roguelite tactique où chaque salle se rejoue en boucles de 20 s.
Chaque boucle jouée devient un clone qui rejoue tes gestes à l'identique.

```bash
npm install
npm run dev        # http://localhost:5173  (?seed=123 pour changer la seed de run)
npm test           # tests de déterminisme et de paradoxes (Vitest)
npm run build      # build statique dans dist/ (publiable tel quel, ex. itch.io)
```

## Ce que contient le POC

- **3 salles enchaînées** couvrant les 3 objectifs : *Le Vestibule* (Activer : 2 leviers tenus en même temps),
  *La Salle des Rouages* (Éliminer), *La Veille* (Tenir 20 s). 3 boucles max par salle.
- **4 classes** (Tank, Archer, Soigneur, Piégeur) avec action de base automatique et compétence au bouton.
  Chaque classe ne sert qu'une fois par salle.
- **3 ennemis** de l'acte I : Sbire, Tireur, Brute (charge télégraphiée).
- **Clones** : rejeu des inputs bruts tick par tick + comparaison de chaque action à l'`ActionEvent` enregistré.
- **Paradoxes** : cible disparue (morte ou hors de portée) ou chemin bloqué > 30 ticks. Le clone passe en sanguine
  et vise l'entité la plus proche, alliés compris. −1 stabilité par clone et par salle.
- **Stabilité** (5 au départ), échec de salle = −2, 0 = run perdue. **Étoiles** selon le nombre de boucles.
- **Aperçu de boucle** : entre deux boucles, la frise est déplaçable et montre où seront les clones à chaque
  seconde (le monde est resimulé à l'avance grâce au déterminisme), trajets en pointillés.
- **Rembobinage** visuel d'1 s, sons synthétisés (tic-tac, plume, verre fêlé, bande), options d'accessibilité
  (vitesse 0,75×, réduction des effets, son) dans le menu pause.

## Contrôles

| Action | Mobile | Desktop |
| --- | --- | --- |
| Se déplacer | Joystick flottant (glisser dans la moitié basse) | ZQSD / WASD / flèches |
| Compétence | Bouton en bas à droite | Espace |
| Choisir une classe | Toucher une carte | 1 à 4 |
| Lancer la boucle | Bouton « Lancer la boucle » | Entrée |
| Parcourir l'aperçu | Glisser la frise | ← / → |
| Pause | Bouton pause | Échap |

## Architecture

```
src/
  sim/            # pure, à pas fixe, strictement déterministe (aucun Math.random / Date / DOM)
    fixed.ts      # entiers (1 case = 1 000 unités), isqrt, table d'angles
    rng.ts        # mulberry32
    world.ts      # createWorld / stepWorld / hashWorld / snapshot
    systems/      # movement, combat, ai, replay, paradox
    content/      # classes, enemies, rooms  ← toutes les valeurs d'équilibrage
  game.ts         # session : boucles, stabilité, étoiles, aperçu, historique pour le rembobinage
  render/         # Canvas 2D, silhouettes 48×48 reprises des maquettes (Path2D), effets
  ui/             # HUD HTML/CSS par-dessus le canvas
  input/          # clavier + joystick tactile -> InputFrame (-127..127)
  audio.ts        # WebAudio
tests/            # déterminisme (hash à chaque tick), paradoxes (cible morte, blocage)
```

Identifiants stables d'une boucle à l'autre : un ennemi = son rang dans la liste d'apparitions de la salle,
un allié = `1000 + numéro de boucle`. C'est ce qui permet de comparer la cible d'un clone entre deux boucles.

`window.echos.game` est exposé dans la console pour bidouiller pendant les tests.

## Écarts assumés / à trancher

- Les valeurs du GDD sont reprises ; ce qui n'y figurait pas (vitesse des ennemis, dégâts du Tireur, durée de
  charge de la Brute, maintien des leviers 0,5 s…) est une première proposition, dans `src/sim/content/`.
- Le Soigneur paradoxal soigne l'entité la plus proche, ennemis compris ; le Piégeur paradoxal pose des pièges
  qui blessent tout le monde.
- Un clone dont la boucle s'est terminée par une mort s'efface à l'instant de cette mort.
- Pas encore : reliques, carte de run, Rouages, boss, coop, sauvegarde (phases suivantes de la roadmap).
