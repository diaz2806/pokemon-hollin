/**
 * "Piel" de los mapas: decide, para cada casilla del mapa de texto, qué suelo de tileset
 * va debajo y si encima va un objeto (farola, caja, valla...). Es lógica pura: el
 * renderizado la usa si existen las casillas recortadas (assets/tiles); si no, dibuja
 * el arte procedural de siempre.
 *
 * Patrón: separamos "qué se ve" (esta función, testeable) de "cómo se pinta" (WorldScene).
 */
import type { Point } from './grid';
import type { Tile, TileMap } from './tilemap';

/** Suelos que tienen versión de tileset. La clave es el nombre en assets/tiles (<clave>_<n>.png). */
const GROUND_SKIN: Partial<Record<Tile, string>> = {
  cobble: 'cobble',
  smoke: 'smoke',
  dirt: 'dirt',
  quay: 'quay',
  water: 'water',
  woodFloor: 'wood',
  grate: 'metal',
};

/** Objetos que se pintan encima de un suelo (su arte procedural sin fondo). */
const PROP_TILES: ReadonlySet<Tile> = new Set<Tile>([
  'lamp',
  'crate',
  'barrel',
  'sign',
  'awning',
  'stall',
  'table',
  'mat',
  'cage',
  'weeds',
  'slag',
  'fence',
  'rails',
  'chimney',
]);

/** Suelo por defecto de cada objeto si ningún vecino lo aclara. */
const PROP_DEFAULT_GROUND: Partial<Record<Tile, string>> = {
  weeds: 'dirt',
  slag: 'dirt',
  fence: 'dirt',
  rails: 'dirt',
  table: 'wood',
  mat: 'wood',
  cage: 'metal',
};

export interface CellLook {
  /** Clave de suelo de tileset (sin variante), o undefined si se usa el arte procedural completo. */
  ground?: string;
  /** El arte procedural va encima como objeto (sin su fondo). */
  prop: boolean;
  /** Número para elegir variante de forma estable (la escena hace módulo con las que haya). */
  variant: number;
}

const DIRS: Point[] = [
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
];

/** Variante estable por posición (siempre la misma casilla para el mismo sitio). */
export function variantAt(p: Point): number {
  return Math.abs((p.x * 73856093) ^ (p.y * 19349663)) % 997;
}

function isRoof(tile: Tile): boolean {
  return tile === 'roof' || tile === 'chimney';
}

/** Suelo más repetido alrededor (empate: el primero encontrado, arriba-izquierda-derecha-abajo). */
function neighbourGround(map: TileMap, p: Point): string | undefined {
  const counts = new Map<string, number>();
  for (const d of DIRS) {
    const q = { x: p.x + d.x, y: p.y + d.y };
    if (!map.inBounds(q)) continue;
    const g = GROUND_SKIN[map.tileAt(q)];
    if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  let best: string | undefined;
  let max = 0;
  for (const [g, n] of counts) {
    if (n > max) {
      best = g;
      max = n;
    }
  }
  return best;
}

export function cellLook(map: TileMap, p: Point): CellLook {
  const tile = map.tileAt(p);
  const variant = variantAt(p);
  const above = p.y > 0 ? map.tileAt({ x: p.x, y: p.y - 1 }) : undefined;

  if (tile === 'roof') return { ground: above && isRoof(above) ? 'roof' : 'roof_top', prop: false, variant };
  if (tile === 'chimney') return { ground: above && isRoof(above) ? 'roof' : 'roof_top', prop: true, variant };
  if (tile === 'eave') return { ground: 'eave', prop: false, variant };
  if (tile === 'backWall') {
    const below = map.inBounds({ x: p.x, y: p.y + 1 }) ? map.tileAt({ x: p.x, y: p.y + 1 }) : undefined;
    return { ground: below === 'backWall' || below === 'shelf' ? 'wall_top' : 'wall_low', prop: false, variant };
  }

  const ground = GROUND_SKIN[tile];
  if (ground) return { ground, prop: false, variant };

  if (PROP_TILES.has(tile)) {
    const under = neighbourGround(map, p) ?? PROP_DEFAULT_GROUND[tile];
    return { ground: under, prop: under !== undefined, variant };
  }
  return { prop: false, variant };
}
