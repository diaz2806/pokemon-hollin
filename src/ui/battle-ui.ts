/**
 * Interfaz de combate estilo Essentials: botones de colores por tipo, cajas de
 * datos y barras. Solo se usa si los gráficos están en assets/ (ver resources.ts);
 * si no, BattleScene usa los menús de texto de siempre.
 */
import * as Phaser from 'phaser';
import { controls } from './input';
import { playSe } from './audio';
import { hasRes, resKey, resReady, type ResRequest } from './resources';
import { FONT_PX } from './palette';

/** Filas de cursor_fight.png y types.png (orden de Essentials). */
export const TYPE_ROW: Record<string, number> = {
  Normal: 0, Fighting: 1, Flying: 2, Poison: 3, Ground: 4, Rock: 5, Bug: 6, Ghost: 7, Steel: 8, '???': 9,
  Fire: 10, Water: 11, Grass: 12, Electric: 13, Psychic: 14, Ice: 15, Dragon: 16, Dark: 17, Fairy: 18,
};

/** Colores clásicos de cada tipo (para las etiquetas en español). */
export const TYPE_COLOR: Record<string, string> = {
  Normal: '#a8a878', Fire: '#f08030', Water: '#6890f0', Grass: '#78c850', Electric: '#e8c020', Ice: '#78c8c8',
  Fighting: '#c03028', Poison: '#a040a0', Ground: '#c8a048', Flying: '#a890f0', Psychic: '#f85888', Bug: '#a8b820',
  Rock: '#b8a038', Ghost: '#705898', Dragon: '#7038f8', Dark: '#705848', Steel: '#a8a8c0', Fairy: '#e890a8', '???': '#68a090',
};

/** Nombres de tipo en español, cortos para caber en la etiqueta. */
export const TYPE_SHORT_ES: Record<string, string> = {
  Normal: 'NORMAL', Fire: 'FUEGO', Water: 'AGUA', Grass: 'PLANTA', Electric: 'ELÉCTR', Ice: 'HIELO', Fighting: 'LUCHA',
  Poison: 'VENENO', Ground: 'TIERRA', Flying: 'VOLAD', Psychic: 'PSÍQ', Bug: 'BICHO', Rock: 'ROCA', Ghost: 'FANTAS',
  Dragon: 'DRAGÓN', Dark: 'SINIEST', Steel: 'ACERO', Fairy: 'HADA', '???': '???',
};

/** Estados en español (abreviados) y su color, como etiqueta en la caja de datos. */
export const STATUS_LABEL: Record<string, [string, string]> = {
  slp: ['DOR', '#8c8c8c'], psn: ['ENV', '#a040a0'], tox: ['ENV', '#702070'], brn: ['QUE', '#e07030'],
  par: ['PAR', '#c8a000'], frz: ['CON', '#58a8c8'],
};

/** Etiqueta de color con texto blanco (tipo o estado), hecha con un Text con fondo. */
export function labelStyle(bg: string): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: '"Press Start 2P"',
    fontSize: `${FONT_PX}px`,
    color: '#ffffff',
    backgroundColor: bg,
    padding: { x: 2, y: 1 },
    shadow: { offsetX: 1, offsetY: 1, color: '#00000088', fill: true },
    resolution: 1,
  };
}

/** Fila de icon_statuses.png para cada estado de Showdown. */
export const STATUS_ROW: Record<string, number> = { slp: 0, psn: 1, brn: 2, par: 3, frz: 4, tox: 5 };

export const BATTLE_BACK = 'city_night';

/** Piezas de un fondo de combate de Essentials (algunos comparten bases y mensaje). */
export interface BattlebackParts {
  bg: string;
  base0: string;
  base1: string;
  message: string;
}

/**
 * "rocky_night" usa rocky_night_bg y rocky_night_base*, pero el mensaje de rocky;
 * "city_night" usa city_night_bg con las bases y el mensaje de city. Se resuelve
 * buscando primero el nombre completo y luego sin el momento del día.
 */
export function battlebackParts(name: string): BattlebackParts {
  const plain = name.replace(/_(night|eve)$/, '');
  const pick = (suffix: string) => (hasRes('battlebacks', `${name}_${suffix}`) ? `${name}_${suffix}` : `${plain}_${suffix}`);
  return { bg: pick('bg'), base0: pick('base0'), base1: pick('base1'), message: pick('message') };
}

/** Recursos que BattleScene necesita para la interfaz de Essentials. */
export const BATTLE_UI_RESOURCES: ResRequest[] = [
  { cat: 'ui/battle', name: 'cursor_fight', sheet: [2, 19] },
  { cat: 'ui/battle', name: 'databox_normal' },
  { cat: 'ui/battle', name: 'databox_normal_foe' },
  { cat: 'ui/battle', name: 'overlay_hp' },
  { cat: 'ui/battle', name: 'overlay_exp' },
  { cat: 'ui/battle', name: 'overlay_fight' },
  { cat: 'ui/battle', name: 'icon_statuses', sheet: [1, 6] },
  { cat: 'ui', name: 'types', sheet: [1, 19] },
];

export function battleResources(back: string): ResRequest[] {
  const parts = battlebackParts(back);
  return [
    ...BATTLE_UI_RESOURCES,
    ...Object.values(parts).map((name) => ({ cat: 'battlebacks' as const, name })),
    { cat: 'ui/battle', name: 'ball_pokeball', frame: [16, 32] },
    { cat: 'ui/battle', name: 'ball_pokeball_open' },
    { cat: 'ui/battle', name: 'ballburst_particle' },
    { cat: 'ui', name: 'category', sheet: [1, 3] },
  ];
}

export function essentialsBattleUi(scene: Phaser.Scene, back: string): boolean {
  const parts = battlebackParts(back);
  return (
    BATTLE_UI_RESOURCES.every((r) => resReady(scene, r.cat, r.name)) &&
    Object.values(parts).every((name) => resReady(scene, 'battlebacks', name))
  );
}

export interface ButtonItem {
  label: string;
  /** Fila de color (TYPE_ROW). */
  row: number;
}

export interface ButtonSlot {
  x: number;
  y: number;
  w: number;
}

const BUTTON_H = 23;

/**
 * Rejilla de botones 2xN navegable con la cruceta. Devuelve el índice elegido,
 * o -1 si se cancela con B.
 */
export function chooseButtons(
  scene: Phaser.Scene,
  items: ButtonItem[],
  slots: ButtonSlot[],
  onMove?: (index: number) => void,
  start = 0,
): Promise<number> {
  const key = resKey('ui/battle', 'cursor_fight');
  const objects: Phaser.GameObjects.GameObject[] = [];
  const buttons = items.map((item, i) => {
    const s = slots[i];
    const normal = scene.add.nineslice(s.x, s.y, key, item.row * 2, s.w, BUTTON_H, 10, 10, 0, 0).setOrigin(0).setDepth(1200);
    const selected = scene.add.nineslice(s.x, s.y, key, item.row * 2 + 1, s.w, BUTTON_H, 10, 10, 0, 0).setOrigin(0).setDepth(1200);
    const text = scene.add
      .text(s.x + s.w / 2, s.y + 8, item.label, {
        fontFamily: '"Press Start 2P"',
        fontSize: `${FONT_PX}px`,
        // Como en Essentials: tinta oscura con sombra clara sobre el centro claro del botón.
        color: '#484848',
        resolution: 1,
        shadow: { offsetX: 1, offsetY: 1, color: '#d8d8d8', fill: true },
      })
      .setOrigin(0.5, 0)
      .setDepth(1201);
    // Nombres largos ("Afilagarras"): se juntan un poco las letras para que quepan.
    if (text.width > s.w - 12) text.setLetterSpacing(-1);
    objects.push(normal, selected, text);
    return { normal, selected };
  });
  let index = Math.min(start, items.length - 1);
  const paint = () => {
    buttons.forEach((b, i) => {
      b.normal.setVisible(i !== index);
      b.selected.setVisible(i === index);
    });
    onMove?.(index);
  };
  paint();
  controls.flush();
  return new Promise((resolve) => {
    const finish = (value: number) => {
      timer.remove();
      objects.forEach((o) => o.destroy());
      resolve(value);
    };
    const timer = scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const dir = controls.tappedDir();
        if (dir) {
          const delta = { up: -2, down: 2, left: -1, right: 1 }[dir];
          const next = index + delta;
          const sameRow = dir === 'left' || dir === 'right' ? Math.floor(next / 2) === Math.floor(index / 2) : true;
          if (next >= 0 && next < items.length && sameRow) {
            index = next;
            paint();
            playSe(scene, 'gui_sel_cursor');
          }
        }
        if (controls.pressed('A')) {
          playSe(scene, 'gui_sel_decision');
          finish(index);
        } else if (controls.pressed('B')) {
          playSe(scene, 'gui_sel_cancel');
          finish(-1);
        }
      },
    });
  });
}
