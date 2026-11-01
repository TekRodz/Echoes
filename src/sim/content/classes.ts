import { cells, cps, sec } from '../fixed';
import type { ClassId } from '../types';

// Valeurs du GDD (« Classes, ennemis, boss »). Toutes à équilibrer en test.

export interface ClassDef {
  id: ClassId;
  name: string;
  hp: number;
  speed: number; // unités/tick
  radius: number;
  basic: { cd: number; firstCd: number; range: number; power: number };
  ability: { cd: number; name: string };
  role: string;
  basicText: string;
  abilityText: string;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  tank: {
    id: 'tank',
    name: 'Tank',
    hp: 200,
    speed: cps(3),
    radius: 380,
    basic: { cd: sec(0.8), firstCd: 1, range: 280, power: 15 }, // portée = contact (rayons + marge)
    ability: { cd: sec(6), name: 'Provocation' },
    role: 'Encaisser',
    basicText: '15 dégâts au contact',
    abilityText: 'Provocation : attire les ennemis 3 s',
  },
  archer: {
    id: 'archer',
    name: 'Archer',
    hp: 80,
    speed: cps(4),
    radius: 340,
    basic: { cd: sec(0.6), firstCd: 1, range: cells(5), power: 12 },
    ability: { cd: sec(8), name: 'Volée' },
    role: 'Dégâts',
    basicText: '12 dégâts à 5 cases',
    abilityText: 'Volée : 3 flèches en cône',
  },
  healer: {
    id: 'healer',
    name: 'Soigneur',
    hp: 100,
    speed: cps(3.5),
    radius: 350,
    basic: { cd: sec(0.5), firstCd: 1, range: cells(3), power: 5 }, // 10 PV/s
    ability: { cd: sec(10), name: 'Bulle' },
    role: 'Soutien',
    basicText: 'Soigne 10 PV/s l’allié le plus blessé',
    abilityText: 'Bulle : bouclier de 50 PV, 4 s',
  },
  trapper: {
    id: 'trapper',
    name: 'Piégeur',
    hp: 90,
    speed: cps(4),
    radius: 350,
    basic: { cd: sec(4), firstCd: sec(1), range: 0, power: 30 },
    ability: { cd: sec(12), name: 'Mine' },
    role: 'Contrôle',
    basicText: 'Pose un piège toutes les 4 s',
    abilityText: 'Mine : 60 dégâts de zone',
  },
};

export const CLASS_ORDER: ClassId[] = ['tank', 'archer', 'healer', 'trapper'];

export const ABILITY = {
  provokeTicks: sec(3),
  volleyCount: 3,
  volleySpread: 15, // degrés
  volleySpeed: cps(10),
  volleyTicks: sec(0.6),
  volleyDmg: 20,
  shield: 50,
  shieldTicks: sec(4),
  bubbleRange: cells(3),
  trapRadius: 520,
  trapArm: sec(0.4),
  trapRoot: sec(1.5),
  mineDistance: cells(1.5),
  mineFuse: sec(0.5),
  mineRadius: cells(1.5),
  mineDmg: 60,
};
