import { describe, expect, it } from 'vitest';
import { directionBetween, step } from '../src/core/grid';
import { Follower } from '../src/core/follower';
import { TileMap, canWalk, interactionAt, visibleNpcs, type MapData } from '../src/core/tilemap';
import { rollEncounter, type EncounterTable } from '../src/core/encounters';
import { addCaught, anyAble, firstAbleIndex, moveToFront, type PartyMember } from '../src/core/party';
import { loadGame, newGame, saveGame, type KeyValueStorage } from '../src/core/game-state';
import mercadoJson from '../data/maps/mercado.json';
import pubJson from '../data/maps/pub.json';
import fabricaJson from '../data/maps/fabrica.json';
import mercadoTable from '../data/encounters/mercado-callejones.json';
import { MAPS, ENCOUNTER_TABLES } from '../src/game/content';
import { findSpotter, defeatFlag } from '../src/core/trainers';

const mercado = mercadoJson as MapData;
const pub = pubJson as MapData;
const fabrica = fabricaJson as MapData;

describe('grid', () => {
  it('avanza una casilla en cada dirección', () => {
    expect(step({ x: 2, y: 2 }, 'up')).toEqual({ x: 2, y: 1 });
    expect(step({ x: 2, y: 2 }, 'right')).toEqual({ x: 3, y: 2 });
  });

  it('calcula la dirección entre casillas vecinas', () => {
    expect(directionBetween({ x: 0, y: 0 }, { x: 0, y: 1 })).toBe('down');
    expect(directionBetween({ x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull();
  });
});

describe('Follower', () => {
  it('ocupa la casilla que deja el jugador', () => {
    const f = new Follower({ x: 1, y: 1 });
    f.onLeaderMoved({ x: 2, y: 1 });
    expect(f.position).toEqual({ x: 2, y: 1 });
    expect(f.facing).toBe('right');
  });

  it('sigue el mismo camino que el jugador en una esquina', () => {
    const f = new Follower({ x: 0, y: 0 });
    let from = { x: 1, y: 0 };
    for (const next of [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }]) {
      f.onLeaderMoved(from);
      from = next;
    }
    expect(f.position).toEqual({ x: 2, y: 1 });
    expect(f.facing).toBe('down');
  });
});

describe('Mapas', () => {
  it('todos los mapas cargan y sus warps llevan a casillas transitables', () => {
    const maps = MAPS;
    for (const data of Object.values(maps)) {
      const map = new TileMap(data);
      for (const w of data.warps ?? []) {
        expect(maps[w.to], `${data.id} -> ${w.to}`).toBeDefined();
        const dest = new TileMap(maps[w.to]);
        expect(dest.isWalkableTile({ x: w.toX, y: w.toY }), `${data.id} -> ${w.to}`).toBe(true);
        expect(map.warpAt({ x: w.x, y: w.y })).toBe(w);
      }
    }
  });

  it('el Mercado tiene posición inicial, muros y canal', () => {
    const map = new TileMap(mercado);
    expect(map.start).toEqual({ x: 4, y: 7 });
    expect(map.isWalkableTile({ x: 0, y: 0 })).toBe(false);
    expect(map.tileAt({ x: 5, y: 13 })).toBe('water');
    expect(map.tileAt({ x: 15, y: 13 })).toBe('bridge');
    expect(map.isWalkableTile({ x: 15, y: 13 })).toBe(true);
  });

  it('los NPCs bloquean el paso', () => {
    const map = new TileMap(mercado);
    const npcs = visibleNpcs(mercado, {});
    expect(canWalk(map, npcs, { x: 9, y: 7 })).toBe(false);
    expect(canWalk(map, npcs, { x: 8, y: 7 })).toBe(true);
  });

  it('se habla con el tabernero a través del mostrador', () => {
    const map = new TileMap(pub);
    const it = interactionAt(map, visibleNpcs(pub, {}), { x: 5, y: 4 }, 'up');
    expect(it.kind === 'npc' && it.npc.id).toBe('tabernero');
  });

  it('carteles y puertas cerradas', () => {
    const map = new TileMap(mercado);
    expect(interactionAt(map, [], { x: 7, y: 6 }, 'up').kind).toBe('sign');
    expect(interactionAt(map, [], { x: 13, y: 5 }, 'up').kind).toBe('lockedDoor');
  });

  it('las jaulas liberadas desaparecen según los flags', () => {
    expect(visibleNpcs(fabrica, {}).length).toBe(3);
    expect(visibleNpcs(fabrica, { freed_growlithe: true }).map((n) => n.id)).not.toContain('jaula-growlithe');
  });

  it('rechaza mapas mal formados', () => {
    expect(() => new TileMap({ id: 'x', name: 'x', rows: ['##', '#'] })).toThrow();
    expect(() => new TileMap({ id: 'x', name: 'x', rows: ['?'] })).toThrow();
  });
});

describe('rollEncounter', () => {
  const table = mercadoTable as EncounterTable;

  it('no hay encuentro si la tirada supera la probabilidad', () => {
    expect(rollEncounter(table, () => 0.99)).toBeNull();
  });

  it('elige especie según los pesos y un nivel dentro del rango', () => {
    const values = [0, 0, 0.99];
    const enc = rollEncounter(table, () => values.shift()!);
    expect(enc?.species).toBe('Pidove');
    expect(enc?.level).toBe(table.slots[0].maxLevel);
  });

  it('el último slot también puede salir', () => {
    const values = [0, 0.999, 0];
    expect(rollEncounter(table, () => values.shift()!)?.species).toBe(table.slots[table.slots.length - 1].species);
  });
});

const mon = (uid: string, hp: number): PartyMember => ({ uid, species: 'Pidove', level: 5, exp: 0, hp, status: '', moves: [] });

describe('Equipo', () => {
  it('añade al equipo hasta 6 y el resto a la caja', () => {
    const party: PartyMember[] = [];
    const box: PartyMember[] = [];
    for (let i = 0; i < 7; i++) addCaught(party, box, mon(String(i), 10));
    expect(party.length).toBe(6);
    expect(box.map((m) => m.uid)).toEqual(['6']);
  });

  it('detecta quién puede luchar y reordena', () => {
    const party = [mon('a', 0), mon('b', 5)];
    expect(firstAbleIndex(party)).toBe(1);
    expect(anyAble(party)).toBe(true);
    moveToFront(party, 1);
    expect(party[0].uid).toBe('b');
    expect(anyAble([mon('c', 0)])).toBe(false);
  });
});

describe('Guardado', () => {
  const memory = (): KeyValueStorage => {
    const m = new Map<string, string>();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
  };

  it('guarda y carga la partida', () => {
    const storage = memory();
    const state = newGame('Alberto');
    state.party.push(mon('x', 12));
    saveGame(state, storage);
    expect(loadGame(storage)).toEqual(state);
  });

  it('ignora guardados corruptos o de otra versión', () => {
    const storage = memory();
    storage.setItem('pokemon-hollin/save', '{roto');
    expect(loadGame(storage)).toBeNull();
    storage.setItem('pokemon-hollin/save', JSON.stringify({ ...newGame(), version: 999 }));
    expect(loadGame(storage)).toBeNull();
  });
});

describe('Entrenadores', () => {
  const almacen = MAPS.almacen;
  const map = new TileMap(almacen);
  const npcs = visibleNpcs(almacen, {});

  it('un entrenador te ve si estás en su línea de visión', () => {
    const spotted = findSpotter(map, npcs, {}, { x: 6, y: 6 });
    expect(spotted?.npc.id).toBe('gorrion-nell');
    expect(spotted?.path).toEqual([{ x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 }]);
  });

  it('no te ve fuera de su alcance ni si ya le has ganado', () => {
    expect(findSpotter(map, npcs, {}, { x: 8, y: 6 })).toBeNull();
    expect(findSpotter(map, npcs, { [defeatFlag('almacen', 'gorrion-nell')]: true }, { x: 6, y: 6 })).toBeNull();
  });

  it('las paredes y objetos cortan la vista', () => {
    // Sid mira a la izquierda desde (11,3); en (6,3) te ve, pero no a través de las cajas.
    expect(findSpotter(map, npcs, {}, { x: 6, y: 3 })?.npc.id).toBe('gorrion-sid');
  });

  it('todos los equipos de entrenadores y tablas usan especies que existen', async () => {
    const { speciesExists } = await import('../src/battle/dex-service');
    for (const data of Object.values(MAPS)) {
      for (const n of data.npcs ?? []) for (const p of n.trainer?.party ?? []) expect(speciesExists(p.species), `${n.id}: ${p.species}`).toBe(true);
    }
    for (const t of Object.values(ENCOUNTER_TABLES)) for (const s of t.slots) expect(speciesExists(s.species), s.species).toBe(true);
  });
});
