/**
 * Pokémon que te sigue (estilo HeartGold/SoulSilver).
 *
 * Regla: cuando el jugador avanza una casilla, el seguidor ocupa la casilla
 * que el jugador acaba de dejar. Si el jugador no se mueve (choca con un muro),
 * el seguidor tampoco.
 */
import { directionBetween, type Direction, type Point } from './grid';

export class Follower {
  private pos: Point;
  private dir: Direction;

  constructor(start: Point, facing: Direction = 'down') {
    this.pos = { ...start };
    this.dir = facing;
  }

  get position(): Point {
    return { ...this.pos };
  }

  get facing(): Direction {
    return this.dir;
  }

  /** Llamar después de que el líder se haya movido de `leaderFrom` a otra casilla. */
  onLeaderMoved(leaderFrom: Point): void {
    const dir = directionBetween(this.pos, leaderFrom);
    if (dir) this.dir = dir;
    this.pos = { ...leaderFrom };
  }

  /** Recoloca al seguidor, por ejemplo al entrar en un mapa nuevo. */
  placeAt(p: Point, facing: Direction = this.dir): void {
    this.pos = { ...p };
    this.dir = facing;
  }
}
