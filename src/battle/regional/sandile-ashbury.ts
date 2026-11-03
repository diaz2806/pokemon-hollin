/**
 * Formas regionales de Ashbury: cadena de Sandile. POKÉMON EMBLEMA del juego.
 *
 * En Ashbury no hay desiertos: los Sandile viven en los canales y las
 * alcantarillas, entre aceite, hollín y desechos de las fábricas. Se han vuelto
 * de tipo Veneno/Siniestro y son inmunes al humo (los tipos Veneno no se tiznan).
 * Los Krookodile de Ashbury controlan las cloacas como jefes de banda.
 *
 * Mismo total de stats que la forma original, repartidos de otra manera:
 * más aguante y menos velocidad (son matones de callejón, no cazadores de dunas).
 */

/** Movimientos por nivel (formato de Showdown: "9L<nivel>"). */
const LEVEL_UP: Record<string, number[]> = {
  leer: [1],
  powertrip: [1],
  smog: [3],
  honeclaws: [6],
  poisonfang: [9],
  scaryface: [1],
  emboscada: [12],
  bite: [15],
  hollinazo: [18],
  sludge: [21],
  swagger: [24],
  crunch: [27],
  toxic: [30],
  foulplay: [33],
  gunkshot: [36],
  thrash: [39],
};

function learnset(extra: Record<string, number[]> = {}): Record<string, string[]> {
  const all = { ...LEVEL_UP, ...extra };
  return Object.fromEntries(Object.entries(all).map(([move, levels]) => [move, levels.map((l) => `9L${l}`)]));
}

export const SANDILE_ASHBURY_SPECIES = {
  sandileashbury: {
    num: 551,
    name: 'Sandile-Ashbury',
    baseSpecies: 'Sandile',
    forme: 'Ashbury',
    types: ['Poison', 'Dark'],
    baseStats: { hp: 55, atk: 70, def: 40, spa: 30, spd: 40, spe: 57 },
    abilities: { 0: 'Intimidate', 1: 'Moxie', H: 'Stench' },
    heightm: 0.7,
    weightkg: 16.1,
    color: 'Gray',
    evos: ['Krokorok-Ashbury'],
    eggGroups: ['Field'],
  },
  krokorokashbury: {
    num: 552,
    name: 'Krokorok-Ashbury',
    baseSpecies: 'Krokorok',
    forme: 'Ashbury',
    types: ['Poison', 'Dark'],
    baseStats: { hp: 65, atk: 80, def: 52, spa: 40, spd: 52, spe: 62 },
    abilities: { 0: 'Intimidate', 1: 'Moxie', H: 'Stench' },
    heightm: 1,
    weightkg: 35.2,
    color: 'Gray',
    prevo: 'Sandile-Ashbury',
    evoLevel: 29,
    evos: ['Krookodile-Ashbury'],
    eggGroups: ['Field'],
  },
  krookodileashbury: {
    num: 553,
    name: 'Krookodile-Ashbury',
    baseSpecies: 'Krookodile',
    forme: 'Ashbury',
    types: ['Poison', 'Dark'],
    baseStats: { hp: 100, atk: 115, def: 90, spa: 55, spd: 82, spe: 77 },
    abilities: { 0: 'Intimidate', 1: 'Moxie', H: 'Poison Touch' },
    heightm: 1.6,
    weightkg: 101.5,
    color: 'Gray',
    prevo: 'Krokorok-Ashbury',
    evoLevel: 40,
    eggGroups: ['Field'],
  },
};

export const SANDILE_ASHBURY_LEARNSETS = {
  sandileashbury: { learnset: learnset() },
  krokorokashbury: { learnset: learnset() },
  krookodileashbury: { learnset: learnset({ knockoff: [1], poisonjab: [1], gunkshot: [42], thrash: [48] }) },
};

/** Entradas de la Pokédex (libreta del registro policial). */
export const SANDILE_ASHBURY_DEX = {
  'Sandile-Ashbury': 'Vive en los canales y alcantarillas. Come lo que tiran las fábricas y su piel se ha vuelto inmune al humo.',
  'Krokorok-Ashbury': 'Trabaja para las bandas de los muelles. Roba carteras con la cola sin que su víctima se dé cuenta.',
  'Krookodile-Ashbury': 'Manda en las cloacas como un jefe de banda. Las marcas de su cabeza recuerdan a una gorra de paño.',
};
