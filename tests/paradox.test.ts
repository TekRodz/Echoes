import { describe, expect, it } from 'vitest';
import { sec } from '../src/sim/fixed';
import { ROOMS, type RoomDef } from '../src/sim/content/rooms';
import { enemyId } from '../src/sim/world';
import { runLoop } from './helpers';

// Salle de test : un seul sbire, à portée d'archer depuis le départ.
const room: RoomDef = {
  ...ROOMS[1]!,
  id: 'test',
  objective: 'survive',
  walls: [],
  spawns: [{ tick: 0, kind: 'minion', x: 3000, y: 4000 }],
};

describe('paradoxes', () => {
  it('un clone dont la cible meurt plus tôt passe en Paradoxe au tick attendu', () => {
    // Boucle 1 : l'archer reste immobile et tire sur le sbire (id stable).
    const loop1 = runLoop(room, 7, [], 'archer', 0, () => ({ moveX: 0, moveY: 0, ability: false }), sec(5));
    const rec = loop1.record!;
    const shots = rec.actions.filter((a) => a.kind === 'basic' && a.targetId === enemyId(0));
    expect(shots.length).toBeGreaterThanOrEqual(4); // 40 PV / 12 = 4 tirs

    // Boucle 2 : un second archer tire en même temps que le clone. Le sbire meurt au 2e tir du joueur,
    // donc la 3e action enregistrée du clone vise une cible morte.
    const loop2 = runLoop(room, 7, [rec], 'archer', 1, () => ({ moveX: 0, moveY: 0, ability: false }), sec(5));
    const death = loop2.events.find((x) => x.e.type === 'death' && x.e.id === enemyId(0));
    expect(death).toBeDefined();
    const expectedTick = shots.find((a) => a.tick > death!.tick)!.tick;
    const paradox = loop2.events.find((x) => x.e.type === 'paradox');
    expect(paradox).toBeDefined();
    expect(paradox!.tick).toBe(expectedTick);
    expect(paradox!.e.type === 'paradox' && paradox!.e.reason).toBe('target');
  });

  it('un clone qui meurt ne devient pas un paradoxe', () => {
    const loop1 = runLoop(room, 3, [], 'trapper', 0, () => ({ moveX: 0, moveY: -127, ability: false }), sec(20));
    const rec = loop1.record!;
    const loop2 = runLoop(room, 3, [rec], null, 1);
    expect(loop2.events.some((x) => x.e.type === 'paradox')).toBe(false);
  });

  it('un clone bloqué plus de 0,5 s par un obstacle nouveau devient un paradoxe', () => {
    // Boucle 1 sans ennemi : le clone monte tout droit.
    const empty: RoomDef = { ...room, spawns: [] };
    const loop1 = runLoop(empty, 5, [], 'tank', 0, () => ({ moveX: 0, moveY: -127, ability: false }), sec(3));
    // Boucle 2 : un mur qui n'existait pas à l'enregistrement barre son chemin.
    const blocked: RoomDef = { ...empty, walls: [[2, 5], [3, 5]] };
    const loop2 = runLoop(blocked, 5, [loop1.record!], null, 1, undefined, sec(3));
    const p = loop2.events.find((x) => x.e.type === 'paradox');
    expect(p).toBeDefined();
    expect(p!.e.type === 'paradox' && p!.e.reason).toBe('blocked');
    // Le mur est atteint vers 0,3 s ; le paradoxe tombe un peu plus de 30 ticks après.
    expect(p!.tick).toBeGreaterThan(30);
    expect(p!.tick).toBeLessThan(sec(1.5));
  });
});
