/**
 * Efectos visuales del combate:
 * - Animaciones de ataque con las hojas de Essentials (assets/animations), una por tipo
 *   y categoría, más algunas propias (Hollinazo, Emboscada).
 * - Salida con Poké Ball: lanzamiento en arco, apertura y destello.
 *
 * Todo es opcional: si faltan los gráficos, cada función hace una versión sencilla
 * (destellos y sacudidas) para que el combate nunca se rompa.
 */
import * as Phaser from 'phaser';
import { ensureRes, resKey, resReady } from './resources';

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

// ---------- Ambiente del combate ----------

/** Textura de un punto de 1x1 o 2x2 (motas, copos de hollín). */
function dotTexture(scene: Phaser.Scene, key: string, size: number, color: string): string {
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, size, size)!;
  const ctx = tex.getContext();
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
  return key;
}

/** Halo radial suave para haces de luz y farolas. */
function haloTexture(scene: Phaser.Scene): string {
  const key = 'battle-halo';
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, 128, 128)!;
  const ctx = tex.getContext();
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,230,170,0.55)');
  g.addColorStop(0.5, 'rgba(255,200,120,0.18)');
  g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  tex.refresh();
  return key;
}

/** Haz de luz inclinado (de una ventana o claraboya). */
function beamTexture(scene: Phaser.Scene): string {
  const key = 'battle-beam';
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, 90, 150)!;
  const ctx = tex.getContext();
  const g = ctx.createLinearGradient(0, 0, 0, 150);
  g.addColorStop(0, 'rgba(255,240,200,0.32)');
  g.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(50, 0);
  ctx.lineTo(90, 150);
  ctx.lineTo(30, 150);
  ctx.closePath();
  ctx.fill();
  tex.refresh();
  return key;
}

/**
 * Ambiente del combate según el fondo: copos de hollín que caen, brasas que suben
 * y halo de farola en la calle; haces de luz con motas de polvo en interiores.
 * Devuelve los objetos creados por si la escena quiere limpiarlos.
 */
export function battleAmbience(scene: Phaser.Scene, back: string, fieldH: number): Phaser.GameObjects.GameObject[] {
  const objs: Phaser.GameObjects.GameObject[] = [];
  const indoor = back.startsWith('indoor');
  const depth = 350;
  if (indoor) {
    for (const [x, delay] of [
      [36, 0],
      [150, 1400],
    ]) {
      const beam = scene.add.image(x, 0, beamTexture(scene)).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth).setAlpha(0.8);
      scene.tweens.add({ targets: beam, alpha: 0.45, duration: 2600, yoyo: true, repeat: -1, delay, ease: 'Sine.InOut' });
      objs.push(beam);
    }
    const dust = scene.add.particles(0, 0, dotTexture(scene, 'mote-light', 1, '#fff0c8'), {
      x: { min: 20, max: 236 },
      y: { min: 10, max: fieldH - 20 },
      speedX: { min: -3, max: 3 },
      speedY: { min: -2, max: 3 },
      lifespan: 5000,
      frequency: 160,
      alpha: { start: 0.9, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
    });
    dust.setDepth(depth + 1);
    objs.push(dust);
  } else {
    const halo = scene.add.image(28, 14, haloTexture(scene)).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth).setScale(1.4);
    scene.tweens.add({ targets: halo, alpha: 0.75, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    objs.push(halo);
    const soot = scene.add.particles(0, -4, dotTexture(scene, 'soot-flake', 2, '#3a3633'), {
      x: { min: -20, max: 276 },
      speedY: { min: 6, max: 14 },
      speedX: { min: 4, max: 12 },
      lifespan: 12000,
      frequency: 220,
      alpha: { start: 0.8, end: 0.2 },
      rotate: { min: 0, max: 90 },
    });
    soot.setDepth(depth + 1);
    const embers = scene.add.particles(0, fieldH + 2, dotTexture(scene, 'ember-dot', 1, '#f2a040'), {
      x: { min: 0, max: 256 },
      speedY: { min: -18, max: -8 },
      speedX: { min: -4, max: 6 },
      lifespan: 6000,
      frequency: 600,
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
    });
    embers.setDepth(depth + 1);
    objs.push(soot, embers);
  }
  return objs;
}

/** Sombra elíptica bajo un Pokémon, sobre su plataforma. */
export function groundShadow(scene: Phaser.Scene, x: number, y: number, width: number, far: boolean): Phaser.GameObjects.Ellipse {
  return scene.add
    .ellipse(x, y, Math.max(24, width * (far ? 0.7 : 0.8)), far ? 7 : 10, 0x000000, 0.32);
}
