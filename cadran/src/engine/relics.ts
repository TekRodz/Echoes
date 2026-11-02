import type { RelicId } from './types';

export interface RelicDef {
  id: RelicId;
  name: string;
  text: string;
}

export const RELICS: Record<RelicId, RelicDef> = {
  echappement: { id: 'echappement', name: 'Échappement', text: 'La carte du cran 12 s’active deux fois.' },
  complication: { id: 'complication', name: 'Grande complication', text: 'Les cartes des crans 3, 6, 9 et 12 gagnent +50 %.' },
  verre: { id: 'verre', name: 'Verre de montre', text: 'Tu vois les intentions de l’automate 2 tours à l’avance.' },
  contrepoids: { id: 'contrepoids', name: 'Contrepoids', text: '+4 de bouclier au début de chaque tour.' },
  remontoir: { id: 'remontoir', name: 'Remontoir', text: 'Au premier tour de chaque combat, +2 de Remontage.' },
  spiral: { id: 'spiral', name: 'Spiral d’or', text: '+3 de Couple maximum.' },
  fusee: { id: 'fusee', name: 'Fusée', text: 'Minuit sonne un tour plus tard.' },
  sablier: { id: 'sablier', name: 'Sablier fêlé', text: '+1 de Remontage à chaque tour, mais −1 d’Intégrité à chaque rembobinage.' },
};

export const RELIC_ORDER: RelicId[] = ['echappement', 'complication', 'verre', 'contrepoids', 'remontoir', 'spiral', 'fusee', 'sablier'];
