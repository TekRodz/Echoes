// Rendu Canvas 2D : lit un instantané de la sim, n'écrit jamais dedans.
import { CELL } from '../sim/fixed';
import { ABILITY } from '../sim/content/classes';
import { LOOP_TICKS, type RoomDef } from '../sim/content/rooms';
import type { ClassId, CloneRecord, EnemyKind, Unit } from '../sim/types';
import type { Frame } from '../sim/world';
import type { FxList } from './fx';
import { C, roman } from './palette';
import { drawClass, drawEnemy } from './shapes';

export interface DrawOpts {
  room: RoomDef;
  frame: Frame;
  alpha: number;
  records: CloneRecord[];
  trails: 'ahead' | 'full' | 'none';
  time: number;
  fx: FxList | null;
  reduceFx: boolean;
  /** 0 = pas de rembobinage ; 0..1 = progression de l'effet. */
  rewind: number;
  /** Afficher la grille de façon appuyée (aperçu). */
  preview: boolean;
}

const MARGIN = 12; // cadre « papier vieilli » autour de la salle, en px

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  scale = 0.05; // px par unité
  ox = 0;
  oy = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
  }

  resize(room: RoomDef): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    const rw = room.cols * CELL;
    const rh = room.rows * CELL;
    this.scale = Math.min((this.w - MARGIN * 2) / rw, (this.h - MARGIN * 2) / rh);
    this.ox = (this.w - rw * this.scale) / 2;
    this.oy = (this.h - rh * this.scale) / 2;
  }

  /** Coordonnées écran (px CSS) -> unités de sim. */
  toWorld(px: number, py: number): [number, number] {
    return [(px - this.ox) / this.scale, (py - this.oy) / this.scale];
  }

  private X = (u: number): number => this.ox + u * this.scale;
  private Y = (u: number): number => this.oy + u * this.scale;

  draw(o: DrawOpts): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    let shake = 0;
    if (o.rewind > 0 && !o.reduceFx) shake = Math.sin(o.time * 60) * 1.5;
    ctx.save();
    ctx.translate(shake, 0);

    this.drawRoom(o);
    this.drawLevers(o);
    this.drawTraps(o);
    this.drawTrails(o);
    this.drawUnits(o);
    this.drawProjectiles(o);
    if (o.fx) this.drawFx(o);
    ctx.restore();

    if (o.rewind > 0) this.drawRewind(o);
  }

  private drawRoom(o: DrawOpts): void {
    const ctx = this.ctx;
    const { room } = o;
    const rw = room.cols * CELL * this.scale;
    const rh = room.rows * CELL * this.scale;
    const cs = CELL * this.scale;
    ctx.fillStyle = C.aged;
    ctx.fillRect(this.ox - MARGIN, this.oy - MARGIN, rw + MARGIN * 2, rh + MARGIN * 2);
    ctx.fillStyle = C.parchment;
    ctx.fillRect(this.ox, this.oy, rw, rh);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(this.ox, this.oy, rw, rh);
    ctx.strokeStyle = C.brassDark;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(this.ox + 6, this.oy + 6, rw - 12, rh - 12);

    ctx.strokeStyle = C.aged;
    ctx.lineWidth = o.preview ? 1.2 : 0.8;
    ctx.beginPath();
    for (let c = 1; c < room.cols; c++) {
      ctx.moveTo(this.ox + c * cs, this.oy + 6);
      ctx.lineTo(this.ox + c * cs, this.oy + rh - 6);
    }
    for (let r = 1; r < room.rows; r++) {
      ctx.moveTo(this.ox + 6, this.oy + r * cs);
      ctx.lineTo(this.ox + rw - 6, this.oy + r * cs);
    }
    ctx.stroke();

    for (const [col, row] of room.walls) {
      const x = this.ox + col * cs;
      const y = this.oy + row * cs;
      ctx.fillStyle = C.aged;
      ctx.fillRect(x, y, cs, cs);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cs, cs);
      ctx.clip();
      ctx.strokeStyle = C.brassDark;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let i = -cs; i < cs; i += 7) {
        ctx.moveTo(x + i, y + cs);
        ctx.lineTo(x + i + cs, y);
      }
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.75, y + 0.75, cs - 1.5, cs - 1.5);
    }
  }

  private drawLevers(o: DrawOpts): void {
    const ctx = this.ctx;
    const cs = CELL * this.scale;
    o.room.levers.forEach(([col, row], i) => {
      const held = o.frame.leversHeld[i] ?? false;
      const x = this.ox + col * cs;
      const y = this.oy + row * cs;
      const pad = cs * 0.1;
      ctx.fillStyle = held ? C.brass : C.agedLight;
      ctx.globalAlpha = held ? 0.35 : 1;
      ctx.fillRect(x + pad, y + pad, cs - pad * 2, cs - pad * 2);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = C.brass;
      ctx.lineWidth = 2;
      ctx.setLineDash(held ? [] : [5, 4]);
      ctx.strokeRect(x + pad, y + pad, cs - pad * 2, cs - pad * 2);
      ctx.setLineDash([]);
      // Levier : socle + manche
      const cx = x + cs / 2;
      const cy = y + cs * 0.68;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - cs * 0.18, cy);
      ctx.lineTo(cx + cs * 0.18, cy);
      const a = held ? 0.55 : -0.55;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.sin(a) * cs * 0.32, cy - Math.cos(a) * cs * 0.32);
      ctx.stroke();
      ctx.fillStyle = C.brass;
      ctx.beginPath();
      ctx.arc(cx + Math.sin(a) * cs * 0.32, cy - Math.cos(a) * cs * 0.32, cs * 0.06, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  private drawTraps(o: DrawOpts): void {
    const ctx = this.ctx;
    const s = this.scale;
    for (const t of o.frame.traps) {
      const x = this.X(t.x);
      const y = this.Y(t.y);
      const color = t.wild ? C.sanguine : C.ink;
      if (t.kind === 'trap') {
        const armed = t.ticks >= ABILITY.trapArm;
        const r = 220 * s;
        ctx.globalAlpha = armed ? 1 : 0.4;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i;
          const px = x + Math.cos(a) * r;
          const py = y + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        // Mâchoire
        ctx.beginPath();
        ctx.moveTo(x - r * 0.6, y);
        ctx.lineTo(x - r * 0.3, y - r * 0.35);
        ctx.lineTo(x, y);
        ctx.lineTo(x + r * 0.3, y - r * 0.35);
        ctx.lineTo(x + r * 0.6, y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        const k = Math.min(1, t.ticks / ABILITY.mineFuse);
        ctx.strokeStyle = color;
        ctx.setLineDash([3, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, ABILITY.mineRadius * s, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 160 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = C.parchment;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 90 * s, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  private drawTrails(o: DrawOpts): void {
    if (o.trails === 'none') return;
    const ctx = this.ctx;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 5]);
    ctx.lineCap = 'round';
    for (const rec of o.records) {
      const u = o.frame.units.find((x) => x.cloneIndex === rec.loopIndex);
      let from = 0;
      let to = rec.endTick;
      if (o.trails === 'ahead') {
        if (!u || !u.alive) continue;
        from = o.frame.tick;
        to = Math.min(rec.endTick, from + 100);
      }
      if (to - from < 2) continue;
      ctx.strokeStyle = u?.paradox ? C.sanguine : C.paleInk;
      ctx.globalAlpha = o.trails === 'ahead' ? 0.55 : 0.8;
      ctx.beginPath();
      for (let t = from; t < to; t += 4) {
        const x = this.X(rec.path[t * 2] ?? 0);
        const y = this.Y(rec.path[t * 2 + 1] ?? 0);
        if (t === from) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(this.X(rec.path[(to - 1) * 2] ?? 0), this.Y(rec.path[(to - 1) * 2 + 1] ?? 0));
      ctx.stroke();
      if (o.trails === 'full') {
        const ex = this.X(rec.path[(to - 1) * 2] ?? 0);
        const ey = this.Y(rec.path[(to - 1) * 2 + 1] ?? 0);
        ctx.setLineDash([]);
        ctx.fillStyle = C.paleInk;
        ctx.font = '700 12px "Cormorant Garamond", Georgia, serif';
        ctx.textAlign = 'center';
        if (rec.endTick < LOOP_TICKS) {
          // Mort pendant sa boucle : petite croix.
          ctx.beginPath();
          ctx.moveTo(ex - 5, ey - 5);
          ctx.lineTo(ex + 5, ey + 5);
          ctx.moveTo(ex + 5, ey - 5);
          ctx.lineTo(ex - 5, ey + 5);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(ex, ey, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillText(roman(rec.loopIndex), ex + 10, ey - 6);
        ctx.setLineDash([3, 5]);
      }
    }
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }

  private pos(u: Unit, alpha: number): [number, number] {
    return [this.X(u.px + (u.x - u.px) * alpha), this.Y(u.py + (u.y - u.py) * alpha)];
  }

  private drawUnits(o: DrawOpts): void {
    const ctx = this.ctx;
    const cs = CELL * this.scale;
    const units = o.frame.units.filter((u) => u.alive);
    const order = (u: Unit): number => (u.side === 'enemy' ? 0 : u.cloneIndex >= 0 ? 1 : 2);
    units.sort((a, b) => order(a) - order(b) || a.id - b.id);

    for (const u of units) {
      const [x, y] = this.pos(u, o.alpha);
      if (u.side === 'enemy') {
        // Télégraphe de charge de la brute
        if (u.kind === 'brute' && u.state === 'windup') {
          ctx.strokeStyle = C.ink;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 5]);
          ctx.globalAlpha = 0.5 + 0.5 * Math.sin(o.time * 20);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + (u.chargeDx / 1000) * cs * 5, y + (u.chargeDy / 1000) * cs * 5);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
        const size = (u.kind === 'brute' ? 1.1 : u.kind === 'shooter' ? 0.66 : 0.68) * cs;
        ctx.save();
        ctx.translate(x - size / 2, y - size / 2);
        ctx.scale(size / 48, size / 48);
        drawEnemy(ctx, u.kind as EnemyKind, (o.fx?.flashes.get(u.id) ?? 0) > 0);
        ctx.restore();
        if (u.rootTicks > 0) {
          ctx.strokeStyle = C.ink;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.arc(x, y, size * 0.62, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        if (u.hp < u.maxHp) this.hpBar(x, y + size * 0.48, cs * 0.6, u.hp / u.maxHp, C.ink);
        continue;
      }

      const look = u.cloneIndex < 0 ? 'player' : u.paradox ? 'paradox' : 'clone';
      const size = cs * 0.8;
      if (look === 'player') {
        ctx.strokeStyle = C.brass;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(x, y, size * 0.75, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (u.provokeTicks > 0) {
        ctx.strokeStyle = look === 'paradox' ? C.sanguine : C.ink;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 6]);
        ctx.lineDashOffset = -o.time * 30;
        ctx.beginPath();
        ctx.arc(x, y, size * (0.95 + 0.08 * Math.sin(o.time * 8)), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
      }
      if (u.shield > 0) {
        ctx.strokeStyle = C.paleInk;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.68, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (look === 'paradox') {
        // Trait pointillé vers la cible disparue + croix.
        const lx = this.X(u.lostX);
        const ly = this.Y(u.lostY);
        ctx.strokeStyle = C.sanguine;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(lx, ly);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lx - 5, ly - 5);
        ctx.lineTo(lx + 5, ly + 5);
        ctx.moveTo(lx + 5, ly - 5);
        ctx.lineTo(lx - 5, ly + 5);
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(x - size / 2, y - size / 2);
      ctx.scale(size / 48, size / 48);
      const flash = (o.fx?.flashes.get(u.id) ?? 0) > 0;
      if (flash) ctx.globalAlpha = 0.6;
      drawClass(ctx, u.kind as ClassId, look, u.cloneIndex, o.time, o.reduceFx);
      ctx.restore();
      if (look === 'paradox') {
        ctx.fillStyle = C.sanguine;
        ctx.font = 'italic 11px Spectral, Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText(`paradoxe · ${roman(u.cloneIndex)}`, x, y + size * 0.85);
      }
      if (u.hp < u.maxHp) this.hpBar(x, y + size * 0.6, cs * 0.6, u.hp / u.maxHp, look === 'paradox' ? C.sanguine : look === 'clone' ? C.paleInk : C.ink);
    }
  }

  private hpBar(cx: number, y: number, w: number, k: number, color: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = C.aged;
    ctx.fillRect(cx - w / 2, y, w, 4);
    ctx.fillStyle = color;
    ctx.fillRect(cx - w / 2, y, w * Math.max(0, k), 4);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 0.6;
    ctx.strokeRect(cx - w / 2, y, w, 4);
  }

  private drawProjectiles(o: DrawOpts): void {
    const ctx = this.ctx;
    for (const p of o.frame.projectiles) {
      const x = this.X(p.px + (p.x - p.px) * o.alpha);
      const y = this.Y(p.py + (p.y - p.py) * o.alpha);
      const len = Math.hypot(p.vx, p.vy) || 1;
      const dx = (p.vx / len) * CELL * this.scale;
      const dy = (p.vy / len) * CELL * this.scale;
      if (p.hits === 'ally') {
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - dx * 0.3, y - dy * 0.3);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = C.ink;
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = p.hits === 'any' ? C.sanguine : C.ink;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - dx * 0.3, y - dy * 0.3);
        ctx.stroke();
      }
    }
  }

  private drawFx(o: DrawOpts): void {
    const ctx = this.ctx;
    const fx = o.fx!;
    const cs = CELL * this.scale;
    for (const f of fx.items) {
      const k = f.life / f.max; // 1 -> 0
      const x = this.X(f.x);
      const y = this.Y(f.y);
      switch (f.kind) {
        case 'shot':
          ctx.strokeStyle = f.wild ? C.sanguine : f.clone ? C.paleInk : C.ink;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = k;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(this.X(f.x2), this.Y(f.y2));
          ctx.stroke();
          break;
        case 'hit':
        case 'heal':
          ctx.globalAlpha = k;
          ctx.fillStyle = f.kind === 'heal' ? C.paleInk : C.ink;
          ctx.font = `600 ${f.kind === 'heal' ? 16 : 13}px "Cormorant Garamond", Georgia, serif`;
          ctx.textAlign = 'center';
          ctx.fillText(f.text ?? '', x + (f.kind === 'heal' ? cs * 0.3 : 0), y - cs * 0.45 - (1 - k) * 18);
          break;
        case 'boom':
          ctx.strokeStyle = C.ink;
          ctx.lineWidth = 2.5 * k;
          ctx.globalAlpha = k;
          ctx.beginPath();
          ctx.arc(x, y, f.r * this.scale * (1.1 - k * 0.6), 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'snap':
        case 'trap':
        case 'death':
        case 'fade': {
          const n = f.kind === 'death' ? 8 : 6;
          ctx.strokeStyle = f.kind === 'fade' ? C.paleInk : C.ink;
          ctx.globalAlpha = k;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + 0.3;
            const r1 = cs * (0.2 + (1 - k) * 0.35);
            const r2 = r1 + cs * 0.12;
            ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
            ctx.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2);
          }
          ctx.stroke();
          break;
        }
        case 'paradox': {
          // Verre fêlé : éclats sanguins.
          ctx.strokeStyle = C.sanguine;
          ctx.globalAlpha = k;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let i = 0; i < 7; i++) {
            const a = i * 0.9 + 0.2;
            const r = cs * (0.5 + (1 - k) * 0.9);
            ctx.moveTo(x + Math.cos(a) * cs * 0.3, y + Math.sin(a) * cs * 0.3);
            ctx.lineTo(x + Math.cos(a + 0.15) * r, y + Math.sin(a + 0.15) * r);
          }
          ctx.stroke();
          break;
        }
        case 'taunt':
        case 'shield': {
          const u = o.frame.units.find((x2) => x2.id === f.follow);
          if (!u) break;
          const [ux, uy] = this.pos(u, o.alpha);
          ctx.strokeStyle = f.kind === 'taunt' ? C.ink : C.paleInk;
          ctx.globalAlpha = k;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(ux, uy, cs * (0.5 + (1 - k) * (f.kind === 'taunt' ? 2.2 : 0.5)), 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawRewind(o: DrawOpts): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = C.parchment;
    ctx.fillRect(0, 0, this.w, this.h);
    if (!o.reduceFx) {
      // Bande magnétique : stries horizontales qui défilent.
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = C.ink;
      for (let i = 0; i < 9; i++) {
        const y = ((i * 97 + o.time * 900) % (this.h + 40)) - 20;
        ctx.fillRect(0, y, this.w, 1 + (i % 3));
      }
    }
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = C.ink;
    ctx.font = 'italic 600 30px "Cormorant Garamond", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('rembobinage', this.w / 2, this.h / 2);
    ctx.restore();
  }
}
