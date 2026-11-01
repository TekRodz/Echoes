import { describe, expect, it } from 'vitest';
import { ROOMS } from '../src/sim/content/rooms';
import type { ClassId, CloneRecord } from '../src/sim/types';
import { runLoop, scriptedInputs } from './helpers';

const CLASSES: ClassId[] = ['tank', 'archer', 'healer', 'trapper'];

function playRoom(roomIndex: number, seed: number): number[][] {
  const room = ROOMS[roomIndex]!;
  const clones: CloneRecord[] = [];
  const all: number[][] = [];
  for (let loop = 0; loop < room.maxLoops; loop++) {
    const res = runLoop(room, seed, clones, CLASSES[loop % 4]!, loop, scriptedInputs(loop + 1));
    all.push(res.hashes);
    if (res.world.outcome === 'win' || !res.record) break;
    clones.push(res.record);
  }
  return all;
}

describe('déterminisme', () => {
  for (let r = 0; r < 3; r++) {
    it(`salle ${r} : mêmes inputs => même hash à chaque tick, sur toutes les boucles`, () => {
      const a = playRoom(r, 1234);
      const b = playRoom(r, 1234);
      expect(a.length).toBeGreaterThan(0);
      expect(b).toEqual(a);
    });
  }

  it('une seed différente donne un état différent', () => {
    const a = playRoom(1, 1);
    const b = playRoom(1, 2);
    expect(b[0]![0]).not.toEqual(a[0]![0]);
  });

  it('un clone rejoué sans perturbation suit exactement son trajet, sans paradoxe', () => {
    const room = ROOMS[1]!;
    const first = runLoop(room, 99, [], 'archer', 0, scriptedInputs(3));
    const rec = first.record!;
    const ghost = runLoop(room, 99, [rec], null, 1, undefined, rec.endTick);
    const clone = ghost.world.units.find((u) => u.cloneIndex === 0)!;
    expect(ghost.events.some((x) => x.e.type === 'paradox')).toBe(false);
    // Même état final : le monde fantôme rejoue la boucle 1 à l'identique.
    expect(ghost.hashes[rec.endTick - 1]).toBeDefined();
    expect(clone.x).toBe(rec.path[(rec.endTick - 1) * 2]);
    expect(clone.y).toBe(rec.path[(rec.endTick - 1) * 2 + 1]);
  });
});
