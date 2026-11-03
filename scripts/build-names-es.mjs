/**
 * Genera data/move-names-es.json y data/ability-names-es.json con los nombres
 * oficiales en español de TODOS los movimientos y habilidades.
 *
 * Fuente: CSVs de PokeAPI (https://github.com/PokeAPI/pokeapi, licencia BSD-3).
 * Uso: node scripts/build-names-es.mjs
 */
import { writeFileSync } from 'node:fs';

const BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv';
const SPANISH = '7';
const toId = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

async function csv(name) {
  const res = await fetch(`${BASE}/${name}.csv`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const [header, ...rows] = (await res.text()).trim().split('\n');
  const cols = header.split(',');
  // Los nombres no llevan comas, salvo casos raros entre comillas: los unimos.
  return rows.map((r) => {
    const parts = r.split(',');
    const fixed = [...parts.slice(0, cols.length - 1), parts.slice(cols.length - 1).join(',').replace(/^"|"$/g, '')];
    return Object.fromEntries(fixed.map((v, i) => [cols[i], v]));
  });
}

async function build(entity, table, file, extra = {}) {
  const items = await csv(table);
  const names = await csv(`${entity}_names`);
  const idToKey = new Map(items.map((m) => [m.id, toId(m.identifier)]));
  const out = { ...extra };
  for (const n of names) {
    if (n[`local_language_id`] !== SPANISH) continue;
    const key = idToKey.get(n[`${entity}_id`]);
    if (key) out[key] = n.name.trim();
  }
  writeFileSync(new URL(`../data/${file}`, import.meta.url), JSON.stringify(out, Object.keys(out).sort(), 0) + '\n');
  console.log(`${file}: ${Object.keys(out).length} nombres`);
}

// Movimientos propios del mod (no existen en PokeAPI).
await build('move', 'moves', 'move-names-es.json', { hollinazo: 'Hollinazo', visegrip: 'Agarre' });
await build('ability', 'abilities', 'ability-names-es.json');
