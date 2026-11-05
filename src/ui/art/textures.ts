/**
 * Genera todas las texturas del juego por código al arrancar: tiles, personajes,
 * placeholders de Pokémon, efectos y fondos de combate.
 */
import * as Phaser from 'phaser';
import { ALL_TILES, drawProp, drawTile, T, TILE_FRAMES } from './tiles';
import { CHARACTER_FRAMES, CHARACTER_PALETTES, WALK_FRAMES, type Facing } from './characters';
import { Painter, mix, seeded } from './painter';

export const CHAR_W = 16;
export const CHAR_H = 22;
export const FACINGS: Facing[] = ['down', 'left', 'right', 'up'];

/** Color por tipo, para los placeholders de Pokémon (cuando no hay sprite oficial). */
export const TYPE_COLORS: Record<string, string> = {
  Normal: '#a8a290',
  Fire: '#e07b39',
  Water: '#4f7fa8',
  Grass: '#6f9a4a',
  Electric: '#e8c46a',
  Ice: '#9cc7cf',
  Fighting: '#a3402a',
  Poison: '#8a5a8f',
  Ground: '#b3925a',
  Flying: '#8f9bc4',
  Psychic: '#c45a7a',
  Bug: '#8f9a3a',
  Rock: '#9a8a5a',
  Ghost: '#5a4f7a',
  Dragon: '#5a4fb3',
  Dark: '#4a3f38',
  Steel: '#8a8f9a',
  Fairy: '#d49ab0',
};

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (p: Painter) => void): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h)!;
  draw(new Painter(tex.getContext()));
  tex.refresh();
}

export function tileKey(tile: string, frame = 0): string {
  return `tile-${tile}-${frame}`;
}

/** El mismo dibujo sin suelo, para ponerlo encima de una casilla de tileset. */
export function propKey(tile: string, frame = 0): string {
  return `prop-${tile}-${frame}`;
}

/** Spritesheet de personaje: columnas = fotogramas (stand, stepA, stepB), filas = FACINGS. */
export function characterKey(palette: string): string {
  return `char-${palette}`;
}

function generateCharacters(scene: Phaser.Scene): void {
  for (const [name, palette] of Object.entries(CHARACTER_PALETTES)) {
    const key = characterKey(name);
    const sheetKey = `${key}-sheet`;
    canvasTexture(scene, sheetKey, CHAR_W * 3, CHAR_H * 4, (p) => {
      FACINGS.forEach((facing, row) => {
        WALK_FRAMES.forEach((f, col) => {
          const src = facing === 'right' ? CHARACTER_FRAMES.left[f] : CHARACTER_FRAMES[facing][f];
          p.grid(src, palette as unknown as Record<string, string>, col * CHAR_W, row * CHAR_H, facing === 'right');
        });
      });
    });
    const sheet = scene.textures.get(sheetKey);
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addSpriteSheet(key, sheet.getSourceImage() as unknown as HTMLImageElement, { frameWidth: CHAR_W, frameHeight: CHAR_H });
  }
}

/**
 * Criatura genérica (placeholder) para el seguidor y los combates:
 * una bola con orejas del color del tipo. NO es ningún Pokémon concreto.
 */
export function paintCreature(p: Painter, cx: number, cy: number, r: number, color: string, facing: Facing | 'back', blink = false): void {
  const dark = mix(color, '#000000', 0.45);
  const light = mix(color, '#ffffff', 0.3);
  const s = r / 6;
  // sombra
  p.ellipse(cx, cy + r, Math.round(r * 0.9), Math.max(1, Math.round(r / 4)), 'rgba(0,0,0,0.35)');
  // orejas
  const earDx = Math.round(r * 0.55);
  const earH = Math.round(r * 0.6);
  for (const dx of [-earDx, earDx]) {
    for (let i = 0; i < earH; i++) {
      const w = Math.max(1, Math.round((earH - i) * 0.5 * (s / 1.2)));
      p.rect(cx + dx - Math.floor(w / 2), cy - r - i + Math.round(r * 0.3), w, 1, i === earH - 1 ? dark : color);
    }
  }
  p.disc(cx, cy, r, dark);
  p.disc(cx, cy, r - Math.max(1, Math.round(s)), color);
  p.disc(cx - Math.round(r / 3), cy - Math.round(r / 3), Math.max(1, Math.round(r / 4)), light);
  if (facing === 'up' || facing === 'back') return;
  const eye = (x: number) => {
    if (blink) p.rect(x - Math.round(s), cy - Math.round(r / 6), Math.max(1, Math.round(2 * s)), 1, '#1a1a1c');
    else p.rect(x, cy - Math.round(r / 5), Math.max(1, Math.round(s)), Math.max(2, Math.round(1.6 * s)), '#1a1a1c');
  };
  const ex = Math.round(r * 0.4);
  if (facing === 'down') {
    eye(cx - ex);
    eye(cx + ex - Math.max(1, Math.round(s)) + 1);
  } else if (facing === 'left') eye(cx - ex - Math.round(s));
  else eye(cx + ex);
}

/** Spritesheet 4x2 (dirección x 2 fotogramas) de 16x16 para el seguidor placeholder. */
export function followerPlaceholderKey(type: string): string {
  return `follower-${type}`;
}

function generateFollowers(scene: Phaser.Scene): void {
  for (const [type, color] of Object.entries(TYPE_COLORS)) {
    const key = followerPlaceholderKey(type);
    const sheetKey = `${key}-sheet`;
    canvasTexture(scene, sheetKey, 16 * 2, 16 * 4, (p) => {
      FACINGS.forEach((facing, row) => {
        for (let f = 0; f < 2; f++) paintCreature(p, 8, row * 16 + 9 - f, 5, color, facing);
      });
    });
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addSpriteSheet(key, scene.textures.get(sheetKey).getSourceImage() as unknown as HTMLImageElement, {
      frameWidth: 16,
      frameHeight: 16,
    });
  }
}

export function battlerPlaceholderKey(type: string, back: boolean): string {
  return `battler-${back ? 'back' : 'front'}-${type}`;
}

function generateBattlers(scene: Phaser.Scene): void {
  for (const [type, color] of Object.entries(TYPE_COLORS)) {
    canvasTexture(scene, battlerPlaceholderKey(type, false), 64, 64, (p) => paintCreature(p, 32, 36, 18, color, 'down'));
    canvasTexture(scene, battlerPlaceholderKey(type, true), 64, 64, (p) => paintCreature(p, 32, 38, 22, color, 'back'));
  }
}

function generateEffects(scene: Phaser.Scene): void {
  canvasTexture(scene, 'puff', 8, 8, (p) => {
    p.disc(4, 4, 3, 'rgba(160,154,144,0.55)');
    p.disc(3, 3, 1, 'rgba(200,194,184,0.6)');
  });
  canvasTexture(scene, 'ember', 2, 2, (p) => p.rect(0, 0, 2, 2, '#f2c14e'));
  if (scene.textures.exists('glow')) scene.textures.remove('glow');
  const glow = scene.textures.createCanvas('glow', 64, 64)!;
  const ctx = glow.getContext();
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(232,196,106,0.55)');
  grad.addColorStop(0.4, 'rgba(232,170,90,0.22)');
  grad.addColorStop(1, 'rgba(232,150,80,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  glow.refresh();

  // Poké Ball de época: latón y hierro remachados.
  canvasTexture(scene, 'ball', 12, 12, (p) => {
    p.disc(6, 6, 5, '#1a1a1c');
    p.disc(6, 6, 4, '#b08a4a');
    p.rect(2, 7, 9, 3, '#5d5f66');
    p.rect(3, 9, 7, 1, '#3d3f45');
    p.hline(1, 6, 10, '#1a1a1c');
    p.disc(6, 6, 2, '#1a1a1c');
    p.px(6, 6, '#d9d2c3');
    p.px(3, 3, '#e8c46a').px(9, 4, '#7a5a2a').px(3, 8, '#1a1a1c').px(9, 8, '#1a1a1c');
  });
  canvasTexture(scene, 'star', 5, 5, (p) => {
    p.px(2, 0, '#e8c46a').rect(0, 2, 5, 1, '#e8c46a').rect(1, 1, 3, 3, '#e8c46a').px(2, 4, '#e8c46a');
  });
}

/** Fondo de combate: callejón con fábricas al fondo bajo el smog. */
function generateBattleBackground(scene: Phaser.Scene): void {
  canvasTexture(scene, 'bg-alley', 256, 144, (p) => {
    const bands = ['#5d5952', '#57534c', '#514d47', '#4b4742', '#45423d', '#3f3c38'];
    bands.forEach((c, i) => p.rect(0, i * 10, 256, 10, c));
    const rng = seeded(42);
    // Fábricas y chimeneas
    let x = 0;
    while (x < 256) {
      const w = 20 + Math.floor(rng() * 30);
      const h = 18 + Math.floor(rng() * 22);
      p.rect(x, 62 - h, w, h, '#2e2b28');
      if (rng() < 0.6) {
        const cx = x + 4 + Math.floor(rng() * (w - 8));
        const ch = 14 + Math.floor(rng() * 18);
        p.rect(cx, 62 - h - ch, 4, ch, '#2a2724');
      }
      for (let i = 0; i < 3; i++) if (rng() < 0.5) p.rect(x + 3 + Math.floor(rng() * (w - 6)), 62 - h + 4 + Math.floor(rng() * (h - 8)), 2, 2, '#c9a24f');
      x += w + 2;
    }
    // Suelo de adoquines
    p.rect(0, 62, 256, 82, '#3f3c38');
    for (let y = 64; y < 144; y += 5) {
      for (let xx = (y / 5) % 2 === 0 ? 0 : -4; xx < 256; xx += 8) p.rect(xx + 1, y, 6, 3, '#47433e');
    }
    // Plataformas
    p.ellipse(190, 84, 52, 11, '#2c2a27');
    p.ellipse(190, 83, 50, 9, '#524e47');
    p.ellipse(70, 136, 64, 12, '#2c2a27');
    p.ellipse(70, 135, 62, 10, '#524e47');
  });
}

function generateTiles(scene: Phaser.Scene): void {
  for (const tile of ALL_TILES) {
    const frames = TILE_FRAMES[tile] ?? 1;
    for (let f = 0; f < frames; f++) {
      canvasTexture(scene, tileKey(tile, f), T, T, (p) => drawTile(p, tile, f));
      canvasTexture(scene, propKey(tile, f), T, T, (p) => drawProp(p, tile, f));
    }
  }
}

export function generateAllTextures(scene: Phaser.Scene): void {
  generateTiles(scene);
  generateCharacters(scene);
  generateFollowers(scene);
  generateBattlers(scene);
  generateEffects(scene);
  generateBattleBackground(scene);
}
