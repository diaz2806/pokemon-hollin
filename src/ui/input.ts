/**
 * Controles unificados: teclado y botones táctiles en pantalla (móvil).
 *
 *   Cruceta: flechas / WASD
 *   A: Z, Espacio, Enter       (aceptar, hablar)
 *   B: X, Retroceso            (cancelar, correr menús hacia atrás)
 *   START: Escape, M           (menú)
 *
 * Las escenas preguntan `controls.held(dir)` para moverse y `controls.pressed('A')`
 * para acciones de un solo toque (se consume al leerlo).
 */
import type { Direction } from '../core/grid';

export type Button = 'A' | 'B' | 'START';

const KEY_DIR: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

const KEY_BUTTON: Record<string, Button> = {
  z: 'A',
  ' ': 'A',
  Enter: 'A',
  x: 'B',
  Backspace: 'B',
  Escape: 'START',
  m: 'START',
};

class Controls {
  private readonly dirs = new Set<Direction>();
  /** Orden en que se pulsaron las direcciones: manda la última. */
  private dirOrder: Direction[] = [];
  private readonly queue = new Set<Button>();
  private readonly dirTaps: Direction[] = [];

  constructor() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const dir = KEY_DIR[key];
      const button = KEY_BUTTON[key];
      if (dir || button) e.preventDefault();
      if (e.repeat) return;
      if (dir) this.pressDir(dir);
      if (button) this.queue.add(button);
    });
    window.addEventListener('keyup', (e) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const dir = KEY_DIR[key];
      if (dir) this.releaseDir(dir);
    });
    window.addEventListener('blur', () => {
      this.dirs.clear();
      this.dirOrder = [];
    });
  }

  pressDir(dir: Direction): void {
    this.dirs.add(dir);
    this.dirOrder = [...this.dirOrder.filter((d) => d !== dir), dir];
    this.dirTaps.push(dir);
  }

  releaseDir(dir: Direction): void {
    this.dirs.delete(dir);
    this.dirOrder = this.dirOrder.filter((d) => d !== dir);
  }

  press(button: Button): void {
    this.queue.add(button);
  }

  /** Dirección mantenida (la última pulsada si hay varias). */
  heldDir(): Direction | null {
    return this.dirOrder.length > 0 ? this.dirOrder[this.dirOrder.length - 1] : null;
  }

  held(dir: Direction): boolean {
    return this.dirs.has(dir);
  }

  /** ¿Se pulsó el botón desde la última vez que se preguntó? (se consume) */
  pressed(button: Button): boolean {
    const had = this.queue.has(button);
    this.queue.delete(button);
    return had;
  }

  /** Pulsación nueva de una dirección (para menús). Se consume. */
  tappedDir(): Direction | null {
    return this.dirTaps.shift() ?? null;
  }

  /** Olvida pulsaciones pendientes (al cambiar de escena o abrir un diálogo). */
  flush(): void {
    this.queue.clear();
    this.dirTaps.length = 0;
  }
}

export const controls = new Controls();

/** Conecta los botones táctiles del HTML (#pad) con los controles. */
export function bindTouchPad(root: HTMLElement): void {
  const bind = (el: Element, down: () => void, up: () => void = () => {}) => {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      (el as HTMLElement).classList.add('on');
      down();
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
      el.addEventListener(ev, () => {
        (el as HTMLElement).classList.remove('on');
        up();
      });
    }
  };
  root.querySelectorAll<HTMLElement>('[data-dir]').forEach((el) => {
    const dir = el.dataset.dir as Direction;
    bind(el, () => controls.pressDir(dir), () => controls.releaseDir(dir));
  });
  root.querySelectorAll<HTMLElement>('[data-btn]').forEach((el) => {
    const btn = el.dataset.btn as Button;
    bind(el, () => controls.press(btn));
  });
}
