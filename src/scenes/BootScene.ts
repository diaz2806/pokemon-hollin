import * as Phaser from 'phaser';
import { generateAllTextures } from '../ui/art/textures';
import { FONT, FONT_PX } from '../ui/palette';
import { queueRes, type ResRequest } from '../ui/resources';
import { COMMON_SE } from '../ui/audio';
import { CHOICE_SKIN, SPEECH_SKIN } from '../ui/TextBox';
import { MAPS } from '../game/content';
import { HERO_OW } from './WorldScene';

/** Carga la fuente, los sprites oficiales opcionales y genera las texturas propias. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  /**
   * Precarga lo que se usa desde el primer momento (si existe en assets/):
   * ventanas, efectos de menú y los personajes Gen 4 de todos los mapas.
   */
  preload(): void {
    const characters = new Set<string>([HERO_OW]);
    for (const map of Object.values(MAPS)) for (const npc of map.npcs ?? []) if (npc.ow) characters.add(npc.ow);
    const requests: ResRequest[] = [
      { cat: 'ui/windowskins', name: SPEECH_SKIN },
      { cat: 'ui/windowskins', name: CHOICE_SKIN },
      ...COMMON_SE.map((name) => ({ cat: 'audio/se' as const, name })),
      ...[...characters].map((name) => ({ cat: 'characters' as const, name, sheet: [4, 4] as [number, number] })),
    ];
    queueRes(this, requests);
  }

  async create(): Promise<void> {
    generateAllTextures(this);
    try {
      await document.fonts.load(`${FONT_PX}px ${FONT}`, 'Pokémon Hollín ¡¿ÁÉÍÓÚÑ');
    } catch {
      // Si la fuente falla, Phaser usará la de reserva.
    }
    this.scene.start('Title');
  }
}
