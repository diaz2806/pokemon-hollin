import * as Phaser from 'phaser';
import { session } from '../game/session';
import { controls } from '../ui/input';
import { Menu, TextBox, textStyle } from '../ui/TextBox';
import { GAME_W, GAME_H, UI } from '../ui/palette';
import { officialAssetCount } from '../ui/assets';
import { playBgm, stopBgm } from '../ui/audio';

const INTRO = [
  'Ashbury, Inglaterra. 1923.',
  'Cuando acabó la Gran Guerra, las minas de carbón bajaron más hondo que nunca.',
  'Y en las vetas más profundas aparecieron criaturas que se alimentaban de calor: los Pokémon.',
  'Hargreave Industries los puso a trabajar en sus hornos. Ashbury se hizo rica... y negra de humo.',
  'Una ley prohíbe a cualquiera que no sea una fábrica tener Pokémon.',
  'Tú eres un huérfano que limpia las jaulas de la fábrica de Hargreave.',
  'Esta noche, algo va a salir muy mal.',
];

/** Pantalla de título, menú inicial e introducción. */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    void playBgm(this, 'title');
    this.add.image(0, 0, 'bg-alley').setOrigin(0).setScale(1, 1.34);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x0e0e14, 0.35).setOrigin(0);
    const smoke = this.add.particles(0, 70, 'puff', {
      x: { min: 0, max: GAME_W },
      speedY: { min: -10, max: -4 },
      speedX: { min: 3, max: 10 },
      scale: { start: 1, end: 4 },
      alpha: { start: 0.35, end: 0 },
      lifespan: 5000,
      frequency: 180,
    });
    smoke.setDepth(5);
    this.add.text(GAME_W / 2, 42, 'POKéMON', { ...textStyle('#e8c46a'), fontSize: '16px' }).setOrigin(0.5).setDepth(10);
    const title = this.add.text(GAME_W / 2, 66, 'HOLLÍN', { ...textStyle(UI.light), fontSize: '24px' }).setOrigin(0.5).setDepth(10);
    title.setShadow(2, 2, '#b4532a', 0, false, true);
    this.add.text(GAME_W / 2, 90, 'ASHBURY · 1923', textStyle('#c9bfa8')).setOrigin(0.5).setDepth(10);
    const press = this.add.text(GAME_W / 2, 140, 'PULSA A', textStyle(UI.light)).setOrigin(0.5).setDepth(10);
    this.tweens.add({ targets: press, alpha: 0, duration: 600, yoyo: true, repeat: -1 });
    const assets = officialAssetCount();
    this.add
      .text(4, GAME_H - 10, assets > 0 ? `${assets} sprites oficiales` : 'Fangame sin ánimo de lucro', { ...textStyle('#7a7066') })
      .setDepth(10);
    controls.flush();
    const waitA = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (controls.pressed('A') || controls.pressed('START')) {
          waitA.remove();
          press.destroy();
          void this.mainMenu();
        }
      },
    });
  }

  private async mainMenu(): Promise<void> {
    const options = session.hasSave() ? ['CONTINUAR', 'NUEVA PARTIDA'] : ['NUEVA PARTIDA'];
    const menu = new Menu(this, options, { x: GAME_W / 2 - 64, y: 118, width: 128 });
    const choice = await menu.choose(-1);
    menu.destroy();
    if (choice < 0) return this.mainMenu();
    if (options[choice] === 'CONTINUAR' && session.load()) {
      this.cameras.main.fadeOut(400);
      void stopBgm(this);
      this.time.delayedCall(420, () => this.scene.start('World'));
      return;
    }
    await this.newGame();
  }

  private async newGame(): Promise<void> {
    this.cameras.main.fadeOut(400);
    await new Promise((r) => this.time.delayedCall(420, r));
    this.children.removeAll(true);
    this.cameras.main.fadeIn(300);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x0e0e10).setOrigin(0);
    const box = new TextBox(this);
    await box.say(INTRO);
    await box.say('Por cierto... ¿cómo te llamas?', { keepOpen: true });
    const names = ['JACK', 'ARTHUR', 'ALFIE', 'ELEGIR'];
    const menu = new Menu(this, names, { right: 254, bottom: 140 });
    const i = await menu.choose(0);
    menu.destroy();
    let name = names[Math.max(0, i)];
    if (name === 'ELEGIR') {
      const typed = window.prompt('¿Cómo te llamas?', 'Jack')?.trim();
      name = typed ? typed.slice(0, 10).toUpperCase() : 'JACK';
    }
    session.startNew(name.charAt(0) + name.slice(1).toLowerCase());
    await box.say(`${session.state.playerName}. Bien. Ahora, despierta...`);
    this.cameras.main.fadeOut(500, 120, 30, 10);
    await new Promise((r) => this.time.delayedCall(520, r));
    void stopBgm(this);
    this.scene.start('World', { intro: true });
  }
}
