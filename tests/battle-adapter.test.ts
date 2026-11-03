import { describe, expect, it } from 'vitest';
import { BattleAdapter, randomPolicy, type PokemonSpec } from '../src/battle/BattleAdapter';
import { stepsToText } from '../src/battle/log-es';
import { createMember } from '../src/battle/dex-service';

const growlithe: PokemonSpec = { species: 'Growlithe', level: 10, moves: ['hollinazo', 'tackle'] };
const pidove: PokemonSpec = { species: 'Pidove', level: 8, moves: ['tackle'] };
const grimer: PokemonSpec = { species: 'Grimer', level: 8, moves: ['pound'] };

const alwaysFirstMove = () => 1;
const seed: [number, number, number, number] = [1, 2, 3, 4];

describe('BattleAdapter', () => {
  it('expone los dos Pokémon activos con su vida completa al empezar', () => {
    const b = new BattleAdapter([growlithe], [pidove], { seed });
    expect(b.player.species).toBe('Growlithe');
    expect(b.opponent.species).toBe('Pidove');
    expect(b.player.hp).toBe(b.player.maxHp);
    expect(b.ended).toBe(false);
  });

  it('lista los movimientos en español y oculta el movimiento interno', () => {
    const b = new BattleAdapter([growlithe], [pidove], { seed });
    expect(b.moves.map((m) => m.name)).toEqual(['Hollinazo', 'Placaje']);
  });

  it('los PP empiezan en su valor base, sin Más PP', () => {
    const b = new BattleAdapter([growlithe], [pidove], { seed });
    expect(b.moves.map((m) => m.maxPp)).toEqual([20, 35]);
  });

  it('un turno devuelve mensajes en español y cambios de vida', () => {
    const b = new BattleAdapter([growlithe], [pidove], { seed, opponentPolicy: alwaysFirstMove, foeLabel: 'salvaje' });
    const steps = b.fight(2);
    const texts = stepsToText(steps);
    expect(texts).toContain('¡Growlithe usó Placaje!');
    expect(texts).toContain('¡Pidove salvaje usó Placaje!');
    expect(steps.some((s) => s.kind === 'hp' && s.side === 'p2')).toBe(true);
  });

  it('el combate acaba con un ganador', () => {
    const b = new BattleAdapter([growlithe], [pidove], { seed, opponentPolicy: alwaysFirstMove });
    for (let turn = 0; turn < 50 && !b.ended; turn++) b.fight(2);
    expect(b.ended).toBe(true);
    expect(b.winner).not.toBeNull();
  });

  it('no deja jugar turnos después del final', () => {
    const b = new BattleAdapter([growlithe], [pidove], { seed });
    for (let turn = 0; turn < 50 && !b.ended; turn++) b.fight(2);
    expect(() => b.fight(1)).toThrow();
  });
});

describe('Equipo del jugador', () => {
  it('respeta los PS y PP guardados', () => {
    const m = createMember('Growlithe', 10, ['ember', 'tackle']);
    m.hp = 7;
    m.moves[0].pp = 3;
    const b = new BattleAdapter([m], [pidove], { seed });
    expect(b.player.hp).toBe(7);
    expect(b.moves[0].pp).toBe(3);
  });

  it('saca al primer Pokémon sano si el primero está debilitado', () => {
    const fainted = createMember('Pidove', 5);
    fainted.hp = 0;
    const healthy = createMember('Growlithe', 5);
    const b = new BattleAdapter([fainted, healthy], [pidove], { seed });
    expect(b.player.species).toBe('Growlithe');
    expect(b.activeIndex).toBe(1);
  });

  it('pide un cambio cuando el activo se debilita y hay otro', () => {
    const weak = createMember('Pidove', 3, ['growl']);
    weak.hp = 1;
    const strong = createMember('Growlithe', 30);
    const foe: PokemonSpec = { species: 'Rattata', level: 20, moves: ['tackle'] };
    const b = new BattleAdapter([weak, strong], [foe], { seed, opponentPolicy: alwaysFirstMove });
    b.fight(1);
    expect(b.needsSwitch).toBe(true);
    expect(b.switchableIndices()).toEqual([1]);
    const steps = b.switchTo(1);
    expect(steps.some((s) => s.kind === 'switch' && s.side === 'p1')).toBe(true);
    expect(b.player.species).toBe('Growlithe');
    expect(b.needsSwitch).toBe(false);
  });

  it('exporta PS y PP tras el combate en el orden original', () => {
    const a = createMember('Growlithe', 12, ['tackle']);
    const c = createMember('Pidove', 5);
    const b = new BattleAdapter([a, c], [pidove], { seed, opponentPolicy: alwaysFirstMove });
    b.fight(1);
    const out = b.exportParty([a, c]);
    expect(out[0].uid).toBe(a.uid);
    expect(out[0].moves[0].pp).toBe(34);
    expect(out[1]).toEqual(c);
  });
});

describe('Combates de entrenador', () => {
  it('el rival saca su siguiente Pokémon y el combate llega al final', () => {
    const strong = createMember('Growlithe', 40, ['ember']);
    const foes: PokemonSpec[] = [
      { species: 'Patrat', level: 5, moves: ['tackle'] },
      { species: 'Meowth', level: 5, moves: ['scratch'] },
      { species: 'Lillipup', level: 5, moves: ['tackle'] },
    ];
    const b = new BattleAdapter([strong], foes, { seed, opponentPolicy: alwaysFirstMove });
    const seen = new Set<string>();
    for (let turn = 0; turn < 20 && !b.ended; turn++) {
      seen.add(b.opponent.species);
      const steps = b.fight(1);
      for (const s of steps) if (s.kind === 'switch' && s.side === 'p2') seen.add(s.name);
    }
    expect(b.winner).toBe('player');
    expect([...seen].sort()).toEqual(['Lillipup', 'Meowth', 'Patrat']);
  });

  it('si ambos se debilitan a la vez, primero cambia el jugador y luego el rival', () => {
    const a = createMember('Pidove', 3, ['tackle']);
    a.hp = 1;
    const c = createMember('Growlithe', 30, ['ember']);
    const foes: PokemonSpec[] = [
      { species: 'Rattata', level: 20, moves: ['explosion'] },
      { species: 'Patrat', level: 5, moves: ['tackle'] },
    ];
    const b = new BattleAdapter([a, c], foes, { seed, opponentPolicy: alwaysFirstMove });
    b.fight(1);
    expect(b.needsSwitch).toBe(true);
    b.switchTo(1);
    expect(b.player.species).toBe('Growlithe');
    expect(b.opponent.species).toBe('Patrat');
    expect(b.ended).toBe(false);
  });
});

describe('Captura y huida', () => {
  it('captura seguro con PS al mínimo y ratio máximo', () => {
    const b = new BattleAdapter([growlithe], [pidove], { seed });
    const r = b.throwBall(255, () => 0);
    expect(r.caught).toBe(true);
    expect(b.wasCaptured).toBe(true);
    expect(b.ended).toBe(true);
  });

  it('si la captura falla, el rival actúa', () => {
    const b = new BattleAdapter([growlithe], [pidove], { seed, opponentPolicy: alwaysFirstMove, foeLabel: 'salvaje' });
    const r = b.throwBall(3, () => 0.99);
    expect(r.caught).toBe(false);
    expect(stepsToText(r.steps)).toContain('¡Pidove salvaje usó Placaje!');
    expect(b.ended).toBe(false);
  });

  it('huir es seguro si eres más rápido', () => {
    const fast: PokemonSpec = { species: 'Growlithe', level: 50, moves: ['tackle'] };
    const b = new BattleAdapter([fast], [pidove], { seed });
    expect(b.run(() => 0.99).escaped).toBe(true);
    expect(b.hasFled).toBe(true);
  });
});

describe('Estado Tiznado', () => {
  it('Hollinazo tizna al rival', () => {
    const b = new BattleAdapter([growlithe], [pidove], { seed, opponentPolicy: alwaysFirstMove });
    const texts = stepsToText(b.fight(1));
    expect(texts).toContain('¡Pidove rival queda tiznado por el humo!');
    expect(b.opponent.tiznado).toBe(true);
  });

  it('los tipos Veneno son inmunes', () => {
    const b = new BattleAdapter([growlithe], [grimer], { seed, opponentPolicy: alwaysFirstMove });
    b.fight(1);
    expect(b.opponent.tiznado).toBe(false);
  });

  it('se cura solo en 2-4 turnos', () => {
    const tough: PokemonSpec = { species: 'Pidove', level: 60, moves: ['growl'] };
    const b = new BattleAdapter([growlithe], [tough], { seed: [5, 6, 7, 8], opponentPolicy: alwaysFirstMove });
    b.fight(1);
    expect(b.opponent.tiznado).toBe(true);
    let turns = 0;
    while (b.opponent.tiznado && turns < 10) {
      b.fight(2);
      turns++;
    }
    expect(b.opponent.tiznado).toBe(false);
    expect(turns).toBeGreaterThanOrEqual(1);
    expect(turns).toBeLessThanOrEqual(4);
  });

  it('a veces hace fallar los ataques del Pokémon tiznado', () => {
    let misses = 0;
    for (let s = 1; s <= 40; s++) {
      const tough: PokemonSpec = { species: 'Pidove', level: 60, moves: ['tackle'] };
      const b = new BattleAdapter([{ ...growlithe, level: 60 }], [tough], {
        seed: [s, s + 1, s + 2, s + 3],
        opponentPolicy: alwaysFirstMove,
      });
      const all = stepsToText([...b.fight(1), ...b.fight(1), ...b.fight(1)]);
      if (all.includes('¡Pidove rival no ve nada entre el humo!')) misses++;
    }
    expect(misses).toBeGreaterThan(0);
  });
});

describe('randomPolicy', () => {
  it('ignora movimientos sin PP o deshabilitados', () => {
    const policy = randomPolicy(() => 0.99);
    const base = { id: 'x', name: 'x', type: 'Normal', maxPp: 10 };
    const slot = policy([
      { ...base, slot: 1, pp: 0, disabled: false },
      { ...base, slot: 2, pp: 5, disabled: true },
      { ...base, slot: 3, pp: 5, disabled: false },
    ]);
    expect(slot).toBe(3);
  });
});
