/**
 * Experiencia y niveles. Fórmulas oficiales de las curvas de crecimiento
 * (las mismas desde la 3.ª generación) y de la experiencia ganada (estilo 4.ª gen).
 */

export type GrowthRate = 'fast' | 'medium' | 'medium-slow' | 'slow' | 'erratic' | 'fluctuating';

export const MAX_LEVEL = 100;

/** Experiencia total necesaria para estar en el nivel `n`. */
export function expForLevel(growth: GrowthRate, n: number): number {
  if (n <= 1) return 0;
  const n3 = n ** 3;
  switch (growth) {
    case 'fast':
      return Math.floor((4 * n3) / 5);
    case 'medium':
      return n3;
    case 'medium-slow':
      return Math.max(0, Math.floor((6 / 5) * n3 - 15 * n ** 2 + 100 * n - 140));
    case 'slow':
      return Math.floor((5 * n3) / 4);
    case 'erratic':
      if (n < 50) return Math.floor((n3 * (100 - n)) / 50);
      if (n < 68) return Math.floor((n3 * (150 - n)) / 100);
      if (n < 98) return Math.floor((n3 * Math.floor((1911 - 10 * n) / 3)) / 500);
      return Math.floor((n3 * (160 - n)) / 100);
    case 'fluctuating':
      if (n < 15) return Math.floor((n3 * (Math.floor((n + 1) / 3) + 24)) / 50);
      if (n < 36) return Math.floor((n3 * (n + 14)) / 50);
      return Math.floor((n3 * (Math.floor(n / 2) + 32)) / 50);
  }
}

/** Nivel que corresponde a una cantidad de experiencia total. */
export function levelForExp(growth: GrowthRate, exp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && expForLevel(growth, level + 1) <= exp) level++;
  return level;
}

/**
 * Experiencia ganada al derrotar a un Pokémon.
 * @param baseExp experiencia base de la especie derrotada
 * @param foeLevel nivel del Pokémon derrotado
 * @param trainer true si era de un entrenador o banda (x1,5)
 */
export function expGain(baseExp: number, foeLevel: number, trainer: boolean): number {
  const base = Math.floor((baseExp * foeLevel) / 7);
  return Math.max(1, trainer ? Math.floor(base * 1.5) : base);
}

/** Progreso (0-1) dentro del nivel actual, para la barra de EXP. */
export function levelProgress(growth: GrowthRate, level: number, exp: number): number {
  if (level >= MAX_LEVEL) return 1;
  const lo = expForLevel(growth, level);
  const hi = expForLevel(growth, level + 1);
  return Math.min(1, Math.max(0, (exp - lo) / (hi - lo)));
}
