/**
 * Mapas de casillas a partir de filas de texto (formato temporal hasta usar Tiled).
 * Cada carácter es un tipo de casilla; ver TILE_CHARS.
 */
import { step, type Direction, type Point } from './grid';
import type { TrainerData } from './trainers';

export type Tile =
  | 'cobble'
  | 'smoke'
  | 'brick'
  | 'window'
  | 'darkWindow'
  | 'door'
  | 'pubDoor'
  | 'roof'
  | 'eave'
  | 'chimney'
  | 'water'
  | 'quay'
  | 'bridge'
  | 'lamp'
  | 'crate'
  | 'barrel'
  | 'sign'
  | 'awning'
  | 'stall'
  | 'woodFloor'
  | 'backWall'
  | 'shelf'
  | 'counter'
  | 'table'
  | 'mat'
  | 'grate'
  | 'pipes'
  | 'furnace'
  | 'cage'
  | 'dirt'
  | 'weeds'
  | 'slag'
  | 'fence'
  | 'rails'
  | 'gangDoor'
  | 'void';

export const TILE_CHARS: Record<string, Tile> = {
  '.': 'cobble',
  P: 'cobble',
  ',': 'smoke',
  '#': 'brick',
  W: 'window',
  V: 'darkWindow',
  D: 'door',
  B: 'pubDoor',
  R: 'roof',
  E: 'eave',
  K: 'chimney',
  '~': 'water',
  _: 'quay',
  '=': 'bridge',
  L: 'lamp',
  X: 'crate',
  Q: 'barrel',
  S: 'sign',
  A: 'awning',
  T: 'stall',
  w: 'woodFloor',
  b: 'backWall',
  H: 'shelf',
  c: 'counter',
  t: 'table',
  m: 'mat',
  g: 'grate',
  p: 'pipes',
  O: 'furnace',
  C: 'cage',
  ':': 'dirt',
  v: 'weeds',
  Z: 'slag',
  F: 'fence',
  '-': 'rails',
  G: 'gangDoor',
  ' ': 'void',
};

const WALKABLE: ReadonlySet<Tile> = new Set([
  'cobble',
  'smoke',
  'pubDoor',
  'gangDoor',
  'quay',
  'bridge',
  'woodFloor',
  'mat',
  'grate',
  'dirt',
  'weeds',
  'rails',
]);

/** Casillas donde salen Pokémon salvajes (callejones con humo y hierba seca). */
const ENCOUNTER_TILES: ReadonlySet<Tile> = new Set(['smoke', 'weeds']);

/** Casillas "mostrador": hablas con quien está al otro lado (como en los Centros Pokémon). */
const COUNTERS: ReadonlySet<Tile> = new Set(['counter', 'stall']);

export interface Warp {
  x: number;
  y: number;
  to: string;
  toX: number;
  toY: number;
  facing: Direction;
  /** Flag necesario para poder pasar; si falta se muestra `blockedText`. */
  requires?: string;
  blockedText?: string[];
}

export type NpcAction = 'heal' | 'cage' | 'giveBalls' | 'giftSandile' | 'shop';

export interface NpcData {
  id: string;
  x: number;
  y: number;
  sprite: string;
  /** Personaje de Essentials/Gen 4 (assets/characters); si falta, se usa `sprite`. */
  ow?: string;
  facing: Direction;
  dialog: string[];
  action?: NpcAction;
  /** Para jaulas y Pokémon en el mapa: qué especie es. */
  species?: string;
  /** Si es entrenador: su equipo, diálogos y recompensa. */
  trainer?: TrainerData;
  /** Solo aparece si el flag está activo / inactivo. */
  ifFlag?: string;
  unlessFlag?: string;
}

export interface SignData {
  x: number;
  y: number;
  text: string[];
}

export interface MapData {
  id: string;
  name: string;
  rows: string[];
  indoor?: boolean;
  encounterTable?: string;
  warps?: Warp[];
  npcs?: NpcData[];
  signs?: SignData[];
  /** Texto al tocar una puerta cerrada ('door'). */
  lockedDoorText?: string[];
  /** Diálogo automático la primera vez que se entra (se marca `flag`). */
  onEnter?: { flag: string; text: string[] };
  /** Bruma de ambiente en el mapa (0-3): solo visual. */
  haze?: number;
  /** Fondo de combate de Essentials para esta zona. */
  battleback?: string;
}

export class TileMap {
  readonly width: number;
  readonly height: number;
  readonly start: Point | null;
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
        const tile = TILE_CHARS[ch];
        if (!tile) throw new Error(`Mapa ${data.id}: carácter desconocido "${ch}" en (${x}, ${y})`);
        return tile;
      });
    });
    this.start = start;
  }

  inBounds(p: Point): boolean {
    return p.x >= 0 && p.y >= 0 && p.x < this.width && p.y < this.height;
  }

  tileAt(p: Point): Tile {
    if (!this.inBounds(p)) return 'void';
    return this.tiles[p.y][p.x];
  }

  isWalkableTile(p: Point): boolean {
    return WALKABLE.has(this.tileAt(p));
  }

  isEncounterTile(p: Point): boolean {
    return ENCOUNTER_TILES.has(this.tileAt(p));
  }

  isCounter(p: Point): boolean {
    return COUNTERS.has(this.tileAt(p));
  }

  warpAt(p: Point): Warp | undefined {
    return this.data.warps?.find((w) => w.x === p.x && w.y === p.y);
  }

  signAt(p: Point): SignData | undefined {
    return this.data.signs?.find((s) => s.x === p.x && s.y === p.y);
  }

  /** Todas las posiciones de un tipo de casilla (para efectos: humo, farolas...). */
  positionsOf(tile: Tile): Point[] {
    const out: Point[] = [];
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) if (this.tiles[y][x] === tile) out.push({ x, y });
    return out;
  }
}

/** NPCs visibles según los flags de la partida. */
export function visibleNpcs(map: MapData, flags: Record<string, boolean>): NpcData[] {
  return (map.npcs ?? []).filter((n) => (!n.ifFlag || flags[n.ifFlag]) && (!n.unlessFlag || !flags[n.unlessFlag]));
}

/** ¿Se puede pisar `p`? Casilla transitable y sin NPC encima. */
export function canWalk(map: TileMap, npcs: NpcData[], p: Point): boolean {
  return map.isWalkableTile(p) && !npcs.some((n) => n.x === p.x && n.y === p.y);
}

export type Interaction =
  | { kind: 'npc'; npc: NpcData }
  | { kind: 'sign'; sign: SignData }
  | { kind: 'lockedDoor' }
  | { kind: 'nothing' };

/** Qué hay delante del jugador al pulsar A. Atraviesa mostradores. */
export function interactionAt(map: TileMap, npcs: NpcData[], from: Point, facing: Direction): Interaction {
  let target = step(from, facing);
  const npcAt = (p: Point) => npcs.find((n) => n.x === p.x && n.y === p.y);
  let npc = npcAt(target);
  if (!npc && map.isCounter(target)) {
    target = step(target, facing);
    npc = npcAt(target);
  }
  if (npc) return { kind: 'npc', npc };
  const sign = map.signAt(step(from, facing));
  if (sign) return { kind: 'sign', sign };
  if (map.tileAt(step(from, facing)) === 'door') return { kind: 'lockedDoor' };
  return { kind: 'nothing' };
}

const OPPOSITE: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };
export const opposite = (d: Direction): Direction => OPPOSITE[d];
