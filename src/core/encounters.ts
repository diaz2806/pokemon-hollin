/** Encuentros con Pokémon salvajes. Sin Phaser; el azar se inyecta para poder testear. */

export interface EncounterSlot {
  species: string;
  /** Peso relativo dentro de la tabla. */
  weight: number;
  minLevel: number;
  maxLevel: number;
  /** Opcional: si no se indica, se usan los movimientos que aprende por nivel. */
  moves?: string[];
}

export interface EncounterTable {
  id: string;
  /** Probabilidad de encuentro por paso en una casilla con humo (0-1). */
  rate: number;
  slots: EncounterSlot[];
}

export interface WildEncounter {
  species: string;
  level: number;
  moves?: string[];
}

export type Rng = () => number;

export function rollEncounter(table: EncounterTable, rng: Rng): WildEncounter | null {
  if (rng() >= table.rate) return null;
  const total = table.slots.reduce((sum, s) => sum + s.weight, 0);
  let pick = rng() * total;
  for (const slot of table.slots) {
    pick -= slot.weight;
    if (pick < 0) {
      const span = slot.maxLevel - slot.minLevel + 1;
      const level = slot.minLevel + Math.floor(rng() * span);
      return { species: slot.species, level, moves: slot.moves };
    }
  }
  const last = table.slots[table.slots.length - 1];
  return { species: last.species, level: last.minLevel, moves: last.moves };
}
