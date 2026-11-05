/**
 * Traduce el protocolo de Showdown ("|move|p1a: Growlithe|Ember|p2a: Pidove")
 * a una secuencia de PASOS que la escena de combate reproduce en orden:
 * mensajes en español y actualizaciones de la barra de vida.
 */

export type Side = 'p1' | 'p2';
/** Cómo se nombra a los Pokémon del rival: "Pidove salvaje" o "Pidove rival". */
export type FoeLabel = 'salvaje' | 'rival';

export type BattleStep =
  | { kind: 'text'; text: string }
  | { kind: 'hp'; side: Side; hp: number; maxHp: number; status: string }
  | { kind: 'switch'; side: Side; name: string }
  | { kind: 'faint'; side: Side }
  /** Animación de ataque del lado indicado (antes del texto "usó..."); `move` es el id. */
  | { kind: 'move'; side: Side; move: string };

export type MoveNameFn = (englishName: string) => string;


/**
 * De cada bloque "|split|pN" se queda con UNA versión de la línea:
 * la privada (PS exactos) si es del jugador (p1), la pública (porcentaje) si es del rival.
 */
export function visibleLines(log: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < log.length; i++) {
    const line = log[i];
    if (line.startsWith('|split|')) {
      const side = line.slice('|split|'.length);
      const priv = log[i + 1];
      const pub = log[i + 2];
      const chosen = side === 'p1' ? priv : pub;
      if (chosen !== undefined) out.push(chosen);
      i += 2;
      continue;
    }
    out.push(line);
  }
  return out;
}

/** Compatibilidad: versión pública de todas las líneas. */
export function publicLines(log: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < log.length; i++) {
    if (log[i].startsWith('|split|')) {
      if (i + 2 < log.length) out.push(log[i + 2]);
      i += 2;
      continue;
    }
    out.push(log[i]);
  }
  return out;
}

/** "p2a: Pidove" -> { side: 'p2', name: 'Pidove' } */
export function parseIdent(ident: string): { side: Side; name: string } {
  const [pos, ...rest] = ident.split(': ');
  return { side: pos.startsWith('p1') ? 'p1' : 'p2', name: rest.join(': ') };
}

/** "30/34 par" -> { hp: 30, maxHp: 34, status: 'par' }; "0 fnt" -> hp 0. */
export function parseHp(text: string): { hp: number; maxHp: number; status: string } {
  const [frac, status = ''] = text.split(' ');
  if (frac === '0') return { hp: 0, maxHp: 1, status: status === 'fnt' ? '' : status };
  const [hp, max] = frac.split('/').map(Number);
  return { hp, maxHp: max || 100, status };
}

const STAT_NAMES: Record<string, string> = {
  atk: 'el Ataque',
  def: 'la Defensa',
  spa: 'el Ataque Especial',
  spd: 'la Defensa Especial',
  spe: 'la Velocidad',
  accuracy: 'la Precisión',
  evasion: 'la Evasión',
};

const STATUS_START: Record<string, string> = {
  brn: 'se ha quemado',
  par: 'está paralizado. ¡Quizás no se pueda mover!',
  psn: 'ha sido envenenado',
  tox: 'ha sido gravemente envenenado',
  slp: 'se ha dormido',
  frz: 'se ha congelado',
};

const CANT: Record<string, string> = {
  par: 'está paralizado. ¡No se puede mover!',
  slp: 'está dormido como un tronco.',
  frz: 'está congelado.',
  flinch: 'retrocedió y no pudo atacar.',
};

export class StepTranslator {
  constructor(
    private readonly foe: FoeLabel = 'rival',
    private readonly moveName: MoveNameFn = (n) => n,
  ) {}

  private who(ident: string): string {
    const { side, name } = parseIdent(ident);
    return side === 'p1' ? name : `${name} ${this.foe}`;
  }

  /** Mensaje para el inicio de frase (mayúscula tras "¡"). */
  translate(line: string): BattleStep[] {
    const parts = line.split('|');
    const cmd = parts[1];
    const text = (t: string): BattleStep => ({ kind: 'text', text: t });
    switch (cmd) {
      case 'move':
        return [
          { kind: 'move', side: parseIdent(parts[2]).side, move: parts[3].toLowerCase().replace(/[^a-z0-9]/g, '') },
          text(`¡${this.who(parts[2])} usó ${this.moveName(parts[3])}!`),
        ];
      case '-damage':
      case '-heal':
      case '-sethp': {
        const { side } = parseIdent(parts[2]);
        const steps: BattleStep[] = [{ kind: 'hp', side, ...parseHp(parts[3]) }];
        const from = parts[4] ?? '';
        if (cmd === '-damage' && from.includes('psn')) steps.unshift(text(`${this.who(parts[2])} sufre por el veneno.`));
        if (cmd === '-damage' && from.includes('brn')) steps.unshift(text(`${this.who(parts[2])} sufre por la quemadura.`));
        if (cmd === '-heal') steps.push(text(`${this.who(parts[2])} ha recuperado salud.`));
        return steps;
      }
      case 'switch':
      case 'drag': {
        const { side, name } = parseIdent(parts[2]);
        return [{ kind: 'switch', side, name }, { kind: 'hp', side, ...parseHp(parts[4]) }];
      }
      case 'faint': {
        const { side } = parseIdent(parts[2]);
        return [{ kind: 'faint', side }, text(`¡${this.who(parts[2])} se debilitó!`)];
      }
      case 'cant': {
        const reason = CANT[parts[3]];
        return reason ? [text(`¡${this.who(parts[2])} ${reason}`)] : [];
      }
      case '-start':
        if (parts[3] === 'Tiznado') return [text(`¡${this.who(parts[2])} queda tiznado por el humo!`)];
        if (parts[3] === 'confusion') return [text(`¡${this.who(parts[2])} se ha confundido!`)];
        return [];
      case '-end':
        if (parts[3] === 'Tiznado') return [text(`${this.who(parts[2])} vuelve a ver con claridad.`)];
        if (parts[3] === 'confusion') return [text(`${this.who(parts[2])} ya no está confuso.`)];
        return [];
      case '-activate':
        if (parts[3] === 'Tiznado') return [text(`¡${this.who(parts[2])} no ve nada entre el humo!`)];
        if (parts[3] === 'confusion') return [text(`${this.who(parts[2])} está confuso...`)];
        return [];
      case '-status': {
        const msg = STATUS_START[parts[3]];
        const { side } = parseIdent(parts[2]);
        return msg ? [{ kind: 'hp', side, hp: -1, maxHp: -1, status: parts[3] }, text(`¡${this.who(parts[2])} ${msg}!`)] : [];
      }
      case '-curestatus': {
        const { side } = parseIdent(parts[2]);
        return [{ kind: 'hp', side, hp: -1, maxHp: -1, status: '' }, text(`${this.who(parts[2])} ya está bien.`)];
      }
      case '-boost':
      case '-unboost': {
        const stat = STAT_NAMES[parts[3]] ?? parts[3];
        const Stat = stat.charAt(0).toUpperCase() + stat.slice(1);
        const amount = Number(parts[4]);
        const verb = cmd === '-boost' ? (amount >= 2 ? 'subió mucho' : 'subió') : amount >= 2 ? 'bajó mucho' : 'bajó';
        if (amount === 0) return [text(`¡${Stat} de ${this.who(parts[2])} no puede cambiar más!`)];
        return [text(`¡${Stat} de ${this.who(parts[2])} ${verb}!`)];
      }
      case '-miss':
        return [text(`¡El ataque de ${this.who(parts[2])} falló!`)];
      case '-supereffective':
        return [text('¡Es muy eficaz!')];
      case '-resisted':
        return [text('No es muy eficaz...')];
      case '-crit':
        return [text('¡Un golpe crítico!')];
      case '-immune':
        return [text(`No afecta a ${this.who(parts[2])}...`)];
      case '-fail':
        return [text('¡Pero falló!')];
      case '-nothing':
        return [text('¡Pero no pasó nada!')];
      default:
        return [];
    }
  }

  translateAll(lines: readonly string[]): BattleStep[] {
    return lines.flatMap((l) => this.translate(l));
  }
}

/** Solo los mensajes de texto (útil en tests). */
export function stepsToText(steps: BattleStep[]): string[] {
  return steps.flatMap((s) => (s.kind === 'text' ? [s.text] : []));
}

/** Atajo para una línea suelta. */
export function lineToSpanish(line: string, foe: FoeLabel = 'rival'): string | null {
  const texts = stepsToText(new StepTranslator(foe).translate(line));
  return texts.length > 0 ? texts.join(' ') : null;
}
