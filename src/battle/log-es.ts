/**
 * Traduce el protocolo de Showdown (líneas tipo "|move|p1a: Growlithe|Tackle|p2a: Pidove")
 * a mensajes en español para la caja de texto del combate.
 *
 * Solo cubre los mensajes que el juego necesita de momento; el resto se ignora.
 * Los nombres de movimientos llegan en inglés: falta una tabla de traducción.
 */

/** Quita las líneas privadas de los bloques "|split|": nos quedamos con la versión pública. */
export function publicLines(log: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < log.length; i++) {
    if (log[i].startsWith('|split|')) {
      // log[i + 1] = versión privada, log[i + 2] = versión pública
      if (i + 2 < log.length) out.push(log[i + 2]);
      i += 2;
      continue;
    }
    out.push(log[i]);
  }
  return out;
}

/** "p2a: Pidove" -> { side: 'p2', name: 'Pidove' } */
export function parseIdent(ident: string): { side: 'p1' | 'p2'; name: string } {
  const [pos, ...rest] = ident.split(': ');
  return { side: pos.startsWith('p1') ? 'p1' : 'p2', name: rest.join(': ') };
}

/** Cómo se nombra a los Pokémon del rival: "Pidove salvaje" o "Pidove rival". */
export type FoeLabel = 'salvaje' | 'rival';

function who(ident: string, foe: FoeLabel): string {
  const { side, name } = parseIdent(ident);
  return side === 'p1' ? name : `${name} ${foe}`;
}

/** Convierte una línea del protocolo en un mensaje, o null si no se muestra. */
export function lineToSpanish(line: string, foe: FoeLabel = 'rival'): string | null {
  const parts = line.split('|');
  const cmd = parts[1];
  switch (cmd) {
    case 'move':
      return `¡${who(parts[2], foe)} usó ${parts[3]}!`;
    case '-start':
      if (parts[3] === 'Tiznado') return `¡${who(parts[2], foe)} queda tiznado por el humo!`;
      return null;
    case '-end':
      if (parts[3] === 'Tiznado') return `${who(parts[2], foe)} vuelve a ver con claridad.`;
      return null;
    case '-activate':
      if (parts[3] === 'Tiznado') return `¡${who(parts[2], foe)} no ve nada entre el humo!`;
      return null;
    case '-miss':
      return `¡El ataque de ${who(parts[2], foe)} falló!`;
    case '-supereffective':
      return '¡Es muy eficaz!';
    case '-resisted':
      return 'No es muy eficaz...';
    case '-crit':
      return '¡Un golpe crítico!';
    case '-immune':
      return `No afecta a ${who(parts[2], foe)}...`;
    case '-fail':
      return '¡Pero falló!';
    case 'faint':
      return `¡${who(parts[2], foe)} se debilitó!`;
    default:
      return null;
  }
}

export function toSpanishMessages(lines: readonly string[], foe: FoeLabel = 'rival'): string[] {
  return lines.map((l) => lineToSpanish(l, foe)).filter((m): m is string => m !== null);
}
