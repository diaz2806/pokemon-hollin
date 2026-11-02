/** Estado completo de la partida y guardado. Sin Phaser. */
import type { Direction, Point } from './grid';
import type { PartyMember } from './party';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'pokemon-hollin/save';

export interface Bag {
  pokeball: number;
  potion: number;
}

export interface GameState {
  version: number;
  playerName: string;
  party: PartyMember[];
  box: PartyMember[];
  bag: Bag;
  money: number;
  map: string;
  pos: Point;
  facing: Direction;
  /** Pub donde se reaparece al quedarse sin Pokémon. */
  lastPub: { map: string; pos: Point };
  /** Marcas de historia: "starterChosen", "talkedToBartender"... */
  flags: Record<string, boolean>;
  seen: string[];
  caught: string[];
  playTimeMs: number;
}

export function newGame(playerName = 'Jack'): GameState {
  return {
    version: SAVE_VERSION,
    playerName,
    party: [],
    box: [],
    bag: { pokeball: 5, potion: 2 },
    money: 300,
    map: 'fabrica',
    pos: { x: 4, y: 5 },
    facing: 'up',
    lastPub: { map: 'pub', pos: { x: 5, y: 6 } },
    flags: {},
    seen: [],
    caught: [],
    playTimeMs: 0,
  };
}

export function markSeen(state: GameState, species: string): void {
  if (!state.seen.includes(species)) state.seen.push(species);
}

export function markCaught(state: GameState, species: string): void {
  markSeen(state, species);
  if (!state.caught.includes(species)) state.caught.push(species);
}

/** Almacenamiento inyectable (localStorage en el navegador, un Map en los tests). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function saveGame(state: GameState, storage: KeyValueStorage): void {
  storage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function loadGame(storage: KeyValueStorage): GameState | null {
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as GameState;
    if (data.version !== SAVE_VERSION || !Array.isArray(data.party)) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave(storage: KeyValueStorage): boolean {
  return loadGame(storage) !== null;
}
