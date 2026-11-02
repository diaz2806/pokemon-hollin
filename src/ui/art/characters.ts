/**
 * Pixel art original de los personajes (16x22 por fotograma), definido como texto.
 * Cada carácter es un color de la paleta del personaje; '.' es transparente.
 *
 * Arte propio del proyecto (no son sprites de Pokémon), así que sí va en el repo.
 */

export type Grid = string[];

export interface CharacterPalette {
  k: string; // contorno
  s: string; // piel
  S: string; // piel en sombra
  e: string; // ojos
  h: string; // pelo
  c: string; // gorra
  C: string; // visera / sombra de gorra
  j: string; // chaqueta
  J: string; // chaqueta en sombra
  w: string; // camisa
  r: string; // bufanda
  p: string; // pantalón
  P: string; // pantalón en sombra
  b: string; // botas
}

const HEAD_DOWN: Grid = [
  '................',
  '.....kkkkkk.....',
  '....kcccccck....',
  '...kcccccccck...',
  '..kCCCCCCCCCCk..',
  '...khsssssshk...',
  '...kssessessk...',
  '....kSssssSk....',
];

const HEAD_UP: Grid = [
  '................',
  '.....kkkkkk.....',
  '....kcccccck....',
  '...kcccccccck...',
  '..kCCCCCCCCCCk..',
  '...khhhhhhhhk...',
  '...khhhhhhhhk...',
  '....khhhhhhk....',
];

const HEAD_LEFT: Grid = [
  '................',
  '.....kkkkkk.....',
  '....kcccccck....',
  '...kcccccccck...',
  '.kCCCCCCCCCk....',
  '...ksssshhhk....',
  '...kesssshhk....',
  '....kSssshhk....',
];

const BODY_DOWN: Grid = [
  '....krrrrrrk....',
  '...kjjrwwrjjk...',
  '..kjjjwwwwjjjk..',
  '..kjjjjwwjjjjk..',
  '..kJjjjwwjjjJk..',
  '..ksJjjjjjjJsk..',
  '...kJJJJJJJJk...',
  '....kppPPppk....',
];

const BODY_UP: Grid = [
  '....krrrrrrk....',
  '...kjjjjjjjjk...',
  '..kjjjjjjjjjjk..',
  '..kjjjjjjjjjjk..',
  '..kJjjjjjjjjJk..',
  '..ksJjjjjjjJsk..',
  '...kJJJJJJJJk...',
  '....kppPPppk....',
];

const BODY_LEFT: Grid = [
  '....krrrrrk.....',
  '....kjjwjjjk....',
  '....kjjwjjjjk...',
  '....kjjjjjjjk...',
  '....kjjJjjjjk...',
  '....kjsJjjjjk...',
  '....kJJJJJJJk...',
  '....kppPPppk....',
];

const LEGS_FRONT = {
  stand: ['....kppkkppk....', '....kbbkkbbk....', '...kbbbkkbbbk...'],
  stepA: ['....kppkkppk....', '...kbbbkkbbk....', '...kbbbk.kkk....'],
  stepB: ['....kppkkppk....', '....kbbkkbbbk...', '....kkk.kbbbk...'],
};

const LEGS_SIDE = {
  stand: ['....kppppppk....', '....kbbbbbbk....', '...kbbbbbbbk....'],
  stepA: ['...kppk.kppk....', '..kbbk...kbbk...', '..kkk.....kkk...'],
  stepB: ['....kpppppk.....', '....kbbbbbk.....', '...kbbbbbbk.....'],
};

const pad = (rows: Grid): Grid => [...rows, '................', '................', '................'].slice(0, 22);

function frame(head: Grid, body: Grid, legs: string[]): Grid {
  return pad([...head, ...body, ...legs]);
}

export type Facing = 'down' | 'up' | 'left' | 'right';
export const WALK_FRAMES = ['stand', 'stepA', 'stepB'] as const;
export type WalkFrame = (typeof WALK_FRAMES)[number];

/** Fotogramas de andar por dirección. 'right' se obtiene volteando 'left'. */
export const CHARACTER_FRAMES: Record<Exclude<Facing, 'right'>, Record<WalkFrame, Grid>> = {
  down: {
    stand: frame(HEAD_DOWN, BODY_DOWN, LEGS_FRONT.stand),
    stepA: frame(HEAD_DOWN, BODY_DOWN, LEGS_FRONT.stepA),
    stepB: frame(HEAD_DOWN, BODY_DOWN, LEGS_FRONT.stepB),
  },
  up: {
    stand: frame(HEAD_UP, BODY_UP, LEGS_FRONT.stand),
    stepA: frame(HEAD_UP, BODY_UP, LEGS_FRONT.stepA),
    stepB: frame(HEAD_UP, BODY_UP, LEGS_FRONT.stepB),
  },
  left: {
    stand: frame(HEAD_LEFT, BODY_LEFT, LEGS_SIDE.stand),
    stepA: frame(HEAD_LEFT, BODY_LEFT, LEGS_SIDE.stepA),
    stepB: frame(HEAD_LEFT, BODY_LEFT, LEGS_SIDE.stepB),
  },
};

const base: CharacterPalette = {
  k: '#1a1a1c',
  s: '#e0b48c',
  S: '#b8865e',
  e: '#1a1a1c',
  h: '#3b2a20',
  c: '#4a4f5c',
  C: '#353843',
  j: '#5e4b3c',
  J: '#463729',
  w: '#d9d2c3',
  r: '#c8642c',
  p: '#2f3340',
  P: '#22252f',
  b: '#1f1a17',
};

/** Paletas de personajes: mismo dibujo, distinta ropa. */
export const CHARACTER_PALETTES: Record<string, CharacterPalette> = {
  hero: base,
  worker: { ...base, c: '#6b5a3e', C: '#4f422d', j: '#3d5266', J: '#2c3c4b', r: '#8a847a' },
  bartender: { ...base, c: '#2a2a2e', C: '#1d1d20', j: '#d9d2c3', J: '#b5ad9d', w: '#7a2f2f', r: '#7a2f2f', h: '#7a5a3a' },
  urchin: { ...base, c: '#7a756d', C: '#5c5850', j: '#6d4f3a', J: '#523a2a', r: '#3d5266', p: '#4a4744' },
  lady: { ...base, c: '#5a2f3f', C: '#42222e', j: '#5a2f3f', J: '#42222e', w: '#e8c46a', r: '#e8c46a', p: '#42222e', P: '#331a24' },
  copper: { ...base, c: '#1e2433', C: '#151a26', j: '#1e2433', J: '#151a26', r: '#c9b25a', w: '#c9b25a', p: '#1e2433' },
};
