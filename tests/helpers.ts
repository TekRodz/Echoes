import { createWorld, hashWorld, stepWorld, type World } from '../src/sim/world';
import type { RoomDef } from '../src/sim/content/rooms';
import { LOOP_TICKS } from '../src/sim/content/rooms';
import type { ClassId, CloneRecord, InputFrame, SimEvent } from '../src/sim/types';

export type InputFn = (tick: number, w: World) => Omit<InputFrame, 'tick'>;

export interface LoopResult {
  world: World;
  record: CloneRecord | null;
  hashes: number[];
  events: { tick: number; e: SimEvent }[];
}

export function runLoop(
  room: RoomDef,
  seed: number,
  clones: CloneRecord[],
  playerClass: ClassId | null,
  loopIndex: number,
  input: InputFn = () => ({ moveX: 0, moveY: 0, ability: false }),
  maxTicks = LOOP_TICKS,
): LoopResult {
  const w = createWorld({ room, seed, clones, playerClass, loopIndex });
  const hashes: number[] = [];
  const events: { tick: number; e: SimEvent }[] = [];
  while (!w.outcome && w.tick < maxTicks) {
    const t = w.tick;
    stepWorld(w, { tick: t, ...input(t, w) });
    hashes.push(hashWorld(w));
    for (const e of w.events) events.push({ tick: t, e });
  }
  return { world: w, record: w.record, hashes, events };
}

/** Générateur d'entrées pseudo-aléatoires reproductible (hors sim, pour les tests). */
export function scriptedInputs(salt: number): InputFn {
  return (tick) => {
    const phase = Math.floor(tick / 45) + salt * 7;
    const a = (phase * 2654435761) >>> 0;
    const mx = ((a % 3) - 1) * 127;
    const my = (((a >>> 3) % 3) - 1) * 127;
    return { moveX: mx, moveY: my, ability: tick % 97 === salt % 97 };
  };
}
