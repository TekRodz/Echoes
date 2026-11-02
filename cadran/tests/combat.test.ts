import { describe, expect, it } from 'vitest';
import { createCombat, intentsFor, place, previewTour, resolveTour } from '../src/engine/combat';
import { STARTER_DECK } from '../src/engine/cards';
import { bareCombat, card } from './helpers';

const deck = () => STARTER_DECK.map((id) => card(id));

describe('déterminisme', () => {
  it('même graine et mêmes actions => mêmes journaux de tour', () => {
    const play = () => {
      const s = createCombat({ seed: 7, deck: deck(), hp: 50, maxHp: 50, relics: [], enemy: 'coucou' });
      const logs = [];
      for (let t = 0; t < 5 && !s.outcome; t++) {
        const free = s.dial.findIndex((c) => !c);
        place(s, 0, free);
        logs.push(resolveTour(s));
      }
      return JSON.stringify(logs);
    };
    expect(play()).toBe(play());
  });

  it("l'aperçu donne exactement le résultat du tour, sans modifier l'état", () => {
    const s = createCombat({ seed: 9, deck: deck(), hp: 50, maxHp: 50, relics: [], enemy: 'sonnerie' });
    place(s, 0, 3);
    const before = JSON.stringify(s);
    const p = previewTour(s);
    expect(JSON.stringify(s)).toBe(before);
    expect(resolveTour(s)).toEqual(p);
  });
});

describe('cartes', () => {
  it('Parade annule une attaque sur son cran et en renvoie la moitié', () => {
    const s = bareCombat('coucou', {});
    const atk = intentsFor(s, 1)[0]!;
    s.dial[atk.cran] = card('parade');
    const log = resolveTour(s);
    const step = log.steps[atk.cran]!;
    expect(step.events.some((e) => e.t === 'parry' && e.reflect === Math.floor(atk.value / 2))).toBe(true);
    expect(step.events.some((e) => e.t === 'hurt')).toBe(false);
  });

  it('Retard pousse une attaque dans une Parade', () => {
    const s = bareCombat('coucou', {});
    const atk = intentsFor(s, 1)[0]!;
    s.dial[atk.cran - 1] = card('retard');
    s.dial[atk.cran + 1] = card('parade');
    const log = resolveTour(s);
    expect(log.steps[atk.cran]!.events.some((e) => e.t === 'hurt')).toBe(false);
    expect(log.steps[atk.cran + 1]!.events.some((e) => e.t === 'parry')).toBe(true);
  });

  it("Grippage annule la prochaine intention, et fait taire la Sonnerie s'il touche une charge", () => {
    const s = bareCombat('sonnerie', {});
    resolveTour(s); // tour 1 : simple attaque
    const charge = intentsFor(s, 2).find((i) => i.kind === 'charge')!;
    s.dial[charge.cran] = card('grippage');
    const log = resolveTour(s);
    expect(log.steps.some((st) => st.events.some((e) => e.t === 'fizzle'))).toBe(true);
  });

  it('Ressort accumule sa Tension à travers les rembobinages, Déclic la libère', () => {
    const s = bareCombat('metronome', { 0: 'ressort' });
    resolveTour(s);
    resolveTour(s);
    expect(s.dial[0]!.tension).toBe(4);
    s.dial[1] = card('declic');
    const log = resolveTour(s); // +2 au début du tour => 6 de Tension => 18 dégâts
    expect(log.steps[1]!.events.some((e) => e.t === 'hit' && e.v === 18)).toBe(true);
    expect(s.dial[0]!.tension).toBe(0);
  });

  it('Élan et Doublé modifient la carte du cran suivant', () => {
    const s = bareCombat('metronome', { 0: 'elan', 1: 'double', 2: 'frappe' });
    const log = resolveTour(s);
    // Élan donne +3 au cran 1 (Doublé), pas à la Frappe ; Doublé => Frappe x2.
    expect(log.steps[2]!.events.filter((e) => e.t === 'hit').length).toBe(2);
  });

  it('Métronome blesse sur les crans pairs vides seulement', () => {
    const s = bareCombat('metronome', { 3: 'frappe' });
    const log = resolveTour(s); // tour 1 : il bat les crans 4, 8 et 12
    expect(log.steps[3]!.events.some((e) => e.t === 'gapBlocked')).toBe(true);
    expect(log.steps[7]!.events.some((e) => e.t === 'hurt')).toBe(true);
  });

  it('Minuit double les dégâts à partir du 6e tour', () => {
    const s = bareCombat('coucou', {}, [], 999);
    s.player.maxHp = 999;
    for (let i = 0; i < 5; i++) resolveTour(s);
    expect(s.tour).toBe(6);
    const log = resolveTour(s);
    const hurt = log.steps.flatMap((st) => st.events).find((e) => e.t === 'hurt');
    expect(hurt && hurt.t === 'hurt' && hurt.v).toBe(2 * (4 + Math.floor(5 / 2)));
  });

  it('le Grand Carillon fait tourner le cadran quand il change de phase', () => {
    const s = bareCombat('carillon', { 4: 'frappe' }, [], 999);
    s.enemy.hp = 62; // juste au-dessus des 2/3 de 90
    s.dial[0] = card('midi');
    s.dial[11] = card('frappe');
    resolveTour(s);
    expect(s.enemy.phase).toBe(1);
    expect(s.dial[5]?.id).toBe('frappe');
    expect(s.dial[0]?.id).toBe('frappe');
  });
});
