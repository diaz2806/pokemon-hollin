import { describe, expect, it } from 'vitest';
import { StepTranslator, lineToSpanish, parseHp, parseIdent, publicLines, visibleLines } from '../src/battle/log-es';

describe('visibleLines / publicLines', () => {
  const log = [
    '|move|p1a: A|Tackle|p2a: B',
    '|split|p2',
    '|-damage|p2a: B|20/28',
    '|-damage|p2a: B|72/100',
    '|split|p1',
    '|-damage|p1a: A|30/34',
    '|-damage|p1a: A|89/100',
  ];

  it('publicLines se queda con la versión pública', () => {
    expect(publicLines(log)).toEqual(['|move|p1a: A|Tackle|p2a: B', '|-damage|p2a: B|72/100', '|-damage|p1a: A|89/100']);
  });

  it('visibleLines muestra PS exactos solo del jugador', () => {
    expect(visibleLines(log)).toEqual(['|move|p1a: A|Tackle|p2a: B', '|-damage|p2a: B|72/100', '|-damage|p1a: A|30/34']);
  });
});

describe('parseIdent / parseHp', () => {
  it('separa lado y nombre', () => {
    expect(parseIdent('p2a: Pidove')).toEqual({ side: 'p2', name: 'Pidove' });
    expect(parseIdent('p1a: Mr. Mime: Galar')).toEqual({ side: 'p1', name: 'Mr. Mime: Galar' });
  });

  it('lee PS, máximo y estado', () => {
    expect(parseHp('30/34 par')).toEqual({ hp: 30, maxHp: 34, status: 'par' });
    expect(parseHp('0 fnt')).toEqual({ hp: 0, maxHp: 1, status: '' });
  });
});

describe('StepTranslator', () => {
  const t = new StepTranslator('salvaje', (en) => (en === 'Ember' ? 'Ascuas' : en));

  it('traduce movimientos con nombres en español', () => {
    expect(t.translate('|move|p1a: Growlithe|Ember|p2a: Pidove')).toEqual([
      { kind: 'move', side: 'p1', move: 'ember' },
      { kind: 'text', text: '¡Growlithe usó Ascuas!' },
    ]);
  });

  it('convierte daño en un paso de vida', () => {
    expect(t.translate('|-damage|p2a: Pidove|50/100')).toEqual([{ kind: 'hp', side: 'p2', hp: 50, maxHp: 100, status: '' }]);
  });

  it('un debilitado genera un paso de faint y su mensaje', () => {
    expect(t.translate('|faint|p2a: Rattata')).toEqual([
      { kind: 'faint', side: 'p2' },
      { kind: 'text', text: '¡Rattata salvaje se debilitó!' },
    ]);
  });

  it('traduce cambios de características con su artículo', () => {
    expect(lineToSpanish('|-unboost|p2a: Pidove|def|1', 'salvaje')).toBe('¡La Defensa de Pidove salvaje bajó!');
    expect(lineToSpanish('|-boost|p1a: Growlithe|atk|2')).toBe('¡El Ataque de Growlithe subió mucho!');
  });

  it('traduce el ciclo del Tiznado', () => {
    expect(lineToSpanish('|-start|p2a: Pidove|Tiznado')).toBe('¡Pidove rival queda tiznado por el humo!');
    expect(lineToSpanish('|-activate|p2a: Pidove|Tiznado')).toBe('¡Pidove rival no ve nada entre el humo!');
    expect(lineToSpanish('|-end|p2a: Pidove|Tiznado')).toBe('Pidove rival vuelve a ver con claridad.');
  });

  it('ignora líneas que no se muestran', () => {
    expect(lineToSpanish('|turn|3')).toBeNull();
    expect(lineToSpanish('|-damage|p2a: Pidove|50/100')).toBeNull();
  });
});

describe('Humo en el log', () => {
  const t = new StepTranslator('salvaje', (en) => en);

  it('traduce los cambios de densidad de humo', () => {
    expect(t.translate('|-humo|3|up')).toEqual([
      { kind: 'smoke', level: 3 },
      { kind: 'text', text: '¡Hollín negro! Ya no se ve nada...' },
    ]);
    expect(t.translate('|-humo|0|down')[1]).toEqual({ kind: 'text', text: '¡El viento se lleva el humo!' });
  });

  it('el nivel inicial de la zona no lleva texto', () => {
    expect(t.translate('|-humo|2|zone')).toEqual([{ kind: 'smoke', level: 2 }]);
  });
});
