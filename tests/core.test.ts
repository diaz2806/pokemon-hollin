import { describe, expect, it } from 'vitest';
import { directionBetween, step } from '../src/core/grid';
import { Follower } from '../src/core/follower';
import { TileMap } from '../src/core/tilemap';
import { rollEncounter, type EncounterTable } from '../src/core/encounters';
import mercado from '../data/maps/mercado.json';
import mercadoTable from '../data/encounters/mercado-callejones.json';

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
    const player = { x: 1, y: 0 };
    const f = new Follower({ x: 0, y: 0 });
    const path = [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }];
    let from = player;
    for (const next of path) {
      f.onLeaderMoved(from);
      from = next;
    }
    // El seguidor pasa por (2,0) y gira hacia abajo, igual que el jugador.
    expect(f.position).toEqual({ x: 2, y: 1 });
    expect(f.facing).toBe('down');
  });
});

describe('TileMap', () => {
  const map = new TileMap(mercado);

  it('carga el mapa del Mercado con su posición inicial', () => {
    expect(map.width).toBe(28);
    expect(map.height).toBe(18);
    expect(map.isWalkable(map.start)).toBe(true);
  });

  it('no deja pisar muros, agua ni salir del mapa', () => {
    expect(map.isWalkable({ x: 0, y: 0 })).toBe(false);
    expect(map.tileAt({ x: 12, y: 6 })).toBe('water');
    expect(map.isWalkable({ x: 12, y: 6 })).toBe(false);
    expect(map.isWalkable({ x: -1, y: 5 })).toBe(false);
  });

  it('marca los callejones con humo', () => {
    expect(map.tileAt({ x: 3, y: 8 })).toBe('smoke');
    expect(map.isWalkable({ x: 3, y: 8 })).toBe(true);
  });

  it('rechaza mapas mal formados', () => {
    expect(() => new TileMap({ id: 'x', name: 'x', rows: ['##', '#'] })).toThrow();
    expect(() => new TileMap({ id: 'x', name: 'x', rows: ['..'] })).toThrow(/P/);
  });
});

describe('rollEncounter', () => {
  const table = mercadoTable as EncounterTable;

  it('no hay encuentro si la tirada supera la probabilidad', () => {
    expect(rollEncounter(table, () => 0.99)).toBeNull();
  });

  it('elige especie según los pesos y un nivel dentro del rango', () => {
    const values = [0, 0, 0.99]; // hay encuentro, primer slot, nivel máximo
    const enc = rollEncounter(table, () => values.shift()!);
    expect(enc).toEqual({ species: 'Pidove', level: 5, moves: ['Tackle', 'Growl'] });
  });

  it('el último slot también puede salir', () => {
    const values = [0, 0.999, 0];
    expect(rollEncounter(table, () => values.shift()!)?.species).toBe('Lillipup');
  });
});
