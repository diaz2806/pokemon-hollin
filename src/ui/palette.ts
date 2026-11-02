/**
 * Paleta de Pokémon Hollín: base gris/sepia con acentos cálidos (horno y farola de gas).
 * Ver "Dirección de arte" en el GDD.
 */
export const PALETTE = {
  night: 0x141416,
  soot: 0x26262b,
  brick: 0x3d3a3a,
  smokePuff: 0x7a756d,
  paper: 0xe8e2d4,
  ink: 0x2a2622,
  quiet: 0x8a847a,
  furnace: 0xe07b39,
  gaslight: 0xe8c46a,
  hpGood: 0x7fae5b,
  hpWarn: 0xe8c46a,
  hpBad: 0xc4573f,
  exp: 0x5b8fbf,
} as const;

/** Colores de la interfaz (marcos de latón, papel, tinta). */
export const UI = {
  ink: '#2a2622',
  quiet: '#7a7066',
  accent: '#b4532a',
  paper: '#e8e2d4',
  light: '#e8e2d4',
  paperN: 0xe8e2d4,
  frameN: 0x9a7b45,
  frameDarkN: 0x2a211b,
} as const;

export const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;

/** Fuente pixel (Press Start 2P, licencia OFL) a su tamaño nativo. */
export const FONT_PX = 8;
export const FONT = '"Press Start 2P"';

/** Resolución interna: la de la pantalla superior de Nintendo DS. */
export const GAME_W = 256;
export const GAME_H = 192;
