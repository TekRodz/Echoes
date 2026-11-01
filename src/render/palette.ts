export const C = {
  parchment: '#efe4cc',
  ink: '#1f1a14',
  paleInk: '#6b7c8c',
  cloneBody: '#d5cfbf',
  sanguine: '#9a2e1c',
  brass: '#b08a3e',
  brassDark: '#8a6a2f',
  aged: '#d9c9a3',
  agedLight: '#e6d8b8',
  text2: '#5a4a36',
} as const;

export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
export const roman = (i: number): string => ROMAN[i] ?? String(i + 1);
