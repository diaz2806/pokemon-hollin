/**
 * Interfaz de combate estilo Essentials: botones de colores por tipo, cajas de
 * datos y barras. Solo se usa si los gráficos están en assets/ (ver resources.ts);
 * si no, BattleScene usa los menús de texto de siempre.
 */
import * as Phaser from 'phaser';
import { controls } from './input';
import { playSe } from './audio';
import { resKey, resReady, type ResRequest } from './resources';
import { FONT_PX } from './palette';

/** Filas de cursor_fight.png y types.png (orden de Essentials). */
export const TYPE_ROW: Record<string, number> = {
  Normal: 0, Fighting: 1, Flying: 2, Poison: 3, Ground: 4, Rock: 5, Bug: 6, Ghost: 7, Steel: 8, '???': 9,
  Fire: 10, Water: 11, Grass: 12, Electric: 13, Psychic: 14, Ice: 15, Dragon: 16, Dark: 17, Fairy: 18,
};

/** Fila de icon_statuses.png para cada estado de Showdown. */
export const STATUS_ROW: Record<string, number> = { slp: 0, psn: 1, brn: 2, par: 3, frz: 4, tox: 5 };

export const BATTLE_BACK = 'city_night';

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
  { cat: 'battlebacks', name: `${BATTLE_BACK}_bg` },
  { cat: 'battlebacks', name: 'city_base0' },
  { cat: 'battlebacks', name: 'city_base1' },
  { cat: 'battlebacks', name: 'city_message' },
];

export function essentialsBattleUi(scene: Phaser.Scene): boolean {
  return BATTLE_UI_RESOURCES.every((r) => resReady(scene, r.cat, r.name));
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
