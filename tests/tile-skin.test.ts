import { describe, expect, it } from 'vitest';
import { TileMap, type MapData } from '../src/core/tilemap';
import { cellLook, variantAt } from '../src/core/tile-skin';

function map(rows: string[]): TileMap {
  return new TileMap({ id: 't', name: 'Test', rows, warps: [], npcs: [], signs: [] } as unknown as MapData);
}

describe('tile-skin', () => {
  it('usa el suelo de tileset en suelos conocidos', () => {
    const m = map(['..', ',,']);
    expect(cellLook(m, { x: 0, y: 0 })).toMatchObject({ ground: 'cobble', prop: false });
    expect(cellLook(m, { x: 1, y: 1 })).toMatchObject({ ground: 'smoke', prop: false });
  });

  it('pone los objetos encima del suelo más repetido alrededor', () => {
    const m = map([',.,', ',L,', ',,,']);
    expect(cellLook(m, { x: 1, y: 1 })).toMatchObject({ ground: 'smoke', prop: true });
  });

  it('usa el suelo por defecto del objeto si no hay vecinos de suelo', () => {
    const m = map(['FFF', 'FFF']);
    expect(cellLook(m, { x: 1, y: 0 })).toMatchObject({ ground: 'dirt', prop: true });
  });

  it('distingue la fila superior del tejado y la chimenea', () => {
    const m = map(['RKR', 'RRR', 'EEE']);
    expect(cellLook(m, { x: 0, y: 0 }).ground).toBe('roof_top');
    expect(cellLook(m, { x: 1, y: 0 })).toMatchObject({ ground: 'roof_top', prop: true });
    expect(cellLook(m, { x: 1, y: 1 }).ground).toBe('roof');
    expect(cellLook(m, { x: 0, y: 2 }).ground).toBe('eave');
  });

  it('parte la pared interior en parte alta y zócalo', () => {
    const m = map(['bb', 'bb', 'ww']);
    expect(cellLook(m, { x: 0, y: 0 }).ground).toBe('wall_top');
    expect(cellLook(m, { x: 0, y: 1 }).ground).toBe('wall_low');
  });

  it('deja las fachadas con el arte propio', () => {
    const m = map(['#W#']);
    const look = cellLook(m, { x: 1, y: 0 });
    expect(look.ground).toBeUndefined();
    expect(look.prop).toBe(false);
  });

  it('la variante es estable por posición', () => {
    expect(variantAt({ x: 3, y: 4 })).toBe(variantAt({ x: 3, y: 4 }));
  });
});
