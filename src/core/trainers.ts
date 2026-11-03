/**
 * Entrenadores: quién te ha visto, por dónde viene a buscarte y si ya le has ganado.
 * Lógica pura (sin Phaser): la escena solo anima lo que esto decide.
 */
import { step, type Point } from './grid';
import type { NpcData, TileMap } from './tilemap';

export interface TrainerPokemon {
  species: string;
  level: number;
  moves?: string[];
}

export interface TrainerData {
  name: string;
  /** "Gorrión", "Obrero", "Jefa de banda"... */
  className: string;
  /** Sprite de combate de Essentials (assets/trainers/<battler>.png), opcional. */
  battler?: string;
  party: TrainerPokemon[];
  /** Dinero que da al perder. */
  money: number;
  /** Casillas que ve hacia donde mira (0 = solo si le hablas). */
  sight?: number;
  intro: string[];
  /** Lo que dice en el combate al perder. */
  defeat: string[];
  /** Lo que dice si le hablas después. */
  after: string[];
  /** Recompensa al ganarle (fichas, objetos...). */
  reward?: { flags: string[]; text: string[]; items?: { pokeball?: number; potion?: number } };
}

export function defeatFlag(mapId: string, npcId: string): string {
  return `beat_${mapId}_${npcId}`;
}

export function isDefeated(flags: Record<string, boolean>, mapId: string, npc: NpcData): boolean {
  return Boolean(flags[defeatFlag(mapId, npc.id)]);
}

export interface Spotted {
  npc: NpcData;
  /** Casillas que el entrenador tiene que andar hasta quedar al lado del jugador. */
  path: Point[];
}

/**
 * ¿Algún entrenador sin derrotar ve al jugador en línea recta hacia donde mira?
 * La vista se corta con paredes, objetos y otros NPCs.
 */
export function findSpotter(
  map: TileMap,
  npcs: NpcData[],
  flags: Record<string, boolean>,
  player: Point,
): Spotted | null {
  for (const npc of npcs) {
    const sight = npc.trainer?.sight ?? 0;
    if (!npc.trainer || sight <= 0 || isDefeated(flags, map.data.id, npc)) continue;
    const path: Point[] = [];
    let cursor: Point = { x: npc.x, y: npc.y };
    for (let i = 0; i < sight; i++) {
      cursor = step(cursor, npc.facing);
      if (cursor.x === player.x && cursor.y === player.y) return { npc, path };
      const blocked = !map.isWalkableTile(cursor) || npcs.some((o) => o !== npc && o.x === cursor.x && o.y === cursor.y);
      if (blocked) break;
      path.push(cursor);
    }
  }
  return null;
}
