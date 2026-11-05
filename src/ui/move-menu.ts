/**
 * Menú de ataques de Pokémon Hollín.
 *
 * Un panel de hierro remachado sube desde abajo con cuatro tarjetas de ataque.
 * Cada tarjeta se pinta por código en un canvas (degradado por bandas, rayado
 * diagonal, brillo superior, remaches) con el color de su tipo, así que no depende
 * de ningún gráfico externo. La seleccionada se eleva, brilla en dorado y la cruza
 * un reflejo; una Poké Ball bota a su lado. Arriba se ven el Pokémon activo y los
 * datos del ataque: categoría, potencia, precisión y eficacia.
 *
 * Patrón: las texturas de tarjeta se generan una vez por tipo y estado y se
 * cachean en el TextureManager (clave `movecard-<tipo>-<estado>`).
 */
import * as Phaser from 'phaser';
import { controls } from './input';
import { playSe } from './audio';
import { resKey, resReady } from './resources';
import { TYPE_COLOR, TYPE_SHORT_ES } from './battle-ui';
import { FONT_PX } from './palette';

export interface MoveCard {
  name: string;
  type: string;
  pp: number;
  maxPp: number;
  category: 'Physical' | 'Special' | 'Status' | string;
  power: number;
  accuracy: number | true;
}

export interface MoveMenuOptions {
  moves: MoveCard[];
  /** Pokémon que ataca: nombre, nivel, PS y clave de su icono (si hay). */
  pokemon: { name: string; level: number; hp: number; maxHp: number; iconKey?: string };
  /** Etiqueta de eficacia del ataque i ('x2', 'x.5'...; '' = sin etiqueta) y su color. */
  hint: (index: number) => [string, string];
  start?: number;
}

const CARD_W = 122;
const CARD_H = 28;
const PANEL_Y = 100;
const PANEL_H = 192 - PANEL_Y;
const DEPTH = 1100;
const CATEGORY_ROW: Record<string, number> = { Physical: 0, Special: 1, Status: 2 };
const CATEGORY_ES: Record<string, string> = { Physical: 'FÍSICO', Special: 'ESPECIAL', Status: 'ESTADO' };

type CardState = 'idle' | 'selected' | 'empty';

// ---------- Colores ----------

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(c: [number, number, number], to: [number, number, number], t: number): [number, number, number] {
  return [0, 1, 2].map((i) => Math.round(c[i] + (to[i] - c[i]) * t)) as [number, number, number];
}

const css = (c: [number, number, number], a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];

function grey(c: [number, number, number]): [number, number, number] {
  const g = Math.round(c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11);
  return [g, g, g];
}

// ---------- Texturas ----------

/** Rectángulo con esquinas recortadas en píxel (sin antialias). */
function pixelRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y, w - 4, h);
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillRect(x, y + 2, w, h - 4);
}

function cardTexture(scene: Phaser.Scene, type: string, state: CardState): string {
  const key = `movecard-${type}-${state}`;
  if (scene.textures.exists(key)) return key;
  let base = hexToRgb(TYPE_COLOR[type] ?? '#68a090');
  if (state === 'empty') base = mix(grey(base), BLACK, 0.2);
  if (state === 'idle') base = mix(base, BLACK, 0.12);
  const light = mix(base, WHITE, state === 'selected' ? 0.45 : 0.32);
  const dark = mix(base, BLACK, 0.4);
  const darker = mix(base, BLACK, 0.68);

  const tex = scene.textures.createCanvas(key, CARD_W, CARD_H)!;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  // Borde
  pixelRoundRect(ctx, 0, 0, CARD_W, CARD_H, css(state === 'selected' ? [42, 30, 14] : darker));
  // Relleno en bandas de 2 px: claro arriba, base en medio, oscuro abajo.
  for (let y = 1; y < CARD_H - 1; y += 2) {
    const t = y / (CARD_H - 2);
    const c = t < 0.5 ? mix(light, base, t * 2) : mix(base, dark, (t - 0.5) * 2);
    ctx.fillStyle = css(c);
    const inset = y < 2 || y > CARD_H - 3 ? 2 : 1;
    ctx.fillRect(inset, y, CARD_W - inset * 2, 2);
  }
  // Rayado diagonal (chapa industrial)
  ctx.fillStyle = css(darker, 0.16);
  for (let y = 2; y < CARD_H - 2; y++) {
    for (let x = 2; x < CARD_W - 2; x++) if ((x + y) % 7 < 2) ctx.fillRect(x, y, 1, 1);
  }
  // Banda inferior para los PP
  ctx.fillStyle = css(darker, 0.38);
  ctx.fillRect(3, 17, CARD_W - 6, 8);
  ctx.fillStyle = css(WHITE, 0.18);
  ctx.fillRect(3, 25, CARD_W - 6, 1);
  // Brillo superior y lateral, sombra inferior
  ctx.fillStyle = css(WHITE, 0.55);
  ctx.fillRect(3, 1, CARD_W - 6, 1);
  ctx.fillStyle = css(WHITE, 0.25);
  ctx.fillRect(1, 3, 1, CARD_H - 6);
  ctx.fillStyle = css(darker, 0.6);
  ctx.fillRect(3, CARD_H - 2, CARD_W - 6, 1);
  // Remaches
  for (const [rx, ry] of [
    [3, 3],
    [CARD_W - 5, 3],
  ]) {
    ctx.fillStyle = css(darker);
    ctx.fillRect(rx, ry + 1, 2, 1);
    ctx.fillStyle = css(light);
    ctx.fillRect(rx, ry, 2, 1);
  }
  tex.refresh();
  return key;
}

/** Placa de hierro del panel: degradado, rayado, remaches y ribete de latón. */
function panelTexture(scene: Phaser.Scene): string {
  const key = 'movemenu-panel';
  if (scene.textures.exists(key)) return key;
  const w = 256;
  const tex = scene.textures.createCanvas(key, w, PANEL_H)!;
  const ctx = tex.getContext();
  for (let y = 0; y < PANEL_H; y++) {
    const t = y / PANEL_H;
    ctx.fillStyle = css(mix([58, 54, 50], [22, 20, 19], t));
    ctx.fillRect(0, y, w, 1);
  }
  // Rayado fino
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (let y = 0; y < PANEL_H; y++) for (let x = (y * 3) % 8; x < w; x += 8) ctx.fillRect(x, y, 1, 1);
  // Ribete de latón arriba (3 px con brillo) y sombra
  const brass: [number, number, number][] = [
    [242, 214, 138],
    [201, 158, 74],
    [128, 92, 38],
  ];
  brass.forEach((c, i) => {
    ctx.fillStyle = css(c);
    ctx.fillRect(0, i, w, 1);
  });
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 3, w, 2);
  // Separador entre cabecera y tarjetas
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(4, 27, w - 8, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.09)';
  ctx.fillRect(4, 28, w - 8, 1);
  // Remaches de las esquinas
  for (const [rx, ry] of [
    [3, 7],
    [w - 6, 7],
    [3, PANEL_H - 5],
    [w - 6, PANEL_H - 5],
  ]) {
    ctx.fillStyle = '#16140f';
    ctx.fillRect(rx, ry + 1, 3, 2);
    ctx.fillStyle = '#9a8a6a';
    ctx.fillRect(rx, ry, 3, 1);
    ctx.fillStyle = '#d9c99a';
    ctx.fillRect(rx, ry, 1, 1);
  }
  tex.refresh();
  return key;
}

function textStyleOutline(color = '#ffffff', stroke = '#1a1410'): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: '"Press Start 2P"',
    fontSize: `${FONT_PX}px`,
    color,
    resolution: 1,
    stroke,
    strokeThickness: 2,
  };
}

function smallStyle(color = '#d9d2c3'): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: '"Press Start 2P"',
    fontSize: `${FONT_PX}px`,
    color,
    resolution: 1,
    shadow: { offsetX: 1, offsetY: 1, color: '#000000', fill: true },
  };
}

function ppColor(pp: number, max: number): number {
  if (pp === 0) return 0x7a2020;
  if (pp <= max / 4) return 0xe07030;
  if (pp <= max / 2) return 0xe8c040;
  return 0x78d070;
}

// ---------- Menú ----------

interface CardView {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Image;
  move: MoveCard;
  x: number;
  y: number;
}

export function chooseMove(scene: Phaser.Scene, opts: MoveMenuOptions): Promise<number> {
  const { moves } = opts;
  const root = scene.add.container(0, PANEL_H).setDepth(DEPTH);
  const objects: Phaser.GameObjects.GameObject[] = [root];

  // Oscurece el campo para centrar la atención en el panel.
  const dim = scene.add.rectangle(0, 0, 256, PANEL_Y, 0x07070a, 0).setOrigin(0).setDepth(DEPTH - 1);
  objects.push(dim);
  scene.tweens.add({ targets: dim, fillAlpha: 0.32, duration: 200 });

  root.add(scene.add.image(0, PANEL_Y, panelTexture(scene)).setOrigin(0));

  // Cabecera izquierda: icono del Pokémon, nombre, nivel y PS.
  const p = opts.pokemon;
  let nameX = 8;
  if (p.iconKey && scene.textures.exists(p.iconKey)) {
    const icon = scene.add.sprite(18, PANEL_Y + 8, p.iconKey, 0).setOrigin(0.5, 0.5);
    root.add(icon);
    scene.tweens.add({ targets: icon, y: icon.y - 2, duration: 260, yoyo: true, repeat: -1, ease: 'Stepped' });
    nameX = 36;
  }
  // Todo el texto a 8 px exactos: escalar la fuente de píxel la emborrona.
  root.add(scene.add.text(nameX, PANEL_Y + 6, p.name.slice(0, 10), textStyleOutline('#f2e8d0')));
  root.add(scene.add.text(nameX, PANEL_Y + 17, `Nv${p.level}`, smallStyle('#b8ae9a')));
  const hpRatio = p.maxHp > 0 ? p.hp / p.maxHp : 0;
  root.add(scene.add.rectangle(nameX + 34, PANEL_Y + 19, 50, 4, 0x14110e).setOrigin(0));
  root.add(scene.add.rectangle(nameX + 35, PANEL_Y + 20, Math.round(48 * hpRatio), 2, hpRatio > 0.5 ? 0x78d070 : hpRatio > 0.2 ? 0xe8c040 : 0xe05030).setOrigin(0));

  // Cabecera derecha: tipo, categoría, potencia y precisión del ataque elegido.
  const typePill = scene.add.text(130, PANEL_Y + 5, '', { ...smallStyle('#ffffff'), padding: { x: 3, y: 1 } });
  const hasCategory = resReady(scene, 'ui', 'category');
  const category = hasCategory ? scene.add.sprite(0, PANEL_Y + 3, resKey('ui', 'category'), 0).setOrigin(0) : undefined;
  const stats = scene.add.text(130, PANEL_Y + 18, '', smallStyle('#d9d2c3'));
  root.add([typePill, stats]);
  if (category) root.add(category);

  // Tarjetas
  const slots = [
    { x: 5, y: PANEL_Y + 32 },
    { x: 129, y: PANEL_Y + 32 },
    { x: 5, y: PANEL_Y + 61 },
    { x: 129, y: PANEL_Y + 61 },
  ];
  const cards: CardView[] = moves.map((move, i) => {
    const s = slots[i];
    const c = scene.add.container(s.x, s.y);
    const state: CardState = move.pp === 0 ? 'empty' : 'idle';
    const bg = scene.add.image(0, 0, cardTexture(scene, move.type, state)).setOrigin(0);
    const name = scene.add.text(8, 4, move.name.slice(0, 13), textStyleOutline(move.pp === 0 ? '#9a9a9a' : '#ffffff'));
    if (name.width > CARD_W - 14) name.setLetterSpacing(-1);
    const ppLabel = scene.add.text(7, 17, 'PP', smallStyle('#c8bca0'));
    const ppText = scene.add.text(27, 17, `${move.pp}/${move.maxPp}`, smallStyle('#f2e8d0'));
    const barX = 70;
    const barW = CARD_W - barX - 7;
    const barBack = scene.add.rectangle(barX, 19, barW, 4, 0x14110e).setOrigin(0);
    const ratio = move.maxPp > 0 ? move.pp / move.maxPp : 0;
    const bar = scene.add.rectangle(barX + 1, 20, Math.max(0, Math.round((barW - 2) * ratio)), 2, ppColor(move.pp, move.maxPp)).setOrigin(0);
    c.add([bg, name, ppLabel, ppText, barBack, bar]);
    // Etiqueta de eficacia (x2, x.5...) en la esquina: se ve en todas las tarjetas.
    const [tag, tagColor] = opts.hint(i);
    if (tag) {
      const t = scene.add.text(CARD_W - 5, 4, tag, textStyleOutline(tagColor)).setOrigin(1, 0);
      if (name.x + name.width > t.x - t.width - 2) name.setLetterSpacing(-1);
      c.add(t);
    }
    root.add(c);
    // Entrada escalonada
    c.setAlpha(0);
    c.y = s.y + 8;
    scene.tweens.add({ targets: c, alpha: 1, y: s.y, delay: 60 + i * 45, duration: 160, ease: 'Quad.Out' });
    return { container: c, bg, move, x: s.x, y: s.y };
  });

  // Selección: halo dorado que late, reflejo que cruza y Poké Ball que bota.
  const glow = scene.add.graphics();
  const shine = scene.add.graphics();
  root.add([glow, shine]);
  const cursor = scene.add.image(0, 0, 'ball').setScale(0.75);
  root.add(cursor);
  const pulse = { a: 0.6 };
  const pulseTween = scene.tweens.add({ targets: pulse, a: 1, duration: 420, yoyo: true, repeat: -1 });
  const sweep = { x: -30 };
  const sweepTween = scene.tweens.add({ targets: sweep, x: CARD_W + 30, duration: 900, repeat: -1, repeatDelay: 900, ease: 'Sine.InOut' });
  const bob = { y: 0 };
  const bobTween = scene.tweens.add({ targets: bob, y: -2, duration: 220, yoyo: true, repeat: -1, ease: 'Stepped' });

  let index = Math.min(opts.start ?? 0, moves.length - 1);

  const paintHeader = () => {
    const m = moves[index];
    typePill.setText(TYPE_SHORT_ES[m.type] ?? m.type).setBackgroundColor(TYPE_COLOR[m.type] ?? '#68a090');
    if (category) category.setFrame(CATEGORY_ROW[m.category] ?? 2).setX(typePill.x + typePill.width + 4);
    else typePill.setText(`${typePill.text} ${CATEGORY_ES[m.category] ?? ''}`);
    const power = m.power > 0 ? String(m.power) : '-';
    const acc = m.accuracy === true ? '-' : String(m.accuracy);
    stats.setText(`POT ${power}  PRE ${acc}`);
  };

  const paint = () => {
    cards.forEach((card, i) => {
      const selected = i === index;
      const state: CardState = card.move.pp === 0 ? 'empty' : selected ? 'selected' : 'idle';
      card.bg.setTexture(cardTexture(scene, card.move.type, state));
      card.container.y = card.y - (selected ? 2 : 0);
    });
    paintHeader();
  };

  const drawSelection = () => {
    const card = cards[index];
    if (!card) return;
    const x = card.x;
    const y = card.container.y;
    glow.clear();
    glow.lineStyle(1, 0xf2c14e, pulse.a).strokeRect(x - 1.5, y - 1.5, CARD_W + 3, CARD_H + 3);
    glow.lineStyle(1, 0xfff0b0, pulse.a * 0.5).strokeRect(x - 2.5, y - 2.5, CARD_W + 5, CARD_H + 5);
    // Sombra bajo la tarjeta elevada
    glow.fillStyle(0x000000, 0.35).fillRect(x + 2, y + CARD_H + 1, CARD_W - 4, 2);
    // Reflejo diagonal recortado a la tarjeta, fila a fila
    shine.clear();
    for (let row = 2; row < CARD_H - 2; row++) {
      const sx = x + sweep.x - row * 0.6;
      const left = Math.max(x + 2, sx);
      const right = Math.min(x + CARD_W - 2, sx + 6);
      if (right > left) shine.fillStyle(0xffffff, 0.22).fillRect(left, y + row, right - left, 1);
    }
    cursor.setPosition(x - 1, y + CARD_H / 2 + bob.y);

  };

  paint();
  scene.tweens.add({ targets: root, y: 0, duration: 220, ease: 'Back.Out' });
  controls.flush();

  return new Promise((resolve) => {
    const finish = (value: number) => {
      timer.remove();
      pulseTween.remove();
      sweepTween.remove();
      bobTween.remove();
      const done = () => {
        objects.forEach((o) => o.destroy());
        resolve(value);
      };
      if (value >= 0) {
        // Destello de confirmación sobre la tarjeta elegida.
        const card = cards[value];
        const flash = scene.add.rectangle(card.x, card.container.y, CARD_W, CARD_H, 0xffffff, 0.7).setOrigin(0);
        root.add(flash);
        scene.tweens.add({ targets: flash, alpha: 0, duration: 160 });
      }
      scene.tweens.add({ targets: root, y: PANEL_H, duration: 160, delay: value >= 0 ? 120 : 0, ease: 'Quad.In', onComplete: done });
      scene.tweens.add({ targets: dim, fillAlpha: 0, duration: 160 });
    };
    const timer = scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        drawSelection();
        const dir = controls.tappedDir();
        if (dir) {
          const delta = { up: -2, down: 2, left: -1, right: 1 }[dir];
          const next = index + delta;
          const sameRow = dir === 'left' || dir === 'right' ? Math.floor(next / 2) === Math.floor(index / 2) : true;
          if (next >= 0 && next < moves.length && sameRow) {
            index = next;
            paint();
            playSe(scene, 'gui_sel_cursor');
          }
        }
        if (controls.pressed('A')) {
          playSe(scene, 'gui_sel_decision');
          finish(index);
        } else if (controls.pressed('B')) {
          playSe(scene, 'gui_sel_cancel');
          finish(-1);
        }
      },
    });
  });
}
