/** Utilidades para pintar pixel art en un canvas (texturas generadas por código). */
import type { Grid } from './characters';

export class Painter {
  constructor(
    readonly ctx: CanvasRenderingContext2D,
    readonly ox = 0,
    readonly oy = 0,
  ) {
    ctx.imageSmoothingEnabled = false;
  }

  at(ox: number, oy: number): Painter {
    return new Painter(this.ctx, ox, oy);
  }

  px(x: number, y: number, color: string): this {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(this.ox + x, this.oy + y, 1, 1);
    return this;
  }

  rect(x: number, y: number, w: number, h: number, color: string): this {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(this.ox + x, this.oy + y, w, h);
    return this;
  }

  hline(x: number, y: number, w: number, color: string): this {
    return this.rect(x, y, w, 1, color);
  }

  vline(x: number, y: number, h: number, color: string): this {
    return this.rect(x, y, 1, h, color);
  }

  /** Pinta una cuadrícula de texto con una paleta; '.' es transparente. */
  grid(rows: Grid, palette: Record<string, string>, x = 0, y = 0, flip = false): this {
    rows.forEach((row, ry) => {
      const w = row.length;
      for (let rx = 0; rx < w; rx++) {
        const ch = row[rx];
        if (ch === '.' || ch === ' ') continue;
        const color = palette[ch];
        if (!color) continue;
        this.px(x + (flip ? w - 1 - rx : rx), y + ry, color);
      }
    });
    return this;
  }

  /** Círculo relleno pixelado. */
  disc(cx: number, cy: number, r: number, color: string): this {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) this.px(cx + x, cy + y, color);
    }
    return this;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: string): this {
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) this.px(cx + x, cy + y, color);
    }
    return this;
  }
}

/** Generador pseudoaleatorio determinista (mulberry32) para que el arte sea siempre igual. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mezcla dos colores hex (t = 0 -> a, t = 1 -> b). */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}
