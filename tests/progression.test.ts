import { describe, expect, it } from 'vitest';
import { expForLevel, expGain, levelForExp, levelProgress } from '../src/core/experience';
import { captureValue, tryCapture } from '../src/core/capture';
import { createMember, defaultMoves, levelEvolution, maxHp, moveName } from '../src/battle/dex-service';
import { evolve, gainExp, pendingEvolution, replaceMove } from '../src/battle/progression';

describe('Curvas de experiencia', () => {
  it('coinciden con los valores oficiales', () => {
    expect(expForLevel('medium', 10)).toBe(1000);
    expect(expForLevel('fast', 100)).toBe(800000);
    expect(expForLevel('slow', 100)).toBe(1250000);
    expect(expForLevel('medium-slow', 100)).toBe(1059860);
    expect(expForLevel('erratic', 100)).toBe(600000);
    expect(expForLevel('fluctuating', 100)).toBe(1640000);
  });

  it('nivel a partir de experiencia y progreso de la barra', () => {
    expect(levelForExp('medium', 999)).toBe(9);
    expect(levelForExp('medium', 1000)).toBe(10);
    expect(levelProgress('medium', 10, 1000)).toBe(0);
  });

  it('los combates de entrenador dan un 50% más', () => {
    expect(expGain(70, 7, false)).toBe(70);
    expect(expGain(70, 7, true)).toBe(105);
  });
});

describe('Captura', () => {
  it('a menos vida, más fácil', () => {
    expect(captureValue({ maxHp: 30, hp: 1, catchRate: 45 })).toBeGreaterThan(captureValue({ maxHp: 30, hp: 30, catchRate: 45 }));
  });

  it('valor ≥ 255 captura sin tirar dados', () => {
    expect(tryCapture({ maxHp: 10, hp: 1, catchRate: 255, statusBonus: 2 }, () => 0.999)).toEqual({ caught: true, shakes: 3 });
  });

  it('cuenta las sacudidas antes de escapar', () => {
    const rolls = [0, 0, 0.999];
    expect(tryCapture({ maxHp: 30, hp: 30, catchRate: 45 }, () => rolls.shift()!)).toEqual({ caught: false, shakes: 2 });
  });
});

describe('Datos de especies', () => {
  it('PS máximos con la fórmula oficial (IV 31, EV 0)', () => {
    // Growlithe base 55 PS a nivel 50: floor((110+31)*50/100) + 60 = 130
    expect(maxHp('Growlithe', 50)).toBe(130);
  });

  it('movimientos por nivel y nombres en español', () => {
    expect(defaultMoves('Growlithe', 5)).toEqual(['ember', 'howl', 'leer'].sort((a, b) => (a === 'howl' ? 1 : b === 'howl' ? -1 : a.localeCompare(b))));
    expect(moveName('ember')).toBe('Ascuas');
  });

  it('evolución por nivel', () => {
    expect(levelEvolution('Pidove', 20)).toBeNull();
    expect(levelEvolution('Pidove', 21)).toBe('Tranquill');
    expect(levelEvolution('Growlithe', 99)).toBeNull(); // evoluciona con piedra
  });
});

describe('Progresión', () => {
  it('sube de nivel, suma PS y aprende movimientos', () => {
    const m = createMember('Growlithe', 7, ['ember', 'leer']);
    const { member, events } = gainExp(m, 2000);
    expect(member.level).toBeGreaterThan(7);
    expect(events.some((e) => e.kind === 'levelUp')).toBe(true);
    expect(events).toContainEqual({ kind: 'learned', move: 'bite' });
    expect(member.moves.map((x) => x.id)).toContain('bite');
    expect(member.hp).toBe(m.hp + maxHp('Growlithe', member.level) - maxHp('Growlithe', 7));
  });

  it('con 4 movimientos pregunta qué olvidar', () => {
    const m = createMember('Growlithe', 7, ['ember', 'leer', 'howl', 'tackle']);
    const { events } = gainExp(m, 2000);
    expect(events).toContainEqual({ kind: 'wantsToLearn', move: 'bite' });
    const replaced = replaceMove(m, 3, 'bite');
    expect(replaced.moves[3].id).toBe('bite');
  });

  it('un debilitado no gana experiencia', () => {
    const m = { ...createMember('Pidove', 5), hp: 0 };
    expect(gainExp(m, 500).member).toBe(m);
  });

  it('evoluciona al nivel indicado', () => {
    const m = { ...createMember('Pidove', 20) };
    const { member } = gainExp(m, 100000);
    expect(pendingEvolution(member)).toBe('Tranquill');
    expect(evolve(member, 'Tranquill').species).toBe('Tranquill');
  });
});
