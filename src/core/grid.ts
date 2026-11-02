/** Movimiento en cuadrícula: posiciones, direcciones y pasos. Sin Phaser. */

export interface Point {
  x: number;
  y: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

const DELTAS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function step(from: Point, dir: Direction): Point {
  const d = DELTAS[dir];
  return { x: from.x + d.x, y: from.y + d.y };
}

export function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Dirección para ir de `from` a `to` si son casillas vecinas; null si no lo son. */
export function directionBetween(from: Point, to: Point): Direction | null {
  for (const [dir, d] of Object.entries(DELTAS) as [Direction, Point][]) {
    if (from.x + d.x === to.x && from.y + d.y === to.y) return dir;
  }
  return null;
}
