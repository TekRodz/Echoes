// Pictogrammes 24 × 24 (trait 1,75, bouts arrondis), dans la lignée des icônes d'Échos.
import type { Glyph } from '../engine/cards';
import type { EnemyId } from '../engine/types';

const SHIELD = 'M12 3.75l7 3v5c0 4.5-3 7-7 8.5-4-1.5-7-4-7-8.5v-5z';
const GEAR = '<circle cx="12" cy="12" r="4"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M6 6l2.1 2.1M15.9 15.9L18 18M18 6l-2.1 2.1M8.1 15.9L6 18"/>';

export const GLYPHS: Record<Glyph | 'laiton' | 'heart' | 'deck' | 'clock' | 'relic', string> = {
  hit: '<path d="M5.5 18.5L17 7M13.5 6H18v4.5M8 13.5l2.5 2.5M4.5 19.5l2-2"/>',
  block: `<path d="${SHIELD}"/>`,
  parry: `<path d="${SHIELD}"/><path d="M15 12H9.5M11.5 9.8L9.3 12l2.2 2.2"/>`,
  later: '<path d="M4 12h11.5M12 8.5l3.5 3.5-3.5 3.5M19.5 6v12"/>',
  sooner: '<path d="M20 12H8.5M12 8.5L8.5 12l3.5 3.5M4.5 6v12"/>',
  jam: '<circle cx="12" cy="12" r="6.5"/><path d="M7.5 7.5l9 9"/>',
  gear: GEAR,
  chain: '<path d="M10 14l4-4M9 16.5a3.2 3.2 0 0 1-4.5-4.5l2.2-2.2a3.2 3.2 0 0 1 4.5 0M15 7.5a3.2 3.2 0 0 1 4.5 4.5l-2.2 2.2a3.2 3.2 0 0 1-4.5 0"/>',
  double: '<path d="M5.5 7l5 5-5 5M12.5 7l5 5-5 5"/>',
  spring: '<path d="M7 4h10M7 20h10M8 4l8 3-8 3 8 3-8 3 8 3"/>',
  click: '<path d="M13.5 3.5L7 13h5l-1.5 7.5L17 11h-5z"/>',
  spiral: '<path d="M12 12.5a1.2 1.2 0 1 0-1.2-1.2M10.8 11.3a3 3 0 1 0 3.2-2.8M14 8.5a5.2 5.2 0 1 1-6.6 5.3M7.4 13.8A7.6 7.6 0 1 1 19.5 9"/>',
  star: '<path d="M12 4l2.3 5 5.2.6-3.9 3.5 1.1 5.2L12 15.7l-4.7 2.6 1.1-5.2-3.9-3.5 5.2-.6z"/>',
  rust: '<path d="M12 3.75c3 4.2 6 7.4 6 10.25a6 6 0 0 1-12 0c0-2.85 3-6.05 6-10.25z"/>',
  read: '<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.5"/>',
  mixed: `<path d="${SHIELD}"/><path d="M9.5 14.5l5-5"/>`,
  laiton: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3.5"/>',
  heart: '<path d="M12 19.5s-7-4.3-7-9.5a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.2-7 9.5-7 9.5z"/>',
  deck: '<rect x="6" y="4" width="11" height="15" rx="1.5"/><path d="M9 21h10a1.5 1.5 0 0 0 1.5-1.5V8"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 12V7.5M12 12l3 2"/>',
  relic: GEAR,
};

export function glyph(name: keyof typeof GLYPHS, size = 24, color = 'currentColor', fill = 'none'): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" fill="${fill}" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[name]}</svg>`;
}

/** Glyphe en coordonnées locales pour l'insérer dans un SVG existant (centré sur x, y). */
export function glyphAt(name: keyof typeof GLYPHS, x: number, y: number, size: number, color: string): string {
  const k = size / 24;
  return `<g transform="translate(${x - size / 2} ${y - size / 2}) scale(${k})" fill="none" stroke="${color}" stroke-width="${1.75 / Math.max(k, 0.6)}" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[name]}</g>`;
}

const GEAR_TEETH = Array.from({ length: 8 }, (_, i) => `<rect x="21" y="3" width="6" height="8" rx="1" transform="rotate(${i * 45} 24 24)"/>`).join('');

/** Silhouettes des automates, grille 48 × 48, à l'encre. */
export const SPRITES: Record<EnemyId, string> = {
  coucou: '<path d="M8 23L24 9l16 14v17H8z" fill="#1f1a14"/><circle cx="24" cy="27" r="5" fill="#efe4cc"/><path d="M27 27l6-2-6-2z" fill="#b08a3e"/><path d="M20 40v-4h8v4" stroke="#efe4cc" stroke-width="1.5" fill="none"/>',
  metronome: '<path d="M14 42h20l-5-34h-10z" fill="#1f1a14"/><path d="M24 36L31 12" stroke="#b08a3e" stroke-width="2" stroke-linecap="round"/><circle cx="29.5" cy="17" r="2.5" fill="#b08a3e"/>',
  sonnerie: '<path d="M13 34c0-13 4-23 11-23s11 10 11 23z" fill="#1f1a14"/><path d="M9 34h30" stroke="#1f1a14" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="39" r="3" fill="#1f1a14"/><path d="M24 7v4" stroke="#1f1a14" stroke-width="2.5" stroke-linecap="round"/><path d="M20 20c0-3 2-5 4-5" stroke="#b08a3e" stroke-width="1.5" fill="none"/>',
  remonteur: '<circle cx="17" cy="17" r="9" fill="#1f1a14"/><circle cx="17" cy="17" r="3.5" fill="#efe4cc"/><path d="M23 23l15 15M31 31l4-4M35 35l4-4" stroke="#1f1a14" stroke-width="4" stroke-linecap="round"/>',
  miroir: '<ellipse cx="24" cy="22" rx="12" ry="16" fill="#1f1a14"/><ellipse cx="24" cy="22" rx="8" ry="12" fill="#d9c9a3"/><path d="M19 15l4-3M18 21l8-6" stroke="#efe4cc" stroke-width="1.5" stroke-linecap="round"/><path d="M24 38v6M18 44h12" stroke="#1f1a14" stroke-width="2.5" stroke-linecap="round"/>',
  carillon: `<g fill="#1f1a14">${GEAR_TEETH}</g><circle cx="24" cy="24" r="15" fill="#1f1a14"/><circle cx="24" cy="24" r="10" fill="none" stroke="#b08a3e" stroke-width="1.5"/><path d="M24 24V16.5M24 24l5 3" stroke="#b08a3e" stroke-width="2" stroke-linecap="round"/>`,
};

export const sprite = (id: EnemyId, size = 48): string => `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${SPRITES[id]}</svg>`;

export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
