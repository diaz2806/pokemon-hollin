/** Equipo del jugador y caja del PC. Lógica pura: sin Phaser ni Showdown. */

export interface MoveState {
  /** id de Showdown, p. ej. "ember". */
  id: string;
  pp: number;
}

export interface PartyMember {
  uid: string;
  species: string;
  nickname?: string;
  level: number;
  exp: number;
  /** PS actuales. */
  hp: number;
  /** Estado alterado con el código de Showdown ('' si ninguno). */
  status: string;
  moves: MoveState[];
}

export const PARTY_SIZE = 6;

export function displayName(m: PartyMember): string {
  return m.nickname ?? m.species;
}

export function isAble(m: PartyMember): boolean {
  return m.hp > 0;
}

export function firstAbleIndex(party: PartyMember[]): number {
  return party.findIndex(isAble);
}

export function anyAble(party: PartyMember[]): boolean {
  return party.some(isAble);
}

/** Añade un Pokémon capturado: al equipo si hay hueco, si no a la caja. */
export function addCaught(party: PartyMember[], box: PartyMember[], m: PartyMember): 'party' | 'box' {
  if (party.length < PARTY_SIZE) {
    party.push(m);
    return 'party';
  }
  box.push(m);
  return 'box';
}

/** Mueve un Pokémon al primer puesto (es el que sale a combatir y el que te sigue). */
export function moveToFront(party: PartyMember[], index: number): void {
  if (index <= 0 || index >= party.length) return;
  const [m] = party.splice(index, 1);
  party.unshift(m);
}

export function swap(party: PartyMember[], a: number, b: number): void {
  if (a === b || !party[a] || !party[b]) return;
  [party[a], party[b]] = [party[b], party[a]];
}
