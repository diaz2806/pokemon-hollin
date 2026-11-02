import * as Phaser from 'phaser';
import '@fontsource/press-start-2p/400.css';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { WorldScene } from './scenes/WorldScene';
import { BattleScene } from './scenes/BattleScene';
import { PartyScene } from './scenes/PartyScene';
import { PALETTE, GAME_W, GAME_H } from './ui/palette';
import { bindTouchPad } from './ui/input';
import { session } from './game/session';

// En pantallas táctiles se muestra la cruceta y los botones bajo el juego.
if (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) {
  document.body.classList.add('touch');
}
bindTouchPad(document.getElementById('pad')!);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: PALETTE.night,
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, TitleScene, WorldScene, BattleScene, PartyScene],
});

// Con ?debug en la URL, se expone el juego en la consola para depurar.
if (new URLSearchParams(location.search).has('debug')) {
  Object.assign(window, { __game: game, __session: session });
}
