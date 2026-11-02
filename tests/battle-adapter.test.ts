import { describe, expect, it } from 'vitest';
import { BattleAdapter, randomPolicy, type PokemonSpec } from '../src/battle/BattleAdapter';

const growlithe: PokemonSpec = { species: 'Growlithe', level: 10, moves: ['Humareda', 'Tackle'] };
const pidove: PokemonSpec = { species: 'Pidove', level: 8, moves: ['Tackle'] };
const grimer: PokemonSpec = { species: 'Grimer', level: 8, moves: ['Pound'] };

const alwaysFirstMove = () => 1;

describe('BattleAdapter', () => {
  it('expone los dos Pokémon activos con su vida completa al empezar', () => {
    const b = new BattleAdapter([growlithe], [pidove], { seed: [1, 2, 3, 4] });
    expect(b.player.species).toBe('Growlithe');
    expect(b.opponent.species).toBe('Pidove');
    expect(b.player.hp).toBe(b.player.maxHp);
    expect(b.ended).toBe(false);
  });

  it('lista los movimientos del jugador, incluido Humareda del mod', () => {
    const b = new BattleAdapter([growlithe], [pidove], { seed: [1, 2, 3, 4] });
    expect(b.moves.map((m) => m.name)).toEqual(['Humareda', 'Tackle']);
    expect(b.moves[0].type).toBe('Fire');
  });

  it('los PP empiezan en su valor base, sin Más PP', () => {
    const b = new BattleAdapter([growlithe], [pidove], { seed: [1, 2, 3, 4] });
    expect(b.moves.map((m) => m.maxPp)).toEqual([20, 35]);
  });

  it('un turno devuelve mensajes en español', () => {
    const b = new BattleAdapter([growlithe], [pidove], {
      seed: [1, 2, 3, 4],
      opponentPolicy: alwaysFirstMove,
    });
    const messages = b.playTurn(2);
    expect(messages).toContain('¡Growlithe usó Tackle!');
    expect(messages).toContain('¡Pidove rival usó Tackle!');
  });

  it('el combate acaba con un ganador', () => {
    const b = new BattleAdapter([growlithe], [pidove], {
      seed: [1, 2, 3, 4],
      opponentPolicy: alwaysFirstMove,
    });
    for (let turn = 0; turn < 50 && !b.ended; turn++) b.playTurn(2);
    expect(b.ended).toBe(true);
    expect(b.winner).not.toBeNull();
  });

  it('no deja jugar turnos después del final', () => {
    const b = new BattleAdapter([growlithe], [pidove], { seed: [1, 2, 3, 4] });
    for (let turn = 0; turn < 50 && !b.ended; turn++) b.playTurn(2);
    expect(() => b.playTurn(1)).toThrow();
  });
});

describe('Estado Tiznado', () => {
  it('Humareda tizna al rival', () => {
    const b = new BattleAdapter([growlithe], [pidove], {
      seed: [1, 2, 3, 4],
      opponentPolicy: alwaysFirstMove,
    });
    const messages = b.playTurn(1);
    expect(messages).toContain('¡Pidove rival queda tiznado por el humo!');
    expect(b.opponent.tiznado).toBe(true);
  });

  it('los tipos Veneno son inmunes', () => {
    const b = new BattleAdapter([growlithe], [grimer], {
      seed: [1, 2, 3, 4],
      opponentPolicy: alwaysFirstMove,
    });
    b.playTurn(1);
    expect(b.opponent.tiznado).toBe(false);
  });

  it('se cura solo en 2-4 turnos', () => {
    // Pidove a nivel alto para que aguante varios turnos sin debilitarse.
    const tough: PokemonSpec = { species: 'Pidove', level: 60, moves: ['Growl'] };
    const b = new BattleAdapter([growlithe], [tough], {
      seed: [5, 6, 7, 8],
      opponentPolicy: alwaysFirstMove,
    });
    b.playTurn(1);
    expect(b.opponent.tiznado).toBe(true);
    let turns = 0;
    while (b.opponent.tiznado && turns < 10) {
      b.playTurn(2);
      turns++;
    }
    expect(b.opponent.tiznado).toBe(false);
    expect(turns).toBeGreaterThanOrEqual(1);
    expect(turns).toBeLessThanOrEqual(4);
  });

  it('a veces hace fallar los ataques del Pokémon tiznado', () => {
    let misses = 0;
    for (let s = 1; s <= 40; s++) {
      const tough: PokemonSpec = { species: 'Pidove', level: 60, moves: ['Tackle'] };
      const b = new BattleAdapter([{ ...growlithe, level: 60 }], [tough], {
        seed: [s, s + 1, s + 2, s + 3],
        opponentPolicy: alwaysFirstMove,
      });
      const all = [...b.playTurn(1), ...b.playTurn(1), ...b.playTurn(1)];
      if (all.includes('¡Pidove rival no ve nada entre el humo!')) misses++;
    }
    expect(misses).toBeGreaterThan(0);
  });
});

describe('randomPolicy', () => {
  it('ignora movimientos sin PP o deshabilitados', () => {
    const policy = randomPolicy(() => 0.99);
    const slot = policy([
      { slot: 1, name: 'A', type: 'Normal', pp: 0, maxPp: 10, disabled: false },
      { slot: 2, name: 'B', type: 'Normal', pp: 5, maxPp: 10, disabled: true },
      { slot: 3, name: 'C', type: 'Normal', pp: 5, maxPp: 10, disabled: false },
    ]);
    expect(slot).toBe(3);
  });
});
