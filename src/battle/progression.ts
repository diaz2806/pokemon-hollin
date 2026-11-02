/**
 * Progresión de un Pokémon fuera del motor de combate: experiencia, subidas de
 * nivel, movimientos nuevos y evolución. Usa los datos oficiales vía dex-service.
 */
import type { PartyMember } from '../core/party';
import { levelForExp, MAX_LEVEL } from '../core/experience';
import { levelEvolution, maxHp, maxPp, meta, movesLearnedAt } from './dex-service';

export type ProgressEvent =
  | { kind: 'levelUp'; level: number }
  /** Aprendido directamente (tenía hueco). */
  | { kind: 'learned'; move: string }
  /** Quiere aprenderlo pero ya sabe 4: la escena pregunta cuál olvidar. */
  | { kind: 'wantsToLearn'; move: string };

export interface ExpResult {
  member: PartyMember;
  events: ProgressEvent[];
}

/** Suma experiencia y aplica subidas de nivel. No muta el original. */
export function gainExp(original: PartyMember, amount: number): ExpResult {
  if (original.level >= MAX_LEVEL || original.hp <= 0) return { member: original, events: [] };
  const growth = meta(original.species).growth;
  let member: PartyMember = { ...original, exp: original.exp + amount, moves: original.moves.map((m) => ({ ...m })) };
  const target = Math.min(MAX_LEVEL, levelForExp(growth, member.exp));
  const events: ProgressEvent[] = [];
  while (member.level < target) {
    const oldMax = maxHp(member.species, member.level);
    const level = member.level + 1;
    const newMax = maxHp(member.species, level);
    // Al subir de nivel se suma la diferencia de PS máximos a los PS actuales.
    member = { ...member, level, hp: member.hp + (newMax - oldMax) };
    events.push({ kind: 'levelUp', level });
    for (const move of movesLearnedAt(member.species, level)) {
      if (member.moves.some((m) => m.id === move)) continue;
      if (member.moves.length < 4) {
        member.moves.push({ id: move, pp: maxPp(move) });
        events.push({ kind: 'learned', move });
      } else {
        events.push({ kind: 'wantsToLearn', move });
      }
    }
  }
  return { member, events };
}

/** Sustituye el movimiento `forgetIndex` por `move` con sus PP completos. */
export function replaceMove(member: PartyMember, forgetIndex: number, move: string): PartyMember {
  const moves = member.moves.map((m, i) => (i === forgetIndex ? { id: move, pp: maxPp(move) } : { ...m }));
  return { ...member, moves };
}

/** Si toca evolucionar por nivel, devuelve la especie destino. */
export function pendingEvolution(member: PartyMember): string | null {
  return levelEvolution(member.species, member.level);
}

/** Aplica la evolución manteniendo la proporción de PS. */
export function evolve(member: PartyMember, into: string): PartyMember {
  const oldMax = maxHp(member.species, member.level);
  const newMax = maxHp(into, member.level);
  const hp = member.hp <= 0 ? 0 : Math.max(1, member.hp + (newMax - oldMax));
  return { ...member, species: into, hp };
}
