/**
 * Decoración automática de los mapas: charcos, papeles, grietas, carteles en las
 * paredes, macetas en las ventanas, palomas en los tejados, restos flotando en el
 * canal... Son detalles solo visuales que se reparten por el mapa de forma
 * determinista (misma casilla, mismo detalle siempre) a partir de un hash de la
 * posición, sin tener que colocarlos a mano.
 *
 * Lógica pura y testeable: WorldScene solo pinta la lista que devuelve `decorate`.
 */
import type { Point } from './grid';
import type { Tile, TileMap } from './tilemap';

export type DecorKind =
  | 'puddle'
  | 'litter'
  | 'crack'
  | 'poster'
  | 'drainpipe'
  | 'flowerbox'
  | 'pigeon'
  | 'debris'
  | 'pebbles'
  | 'tuft'
  | 'scrap'
  | 'bottle'
  | 'sawdust'
  | 'oilstain';

export interface Decor {
  x: number;
  y: number;
  kind: DecorKind;
  /** Variante de dibujo (0-3). */
  variant: number;
}

/** Probabilidad (en tantos por mil) de cada detalle según el suelo. */
const RULES: Partial<Record<Tile, [DecorKind, number][]>> = {
  cobble: [
    ['puddle', 70],
    ['litter', 55],
    ['crack', 45],
    ['oilstain', 25],
  ],
  smoke: [
    ['puddle', 50],
    ['litter', 45],
    ['crack', 25],
  ],
  quay: [
    ['crack', 40],
    ['oilstain', 30],
  ],
  brick: [
    ['poster', 200],
    ['drainpipe', 90],
  ],
  window: [['flowerbox', 450]],
  darkWindow: [['flowerbox', 120]],
  roof: [['pigeon', 70]],
  water: [['debris', 50]],
  dirt: [
    ['pebbles', 130],
    ['tuft', 110],
    ['scrap', 25],
  ],
  woodFloor: [
    ['sawdust', 40],
    ['bottle', 20],
  ],
  grate: [['oilstain', 60]],
};

/** Hash entero estable de una posición (y una semilla por tipo de detalle). */
export function hashAt(p: Point, salt: number): number {
  let h = (p.x * 374761393 + p.y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Decide los detalles de un mapa. `blocked` son casillas que no deben llevar nada
 * en el suelo (puertas, NPCs, salidas). Como mucho un detalle por casilla.
 */
export function decorate(map: TileMap, blocked: Point[] = []): Decor[] {
  const skip = new Set(blocked.map((b) => `${b.x},${b.y}`));
  const out: Decor[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (skip.has(`${x},${y}`)) continue;
      const rules = RULES[map.tileAt({ x, y })];
      if (!rules) continue;
      for (const [i, [kind, perMille]] of rules.entries()) {
        const h = hashAt({ x, y }, i + 1);
        if (h % 1000 < perMille) {
          out.push({ x, y, kind, variant: (h >>> 10) % 4 });
          break;
        }
      }
    }
  }
  return out;
}

/** Detalles con animación (número de fotogramas). */
export const DECOR_FRAMES: Partial<Record<DecorKind, number>> = { puddle: 2, pigeon: 2, debris: 2 };
