/**
 * Consultas a los datos oficiales (vía Showdown) que necesita el resto del juego:
 * stats, PS máximos, movimientos que aprende, evoluciones y datos de movimientos.
 *
 * Igual que BattleAdapter, es frontera con @pkmn/sim: el resto del juego no lo importa.
 */
import { getHollinDex } from './hollin-mod';
import type { MoveState, PartyMember } from '../core/party';
import type { GrowthRate } from '../core/experience';
import { expForLevel } from '../core/experience';
import speciesMeta from '../../data/species-meta.json';
import moveNamesEs from '../../data/move-names-es.json';

interface SpeciesMeta {
  num: number;
  catchRate: number;
  baseExp: number;
  growth: GrowthRate;
}

const META = speciesMeta as Record<string, SpeciesMeta>;
const MOVE_NAMES_ES = moveNamesEs as Record<string, string>;

const dex = () => getHollinDex();
export const toId = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function speciesName(species: string): string {
  return dex().species.get(species).name;
}

/** id de la especie base ("Sandile-Ashbury" -> "sandile"). */
export function speciesBaseId(species: string): string {
  const s = dex().species.get(species);
  return s.exists ? toId(s.baseSpecies) : toId(species);
}

export function speciesExists(species: string): boolean {
  return dex().species.get(species).exists;
}

export function speciesTypes(species: string): string[] {
  return dex().species.get(species).types;
}

/**
 * Multiplicador de tipo de un ataque contra unos tipos (0, 0.25, 0.5, 1, 2, 4).
 * Lo usa el menú de ataques para dar la pista de eficacia.
 */
export function typeMultiplier(moveType: string, defenderTypes: string[]): number {
  const d = dex();
  if (!d.getImmunity(moveType, defenderTypes)) return 0;
  return 2 ** d.getEffectiveness(moveType, defenderTypes);
}

export function meta(species: string): SpeciesMeta {
  const s = dex().species.get(species);
  return META[toId(s.baseSpecies)] ?? META[s.id] ?? { num: s.num, catchRate: 45, baseExp: 60, growth: 'medium' };
}

/** PS máximos con IVs 31, EVs 0 y naturaleza neutra (lo mismo que usa el combate). */
export function maxHp(species: string, level: number): number {
  const base = dex().species.get(species).baseStats.hp;
  if (base === 1) return 1; // Shedinja
  return Math.floor(((2 * base + 31) * level) / 100) + level + 10;
}

export function moveName(id: string): string {
  return MOVE_NAMES_ES[toId(id)] ?? dex().moves.get(id).name;
}

export function moveInfo(id: string): {
  name: string;
  type: string;
  pp: number;
  category: string;
  power: number;
  target: string;
  accuracy: number | true;
} {
  const m = dex().moves.get(id);
  return { name: moveName(m.id), type: m.type, pp: m.pp, category: m.category, power: m.basePower, target: m.target, accuracy: m.accuracy };
}

/**
 * Movimientos que la especie aprende subiendo de nivel, de la generación más
 * reciente en la que existe. Devuelve [nivel, idMovimiento] ordenado por nivel.
 */
export function levelUpMoves(species: string): [number, string][] {
  const s = dex().species.get(species);
  const learnset = dex().data.Learnsets[s.id]?.learnset ?? dex().data.Learnsets[toId(s.baseSpecies)]?.learnset;
  if (!learnset) return [];
  const byGen = new Map<number, [number, string][]>();
  for (const [move, sources] of Object.entries(learnset)) {
    for (const src of sources as string[]) {
      const m = /^(\d)L(\d+)$/.exec(src);
      if (!m) continue;
      const gen = Number(m[1]);
      if (!byGen.has(gen)) byGen.set(gen, []);
      byGen.get(gen)!.push([Number(m[2]), move]);
    }
  }
  if (byGen.size === 0) return [];
  const latest = Math.max(...byGen.keys());
  return byGen.get(latest)!.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
}

/** Los 4 últimos movimientos aprendidos hasta `level` (como un Pokémon salvaje). */
export function defaultMoves(species: string, level: number): string[] {
  const learned = levelUpMoves(species).filter(([lv]) => lv <= Math.max(1, level));
  const unique: string[] = [];
  for (const [, move] of learned) {
    const i = unique.indexOf(move);
    if (i >= 0) unique.splice(i, 1);
    unique.push(move);
  }
  const moves = unique.slice(-4);
  return moves.length > 0 ? moves : ['tackle'];
}

/** Movimientos nuevos al llegar exactamente a `level`. */
export function movesLearnedAt(species: string, level: number): string[] {
  return levelUpMoves(species)
    .filter(([lv]) => lv === level)
    .map(([, m]) => m);
}

/** Si la especie evoluciona por nivel y ya lo alcanza, devuelve la especie destino. */
export function levelEvolution(species: string, level: number): string | null {
  for (const evo of dex().species.get(species).evos) {
    const target = dex().species.get(evo);
    if (!target.evoType && target.evoLevel && level >= target.evoLevel) return target.name;
  }
  return null;
}

let uidCounter = 0;
export function newUid(): string {
  uidCounter++;
  return `${Date.now().toString(36)}-${uidCounter.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function toMoveStates(moves: string[]): MoveState[] {
  return moves.map((m) => {
    const info = dex().moves.get(m);
    return { id: info.id, pp: info.pp };
  });
}

/** Crea un Pokémon nuevo con PS y PP completos y sus movimientos por nivel. */
export function createMember(species: string, level: number, moves?: string[]): PartyMember {
  const s = dex().species.get(species);
  if (!s.exists) throw new Error(`Especie desconocida: ${species}`);
  return {
    uid: newUid(),
    species: s.name,
    level,
    exp: expForLevel(meta(s.name).growth, level),
    hp: maxHp(s.name, level),
    status: '',
    moves: toMoveStates(moves ?? defaultMoves(s.name, level)),
  };
}

export function maxPp(moveId: string): number {
  return dex().moves.get(moveId).pp;
}

/** Cura PS, estado y PP de todo el equipo (lo que hace el tabernero del pub). */
export function healMember(m: PartyMember): PartyMember {
  return {
    ...m,
    hp: maxHp(m.species, m.level),
    status: '',
    moves: m.moves.map((mv) => ({ ...mv, pp: maxPp(mv.id) })),
  };
}
