/**
 * Caja de texto estilo Pokémon de DS: dos líneas, el texto aparece letra a letra,
 * A para avanzar, y preguntas con opciones (Sí/No, listas...).
 *
 * Todo es asíncrono: `await box.say(['Hola', '¿Qué tal?'])`.
 */
import * as Phaser from 'phaser';
import { controls } from './input';
import { FONT_PX, UI } from './palette';

export const LINE_CHARS = 28;
const CHARS_PER_SECOND = 70;

/** Parte un texto en líneas de como mucho `width` caracteres respetando palabras. */
export function wrap(text: string, width = LINE_CHARS): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (line.length === 0) line = w;
    else if (line.length + 1 + w.length <= width) line += ` ${w}`;
    else {
      lines.push(line);
      line = w;
    }
    while (line.length > width) {
      lines.push(line.slice(0, width));
      line = line.slice(width);
    }
  }
  if (line.length > 0) lines.push(line);
  return lines;
}

export function textStyle(color: string = UI.ink): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: '"Press Start 2P"', fontSize: `${FONT_PX}px`, color, resolution: 1 };
}

/** Dibuja un marco de ventana estilo latón. */
export function drawFrame(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  g.fillStyle(UI.frameDarkN).fillRect(x, y, w, h);
  g.fillStyle(UI.frameN).fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle(UI.frameDarkN).fillRect(x + 3, y + 3, w - 6, h - 6);
  g.fillStyle(UI.paperN).fillRect(x + 4, y + 4, w - 8, h - 8);
}

export class TextBox {
  readonly container: Phaser.GameObjects.Container;
  private readonly lines: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  private readonly arrow: Phaser.GameObjects.Text;
  private readonly x: number;
  private readonly y: number;
  private readonly w: number;

  constructor(
    private readonly scene: Phaser.Scene,
    x = 2,
    y = 142,
    w = 252,
    h = 48,
  ) {
    this.x = x;
    this.y = y;
    this.w = w;
    const g = scene.add.graphics();
    drawFrame(g, x, y, w, h);
    const l1 = scene.add.text(x + 12, y + 12, '', textStyle());
    const l2 = scene.add.text(x + 12, y + 28, '', textStyle());
    this.arrow = scene.add.text(x + w - 18, y + h - 14, 'v', textStyle(UI.accent)).setVisible(false);
    scene.tweens.add({ targets: this.arrow, y: this.arrow.y + 2, duration: 300, yoyo: true, repeat: -1 });
    this.lines = [l1, l2];
    this.container = scene.add.container(0, 0, [g, l1, l2, this.arrow]).setDepth(1000).setScrollFactor(0).setVisible(false);
  }

  get visible(): boolean {
    return this.container.visible;
  }

  show(): void {
    this.container.setVisible(true);
  }

  hide(): void {
    this.container.setVisible(false);
    this.lines.forEach((l) => l.setText(''));
  }

  /** Escribe el texto sin esperar (por ejemplo, "¿Qué hará Growlithe?"). */
  setInstant(text: string): void {
    this.show();
    const [a = '', b = ''] = wrap(text);
    this.lines[0].setText(a);
    this.lines[1].setText(b);
    this.arrow.setVisible(false);
  }

  /** Escribe dos líneas exactas sin esperar. */
  setLines(a: string, b = ''): void {
    this.show();
    this.lines[0].setText(a);
    this.lines[1].setText(b);
    this.arrow.setVisible(false);
  }

  /** Muestra uno o varios mensajes y espera a que el jugador pulse A en cada página. */
  async say(messages: string | string[], opts: { keepOpen?: boolean; autoMs?: number } = {}): Promise<void> {
    const list = Array.isArray(messages) ? messages : [messages];
    this.show();
    for (const msg of list) {
      const pages: string[][] = [];
      const wrapped = wrap(msg);
      for (let i = 0; i < wrapped.length; i += 2) pages.push(wrapped.slice(i, i + 2));
      for (const page of pages) {
        await this.typePage(page);
        await this.waitAdvance(opts.autoMs);
      }
    }
    if (!opts.keepOpen) this.hide();
  }

  /** Escribe una página y deja el texto visible (sin esperar a A). */
  async type(message: string): Promise<void> {
    this.show();
    await this.typePage(wrap(message).slice(0, 2));
  }

  private typePage(page: string[]): Promise<void> {
    this.arrow.setVisible(false);
    this.lines.forEach((l) => l.setText(''));
    controls.flush();
    const full = page.join('\n');
    let shown = 0;
    return new Promise((resolve) => {
      const timer = this.scene.time.addEvent({
        delay: 1000 / CHARS_PER_SECOND,
        loop: true,
        callback: () => {
          if (controls.pressed('A') || controls.pressed('B')) shown = full.length;
          else shown++;
          const visible = full.slice(0, shown).split('\n');
          this.lines[0].setText(visible[0] ?? '');
          this.lines[1].setText(visible[1] ?? '');
          if (shown >= full.length) {
            timer.remove();
            resolve();
          }
        },
      });
    });
  }

  private waitAdvance(autoMs?: number): Promise<void> {
    this.arrow.setVisible(autoMs === undefined);
    controls.flush();
    return new Promise((resolve) => {
      let elapsed = 0;
      const timer = this.scene.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          elapsed += 16;
          if (controls.pressed('A') || controls.pressed('B') || (autoMs !== undefined && elapsed >= autoMs)) {
            timer.remove();
            this.arrow.setVisible(false);
            resolve();
          }
        },
      });
    });
  }

  /**
   * Hace una pregunta con opciones. Devuelve el índice elegido o -1 si se cancela con B.
   * El menú aparece encima de la caja, a la derecha.
   */
  async ask(question: string, options: string[], cancelIndex = options.length - 1): Promise<number> {
    await this.type(question);
    const menu = new Menu(this.scene, options, { right: this.x + this.w, bottom: this.y - 2 });
    const choice = await menu.choose(cancelIndex);
    menu.destroy();
    return choice;
  }
}

export interface MenuPlacement {
  x?: number;
  y?: number;
  right?: number;
  bottom?: number;
  width?: number;
  columns?: number;
}

/** Menú de opciones con cursor. */
export class Menu {
  private readonly container: Phaser.GameObjects.Container;
  private readonly texts: Phaser.GameObjects.Text[];
  private readonly cursor: Phaser.GameObjects.Text;
  private index = 0;
  private readonly columns: number;
  private readonly colWidth: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: string[],
    place: MenuPlacement = {},
    private readonly onMove?: (index: number) => void,
  ) {
    this.columns = place.columns ?? 1;
    const longest = Math.max(...options.map((o) => o.length));
    this.colWidth = longest * FONT_PX + 16;
    const rows = Math.ceil(options.length / this.columns);
    const w = place.width ?? this.colWidth * this.columns + 16;
    const h = rows * 14 + 16;
    const x = place.x ?? (place.right !== undefined ? place.right - w : 0);
    const y = place.y ?? (place.bottom !== undefined ? place.bottom - h : 0);
    const g = scene.add.graphics();
    drawFrame(g, x, y, w, h);
    this.texts = options.map((o, i) => {
      const col = i % this.columns;
      const row = Math.floor(i / this.columns);
      return scene.add.text(x + 18 + col * this.colWidth, y + 10 + row * 14, o, textStyle());
    });
    this.cursor = scene.add.text(0, 0, '>', textStyle(UI.accent));
    this.container = scene.add.container(0, 0, [g, ...this.texts, this.cursor]).setDepth(1100).setScrollFactor(0);
    this.place();
  }

  private place(): void {
    const t = this.texts[this.index];
    this.cursor.setPosition(t.x - 10, t.y);
    this.onMove?.(this.index);
  }

  setIndex(i: number): void {
    this.index = Math.max(0, Math.min(this.options.length - 1, i));
    this.place();
  }

  /** Espera la elección. B devuelve -1 (o `cancelIndex` si se indica y es >= 0). */
  choose(cancelIndex = -1): Promise<number> {
    controls.flush();
    return new Promise((resolve) => {
      const timer = this.scene.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          const dir = controls.tappedDir();
          if (dir) {
            const delta = { up: -this.columns, down: this.columns, left: -1, right: 1 }[dir];
            const next = this.index + delta;
            if (next >= 0 && next < this.options.length && (this.columns > 1 || dir === 'up' || dir === 'down')) {
              this.index = next;
              this.place();
            }
          }
          if (controls.pressed('A')) {
            timer.remove();
            resolve(this.index);
          } else if (controls.pressed('B')) {
            timer.remove();
            resolve(cancelIndex);
          }
        },
      });
    });
  }

  destroy(): void {
    this.container.destroy();
  }
}
