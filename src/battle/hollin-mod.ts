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
 * Emboscada: movimiento exclusivo de la cadena de Sandile de Ashbury.
 * Primero ciegas al rival con humo (Hollinazo) y luego golpeas: si el objetivo
 * está Tiznado, la potencia se duplica (70 -> 140).
 */
const emboscada = {
  num: -3,
  name: 'Emboscada',
  type: 'Dark',
  category: 'Physical',
  accuracy: 100,
  basePower: 70,
  basePowerCallback(this: Battle, _pokemon: Pokemon, target: Pokemon, move: ActiveMove) {
    return target.volatiles['tiznado'] ? move.basePower * 2 : move.basePower;
  },
  pp: 15,
  priority: 0,
  target: 'normal',
  flags: { contact: 1, protect: 1, mirror: 1 },
  secondary: null,
  desc: 'Ataque por sorpresa. Si el objetivo está Tiznado, su potencia se duplica.',
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

// ---------- Densidad de humo ----------

/**
 * La mecánica propia de Hollín: el campo de batalla tiene una DENSIDAD DE HUMO de 0 a 3
 * que cambia durante el combate. Cada zona empieza con la suya (la fábrica, a tope).
 *
 * - Sube con los ataques de Fuego y Veneno (+1) y con Hollinazo (+2): el combate se ensucia.
 * - Baja con los movimientos de viento (-1), la lluvia (-1) y Despejar o Niebla Clara (a 0).
 * - Con humo, todo el que no sea Fuego, Veneno o Siniestro pierde precisión (-10 % por nivel).
 * - Los ataques Siniestro ganan +10 % de potencia por nivel: es el terreno de los emboscados.
 * - A nivel 3 (hollín negro), los de Fuego pegan un 20 % más (el aire es inflamable) y,
 *   al final de cada turno, quien no esté acostumbrado al humo puede quedar Tiznado (20 %).
 *
 * Se implementa como un "pseudoWeather" de Showdown (como Gravedad o Espacio Raro) sin
 * duración: está siempre activo y guarda el nivel en su estado.
 */
export const SMOKE_MAX = 3;
/** Tipos que se mueven bien entre el humo: ni pierden precisión ni se tiznan. */
export const SMOKE_NATIVE_TYPES = ['Fire', 'Poison', 'Dark'];
const SMOKE_CLEARERS = new Set(['defog', 'clearsmog']);

interface SmokeState {
  level: number;
}

/** Cambia el nivel y lo anuncia en el log como `|-humo|<nivel>|<causa>`. */
export function setSmoke(battle: Battle, level: number, cause: 'up' | 'down' | 'clear' | 'zone'): void {
  const state = battle.field.pseudoWeather['humo'] as unknown as SmokeState | undefined;
  if (!state) return;
  const next = Math.max(0, Math.min(SMOKE_MAX, level));
  if (next === state.level && cause !== 'zone') return;
  state.level = next;
  battle.add('-humo', String(next), cause);
}

export function smokeLevel(battle: Battle): number {
  const state = battle.field.pseudoWeather['humo'] as unknown as SmokeState | undefined;
  return state?.level ?? 0;
}

const humo = {
  name: 'Humo',
  effectType: 'Condition',
  onFieldStart(this: Battle) {
    (this.effectState as unknown as SmokeState).level = 0;
  },
  onModifyAccuracy(this: Battle, accuracy: number | true, _target: Pokemon, source: Pokemon) {
    const level = smokeLevel(this);
    if (typeof accuracy !== 'number' || level === 0 || source.hasType(SMOKE_NATIVE_TYPES)) return;
    return this.chainModify(1 - 0.1 * level);
  },
  onBasePowerPriority: 6,
  onBasePower(this: Battle, _bp: number, _source: Pokemon, _target: Pokemon, move: ActiveMove) {
    const level = smokeLevel(this);
    if (level === 0) return;
    if (move.type === 'Dark') return this.chainModify(1 + 0.1 * level);
    if (move.type === 'Fire' && level === SMOKE_MAX) return this.chainModify(1.2);
  },
  onAfterMove(this: Battle, _pokemon: Pokemon, _target: Pokemon, move: ActiveMove) {
    const level = smokeLevel(this);
    if (SMOKE_CLEARERS.has(move.id)) setSmoke(this, 0, 'clear');
    else if (move.id === 'hollinazo') setSmoke(this, level + 2, 'up');
    else if (move.type === 'Fire' || move.type === 'Poison') setSmoke(this, level + 1, 'up');
    else if (move.flags['wind'] || move.id === 'raindance') setSmoke(this, level - 1, 'down');
  },
  onFieldResidualOrder: 28,
  onFieldResidual(this: Battle) {
    if (smokeLevel(this) < SMOKE_MAX) return;
    for (const pokemon of this.getAllActive()) {
      if (pokemon.fainted || pokemon.hasType(SMOKE_NATIVE_TYPES) || pokemon.volatiles['tiznado']) continue;
      if (this.randomChance(1, 5)) pokemon.addVolatile('tiznado');
    }
  },
};

let cached: ModdedDex | undefined;

/** Registra el mod (una sola vez) y devuelve su Dex. */
export function getHollinDex(): ModdedDex {
  if (!cached) {
    cached = Dex.mod('hollin', {
      Conditions: { tiznado, humo },
      Moves: { hollinazo, emboscada, hollinaccion },
      // Formas regionales de Ashbury.
      Pokedex: { ...SANDILE_ASHBURY_SPECIES },
      Learnsets: { ...SANDILE_ASHBURY_LEARNSETS },
      FormatsData: Object.fromEntries(Object.keys(SANDILE_ASHBURY_SPECIES).map((id) => [id, { tier: 'Illegal' }])),
      Formats: [{ name: '[Gen 9] Hollin', mod: 'hollin', ruleset: [] }],
    } as unknown as Parameters<typeof Dex.mod>[1]);
  }
  return cached;
}
