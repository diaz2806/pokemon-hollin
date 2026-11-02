/**
 * Genera data/species-meta.json con los datos que Showdown no trae:
 * ratio de captura, experiencia base y curva de crecimiento.
 *
 * Fuente: CSVs de PokeAPI (https://github.com/PokeAPI/pokeapi, licencia BSD-3).
 * Uso: node scripts/build-species-meta.mjs
 */
import { writeFileSync } from 'node:fs';

const BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv';
const GROWTH = { 1: 'slow', 2: 'medium', 3: 'fast', 4: 'medium-slow', 5: 'erratic', 6: 'fluctuating' };

async function csv(name) {
  const res = await fetch(`${BASE}/${name}.csv`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const [header, ...rows] = (await res.text()).trim().split('\n');
  const cols = header.split(',');
  return rows.map((r) => Object.fromEntries(r.split(',').map((v, i) => [cols[i], v])));
}

const toId = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const species = await csv('pokemon_species');
const pokemon = await csv('pokemon');
const baseExp = new Map(pokemon.filter((p) => p.is_default === '1').map((p) => [p.species_id, Number(p.base_experience) || 50]));

const out = {};
for (const s of species) {
  out[toId(s.identifier)] = {
    num: Number(s.id),
    catchRate: Number(s.capture_rate),
    baseExp: baseExp.get(s.id) ?? 50,
    growth: GROWTH[s.growth_rate_id] ?? 'medium',
  };
}
writeFileSync(new URL('../data/species-meta.json', import.meta.url), JSON.stringify(out) + '\n');
console.log(`species-meta.json: ${Object.keys(out).length} especies`);
