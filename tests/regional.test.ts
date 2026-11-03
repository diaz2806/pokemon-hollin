import { describe, expect, it } from 'vitest';
import { BattleAdapter } from '../src/battle/BattleAdapter';
import { createMember, defaultMoves, levelEvolution, moveName, speciesTypes } from '../src/battle/dex-service';
import { stepsToText } from '../src/battle/log-es';
import { speciesLabel } from '../src/core/party';
import { getHollinDex } from '../src/battle/hollin-mod';
import mercadoTable from '../data/encounters/mercado-callejones.json';
import moveNamesEs from '../data/move-names-es.json';

describe('Sandile de Ashbury', () => {
  it('existe con tipo Veneno/Siniestro y evoluciona a los mismos niveles', () => {
    expect(speciesTypes('Sandile-Ashbury')).toEqual(['Poison', 'Dark']);
    expect(levelEvolution('Sandile-Ashbury', 28)).toBeNull();
    expect(levelEvolution('Sandile-Ashbury', 29)).toBe('Krokorok-Ashbury');
    expect(levelEvolution('Krokorok-Ashbury', 40)).toBe('Krookodile-Ashbury');
  });

  it('mantiene el total de stats de la forma original', () => {
    const dex = getHollinDex();
    const total = (s: string) => Object.values(dex.species.get(s).baseStats).reduce((a, b) => a + b, 0);
    for (const s of ['Sandile', 'Krokorok', 'Krookodile']) expect(total(`${s}-Ashbury`)).toBe(total(s));
  });

  it('aprende movimientos de Veneno y el Hollinazo', () => {
    expect(defaultMoves('Sandile-Ashbury', 21)).toContain('hollinazo');
    expect(defaultMoves('Sandile-Ashbury', 21)).toContain('sludge');
  });

  it('es inmune al Tiznado por ser de tipo Veneno', () => {
    const b = new BattleAdapter(
      [{ species: 'Growlithe', level: 20, moves: ['hollinazo'] }],
      [{ species: 'Sandile-Ashbury', level: 20, moves: ['leer'] }],
      { seed: [1, 2, 3, 4], opponentPolicy: () => 1 },
    );
    b.fight(1);
    expect(b.opponent.tiznado).toBe(false);
  });

  it('en pantalla se llama como la especie base', () => {
    expect(speciesLabel('Krookodile-Ashbury')).toBe('Krookodile');
    const m = createMember('Sandile-Ashbury', 5);
    const b = new BattleAdapter([m], [{ species: 'Pidove', level: 3, moves: ['growl'] }], { seed: [1, 2, 3, 4], opponentPolicy: () => 1 });
    expect(stepsToText(b.fight(1))[0]).toMatch(/^¡Sandile usó /);
  });
});

describe('Datos de todas las generaciones', () => {
  it('todos los movimientos oficiales tienen nombre en español', () => {
    const dex = getHollinDex();
    const names = moveNamesEs as Record<string, string>;
    const missing = dex.moves
      .all()
      .filter((m) => m.exists && !m.isNonstandard && m.id !== 'hollinaccion')
      .filter((m) => !names[m.id]);
    expect(missing.map((m) => m.id)).toEqual([]);
    expect(moveName('gunkshot')).toBe('Lanzamugre');
  });

  it('el Mercado tiene Pokémon de las 9 generaciones y todos existen', () => {
    const dex = getHollinDex();
    const gens = new Set<number>();
    for (const slot of mercadoTable.slots) {
      const s = dex.species.get(slot.species);
      expect(s.exists, slot.species).toBe(true);
      gens.add(s.gen);
    }
    expect([...gens].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});
