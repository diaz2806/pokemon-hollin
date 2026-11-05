/**
 * Efectos visuales del combate:
 * - Animaciones de ataque con las hojas de Essentials (assets/animations), una por tipo
 *   y categoría, más algunas propias (Hollinazo, Emboscada).
 * - Salida con Poké Ball: lanzamiento en arco, apertura y destello.
 * - La capa de humo y su medidor (la densidad de humo del mod de Showdown).
 *
 * Todo es opcional: si faltan los gráficos, cada función hace una versión sencilla
 * (destellos y sacudidas) para que el combate nunca se rompa.
 */
import * as Phaser from 'phaser';
import { ensureRes, resKey, resReady } from './resources';
import { textStyle } from './TextBox';

/** Celdas de 96 px (las hojas de Essentials a mitad de tamaño). */
const CELL = 96;

/** Fotogramas con dibujo de cada hoja que usamos (contados al convertir). */
const SHEET_FRAMES: Record<string, number> = {
  '003_attack01': 10,
  light1: 15,
  fire4: 12,
  fire5: 14,
  water3: 12,
  '018_water01': 14,
  thunder2: 6,
  '017_thunder01': 6,
  grass2: 13,
  wind1: 14,
  ice1: 9,
  icewater: 15,
  punches: 16,
  efftest4: 15,
  poison2: 15,
  poison: 13,
  earth1: 7,
  aerial_ace: 7,
  psycho_cut: 13,
  '028_state01': 9,
  scratch_shadow_claw: 10,
  state1: 14,
  rock_tomb: 8,
  ancient_powerfilesheet: 14,
  ghost1: 14,
  ghost2: 14,
  dragon_claw: 14,
  cosmo_01: 15,
  crunch: 17,
  '022_darkness01': 14,
  iron_head: 9,
  divine_smash: 15,
  zan03: 4,
  estranho: 15,
  special5: 14,
  heal5: 13,
  leer: 8,
};

/** [físico, especial/estado] por tipo. */
const TYPE_SHEETS: Record<string, [string, string]> = {
  Normal: ['003_attack01', 'light1'],
  Fire: ['fire4', 'fire5'],
  Water: ['water3', '018_water01'],
  Electric: ['thunder2', '017_thunder01'],
  Grass: ['grass2', 'wind1'],
  Ice: ['ice1', 'icewater'],
  Fighting: ['punches', 'efftest4'],
  Poison: ['poison2', 'poison'],
  Ground: ['earth1', 'earth1'],
  Flying: ['aerial_ace', 'wind1'],
  Psychic: ['psycho_cut', '028_state01'],
  Bug: ['scratch_shadow_claw', 'state1'],
  Rock: ['rock_tomb', 'ancient_powerfilesheet'],
  Ghost: ['ghost1', 'ghost2'],
  Dragon: ['dragon_claw', 'cosmo_01'],
  Dark: ['crunch', '022_darkness01'],
  Steel: ['iron_head', 'divine_smash'],
  Fairy: ['zan03', 'estranho'],
};

export interface MoveLike {
  id: string;
  type: string;
  category: string;
  target: string;
}

export interface MoveAnimation {
  sheet: string;
  /** La animación se pinta sobre quien usa el movimiento (mejoras, curas). */
  onUser: boolean;
  tint?: number;
}

/** Qué animación toca para un movimiento. Lógica pura (se puede probar sin Phaser). */
export function animationFor(move: MoveLike): MoveAnimation | undefined {
  if (move.id === 'hollinazo') return { sheet: 'special5', onUser: false, tint: 0x3c3a38 };
  if (move.id === 'emboscada') return { sheet: 'crunch', onUser: false, tint: 0x8a5cc0 };
  const selfTarget = ['self', 'allySide', 'allies', 'adjacentAllyOrSelf'].includes(move.target);
  if (move.category === 'Status' && selfTarget) return { sheet: 'heal5', onUser: true };
  if (move.category === 'Status' && move.target === 'all') return undefined;
  const pair = TYPE_SHEETS[move.type];
  if (!pair) return undefined;
  if (move.category === 'Status') return { sheet: move.type === 'Normal' ? 'leer' : pair[1], onUser: false };
  return { sheet: move.category === 'Physical' ? pair[0] : pair[1], onUser: false };
}

/** Reproduce una hoja de animación centrada en (x, y). Resuelve al terminar. */
export async function playSheet(
  scene: Phaser.Scene,
  anim: MoveAnimation,
  x: number,
  y: number,
  scale = 1,
): Promise<boolean> {
  const frames = SHEET_FRAMES[anim.sheet];
  if (!frames) return false;
  await ensureRes(scene, [{ cat: 'animations', name: anim.sheet, frame: [CELL, CELL] }]);
  if (!resReady(scene, 'animations', anim.sheet)) return false;
  const key = resKey('animations', anim.sheet);
  const animKey = `${key}#play`;
  if (!scene.anims.exists(animKey)) {
    scene.anims.create({
      key: animKey,
      frames: scene.anims.generateFrameNumbers(key, { start: 0, end: frames - 1 }),
      frameRate: 20,
    });
  }
  const sprite = scene.add.sprite(x, y, key, 0).setScale(scale).setDepth(700);
  if (anim.tint !== undefined) sprite.setTint(anim.tint);
  return new Promise((resolve) => {
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      sprite.destroy();
      resolve(true);
    });
    sprite.play(animKey);
  });
}

// ---------- Poké Ball ----------

function tweenP(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => scene.tweens.add({ ...config, onComplete: () => resolve() }));
}

export function hasBallGraphics(scene: Phaser.Scene): boolean {
  return resReady(scene, 'ui/battle', 'ball_pokeball') && resReady(scene, 'ui/battle', 'ball_pokeball_open');
}

/**
 * Lanza la Poké Ball en arco desde `from`, la abre en `to` y saca al Pokémon con un
 * destello blanco que se desvanece (como en los juegos de DS).
 */
export async function ballSendOut(
  scene: Phaser.Scene,
  from: { x: number; y: number },
  to: { x: number; y: number },
  pokemon: Phaser.GameObjects.Image,
): Promise<void> {
  const finalX = pokemon.x;
  const finalY = pokemon.y;
  pokemon.setVisible(false);
  if (hasBallGraphics(scene)) {
    const ball = scene.add.sprite(from.x, from.y, resKey('ui/battle', 'ball_pokeball'), 0).setDepth(650);
    const arc = { t: 0 };
    let frame = 0;
    await tweenP(scene, {
      targets: arc,
      t: 1,
      duration: 450,
      onUpdate: () => {
        ball.x = Phaser.Math.Linear(from.x, to.x, arc.t);
        ball.y = Phaser.Math.Linear(from.y, to.y, arc.t) - Math.sin(arc.t * Math.PI) * 40;
        frame = (frame + 1) % 8;
        ball.setFrame(frame);
      },
    });
    ball.setTexture(resKey('ui/battle', 'ball_pokeball_open'));
    if (resReady(scene, 'ui/battle', 'ballburst_particle')) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const p = scene.add
          .image(to.x, to.y, resKey('ui/battle', 'ballburst_particle'))
          .setScale(0.35)
          .setDepth(660)
          .setBlendMode(Phaser.BlendModes.ADD);
        scene.tweens.add({
          targets: p,
          x: to.x + Math.cos(a) * 26,
          y: to.y + Math.sin(a) * 18,
          alpha: 0,
          scale: 0.1,
          duration: 380,
          onComplete: () => p.destroy(),
        });
      }
    }
    scene.time.delayedCall(250, () => ball.destroy());
  }
  // El Pokémon crece desde la ball como una silueta blanca que se desvanece.
  const glow = scene.add
    .image(finalX, finalY, pokemon.texture.key, pokemon.frame.name)
    .setOrigin(pokemon.originX, pokemon.originY)
    .setDepth(pokemon.depth + 1)
    .setTint(0xffffff)
    .setTintMode(Phaser.TintModes.FILL)
    .setScale(0.1);
  pokemon.setPosition(finalX, finalY).setVisible(true).setScale(0.1);
  await tweenP(scene, { targets: [pokemon, glow], scale: 1, duration: 260, ease: 'Back.Out' });
  await tweenP(scene, { targets: glow, alpha: 0, duration: 260 });
  glow.destroy();
}

// ---------- Humo ----------

/** Opacidad de la niebla para cada nivel de humo. */
const FOG_ALPHA = [0, 0.3, 0.5, 0.72];
const LEVEL_NAMES = ['LIMPIO', 'NEBLINA', 'DENSO', 'HOLLÍN'];
/** Color de los bloques llenos: gris claro, gris y, a tope, brasa. */
const PIP_COLORS = [0xd9d2c3, 0xd9d2c3, 0xa9a29a, 0xe07b39];

/**
 * Niebla de humo sobre el campo de batalla (dos capas que se mueven a distinta
 * velocidad) y un medidor de densidad arriba a la derecha.
 */
export class SmokeLayer {
  private readonly layers: Phaser.GameObjects.TileSprite[] = [];
  private readonly pips: Phaser.GameObjects.Rectangle[] = [];
  private readonly label: Phaser.GameObjects.Text;
  private readonly gauge: Phaser.GameObjects.Container;
  level = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    width: number,
    height: number,
  ) {
    const keys = ['fog_tile', 'fog_tile_2'].filter((k) => resReady(scene, 'fogs', k)).map((k) => resKey('fogs', k));
    if (keys.length === 0) keys.push(this.fallbackTexture());
    keys.forEach((key, i) => {
      const layer = scene.add
        .tileSprite(0, 0, width, height, key)
        .setOrigin(0)
        .setDepth(300 + i)
        .setAlpha(0)
        .setTint(i === 0 ? 0x9a948c : 0x5a5650);
      layer.setTileScale(i === 0 ? 1 : 1.5);
      this.layers.push(layer);
    });

    // Medidor: chimenea + tres bloques de humo.
    const bg = scene.add.rectangle(0, 0, 66, 12, 0x1a1816, 0.75).setOrigin(0).setStrokeStyle(1, 0x5c5850);
    const icon = scene.add.text(3, 2, 'HUMO', textStyle('#d9d2c3')).setScale(0.75);
    const parts: Phaser.GameObjects.GameObject[] = [bg, icon];
    for (let i = 0; i < 3; i++) {
      const pip = scene.add.rectangle(36 + i * 9, 3, 7, 6, 0x3a3633).setOrigin(0).setStrokeStyle(1, 0x0e0d0c);
      this.pips.push(pip);
      parts.push(pip);
    }
    this.label = scene.add.text(66, 13, '', textStyle('#d9d2c3')).setOrigin(1, 0).setScale(0.75).setShadow(1, 1, '#000000', 0, false, true);
    parts.push(this.label);
    this.gauge = scene.add.container(width - 70, 3, parts).setDepth(950);
  }

  /** Textura de reserva: manchas grises difuminadas generadas por código. */
  private fallbackTexture(): string {
    const key = 'smoke-fallback';
    if (this.scene.textures.exists(key)) return key;
    const tex = this.scene.textures.createCanvas(key, 64, 64)!;
    const ctx = tex.getContext();
    for (let i = 0; i < 9; i++) {
      const x = (i * 23) % 64;
      const y = (i * 37) % 64;
      const g = ctx.createRadialGradient(x, y, 2, x, y, 18);
      g.addColorStop(0, 'rgba(200,200,200,0.55)');
      g.addColorStop(1, 'rgba(200,200,200,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    }
    tex.refresh();
    return key;
  }

  setLevel(level: number, animate = true): void {
    this.level = level;
    this.layers.forEach((layer, i) => {
      const alpha = FOG_ALPHA[level] * (i === 0 ? 1 : 0.8);
      if (animate) this.scene.tweens.add({ targets: layer, alpha, duration: 700 });
      else layer.setAlpha(alpha);
    });
    this.pips.forEach((pip, i) => pip.setFillStyle(i < level ? PIP_COLORS[level] : 0x2a2724).setStrokeStyle(1, i < level ? 0x0e0d0c : 0x5c5850));
    this.label.setText(LEVEL_NAMES[level]);
    if (animate && level > 0) {
      this.scene.tweens.add({ targets: this.gauge, scale: 1.12, duration: 120, yoyo: true });
    }
  }

  update(delta: number): void {
    this.layers.forEach((layer, i) => {
      layer.tilePositionX += delta * (i === 0 ? 0.012 : -0.02);
      layer.tilePositionY += delta * (i === 0 ? 0.004 : 0.006);
    });
  }

  setVisible(v: boolean): void {
    this.gauge.setVisible(v);
  }
}
