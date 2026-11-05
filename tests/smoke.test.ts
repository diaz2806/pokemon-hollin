import { describe, expect, it } from 'vitest';
import { BattleAdapter, type PokemonSpec } from '../src/battle/BattleAdapter';

const seed: [number, number, number, number] = [5, 6, 7, 8];
const first = () => 1;
const wall: PokemonSpec = { species: 'Wailord', level: 60, moves: ['splash'] };

function hpLost(b: BattleAdapter): number {
  return b.opponent.maxHp - b.opponent.hp;
}

describe('Densidad de humo', () => {
  it('empieza con el nivel de la zona (0 por defecto)', () => {
    expect(new BattleAdapter([wall], [wall], { seed }).smoke).toBe(0);
    expect(new BattleAdapter([wall], [wall], { seed, smoke: 2 }).smoke).toBe(2);
    expect(new BattleAdapter([wall], [wall], { seed, smoke: 9 }).smoke).toBe(3);
  });

  it('los ataques de Fuego espesan el humo y se anuncia en español', () => {
    const b = new BattleAdapter([{ species: 'Growlithe', level: 20, moves: ['ember'] }], [wall], {
      seed,
      opponentPolicy: first,
    });
    const steps = b.fight(1);
    expect(b.smoke).toBe(1);
    expect(steps).toContainEqual({ kind: 'smoke', level: 1 });
    expect(steps.some((s) => s.kind === 'text' && s.text.includes('humo se espesa'))).toBe(true);
  });

  it('Hollinazo suma dos niveles', () => {
    const b = new BattleAdapter([{ species: 'Growlithe', level: 20, moves: ['hollinazo'] }], [wall], {
      seed,
      opponentPolicy: first,
    });
    b.fight(1);
    expect(b.smoke).toBe(2);
  });

  it('el viento lo aclara y Despejar lo limpia del todo', () => {
    const gust = new BattleAdapter([{ species: 'Pidgey', level: 20, moves: ['gust'] }], [wall], {
      seed,
      smoke: 3,
      opponentPolicy: first,
    });
    gust.fight(1);
    expect(gust.smoke).toBe(2);

    const defog = new BattleAdapter([{ species: 'Pidgey', level: 20, moves: ['defog'] }], [wall], {
      seed,
      smoke: 3,
      opponentPolicy: first,
    });
    defog.fight(1);
    expect(defog.smoke).toBe(0);
  });

  it('los ataques Siniestro pegan más fuerte entre el humo', () => {
    const attacker: PokemonSpec = { species: 'Sandile-Ashbury', level: 30, moves: ['bite'] };
    const clear = new BattleAdapter([attacker], [wall], { seed, opponentPolicy: first });
    const smoky = new BattleAdapter([attacker], [wall], { seed, smoke: 3, opponentPolicy: first });
    clear.fight(1);
    smoky.fight(1);
    expect(hpLost(smoky)).toBeGreaterThan(hpLost(clear));
  });
});
