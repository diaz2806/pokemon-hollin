import { describe, expect, it } from 'vitest';
import { TileMap, type MapData } from '../src/core/tilemap';
import { decorate, hashAt } from '../src/core/decor';
import { MAPS } from '../src/game/content';

function map(rows: string[]): TileMap {
  return new TileMap({ id: 't', name: 'Test', rows, warps: [], npcs: [], signs: [] } as unknown as MapData);
}

describe('decoración automática', () => {
  it('es determinista: el mismo mapa da los mismos detalles', () => {
    const m = new TileMap(MAPS.mercado);
    expect(decorate(m)).toEqual(decorate(m));
  });

  it('reparte detalles según el suelo', () => {
    const m = map(Array.from({ length: 30 }, () => '.'.repeat(30)));
    const d = decorate(m);
    expect(d.length).toBeGreaterThan(30);
    expect(d.length).toBeLessThan(300);
    expect(new Set(d.map((x) => x.kind))).toEqual(new Set(['puddle', 'litter', 'crack', 'oilstain']));
  });

  it('no pone nada en casillas bloqueadas ni en suelos sin reglas', () => {
    const m = map(Array.from({ length: 20 }, () => '.'.repeat(20)));
    const blocked = Array.from({ length: 20 }, (_, y) => Array.from({ length: 20 }, (_, x) => ({ x, y }))).flat();
    expect(decorate(m, blocked)).toEqual([]);
    expect(decorate(map(['vv', 'vv']))).toEqual([]);
  });

  it('como mucho un detalle por casilla', () => {
    const d = decorate(new TileMap(MAPS.ruta1));
    const keys = d.map((x) => `${x.x},${x.y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('el hash cambia con la posición', () => {
    expect(hashAt({ x: 1, y: 2 }, 1)).not.toBe(hashAt({ x: 2, y: 1 }, 1));
  });
});
