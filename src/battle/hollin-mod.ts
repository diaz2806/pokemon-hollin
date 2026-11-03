/**
 * Mod "hollin" para el motor de Pokémon Showdown (@pkmn/sim).
 *
 * Hereda todas las reglas y datos oficiales (Gen 9) y añade lo propio de
 * Pokémon Hollín: el estado Tiznado y el movimiento Hollinazo. Aquí irán
 * también el clima Smog, las formas regionales de Ashbury y las especies nuevas.
 */
import { Dex } from '@pkmn/sim';
import type { ActiveMove, Battle, ModdedDex, Pokemon } from '@pkmn/sim';
import { SANDILE_ASHBURY_LEARNSETS, SANDILE_ASHBURY_SPECIES } from './regional/sandile-ashbury';

export const HOLLIN_FORMAT_ID = 'gen9hollin';

/** Probabilidad de que un Pokémon tiznado falle un ataque dirigido al rival. */
export const TIZNADO_MISS_CHANCE = { numerator: 1, denominator: 4 } as const;

/** Tipos inmunes al Tiznado: están acostumbrados al humo. */
export const TIZNADO_IMMUNE_TYPES = ['Fire', 'Poison'];

/** Objetivos de movimiento que cuentan como "dirigidos al rival". */
const FOE_TARGETS = new Set(['normal', 'any', 'adjacentFoe', 'allAdjacentFoes', 'randomNormal']);

const tiznado = {
  name: 'Tiznado',
  effectType: 'Condition',
  // Dura 2-4 turnos (random(2, 5) devuelve 2, 3 o 4).
  durationCallback(this: Battle) {
    return this.random(2, 5);
  },
  onStart(this: Battle, target: Pokemon) {
    if (target.hasType(TIZNADO_IMMUNE_TYPES)) return false;
    this.add('-start', target, 'Tiznado');
  },
  onBeforeMovePriority: 3,
  onBeforeMove(this: Battle, pokemon: Pokemon, _target: Pokemon, move: ActiveMove) {
    if (!FOE_TARGETS.has(move.target)) return;
    if (this.randomChance(TIZNADO_MISS_CHANCE.numerator, TIZNADO_MISS_CHANCE.denominator)) {
      this.add('-activate', pokemon, 'Tiznado');
      this.add('-miss', pokemon);
      return false;
    }
  },
  onEnd(this: Battle, target: Pokemon) {
    this.add('-end', target, 'Tiznado');
  },
};

const hollinazo = {
  num: -1,
  name: 'Hollinazo',
  type: 'Fire',
  category: 'Status',
  accuracy: 90,
  basePower: 0,
  pp: 20,
  priority: 0,
  target: 'normal',
  volatileStatus: 'tiznado',
  flags: { protect: 1, reflectable: 1, mirror: 1 },
  secondary: null,
  desc: 'Envuelve al rival en humo negro: queda Tiznado y puede fallar sus ataques.',
};

/**
 * Movimiento interno e invisible. Se usa en los turnos en los que el jugador no
 * ataca (lanzar una Poké Ball, intentar huir, usar un objeto) para que el rival
 * sí actúe. Prioridad máxima y onTry -> null: no hace nada ni escribe en el log.
 */
export const ACTION_MOVE_ID = 'hollinaccion';
const hollinaccion = {
  num: -2,
  name: 'Hollinaccion',
  type: '???',
  category: 'Status',
  accuracy: true,
  basePower: 0,
  pp: 64,
  noPPBoosts: true,
  priority: 6,
  target: 'self',
  flags: {},
  onTry() {
    return null;
  },
  secondary: null,
};

let cached: ModdedDex | undefined;

/** Registra el mod (una sola vez) y devuelve su Dex. */
export function getHollinDex(): ModdedDex {
  if (!cached) {
    cached = Dex.mod('hollin', {
      Conditions: { tiznado },
      Moves: { hollinazo, hollinaccion },
      // Formas regionales de Ashbury.
      Pokedex: { ...SANDILE_ASHBURY_SPECIES },
      Learnsets: { ...SANDILE_ASHBURY_LEARNSETS },
      FormatsData: Object.fromEntries(Object.keys(SANDILE_ASHBURY_SPECIES).map((id) => [id, { tier: 'Illegal' }])),
      Formats: [{ name: '[Gen 9] Hollin', mod: 'hollin', ruleset: [] }],
    } as unknown as Parameters<typeof Dex.mod>[1]);
  }
  return cached;
}
