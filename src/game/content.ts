/** Registro de contenido: mapas, tablas de encuentros e iniciales. */
import type { MapData } from '../core/tilemap';
import type { EncounterTable } from '../core/encounters';
import mercado from '../../data/maps/mercado.json';
import pub from '../../data/maps/pub.json';
import fabrica from '../../data/maps/fabrica.json';
import almacen from '../../data/maps/almacen.json';
import ruta1 from '../../data/maps/ruta1.json';
import mercadoCallejones from '../../data/encounters/mercado-callejones.json';
import ruta1Escoria from '../../data/encounters/ruta1-escoria.json';

export const MAPS: Record<string, MapData> = {
  mercado: mercado as MapData,
  pub: pub as MapData,
  fabrica: fabrica as MapData,
  almacen: almacen as MapData,
  ruta1: ruta1 as MapData,
};

export const ENCOUNTER_TABLES: Record<string, EncounterTable> = {
  'mercado-callejones': mercadoCallejones as EncounterTable,
  'ruta1-escoria': ruta1Escoria as EncounterTable,
};

/** Iniciales: los tres Pokémon enjaulados de la fábrica (nivel y movimientos). */
export const STARTERS: Record<string, { level: number; moves: string[] }> = {
  Growlithe: { level: 5, moves: ['ember', 'leer', 'howl', 'hollinazo'] },
  Sprigatito: { level: 5, moves: ['scratch', 'tailwhip', 'leafage'] },
  Oshawott: { level: 5, moves: ['tackle', 'tailwhip', 'watergun'] },
};

/** Las ocho fichas de banda (equivalen a las medallas). */
export const FICHAS: { flag: string; name: string; gang: string }[] = [
  { flag: 'ficha_mercado', name: 'Ficha del Mercado', gang: 'Los Gorriones' },
  { flag: 'ficha_muelles', name: 'Ficha de los Muelles', gang: '???' },
  { flag: 'ficha_hipodromo', name: 'Ficha del Hipódromo', gang: '???' },
  { flag: 'ficha_fundicion', name: 'Ficha de la Fundición', gang: '???' },
  { flag: 'ficha_minas', name: 'Ficha de las Minas', gang: '???' },
  { flag: 'ficha_cabarets', name: 'Ficha de los Cabarets', gang: '???' },
  { flag: 'ficha_central', name: 'Ficha de la Central', gang: '???' },
  { flag: 'ficha_westend', name: 'Ficha del West End', gang: '???' },
];

/** Precios de la tienda (en chelines). */
export const SHOP: { item: 'pokeball' | 'potion'; name: string; price: number }[] = [
  { item: 'pokeball', name: 'POKé BALL', price: 200 },
  { item: 'potion', name: 'POCIÓN', price: 300 },
];
