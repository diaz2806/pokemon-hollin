/**
 * Adaptador entre el juego y el motor de combate de Showdown.
 *
 * Es la ÚNICA pieza (junto con dex-service) que conoce @pkmn/sim. Recibe el
 * equipo del jugador tal como lo guarda el juego (PartyMember, con sus PS y PP
 * actuales), monta el combate y devuelve pasos ya traducidos para la escena.
 */
import { Battle, toID } from '@pkmn/sim';
import { ACTION_MOVE_ID, getHollinDex, HOLLIN_FORMAT_ID } from './hollin-mod';
import { StepTranslator, visibleLines, type BattleStep, type FoeLabel } from './log-es';
import { moveName, toId } from './dex-service';
import { speciesLabel, type PartyMember } from '../core/party';
import { tryCapture, statusBonus, type CaptureResult, type Rng } from '../core/capture';

/** Definición mínima de un Pokémon rival. */
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
  status: string;
  fainted: boolean;
  tiznado: boolean;
}

export interface MoveOption {
  /** Posición 1-4, tal como la espera Showdown ("move 1"). */
  slot: number;
  id: string;
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

export interface CaptureOutcome extends CaptureResult {
  /** Pasos del turno del rival si la captura falla. */
  steps: BattleStep[];
}

const EMPTY_STATS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
const MAX_IVS = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

function specToSet(spec: PokemonSpec) {
  return {
    name: spec.nickname ?? speciesLabel(spec.species),
    species: spec.species,
    level: spec.level,
    moves: [...spec.moves, ACTION_MOVE_ID],
    ability: spec.ability ?? '',
    item: '',
    nature: 'Hardy',
    gender: '',
    evs: EMPTY_STATS,
    ivs: MAX_IVS,
  };
}

function memberToSpec(m: PartyMember): PokemonSpec {
  return { species: m.species, level: m.level, moves: m.moves.map((mv) => mv.id), nickname: m.nickname };
}

/** Acepta tanto el equipo del jugador (PartyMember) como especificaciones simples. */
type Combatant = PartyMember | PokemonSpec;
const isMember = (c: Combatant): c is PartyMember => 'uid' in c;

export class BattleAdapter {
  private readonly battle: Battle;
  private readonly policy: OpponentPolicy;
  private readonly translator: StepTranslator;
  private logCursor = 0;
  private escapeAttempts = 0;
  private captured = false;
  private fled = false;
  /** Índices (en el equipo del jugador) de los Pokémon que han salido a combatir. */
  readonly participants = new Set<number>();

  constructor(
    player: Combatant[],
    opponent: Combatant[],
    options: BattleOptions = {},
  ) {
    if (player.length === 0) throw new Error('El jugador necesita al menos un Pokémon');
    const dex = getHollinDex();
    this.battle = new Battle(
      {
        formatid: toID(HOLLIN_FORMAT_ID),
        seed: options.seed ? (options.seed.join(',') as `${number},${string}`) : undefined,
      },
      dex,
    );
    // Showdown saca al primero de la lista: ordenamos para que salga el primero sano.
    const firstAble = Math.max(0, player.findIndex((p) => !isMember(p) || p.hp > 0));
    const order = [firstAble, ...player.map((_, i) => i).filter((i) => i !== firstAble)];
    this.order = order;
    const playerSpecs = order.map((i) => player[i]).map((p) => (isMember(p) ? memberToSpec(p) : p));
    const foeSpecs = opponent.map((p) => (isMember(p) ? memberToSpec(p) : p));
    this.battle.setPlayer('p1', { name: 'Jugador', team: playerSpecs.map(specToSet) as never });
    this.battle.setPlayer('p2', { name: 'Rival', team: foeSpecs.map(specToSet) as never });
    this.applyStoredState(order.map((i) => player[i]), this.battle.p1.pokemon);
    this.applyStoredState(opponent, this.battle.p2.pokemon);
    this.policy = options.opponentPolicy ?? randomPolicy();
    this.translator = new StepTranslator(options.foeLabel ?? 'rival', (en) => moveName(toId(en)));
    this.logCursor = this.battle.log.length;
    this.participants.add(this.order[0]);
  }

  /** order[i] = índice en el equipo original del Pokémon i de Showdown. */
  private readonly order: number[];

  // ---------- Consultas ----------

  get player(): BattlerView {
    return this.view(this.battle.p1.active[0]);
  }

  get opponent(): BattlerView {
    return this.view(this.battle.p2.active[0]);
  }

  /** Índice en el equipo original del Pokémon activo del jugador. */
  get activeIndex(): number {
    return this.order[this.battle.p1.pokemon.indexOf(this.battle.p1.active[0])];
  }

  get ended(): boolean {
    return this.battle.ended || this.captured || this.fled;
  }

  get winner(): Winner {
    if (this.captured || this.fled) return null;
    if (!this.battle.ended) return null;
    if (this.battle.winner === 'Jugador') return 'player';
    if (this.battle.winner === 'Rival') return 'opponent';
    return null;
  }

  get wasCaptured(): boolean {
    return this.captured;
  }

  get hasFled(): boolean {
    return this.fled;
  }

  /** El Pokémon activo del jugador se ha debilitado y hay que elegir otro. */
  get needsSwitch(): boolean {
    return !this.ended && Boolean(this.battle.p1.activeRequest?.forceSwitch);
  }

  /** Movimientos visibles del Pokémon activo del jugador (sin el movimiento interno). */
  get moves(): MoveOption[] {
    return this.movesOf(this.battle.p1.active[0]);
  }

  /** Índices del equipo original a los que se puede cambiar ahora mismo. */
  switchableIndices(): number[] {
    const active = this.battle.p1.active[0];
    return this.battle.p1.pokemon
      .map((mon, i) => ({ mon, i }))
      .filter(({ mon }) => mon !== active && !mon.fainted)
      .map(({ i }) => this.order[i]);
  }

  // ---------- Acciones del jugador ----------

  /** El jugador usa el movimiento `slot` (1-4). */
  fight(slot: number): BattleStep[] {
    this.assertCanAct();
    return this.runTurn(`move ${slot}`);
  }

  /** Cambia al Pokémon `partyIndex`. Si es un cambio forzado no gasta turno. */
  switchTo(partyIndex: number): BattleStep[] {
    if (this.ended) throw new Error('El combate ya ha terminado');
    const sdIndex = this.order.indexOf(partyIndex);
    if (sdIndex < 0) throw new Error(`No existe el Pokémon ${partyIndex}`);
    const forced = this.needsSwitch;
    this.battle.choose('p1', `switch ${sdIndex + 1}`);
    if (!forced) {
      this.chooseOpponent();
    } else {
      // Si los dos se debilitaron a la vez, el rival también tiene que elegir.
      const req = this.battle.p2.activeRequest;
      if (req && !req.wait && req.forceSwitch) this.chooseOpponent();
    }
    this.settleOpponent();
    this.participants.add(partyIndex);
    return this.flush();
  }

  /**
   * Lanza una Poké Ball (solo contra salvajes). Si falla, el rival actúa.
   */
  throwBall(catchRate: number, rng: Rng, ballBonus = 1): CaptureOutcome {
    this.assertCanAct();
    const foe = this.battle.p2.active[0];
    const result = tryCapture(
      { maxHp: foe.maxhp, hp: foe.hp, catchRate, ballBonus, statusBonus: statusBonus(foe.status) },
      rng,
    );
    if (result.caught) {
      this.captured = true;
      return { ...result, steps: [] };
    }
    return { ...result, steps: this.runTurn(this.actionChoice()) };
  }

  /** Intenta huir (fórmula de 3.ª-4.ª gen basada en la Velocidad). */
  run(rng: Rng): { escaped: boolean; steps: BattleStep[] } {
    this.assertCanAct();
    this.escapeAttempts++;
    const mine = this.battle.p1.active[0].getStat('spe', false, true);
    const theirs = Math.max(1, this.battle.p2.active[0].getStat('spe', false, true));
    const odds = Math.floor((mine * 128) / theirs) + 30 * this.escapeAttempts;
    if (mine >= theirs || odds > 255 || Math.floor(rng() * 256) < odds) {
      this.fled = true;
      return { escaped: true, steps: [] };
    }
    return { escaped: false, steps: this.runTurn(this.actionChoice()) };
  }

  /**
   * Cura `amount` PS al Pokémon `partyIndex` (Poción). Devuelve lo curado.
   * No gasta turno por sí mismo: después hay que llamar a passTurn().
   */
  heal(partyIndex: number, amount: number): number {
    const mon = this.battle.p1.pokemon[this.order.indexOf(partyIndex)];
    if (!mon || mon.fainted || mon.hp >= mon.maxhp) return 0;
    const healed = Math.min(amount, mon.maxhp - mon.hp);
    mon.hp += healed;
    return healed;
  }

  /** Un turno en el que el jugador no ataca (objeto, etc.): solo actúa el rival. */
  passTurn(): BattleStep[] {
    this.assertCanAct();
    return this.runTurn(this.actionChoice());
  }

  // ---------- Exportar el resultado ----------

  /**
   * Estado final del equipo del jugador (PS, PP y estado), en el orden original,
   * listo para guardarlo en la partida.
   */
  exportParty(original: PartyMember[]): PartyMember[] {
    return original.map((m, i) => {
      const mon = this.battle.p1.pokemon[this.order.indexOf(i)];
      if (!mon) return m;
      return {
        ...m,
        hp: mon.hp,
        status: mon.fainted ? '' : mon.status,
        moves: m.moves.map((mv) => {
          const slot = mon.baseMoveSlots.find((s) => s.id === mv.id);
          return slot ? { ...mv, pp: slot.pp } : mv;
        }),
      };
    });
  }

  // ---------- Internos ----------

  private assertCanAct(): void {
    if (this.ended) throw new Error('El combate ya ha terminado');
    if (this.needsSwitch) throw new Error('Hay que cambiar de Pokémon primero');
  }

  private actionChoice(): string {
    const active = this.battle.p1.active[0];
    const slot = active.moveSlots.findIndex((m) => m.id === ACTION_MOVE_ID);
    return `move ${slot + 1}`;
  }

  private runTurn(playerChoice: string): BattleStep[] {
    this.battle.choose('p1', playerChoice);
    this.chooseOpponent();
    this.settleOpponent();
    return this.flush();
  }

  /**
   * Si el rival tiene que sacar otro Pokémon (el suyo se debilitó) y el jugador
   * no tiene nada pendiente, lo saca ya para que el combate siga.
   */
  private settleOpponent(): void {
    for (let guard = 0; guard < 6; guard++) {
      const req = this.battle.p2.activeRequest;
      if (this.battle.ended || !req || req.wait || !req.forceSwitch) return;
      if (this.battle.p1.activeRequest?.forceSwitch) return; // primero elige el jugador
      this.chooseOpponent();
    }
  }

  private chooseOpponent(): void {
    const req = this.battle.p2.activeRequest;
    if (!req || req.wait) return;
    if (req.forceSwitch) {
      const next = this.battle.p2.pokemon.findIndex((p) => !p.fainted && !p.isActive);
      this.battle.choose('p2', `switch ${next + 1}`);
      return;
    }
    const options = this.movesOf(this.battle.p2.active[0]);
    this.battle.choose('p2', `move ${this.policy(options)}`);
  }

  private flush(): BattleStep[] {
    const fresh = this.battle.log.slice(this.logCursor);
    this.logCursor = this.battle.log.length;
    // El movimiento interno no escribe nada, pero por si acaso filtramos su nombre.
    const lines = visibleLines(fresh).filter((l) => !l.includes('|Hollinaccion|'));
    return this.translator.translateAll(lines);
  }

  private view(mon: Battle['p1']['active'][number]): BattlerView {
    return {
      name: mon.name,
      species: mon.species.name,
      level: mon.level,
      hp: mon.hp,
      maxHp: mon.maxhp,
      status: mon.status,
      fainted: mon.fainted,
      tiznado: 'tiznado' in mon.volatiles,
    };
  }

  private movesOf(mon: Battle['p1']['active'][number]): MoveOption[] {
    return mon.moveSlots
      .map((ms, i) => ({ ms, i }))
      .filter(({ ms }) => ms.id !== ACTION_MOVE_ID)
      .map(({ ms, i }) => {
        const info = this.battle.dex.moves.get(ms.id);
        return {
          slot: i + 1,
          id: ms.id,
          name: moveName(ms.id),
          type: info.type,
          pp: ms.pp,
          maxPp: ms.maxpp,
          disabled: Boolean(ms.disabled),
        };
      });
  }

  /**
   * Showdown asume 3 Más PP y PS completos. Aquí aplicamos los PP base y, si es
   * un PartyMember, sus PS, PP y estado actuales.
   */
  private applyStoredState(source: Combatant[], mons: Battle['p1']['pokemon']): void {
    mons.forEach((mon, i) => {
      const stored = source[i];
      for (const slots of [mon.moveSlots, mon.baseMoveSlots]) {
        for (const ms of slots) {
          if (ms.id === ACTION_MOVE_ID) continue;
          const base = this.battle.dex.moves.get(ms.id).pp;
          const saved = stored && isMember(stored) ? stored.moves.find((m) => m.id === ms.id)?.pp : undefined;
          ms.maxpp = base;
          ms.pp = saved ?? base;
        }
      }
      if (stored && isMember(stored)) {
        mon.hp = Math.min(mon.maxhp, Math.max(0, stored.hp));
        if (mon.hp === 0) mon.fainted = true;
        if (stored.status) mon.setStatus(stored.status as never);
      }
    });
  }
}
