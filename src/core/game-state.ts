/** Estado de la partida. De momento solo el equipo; aquí irán fichas, dinero, flags de historia... */
import type { PokemonSpec } from '../battle/BattleAdapter';

export interface GameState {
  party: PokemonSpec[];
}

/** Inicial provisional mientras no exista la escena del incendio en la fábrica. */
export function newGame(): GameState {
  return {
    party: [{ species: 'Growlithe', level: 7, moves: ['Ember', 'Humareda', 'Bite', 'Leer'] }],
  };
}
