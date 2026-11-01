// Effets éphémères déclenchés par les événements de la sim (temps réel, hors sim).
import type { SimEvent } from '../sim/types';
import type { World } from '../sim/world';

export type FxKind = 'shot' | 'hit' | 'heal' | 'boom' | 'snap' | 'death' | 'paradox' | 'taunt' | 'shield' | 'fade' | 'trap';

export interface Fx {
  kind: FxKind;
  x: number;
  y: number;
  x2: number;
  y2: number;
  r: number;
  life: number;
  max: number;
  clone: boolean;
  wild: boolean;
  text?: string;
  /** Unité suivie (pour les anneaux). */
  follow?: number;
}

export class FxList {
  items: Fx[] = [];
  /** Unités touchées récemment (clignotement). */
  flashes = new Map<number, number>();

  clear(): void {
    this.items = [];
    this.flashes.clear();
  }

  private add(f: Partial<Fx> & { kind: FxKind; x: number; y: number; max: number }): void {
    this.items.push({ x2: f.x, y2: f.y, r: 0, life: f.max, clone: false, wild: false, ...f });
  }

  push(events: SimEvent[], w: World): void {
    for (const e of events) {
      switch (e.type) {
        case 'shot': {
          const u = w.byId.get(e.from);
          this.add({ kind: 'shot', x: e.x1, y: e.y1, x2: e.x2, y2: e.y2, max: 0.14, clone: (u?.cloneIndex ?? -1) >= 0, wild: !!u?.paradox });
          break;
        }
        case 'hit': {
          this.flashes.set(e.to, 0.12);
          const t = w.byId.get(e.to);
          if (t?.side === 'ally' && t.cloneIndex < 0) this.add({ kind: 'hit', x: e.x, y: e.y, max: 0.5, text: `−${e.amount}` });
          break;
        }
        case 'heal': {
          const t = w.byId.get(e.to);
          if (t) this.add({ kind: 'heal', x: t.x, y: t.y, max: 0.6, text: '+' });
          break;
        }
        case 'shield':
          this.add({ kind: 'shield', x: 0, y: 0, max: 0.5, follow: e.to });
          break;
        case 'taunt':
          this.add({ kind: 'taunt', x: 0, y: 0, max: 0.8, follow: e.id });
          break;
        case 'boom':
          this.add({ kind: 'boom', x: e.x, y: e.y, r: e.r, max: 0.45 });
          break;
        case 'snap':
          this.add({ kind: 'snap', x: e.x, y: e.y, max: 0.4 });
          break;
        case 'trap':
          this.add({ kind: 'trap', x: e.x, y: e.y, max: 0.3 });
          break;
        case 'death':
          this.add({ kind: 'death', x: e.x, y: e.y, max: 0.6 });
          break;
        case 'fade': {
          const u = w.byId.get(e.id);
          if (u) this.add({ kind: 'fade', x: u.x, y: u.y, max: 0.6 });
          break;
        }
        case 'paradox':
          this.add({ kind: 'paradox', x: e.x, y: e.y, x2: e.lostX, y2: e.lostY, max: 0.9 });
          break;
        default:
          break;
      }
    }
  }

  update(dt: number): void {
    for (const f of this.items) f.life -= dt;
    this.items = this.items.filter((f) => f.life > 0);
    for (const [id, t] of this.flashes) {
      if (t - dt <= 0) this.flashes.delete(id);
      else this.flashes.set(id, t - dt);
    }
  }
}
