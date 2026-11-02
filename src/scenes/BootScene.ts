import * as Phaser from 'phaser';
import { generateAllTextures } from '../ui/art/textures';
import { queueOfficialAssets, sliceFollowerSheets } from '../ui/assets';
import { FONT, FONT_PX } from '../ui/palette';

/** Carga la fuente, los sprites oficiales opcionales y genera las texturas propias. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    queueOfficialAssets(this);
  }

  async create(): Promise<void> {
    sliceFollowerSheets(this);
    generateAllTextures(this);
    try {
      await document.fonts.load(`${FONT_PX}px ${FONT}`, 'Pokémon Hollín ¡¿ÁÉÍÓÚÑ');
    } catch {
      // Si la fuente falla, Phaser usará la de reserva.
    }
    this.scene.start('Title');
  }
}
