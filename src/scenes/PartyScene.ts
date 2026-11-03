/**
 * Pantalla de equipo: ver el equipo, ordenar, y elegir Pokémon (para cambiar en
 * combate o usar un objeto). Se abre encima de otra escena.
 */
import * as Phaser from 'phaser';
import { displayName, moveToFront, type PartyMember } from '../core/party';
import { maxHp, moveName, speciesTypes } from '../battle/dex-service';
import { session } from '../game/session';
import { controls } from '../ui/input';
import { Menu, TextBox, textStyle } from '../ui/TextBox';
import { PALETTE, UI, GAME_W, GAME_H } from '../ui/palette';
import { assetKey, hasTexture, queueAssets } from '../ui/assets';
import { followerPlaceholderKey } from '../ui/art/textures';

export interface PartySceneData {
  /** view: solo mirar/ordenar · select: elegir uno (objetos) · switch: cambio en combate */
  mode: 'view' | 'select' | 'switch';
  prompt?: string;
  /** En combate: índices que no se pueden elegir (el activo). */
  disabled?: number[];
  /** Cambio obligatorio (no se puede cancelar). */
  forced?: boolean;
  /** Equipo a mostrar (en combate, el estado actual del combate). */
  party?: PartyMember[];
  onDone: (index: number) => void;
}

const ROW_H = 26;
const STATUS_ES: Record<string, string> = { brn: 'QUE', par: 'PAR', psn: 'ENV', tox: 'ENV', slp: 'DOR', frz: 'CON' };

export class PartyScene extends Phaser.Scene {
  private opts!: PartySceneData;
  private index = 0;
  private cursor!: Phaser.GameObjects.Graphics;
  private busy = false;
  private rowsContainer!: Phaser.GameObjects.Container;
  private textbox!: TextBox;

  constructor() {
    super('Party');
  }

  private get party(): PartyMember[] {
    return this.opts.party ?? session.state.party;
  }

  preload(): void {
    const party = (this.scene.settings.data as PartySceneData | undefined)?.party ?? session.state.party;
    queueAssets(this, party.map((m) => ['icons', m.species] as const).map(([k, s]) => [k, s]));
  }

  create(data: PartySceneData): void {
    this.opts = data;
    this.index = 0;
    this.busy = false;
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x2a2826).setOrigin(0);
    this.rowsContainer = this.add.container(0, 0);
    this.cursor = this.add.graphics();
    this.textbox = new TextBox(this, 2, 160, 252, 30);
    this.drawRows();
    this.textbox.setInstant(data.prompt ?? (data.mode === 'switch' ? '¿Quién sale ahora?' : 'Elige un Pokémon.'));
    controls.flush();
  }

  private drawRows(): void {
    this.rowsContainer.removeAll(true);
    this.party.forEach((m, i) => {
      const y = 4 + i * ROW_H;
      const g = this.add.graphics();
      const fainted = m.hp <= 0;
      g.fillStyle(fainted ? 0x5a4a44 : 0x3d3a3a).fillRect(4, y, GAME_W - 8, ROW_H - 2);
      g.fillStyle(fainted ? 0x7a5a50 : 0x524e47).fillRect(5, y + 1, GAME_W - 10, ROW_H - 4);
      const max = maxHp(m.species, m.level);
      const ratio = Math.max(0, m.hp / max);
      g.fillStyle(0x1a1a1c).fillRect(150, y + 15, 52, 5);
      g.fillStyle(ratio > 0.5 ? PALETTE.hpGood : ratio > 0.2 ? PALETTE.hpWarn : PALETTE.hpBad).fillRect(151, y + 16, Math.round(50 * ratio), 3);
      const icon = this.icon(m.species).setPosition(18, y + ROW_H - 4);
      const name = this.add.text(34, y + 5, displayName(m), textStyle(UI.light));
      const lvl = this.add.text(34, y + 15, `Nv${m.level}`, textStyle('#c9bfa8'));
      const hp = this.add.text(150, y + 5, `${m.hp}/${max}`, textStyle(UI.light));
      const status = m.status ? this.add.text(90, y + 15, STATUS_ES[m.status] ?? m.status.toUpperCase(), textStyle('#e8c46a')) : null;
      const disabled = this.opts.disabled?.includes(i);
      const tag = disabled ? this.add.text(206, y + 15, 'FUERA', textStyle('#e8c46a')) : null;
      this.rowsContainer.add([g, icon, name, lvl, hp, ...(status ? [status] : []), ...(tag ? [tag] : [])]);
    });
    this.drawCursor();
  }

  private icon(species: string): Phaser.GameObjects.Image | Phaser.GameObjects.Sprite {
    if (hasTexture(this, 'icons', species)) {
      const icon = this.add.sprite(0, 0, assetKey('icons', species), 0).setOrigin(0.5, 0.85);
      // Los iconos tienen dos fotogramas: se mueven como en los juegos.
      this.time.addEvent({ delay: 280, loop: true, callback: () => icon.active && icon.setFrame(Number(icon.frame.name) === 0 ? 1 : 0) });
      return icon;
    }
    return this.add.sprite(0, 0, followerPlaceholderKey(speciesTypes(species)[0]), 0).setOrigin(0.5, 1);
  }

  private drawCursor(): void {
    const y = 4 + this.index * ROW_H;
    this.cursor.clear();
    this.cursor.lineStyle(2, 0xe8c46a).strokeRect(3, y - 1, GAME_W - 6, ROW_H);
  }

  update(): void {
    if (this.busy) return;
    const dir = controls.tappedDir();
    if (dir === 'up' || dir === 'down') {
      const n = this.party.length;
      this.index = (this.index + (dir === 'up' ? -1 : 1) + n) % n;
      this.drawCursor();
    }
    if (controls.pressed('A')) void this.select();
    else if (controls.pressed('B') && !this.opts.forced) this.finish(-1);
  }

  private async select(): Promise<void> {
    this.busy = true;
    const m = this.party[this.index];
    if (this.opts.mode === 'view') {
      const menu = new Menu(this, ['MOVIMIENTOS', 'AL FRENTE', 'SALIR'], { right: GAME_W - 2, bottom: 158 });
      const choice = await menu.choose(2);
      menu.destroy();
      if (choice === 0) {
        const lines = m.moves.map((mv) => `${moveName(mv.id)} ${mv.pp}PP`);
        await this.textbox.say(lines.length ? [lines.slice(0, 2).join(' · '), ...(lines.length > 2 ? [lines.slice(2).join(' · ')] : [])] : ['No sabe nada.'], {
          keepOpen: true,
        });
      } else if (choice === 1) {
        moveToFront(session.state.party, this.index);
        this.index = 0;
        this.drawRows();
        await this.textbox.say(`${displayName(m)} irá delante.`, { keepOpen: true });
      }
      this.textbox.setInstant('Elige un Pokémon.');
      this.busy = false;
      return;
    }
    if (this.opts.mode === 'switch') {
      if (m.hp <= 0) {
        await this.textbox.say(`${displayName(m)} no puede luchar.`, { keepOpen: true });
        this.textbox.setInstant('¿Quién sale ahora?');
        this.busy = false;
        return;
      }
      if (this.opts.disabled?.includes(this.index)) {
        await this.textbox.say(`${displayName(m)} ya está combatiendo.`, { keepOpen: true });
        this.textbox.setInstant('¿Quién sale ahora?');
        this.busy = false;
        return;
      }
    }
    this.finish(this.index);
  }

  private finish(index: number): void {
    controls.flush();
    const done = this.opts.onDone;
    const parent = this.scene.manager.getScenes(false).find((s) => s.scene.key !== 'Party' && this.scene.isPaused(s.scene.key));
    this.scene.stop();
    if (parent) this.scene.resume(parent.scene.key);
    done(index);
  }
}
