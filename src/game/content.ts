/** Registro de contenido: mapas, tablas de encuentros e iniciales. */
import type { MapData } from '../core/tilemap';
import type { EncounterTable } from '../core/encounters';
import mercado from '../../data/maps/mercado.json';
import pub from '../../data/maps/pub.json';
import fabrica from '../../data/maps/fabrica.json';
import mercadoCallejones from '../../data/encounters/mercado-callejones.json';

export const MAPS: Record<string, MapData> = {
  mercado: mercado as MapData,
  pub: pub as MapData,
  fabrica: fabrica as MapData,
};

export const ENCOUNTER_TABLES: Record<string, EncounterTable> = {
  'mercado-callejones': mercadoCallejones as EncounterTable,
};

/** Iniciales: los tres Pokémon enjaulados de la fábrica (nivel y movimientos). */
export const STARTERS: Record<string, { level: number; moves: string[] }> = {
  Growlithe: { level: 5, moves: ['ember', 'leer', 'howl', 'hollinazo'] },
  Sprigatito: { level: 5, moves: ['scratch', 'tailwhip', 'leafage'] },
  Oshawott: { level: 5, moves: ['tackle', 'tailwhip', 'watergun'] },
};
