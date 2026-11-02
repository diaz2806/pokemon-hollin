import * as Phaser from 'phaser';
import { PALETTE } from '../ui/palette';

export const TILE = 32;

/**
 * Genera texturas provisionales (placeholders) con formas simples.
 * Cuando haya assets reales, aquí se cargarán los sprites desde assets/.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.makeTile('tile-wall', (g) => {
      g.fillStyle(PALETTE.brick).fillRect(0, 0, TILE, TILE);
      g.lineStyle(2, PALETTE.brickLine);
      for (let y = 0; y < TILE; y += 8) g.lineBetween(0, y, TILE, y);
      for (let y = 0; y < TILE; y += 8) {
        const off = (y / 8) % 2 === 0 ? 0 : 8;
        for (let x = off; x < TILE; x += 16) g.lineBetween(x, y, x, y + 8);
      }
    });
    this.makeTile('tile-floor', (g) => {
      g.fillStyle(PALETTE.cobble).fillRect(0, 0, TILE, TILE);
      g.fillStyle(PALETTE.cobbleLine);
      g.fillRect(0, 15, TILE, 2).fillRect(15, 0, 2, 15).fillRect(7, 17, 2, 15).fillRect(23, 17, 2, 15);
    });
    this.makeTile('tile-water', (g) => {
      g.fillStyle(PALETTE.canal).fillRect(0, 0, TILE, TILE);
      g.fillStyle(PALETTE.canalLine).fillRect(4, 8, 10, 2).fillRect(18, 20, 10, 2);
    });
    this.makeTile('tile-smoke', (g) => {
      g.fillStyle(PALETTE.smoke).fillRect(0, 0, TILE, TILE);
      g.fillStyle(PALETTE.smokePuff, 0.6);
      g.fillCircle(9, 10, 6).fillCircle(22, 8, 5).fillCircle(16, 22, 7).fillCircle(27, 25, 4);
    });

    // Protagonista: abrigo oscuro y gorra con un toque de luz de gas.
    this.makeTile('player', (g) => {
      g.fillStyle(PALETTE.ink).fillEllipse(16, 29, 18, 5);
      g.fillStyle(0x3b3f47).fillRoundedRect(9, 13, 14, 15, 3);
      g.fillStyle(0xc9a98a).fillCircle(16, 10, 6);
      g.fillStyle(0x2a2a2e).fillRect(9, 3, 14, 5).fillRect(7, 7, 18, 2);
      g.fillStyle(PALETTE.gaslight).fillRect(12, 18, 2, 2);
    });
    // Pokémon que te sigue (placeholder): un perrito con brasas.
    this.makeTile('follower', (g) => {
      g.fillStyle(PALETTE.ink).fillEllipse(16, 28, 20, 5);
      g.fillStyle(PALETTE.furnace).fillEllipse(16, 20, 20, 13);
      g.fillCircle(10, 13, 6);
      g.fillStyle(PALETTE.gaslight).fillCircle(8, 12, 2).fillRect(18, 15, 6, 3);
      g.fillStyle(PALETTE.ink).fillCircle(9, 12, 1);
    });

    this.scene.start('Overworld');
  }

  private makeTile(key: string, draw: (g: Phaser.GameObjects.Graphics) => void): void {
    const g = this.add.graphics();
    draw(g);
    g.generateTexture(key, TILE, TILE);
    g.destroy();
  }
}
