/**
 * Adaptador entre el juego y el motor de combate de Showdown.
 *
 * Es la ÚNICA pieza del proyecto que conoce @pkmn/sim. El resto del juego
 * (escenas, UI) habla con esta clase usando tipos propios y sencillos.
 */
import { Battle, toID } from '@pkmn/sim';
import { getHollinDex, HOLLIN_FORMAT_ID } from './hollin-mod';
import { publicLines, toSpanishMessages, type FoeLabel } from './log-es';

/** Definición mínima de un Pokémon para entrar en combate. */
export interface PokemonSpec {
  species: string;
  level: number;
  moves: string[];
  ability?: string;
  nickname?: string;
}

export interface BattlerView {
  name: string;
  species: string;
  level: number;
  hp: number;
  maxHp: number;
  fainted: boolean;
  tiznado: boolean;
}

export interface MoveOption {
  /** Posición 1-4, tal como la espera Showdown ("move 1"). */
  slot: number;
  name: string;
  type: string;
  pp: number;
  maxPp: number;
  disabled: boolean;
}

export type Winner = 'player' | 'opponent' | null;

/** Elige el movimiento del rival a partir de las opciones disponibles. */
export type OpponentPolicy = (options: MoveOption[]) => number;

export const randomPolicy =
  (rng: () => number = Math.random): OpponentPolicy =>
  (options) => {
    const usable = options.filter((o) => !o.disabled && o.pp > 0);
    if (usable.length === 0) return 1; // Showdown usará Forcejeo
    return usable[Math.floor(rng() * usable.length)].slot;
  };

export interface BattleOptions {
  /** Semilla para que el combate sea reproducible (tests, repeticiones). */
  seed?: [number, number, number, number];
  opponentPolicy?: OpponentPolicy;
  /** 'salvaje' para encuentros, 'rival' (por defecto) para entrenadores y bandas. */
  foeLabel?: FoeLabel;
}

function toSet(spec: PokemonSpec) {
  return {
    name: spec.nickname ?? spec.species,
    species: spec.species,
    level: spec.level,
    moves: spec.moves,
    ability: spec.ability ?? '',
    item: '',
    nature: 'Hardy',
    gender: '',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  };
}

export class BattleAdapter {
  private readonly battle: Battle;
  private readonly policy: OpponentPolicy;
  private readonly foeLabel: FoeLabel;
  private logCursor = 0;

  constructor(player: PokemonSpec[], opponent: PokemonSpec[], options: BattleOptions = {}) {
    const dex = getHollinDex();
    this.battle = new Battle(
      {
        formatid: toID(HOLLIN_FORMAT_ID),
        seed: options.seed ? (options.seed.join(',') as `${number},${string}`) : undefined,
      },
      dex,
    );
    this.battle.setPlayer('p1', { name: 'Jugador', team: player.map(toSet) as never });
    this.battle.setPlayer('p2', { name: 'Rival', team: opponent.map(toSet) as never });
    this.resetPPUps();
    this.policy = options.opponentPolicy ?? randomPolicy();
    this.foeLabel = options.foeLabel ?? 'rival';
    this.logCursor = this.battle.log.length;
  }

  get player(): BattlerView {
    return this.view('p1');
  }

  get opponent(): BattlerView {
    return this.view('p2');
  }

  get ended(): boolean {
    return this.battle.ended;
  }

  get winner(): Winner {
    if (!this.battle.ended) return null;
    if (this.battle.winner === 'Jugador') return 'player';
    if (this.battle.winner === 'Rival') return 'opponent';
    return null;
  }

  /** Movimientos del Pokémon activo del jugador. */
  get moves(): MoveOption[] {
    return this.movesOf('p1');
  }

  /**
   * Ejecuta un turno: el jugador usa el movimiento `slot` (1-4) y el rival
   * elige según su política. Devuelve los mensajes del turno en español.
   */
  playTurn(slot: number): string[] {
    if (this.battle.ended) throw new Error('El combate ya ha terminado');
    const opponentSlot = this.policy(this.movesOf('p2'));
    this.battle.choose('p1', `move ${slot}`);
    this.battle.choose('p2', `move ${opponentSlot}`);
    return this.flushMessages();
  }

  /**
   * Showdown da por hecho que cada movimiento lleva 3 Más PP (pensado para combates
   * competitivos). En la aventura los PP empiezan en su valor base.
   */
  private resetPPUps(): void {
    for (const side of [this.battle.p1, this.battle.p2]) {
      for (const mon of side.pokemon) {
        for (const slots of [mon.moveSlots, mon.baseMoveSlots]) {
          for (const ms of slots) {
            const base = this.battle.dex.moves.get(ms.id).pp;
            ms.pp = base;
            ms.maxpp = base;
          }
        }
      }
    }
  }

  /** Líneas nuevas del protocolo desde la última llamada (útil para depurar). */
  private flushRaw(): string[] {
    const fresh = this.battle.log.slice(this.logCursor);
    this.logCursor = this.battle.log.length;
    return publicLines(fresh);
  }

  private flushMessages(): string[] {
    return toSpanishMessages(this.flushRaw(), this.foeLabel);
  }

  private view(sideId: 'p1' | 'p2'): BattlerView {
    const side = sideId === 'p1' ? this.battle.p1 : this.battle.p2;
    const mon = side.active[0];
    return {
      name: mon.name,
      species: mon.species.name,
      level: mon.level,
      hp: mon.hp,
      maxHp: mon.maxhp,
      fainted: mon.fainted,
      tiznado: 'tiznado' in mon.volatiles,
    };
  }

  private movesOf(sideId: 'p1' | 'p2'): MoveOption[] {
    const side = sideId === 'p1' ? this.battle.p1 : this.battle.p2;
    const mon = side.active[0];
    return mon.moveSlots.map((ms, i) => ({
      slot: i + 1,
      name: ms.move,
      type: this.battle.dex.moves.get(ms.id).type,
      pp: ms.pp,
      maxPp: ms.maxpp,
      disabled: Boolean(ms.disabled),
    }));
  }
}
