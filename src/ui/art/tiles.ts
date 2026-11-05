/**
 * Tileset original de Ashbury (16x16), pintado por código.
 * Paleta gris/sepia con acentos de horno y farola de gas.
 */
import type { Tile } from '../../core/tilemap';
import { Painter, seeded } from './painter';

export const T = 16;

const C = {
  cobble: '#5c5850',
  cobbleDark: '#4a4640',
  cobbleLight: '#6e695f',
  soot: '#3c3936',
  sootLight: '#4a4643',
  mortar: '#2b2826',
  brickA: '#5e3c33',
  brickB: '#54352d',
  brickC: '#66443a',
  brickLight: '#74503f',
  slate: '#3a3d45',
  slateDark: '#2a2c33',
  slateLight: '#4b4f5a',
  gutter: '#1d1d21',
  window: '#e8c46a',
  windowWarm: '#f2d88a',
  windowDark: '#2f3b45',
  frame: '#2a211b',
  wood: '#5a4030',
  woodDark: '#45301f',
  woodLight: '#6d4f3a',
  water: '#2f3b45',
  waterLight: '#3f5160',
  waterShine: '#5d7282',
  quay: '#6b665d',
  quayDark: '#57534b',
  quayLight: '#7d776c',
  iron: '#1d1b19',
  ironLight: '#3a3633',
  glow: '#e8c46a',
  canvasA: '#7a3b33',
  canvasB: '#c9bfa8',
  green: '#2f4a3a',
  greenDark: '#22362a',
  wallpaper: '#2f3d34',
  wallpaperLine: '#273229',
  floorA: '#5a4030',
  floorB: '#4f3828',
  grate: '#3a3d45',
  grateDark: '#26282e',
  pipe: '#5d5f66',
  pipeDark: '#3d3f45',
  fire: '#e07b39',
  fireHot: '#f2c14e',
  ember: '#a3402a',
  black: '#0d0d0f',
};

type Draw = (p: Painter, frame: number) => void;

/**
 * Modo "objeto": se pinta solo la cosa (farola, caja...) sin su suelo, para ponerla
 * encima de un suelo de tileset. Los dibujantes de suelo no hacen nada mientras está activo.
 */
let bare = false;

function floor(p: Painter) {
  if (!bare) p.rect(0, 0, T, T, C.floorA);
}

function cobble(p: Painter, seed: number, base = C.cobble, dark = C.cobbleDark, light = C.cobbleLight) {
  if (bare) return;
  p.rect(0, 0, T, T, dark);
  const rng = seeded(seed);
  // Adoquines de 5x4 en filas desplazadas.
  for (let row = 0; row < 4; row++) {
    const off = row % 2 === 0 ? 0 : -3;
    for (let col = -1; col < 4; col++) {
      const x = col * 6 + off;
      const y = row * 4;
      const shade = rng() < 0.25 ? light : base;
      p.rect(x + 1, y + 1, 4, 2, shade);
      p.hline(x + 1, y, 3, light);
    }
  }
  // clip a 16x16
  p.ctx.clearRect(p.ox + T, p.oy, 8, T);
}

const draws: Record<Tile, Draw> = {
  cobble: (p) => cobble(p, 7),
  smoke: (p) => {
    cobble(p, 11, C.sootLight, C.soot, '#57534c');
    const rng = seeded(3);
    for (let i = 0; i < 6; i++) p.px(Math.floor(rng() * 16), Math.floor(rng() * 16), '#2a2725');
  },
  brick: (p) => brick(p, 1),
  window: (p, frame) => {
    brick(p, 2);
    p.rect(3, 2, 10, 11, C.frame);
    p.rect(4, 3, 8, 9, frame % 2 === 0 ? C.window : C.windowWarm);
    p.vline(7, 3, 9, C.frame).vline(8, 3, 9, C.frame);
    p.hline(4, 7, 8, C.frame);
    p.rect(2, 13, 12, 2, C.quayLight);
  },
  darkWindow: (p) => {
    brick(p, 3);
    p.rect(3, 2, 10, 11, C.frame);
    p.rect(4, 3, 8, 9, C.windowDark);
    p.vline(7, 3, 9, C.frame).vline(8, 3, 9, C.frame);
    p.hline(4, 7, 8, C.frame);
    p.px(5, 4, C.waterShine);
    p.rect(2, 13, 12, 2, C.quayLight);
  },
  door: (p) => {
    brick(p, 4);
    p.rect(3, 1, 10, 15, C.frame);
    p.rect(4, 2, 8, 14, C.wood);
    for (let x = 5; x < 12; x += 2) p.vline(x, 3, 12, C.woodDark);
    p.px(10, 9, C.glow);
  },
  pubDoor: (p) => {
    brick(p, 5);
    p.rect(3, 1, 10, 15, C.frame);
    p.rect(4, 2, 8, 14, C.green);
    p.rect(5, 3, 6, 4, C.window);
    p.vline(7, 3, 4, C.greenDark).vline(8, 3, 4, C.greenDark);
    p.rect(5, 9, 6, 6, C.greenDark);
    p.px(10, 10, C.glow);
  },
  roof: (p) => roof(p),
  eave: (p) => {
    roof(p);
    p.rect(0, 12, T, 2, C.gutter);
    p.rect(0, 14, T, 2, '#151518');
  },
  chimney: (p) => {
    if (!bare) roof(p);
    p.rect(4, 2, 8, 14, C.brickB);
    for (let y = 4; y < 16; y += 3) p.hline(4, y, 8, C.mortar);
    p.rect(3, 0, 10, 3, C.iron);
    p.rect(5, 0, 6, 1, '#000000');
  },
  water: (p, frame) => {
    p.rect(0, 0, T, T, C.water);
    const rng = seeded(21 + frame);
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(rng() * 12);
      const y = Math.floor(rng() * 15);
      p.hline(x, y, 3 + Math.floor(rng() * 3), C.waterLight);
    }
    p.px((5 + frame * 6) % 16, 4, C.waterShine).px((11 + frame * 3) % 16, 12, C.waterShine);
  },
  quay: (p) => {
    p.rect(0, 0, T, T, C.quayDark);
    p.rect(0, 0, 7, 7, C.quay).rect(8, 0, 8, 7, C.quay).rect(0, 8, 11, 8, C.quay).rect(12, 8, 4, 8, C.quay);
    p.hline(0, 0, 7, C.quayLight).hline(8, 0, 8, C.quayLight).hline(0, 8, 11, C.quayLight).hline(12, 8, 4, C.quayLight);
  },
  bridge: (p) => {
    p.rect(0, 0, T, T, C.water);
    p.rect(0, 0, T, T, C.woodDark);
    for (let y = 0; y < T; y += 4) {
      p.hline(0, y, T, C.woodLight);
      p.rect(0, y + 1, T, 2, C.wood);
    }
    p.vline(0, 0, T, C.iron).vline(15, 0, T, C.iron);
  },
  lamp: (p) => {
    cobble(p, 13);
    p.ellipse(8, 14, 4, 1, '#2a2725');
    p.rect(7, 4, 2, 11, C.iron);
    p.rect(6, 14, 4, 1, C.iron);
    p.rect(5, 0, 6, 1, C.iron);
    p.rect(5, 1, 6, 4, C.glow);
    p.vline(5, 1, 4, C.iron).vline(10, 1, 4, C.iron);
    p.rect(6, 5, 4, 1, C.iron);
  },
  crate: (p) => {
    cobble(p, 17);
    p.rect(2, 2, 12, 12, C.woodDark);
    p.rect(3, 3, 10, 10, C.woodLight);
    for (let i = 0; i < 10; i++) {
      p.px(3 + i, 3 + i, C.woodDark);
      p.px(12 - i, 3 + i, C.woodDark);
    }
    p.hline(2, 14, 12, '#2a2725');
  },
  barrel: (p) => {
    cobble(p, 19);
    p.ellipse(8, 9, 6, 6, C.woodDark);
    p.ellipse(8, 9, 5, 5, C.wood);
    p.hline(3, 5, 10, C.iron).hline(3, 12, 10, C.iron);
    p.ellipse(8, 4, 4, 1, C.woodLight);
  },
  sign: (p) => {
    cobble(p, 23);
    p.rect(7, 9, 2, 6, C.woodDark);
    p.rect(2, 2, 12, 8, C.frame);
    p.rect(3, 3, 10, 6, C.woodLight);
    p.hline(4, 5, 8, C.woodDark).hline(4, 7, 6, C.woodDark);
  },
  awning: (p) => {
    cobble(p, 29);
    for (let x = 0; x < T; x++) p.rect(x, 1, 1, 11, Math.floor(x / 3) % 2 === 0 ? C.canvasA : C.canvasB);
    for (let x = 0; x < T; x += 3) p.rect(x, 12, 2, 1, Math.floor(x / 3) % 2 === 0 ? C.canvasA : C.canvasB);
    p.hline(0, 1, T, '#3b1d19');
  },
  stall: (p) => {
    cobble(p, 31);
    p.rect(0, 3, T, 9, C.woodDark);
    p.rect(0, 3, T, 2, C.woodLight);
    // Género: manzanas, telas, latas
    p.disc(4, 7, 2, '#8a3b2f').disc(8, 7, 2, '#a9a07a').rect(11, 5, 4, 4, '#7a756d');
    p.hline(0, 12, T, '#2a2725');
  },
  woodFloor: (p) => {
    p.rect(0, 0, T, T, C.floorA);
    for (let y = 0; y < T; y += 4) {
      p.hline(0, y, T, C.floorB);
      p.vline((y * 5) % 16, y, 4, C.floorB);
    }
  },
  backWall: (p) => {
    p.rect(0, 0, T, T, C.wallpaper);
    for (let x = 1; x < T; x += 4) p.vline(x, 0, 11, C.wallpaperLine);
    p.rect(0, 11, T, 5, C.wood);
    p.hline(0, 11, T, C.woodLight);
  },
  shelf: (p) => {
    p.rect(0, 0, T, T, C.wallpaper);
    p.rect(0, 4, T, 2, C.woodLight).rect(0, 10, T, 2, C.woodLight);
    const bottles = ['#2f4a3a', '#7a2f2f', '#c9b25a', '#3d5266'];
    for (let i = 0; i < 4; i++) {
      p.rect(1 + i * 4, 0, 2, 4, bottles[i]);
      p.rect(2 + i * 4, 6, 2, 4, bottles[(i + 2) % 4]);
    }
    p.rect(0, 12, T, 4, C.wood);
  },
  counter: (p) => {
    p.rect(0, 0, T, T, C.woodDark);
    p.rect(0, 0, T, 4, C.woodLight);
    p.hline(0, 4, T, C.frame);
    for (let x = 2; x < T; x += 5) p.vline(x, 6, 9, C.frame);
  },
  table: (p) => {
    floor(p);
    p.ellipse(8, 7, 7, 5, C.woodDark);
    p.ellipse(8, 6, 7, 5, C.woodLight);
    p.rect(6, 4, 2, 3, '#c9b25a'); // jarra
    p.rect(7, 12, 2, 4, C.woodDark);
  },
  mat: (p) => {
    floor(p);
    p.rect(1, 2, 14, 12, '#7a2f2f');
    p.rect(2, 3, 12, 10, '#8f3d36');
    p.hline(3, 8, 10, '#7a2f2f');
  },
  grate: (p) => {
    p.rect(0, 0, T, T, C.grateDark);
    for (let y = 0; y < T; y += 4) for (let x = 0; x < T; x += 4) p.rect(x, y, 3, 3, C.grate);
  },
  pipes: (p) => {
    brick(p, 9);
    p.rect(0, 3, T, 3, C.pipe).hline(0, 3, T, '#7a7d85').hline(0, 5, T, C.pipeDark);
    p.rect(3, 6, 3, 10, C.pipe).vline(3, 6, 10, '#7a7d85');
    p.rect(2, 9, 5, 2, C.pipeDark);
  },
  furnace: (p, frame) => {
    brick(p, 10);
    p.rect(2, 4, 12, 12, C.iron);
    p.rect(3, 6, 10, 10, frame % 2 === 0 ? C.fire : C.ember);
    p.rect(5, 9, 6, 7, frame % 2 === 0 ? C.fireHot : C.fire);
    p.rect(2, 3, 12, 2, C.ironLight);
  },
  cage: (p) => {
    if (!bare) {
      p.rect(0, 0, T, T, C.grateDark);
      for (let y = 0; y < T; y += 4) for (let x = 0; x < T; x += 4) p.rect(x, y, 3, 3, C.grate);
    }
    p.rect(1, 1, 14, 14, '#1d1b19');
    p.rect(2, 2, 12, 12, '#2a2725');
    for (let x = 1; x < 15; x += 3) p.vline(x, 1, 14, '#6b665d');
    p.hline(1, 1, 14, '#7d776c').hline(1, 14, 14, '#6b665d');
  },
  dirt: (p) => dirt(p, 41),
  weeds: (p, frame) => {
    dirt(p, 43);
    const rng = seeded(47);
    // Hierba seca y amarillenta que crece entre la escoria.
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(rng() * 15);
      const y = 4 + Math.floor(rng() * 11);
      const h = 2 + Math.floor(rng() * 4);
      const sway = frame === 1 && i % 3 === 0 ? 1 : 0;
      p.vline(x + sway, y - h, h, rng() < 0.5 ? '#7d7a4a' : '#8f8a52');
      p.px(x + sway, y - h, '#a9a265');
    }
    p.hline(0, 15, T, '#3a352c');
  },
  slag: (p) => {
    dirt(p, 53);
    p.ellipse(8, 10, 7, 5, '#25221f');
    p.ellipse(8, 9, 6, 5, '#2f2b27');
    p.ellipse(6, 7, 3, 2, '#3e3832');
    p.px(10, 8, '#e07b39').px(4, 11, '#a3402a');
  },
  fence: (p) => {
    dirt(p, 59);
    p.hline(0, 4, T, C.ironLight).hline(0, 10, T, C.ironLight);
    for (let x = 1; x < T; x += 4) {
      p.vline(x, 1, 13, C.iron);
      p.px(x, 0, C.ironLight);
    }
  },
  rails: (p) => {
    dirt(p, 61);
    for (let x = 1; x < T; x += 5) p.rect(x, 3, 3, 10, '#4a3626');
    p.hline(0, 5, T, '#7a7d85').hline(0, 11, T, '#7a7d85');
    p.hline(0, 6, T, '#3d3f45').hline(0, 12, T, '#3d3f45');
  },
  gangDoor: (p) => {
    brick(p, 6);
    p.rect(1, 1, 14, 15, C.frame);
    p.rect(2, 2, 12, 14, '#4a4744');
    for (let y = 3; y < 16; y += 3) p.hline(2, y, 12, '#3a3836');
    p.rect(2, 8, 12, 1, '#2a2826');
    // Marca de la banda: un pájaro pintado con tiza.
    p.px(7, 5, '#d9d2c3').px(8, 5, '#d9d2c3').px(6, 6, '#d9d2c3').px(9, 6, '#d9d2c3');
  },
  void: (p) => p.rect(0, 0, T, T, C.black),
};

function dirt(p: Painter, seed: number) {
  if (bare) return;
  p.rect(0, 0, T, T, '#4a443a');
  const rng = seeded(seed);
  for (let i = 0; i < 18; i++) p.px(Math.floor(rng() * 16), Math.floor(rng() * 16), rng() < 0.5 ? '#3e392f' : '#57503f');
  for (let i = 0; i < 3; i++) p.rect(Math.floor(rng() * 14), Math.floor(rng() * 14), 2, 1, '#2f2b25');
}

function brick(p: Painter, seed: number) {
  p.rect(0, 0, T, T, C.mortar);
  const rng = seeded(seed * 97);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 === 0 ? 0 : -4;
    for (let col = -1; col < 3; col++) {
      const x = col * 8 + off;
      const y = row * 4;
      const r = rng();
      const color = r < 0.33 ? C.brickA : r < 0.66 ? C.brickB : C.brickC;
      p.rect(x + 1, y + 1, 7, 3, color);
      p.hline(x + 1, y + 1, 6, C.brickLight);
    }
  }
  p.ctx.clearRect(p.ox + T, p.oy, 8, T);
  // Hollín: manchas oscuras
  for (let i = 0; i < 4; i++) p.px(Math.floor(rng() * 16), Math.floor(rng() * 16), '#2f2522');
}

function roof(p: Painter) {
  p.rect(0, 0, T, T, C.slateDark);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 === 0 ? 0 : 2;
    for (let x = -off; x < T; x += 4) {
      p.rect(x, row * 4, 3, 3, C.slate);
      p.px(x, row * 4, C.slateLight);
    }
  }
}

/** Número de fotogramas de animación por tipo de casilla. */
export const TILE_FRAMES: Partial<Record<Tile, number>> = { water: 2, furnace: 2, window: 2, weeds: 2 };

export function drawTile(p: Painter, tile: Tile, frame = 0): void {
  draws[tile](p, frame);
}

/** Solo el objeto, sin suelo (ver `bare`). */
export function drawProp(p: Painter, tile: Tile, frame = 0): void {
  bare = true;
  try {
    draws[tile](p, frame);
  } finally {
    bare = false;
  }
}

export const ALL_TILES = Object.keys(draws) as Tile[];
