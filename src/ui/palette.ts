/**
 * Paleta de Pokémon Hollín: base gris/sepia con acentos cálidos (horno y farola de gas).
 * Ver "Dirección de arte" en el GDD.
 */
export const PALETTE = {
  night: 0x141416,
  soot: 0x26262b,
  brick: 0x3d3a3a,
  brickLine: 0x2c2a2a,
  cobble: 0x5c5850,
  cobbleLine: 0x4d4943,
  smoke: 0x4a4744,
  smokePuff: 0x7a756d,
  canal: 0x2f3b45,
  canalLine: 0x3d4c58,
  paper: 0xd9d2c3,
  ink: 0x1d1b19,
  quiet: 0x8a847a,
  furnace: 0xe07b39,
  gaslight: 0xe8c46a,
  hpGood: 0x8fae6b,
  hpWarn: 0xe8c46a,
  hpBad: 0xc4573f,
} as const;

export const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;

export const FONT = '"Courier New", Courier, monospace';
