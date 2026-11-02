/**
 * Mapa de casillas a partir de filas de texto. Formato temporal hasta usar Tiled.
 *
 *   #  muro / edificio (no se pisa)
 *   .  adoquín
 *   ~  canal (no se pisa)
 *   ,  callejón con humo: hay encuentros con Pokémon salvajes
 *   P  posición inicial del jugador (es adoquín)
 */
import type { Point } from './grid';

export type Tile = 'wall' | 'floor' | 'water' | 'smoke';

const CHAR_TO_TILE: Record<string, Tile> = {
  '#': 'wall',
  '.': 'floor',
  '~': 'water',
  ',': 'smoke',
  P: 'floor',
};

const WALKABLE: ReadonlySet<Tile> = new Set(['floor', 'smoke']);

export interface MapData {
  id: string;
  name: string;
  rows: string[];
  encounterTable?: string;
}

export class TileMap {
  readonly width: number;
  readonly height: number;
  readonly start: Point;
  private readonly tiles: Tile[][];

  constructor(readonly data: MapData) {
    if (data.rows.length === 0) throw new Error(`Mapa ${data.id} vacío`);
    this.width = data.rows[0].length;
    this.height = data.rows.length;
    let start: Point | null = null;
    this.tiles = data.rows.map((row, y) => {
      if (row.length !== this.width) throw new Error(`Mapa ${data.id}: la fila ${y} no mide ${this.width}`);
      return [...row].map((ch, x) => {
        if (ch === 'P') start = { x, y };
        const tile = CHAR_TO_TILE[ch];
        if (!tile) throw new Error(`Mapa ${data.id}: carácter desconocido "${ch}" en (${x}, ${y})`);
        return tile;
      });
    });
    if (!start) throw new Error(`Mapa ${data.id}: falta la posición inicial P`);
    this.start = start;
  }

  tileAt(p: Point): Tile {
    if (p.x < 0 || p.y < 0 || p.x >= this.width || p.y >= this.height) return 'wall';
    return this.tiles[p.y][p.x];
  }

  isWalkable(p: Point): boolean {
    return WALKABLE.has(this.tileAt(p));
  }
}
