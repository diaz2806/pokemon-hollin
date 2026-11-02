import { describe, expect, it } from 'vitest';
import { lineToSpanish, parseIdent, publicLines } from '../src/battle/log-es';

describe('publicLines', () => {
  it('se queda con la versión pública de los bloques split', () => {
    const log = ['|move|p1a: A|Tackle|p2a: B', '|split|p2', '|-damage|p2a: B|20/28', '|-damage|p2a: B|72/100', '|turn|2'];
    expect(publicLines(log)).toEqual(['|move|p1a: A|Tackle|p2a: B', '|-damage|p2a: B|72/100', '|turn|2']);
  });
});

describe('parseIdent', () => {
  it('separa lado y nombre', () => {
    expect(parseIdent('p2a: Pidove')).toEqual({ side: 'p2', name: 'Pidove' });
    expect(parseIdent('p1a: Mr. Mime: Galar')).toEqual({ side: 'p1', name: 'Mr. Mime: Galar' });
  });
});

describe('lineToSpanish', () => {
  it('traduce movimientos del jugador y del rival', () => {
    expect(lineToSpanish('|move|p1a: Growlithe|Ember|p2a: Pidove')).toBe('¡Growlithe usó Ember!');
    expect(lineToSpanish('|move|p2a: Pidove|Gust|p1a: Growlithe')).toBe('¡Pidove rival usó Gust!');
  });

  it('llama "salvaje" a los Pokémon de encuentros', () => {
    expect(lineToSpanish('|faint|p2a: Rattata', 'salvaje')).toBe('¡Rattata salvaje se debilitó!');
  });

  it('traduce el ciclo del Tiznado', () => {
    expect(lineToSpanish('|-start|p2a: Pidove|Tiznado')).toBe('¡Pidove rival queda tiznado por el humo!');
    expect(lineToSpanish('|-activate|p2a: Pidove|Tiznado')).toBe('¡Pidove rival no ve nada entre el humo!');
    expect(lineToSpanish('|-end|p2a: Pidove|Tiznado')).toBe('Pidove rival vuelve a ver con claridad.');
  });

  it('ignora líneas que no se muestran', () => {
    expect(lineToSpanish('|-damage|p2a: Pidove|50/100')).toBeNull();
    expect(lineToSpanish('|turn|3')).toBeNull();
  });
});
