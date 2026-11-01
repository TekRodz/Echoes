// Silhouettes 48 × 48 reprises des maquettes (Personnages.dc.html), converties en Path2D.
import type { ClassId, EnemyKind } from '../sim/types';
import { C, roman } from './palette';

const P = (d: string): Path2D => new Path2D(d);
const rr = (x: number, y: number, w: number, h: number, r: number): Path2D => {
  const p = new Path2D();
  p.roundRect(x, y, w, h, r);
  return p;
};
const join = (...ps: Path2D[]): Path2D => {
  const out = new Path2D();
  for (const p of ps) out.addPath(p);
  return out;
};

interface ClassShape {
  /** Corps plein (remplissage). */
  body: Path2D;
  /** Traits (arc de l'archer). */
  strokes?: { path: Path2D; width: number }[];
  heart: [number, number];
  numeralY: number;
}

let cache: Record<ClassId, ClassShape> | null = null;

export function classShapes(): Record<ClassId, ClassShape> {
  if (cache) return cache;
  cache = {
    tank: { body: join(rr(10, 13, 28, 27, 5), rr(8, 8, 32, 6, 2)), heart: [20.5, 23], numeralY: 31 },
    archer: {
      body: P('M24 16L34 28L24 40L14 28Z'),
      strokes: [
        { path: P('M9 15Q24 1 39 15'), width: 3 },
        { path: P('M24 15V9M20.5 12.5L24 9l3.5 3.5'), width: 2 },
      ],
      heart: [20.5, 24.5],
      numeralY: 32.5,
    },
    healer: {
      body: join(rr(21, 8, 6, 6, 1.5), rr(21, 34, 6, 6, 1.5), rr(8, 21, 6, 6, 1.5), rr(34, 21, 6, 6, 1.5), circle(24, 24, 12)),
      heart: [20.5, 20.5],
      numeralY: 28.5,
    },
    trapper: { body: join(P('M18 13V8l3 2.5L24 8l3 2.5L30 8v5z'), P('M17 14H31L38 27L31 40H17L10 27Z')), heart: [20.5, 23.5], numeralY: 31.5 },
  };
  return cache;
}

function circle(cx: number, cy: number, r: number): Path2D {
  const p = new Path2D();
  p.arc(cx, cy, r, 0, Math.PI * 2);
  return p;
}

export type AllyLook = 'player' | 'clone' | 'paradox';

/** Dessine une classe dans la boîte 48 × 48 (le contexte est déjà transformé). */
export function drawClass(ctx: CanvasRenderingContext2D, kind: ClassId, look: AllyLook, loop: number, t: number, reduceFx: boolean): void {
  const s = classShapes()[kind];
  if (look === 'paradox') {
    // Double décalé qui « bave ».
    const wob = reduceFx ? 0 : Math.sin(t * 9) * 1.2;
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.translate(3 + wob, 3 - wob * 0.5);
    ctx.fillStyle = C.sanguine;
    ctx.fill(s.body);
    for (const st of s.strokes ?? []) strokePath(ctx, st.path, C.sanguine, st.width);
    ctx.restore();
    ctx.fillStyle = C.sanguine;
    ctx.fill(s.body);
    for (const st of s.strokes ?? []) strokePath(ctx, st.path, C.sanguine, st.width);
    const [hx, hy] = s.heart;
    ctx.strokeStyle = C.parchment;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx + 0.5, hy + 0.5);
    ctx.lineTo(hx + 6.5, hy + 6.5);
    ctx.moveTo(hx + 6.5, hy + 0.5);
    ctx.lineTo(hx + 0.5, hy + 6.5);
    ctx.stroke();
    // Gouttes
    ctx.fillStyle = C.sanguine;
    const drip = reduceFx ? 0 : (t * 6) % 4;
    ctx.beginPath();
    ctx.arc(44, 44 + drip * 0.5, 1.8, 0, Math.PI * 2);
    ctx.arc(6, 40 + drip, 1.3, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (look === 'clone') {
    ctx.fillStyle = C.cloneBody;
    ctx.fill(s.body);
    strokePath(ctx, s.body, C.paleInk, 2.5);
    for (const st of s.strokes ?? []) strokePath(ctx, st.path, C.paleInk, st.width);
    ctx.fillStyle = C.ink;
    ctx.font = '700 12px "Cormorant Garamond", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(roman(loop), 24, s.numeralY);
    return;
  }
  ctx.fillStyle = C.ink;
  ctx.fill(s.body);
  for (const st of s.strokes ?? []) strokePath(ctx, st.path, C.ink, st.width);
  ctx.fillStyle = C.brass;
  ctx.fillRect(s.heart[0], s.heart[1], 7, 7);
}

function strokePath(ctx: CanvasRenderingContext2D, p: Path2D, color: string, width: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(p);
}

let enemyCache: Record<EnemyKind, { outline: Path2D; hatch: Path2D; extra?: Path2D }> | null = null;

function enemyShapes(): Record<EnemyKind, { outline: Path2D; hatch: Path2D; extra?: Path2D }> {
  if (enemyCache) return enemyCache;
  const tri = P('M24 9L39 37H9Z');
  const hatch = P('M15 33l6-6M19 35l9-9M25 35l7-7M31 35l3-3');
  enemyCache = {
    minion: { outline: tri, hatch },
    shooter: { outline: tri, hatch: P('M15 33l4-4M31 35l3-3M27 35l4-4'), extra: circle(24, 26, 3.6) },
    brute: { outline: P('M24 4L44 41H4Z'), hatch: P('M11 37l8-8M17 39l12-12M25 39l11-11M33 39l6-6'), extra: P('M24 13L36 35H12Z') },
  };
  return enemyCache;
}

export function drawEnemy(ctx: CanvasRenderingContext2D, kind: EnemyKind, flash: boolean): void {
  const s = enemyShapes()[kind];
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.fillStyle = flash ? C.ink : C.parchment;
  ctx.fill(s.outline);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2.5;
  ctx.stroke(s.outline);
  ctx.lineWidth = 1.2;
  ctx.stroke(s.hatch);
  if (kind === 'brute' && s.extra) {
    ctx.lineWidth = 1.5;
    ctx.stroke(s.extra);
  } else if (s.extra) {
    ctx.fillStyle = flash ? C.parchment : C.ink;
    ctx.fill(s.extra);
  }
}

// Icônes 24 × 24 (Icones.dc.html), pour l'interface HTML.
export const ICONS: Record<string, string> = {
  tank: '<path d="M12 3.75l7 3v5c0 4.5-3 7-7 8.5-4-1.5-7-4-7-8.5v-5z"/>',
  archer: '<path d="M8 4.5c5.5 3 5.5 12 0 15M8 4.5v15M4.5 12H19M16 9l3 3-3 3"/>',
  healer: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
  trapper: '<circle cx="12" cy="12" r="3.5"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M6 6l2.1 2.1M15.9 15.9L18 18M18 6l-2.1 2.1M8.1 15.9L6 18"/>',
  loop: '<path d="M19 12a7 7 0 1 1-7-7c1.96 0 3.83.78 5.24 2.13L19 8.5"/><path d="M19 4.5v4h-4"/><path d="M12 12h.01" stroke-width="2.5"/>',
  stability: '<path d="M7 4h10M7 20h10M8 4c0 5 8 6 8 16M16 4c0 5-8 6-8 16"/>',
  pause: '<path d="M9 6.5v11M15 6.5v11"/>',
  star: '<path d="M12 4l2.3 5 5.2.6-3.9 3.5 1.1 5.2L12 15.7l-4.7 2.6 1.1-5.2-3.9-3.5 5.2-.6z"/>',
  boss: '<circle cx="12" cy="12" r="8"/><path d="M12 12V7.5M12 12l3 2M12 2.5V4M12 20v1.5M2.5 12H4M20 12h1.5"/>',
};

export function icon(name: string, size = 24, color = 'currentColor', fill = 'none'): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" fill="${fill}" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? ''}</svg>`;
}
