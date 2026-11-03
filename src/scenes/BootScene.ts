import * as Phaser from 'phaser';
import { generateAllTextures } from '../ui/art/textures';
import { FONT, FONT_PX } from '../ui/palette';

/** Carga la fuente, los sprites oficiales opcionales y genera las texturas propias. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
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
