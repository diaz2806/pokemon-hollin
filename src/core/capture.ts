/**
 * Captura con Poké Ball. Fórmula de la 3.ª/4.ª generación:
 *
 *   a = ((3·PSmáx − 2·PSactual) · ratio · bonusBall) / (3·PSmáx) · bonusEstado
 *
 * Si a ≥ 255 se captura seguro. Si no, se hacen 4 comprobaciones de "sacudida":
 * cada una pasa si un número aleatorio de 0-65535 es menor que
 * b = 1048560 / sqrt(sqrt(16711680 / a)). Hacen falta las 4.
 */

export type Rng = () => number;

export interface CaptureInput {
  maxHp: number;
  hp: number;
  catchRate: number;
  ballBonus?: number;
  /** 2 si está dormido o congelado, 1,5 si está paralizado, quemado o envenenado. */
  statusBonus?: number;
}

export interface CaptureResult {
  caught: boolean;
  /** Sacudidas de la ball antes de abrirse (0-3). Si se captura, 3. */
  shakes: number;
}

export function captureValue({ maxHp, hp, catchRate, ballBonus = 1, statusBonus = 1 }: CaptureInput): number {
  return Math.floor((((3 * maxHp - 2 * hp) * catchRate * ballBonus) / (3 * maxHp)) * statusBonus);
}

export function tryCapture(input: CaptureInput, rng: Rng): CaptureResult {
  const a = captureValue(input);
  if (a >= 255) return { caught: true, shakes: 3 };
  if (a <= 0) return { caught: false, shakes: 0 };
  const b = 1048560 / Math.sqrt(Math.sqrt(16711680 / a));
  let shakes = 0;
  for (let i = 0; i < 4; i++) {
    if (Math.floor(rng() * 65536) >= b) return { caught: false, shakes: Math.min(shakes, 3) };
    shakes++;
  }
  return { caught: true, shakes: 3 };
}

/** Bonus por estado alterado, con los nombres de estado de Showdown. */
export function statusBonus(status: string): number {
  if (status === 'slp' || status === 'frz') return 2;
  if (status === 'par' || status === 'brn' || status === 'psn' || status === 'tox') return 1.5;
  return 1;
}
