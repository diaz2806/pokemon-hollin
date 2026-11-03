/**
 * Escena de combate estilo DS. Las reglas las decide BattleAdapter (motor de
 * Showdown); aquí se dibuja, se anima y se recogen las órdenes del jugador.
 */
import * as Phaser from 'phaser';
import { BattleAdapter, type PokemonSpec } from '../battle/BattleAdapter';
import type { BattleStep, Side } from '../battle/log-es';
import { createMember, defaultMoves, maxHp, meta, moveInfo, speciesTypes } from '../battle/dex-service';
import { evolve, gainExp, pendingEvolution, replaceMove } from '../battle/progression';
import { expGain, levelProgress } from '../core/experience';
import { addCaught, displayName, speciesLabel, type PartyMember } from '../core/party';
import { markCaught } from '../core/game-state';
import { session } from '../game/session';
import { Menu, TextBox, drawFrame, textStyle } from '../ui/TextBox';
import { PALETTE, UI, GAME_W } from '../ui/palette';
import { assetKey, ensureAssets, hasTexture, queueAssets, transparentBottom } from '../ui/assets';
import { battlerPlaceholderKey, characterKey } from '../ui/art/textures';
import type { PartySceneData } from './PartyScene';

export interface BattleSceneData {
  kind: 'wild' | 'trainer';
  foes: { species: string; level: number; moves?: string[] }[];
  trainer?: {
    name: string;
    className: string;
    /** Paleta de personaje (para dibujarlo al empezar y al acabar). */
    sprite: string;
    money: number;
    defeat: string[];
  };
}

export interface BattleResult {
  outcome: 'won' | 'lost' | 'fled' | 'caught';
  caughtNew?: string;
}

const TYPE_ES: Record<string, string> = {
  Normal: 'NORMAL', Fire: 'FUEGO', Water: 'AGUA', Grass: 'PLANTA', Electric: 'ELÉCTR.', Ice: 'HIELO', Fighting: 'LUCHA',
  Poison: 'VENENO', Ground: 'TIERRA', Flying: 'VOLADOR', Psychic: 'PSÍQUICO', Bug: 'BICHO', Rock: 'ROCA', Ghost: 'FANTASMA',
  Dragon: 'DRAGÓN', Dark: 'SINIESTRO', Steel: 'ACERO', Fairy: 'HADA',
};

const STATUS_ES: Record<string, string> = { brn: 'QUE', par: 'PAR', psn: 'ENV', tox: 'ENV', slp: 'DOR', frz: 'CON' };

const FOE_POS = { x: 190, y: 86 };
const PLAYER_POS = { x: 70, y: 142 };

interface Databox {
  container: Phaser.GameObjects.Container;
  name: Phaser.GameObjects.Text;
  level: Phaser.GameObjects.Text;
  hpText?: Phaser.GameObjects.Text;
  bar: Phaser.GameObjects.Rectangle;
  exp?: Phaser.GameObjects.Rectangle;
  status: Phaser.GameObjects.Text;
  smoke: Phaser.GameObjects.Text;
  maxHp: number;
  hp: number;
}

export class BattleScene extends Phaser.Scene {
  private adapter!: BattleAdapter;
  private setup!: BattleSceneData;
  private party!: PartyMember[];
  private textbox!: TextBox;
  private foeSprite!: Phaser.GameObjects.Image;
  private playerSprite!: Phaser.GameObjects.Image;
  private foeBox!: Databox;
  private playerBox!: Databox;
  private foeSpecs: PokemonSpec[] = [];
  private faintedFoes: PokemonSpec[] = [];
  private foeIndex = 0;
  private foeFainted = false;

  constructor() {
    super('Battle');
  }

  /** Carga los sprites oficiales de los que van a combatir (si existen en assets/). */
  preload(): void {
    // Phaser no pasa los datos a preload(): están en settings.data.
    const data = this.scene.settings.data as BattleSceneData;
    queueAssets(this, [
      ...data.foes.map((f) => ['front', f.species] as ['front', string]),
      ...session.state.party.map((m) => ['back', m.species] as ['back', string]),
      ...session.state.party.map((m) => ['front', m.species] as ['front', string]),
    ]);
  }

  create(data: BattleSceneData): void {
    this.setup = data;
    this.party = session.state.party.map((m) => ({ ...m, moves: m.moves.map((mv) => ({ ...mv })) }));
    this.foeSpecs = data.foes.map((f) => ({ species: f.species, level: f.level, moves: f.moves ?? defaultMoves(f.species, f.level) }));
    this.faintedFoes = [];
    this.foeIndex = 0;
    this.foeFainted = false;
    this.adapter = new BattleAdapter(this.party, this.foeSpecs, { foeLabel: data.kind === 'wild' ? 'salvaje' : 'rival' });

    this.add.image(0, 0, 'bg-alley').setOrigin(0);
    this.foeSprite = this.add.image(FOE_POS.x, FOE_POS.y, this.battlerTexture(this.adapter.opponent.species, false));
    this.playerSprite = this.add.image(PLAYER_POS.x, PLAYER_POS.y, this.battlerTexture(this.adapter.player.species, true));
    this.seat(this.foeSprite);
    this.seat(this.playerSprite);
    this.foeBox = this.databox(false);
    this.playerBox = this.databox(true);
    this.textbox = new TextBox(this);
    this.cameras.main.fadeIn(300);
    void this.run();
  }

  // ---------- Flujo principal ----------

  private async run(): Promise<void> {
    // Entrada: el rival aparece desde la izquierda y tu Pokémon desde la derecha.
    this.foeSprite.x = -60;
    this.playerSprite.x = GAME_W + 60;
    this.foeBox.container.setVisible(false);
    this.playerBox.container.setVisible(false);
    const t = this.setup.trainer;
    const foe = this.adapter.opponent;
    if (t) {
      // El entrenador aparece primero, reta al jugador y se aparta.
      const trainerSprite = this.add.sprite(-60, FOE_POS.y + 2, characterKey(t.sprite), 0).setOrigin(0.5, 1).setScale(3).setDepth(10);
      await this.tween({ targets: trainerSprite, x: FOE_POS.x, duration: 600, ease: 'Quad.Out' });
      await this.say(`¡${t.className} ${t.name} te desafía!`);
      await this.tween({ targets: trainerSprite, x: GAME_W + 60, duration: 400, ease: 'Quad.In' });
      trainerSprite.destroy();
      await this.say(`¡${t.name} saca a ${foe.name}!`, 700);
    }
    await this.tween({ targets: this.foeSprite, x: FOE_POS.x, duration: t ? 350 : 600, ease: 'Quad.Out' });
    this.refreshBox(this.foeBox, false);
    this.foeBox.container.setVisible(true);
    if (!t) await this.say(`¡Un ${foe.name} salvaje sale de entre el humo!`);
    await this.say(`¡Adelante, ${this.adapter.player.name}!`, 700);
    await this.tween({ targets: this.playerSprite, x: PLAYER_POS.x, duration: 400, ease: 'Quad.Out' });
    this.refreshBox(this.playerBox, true);
    this.playerBox.container.setVisible(true);

    while (!this.adapter.ended) {
      if (this.adapter.needsSwitch) {
        await this.forcedSwitch();
        continue;
      }
      const done = await this.commandMenu();
      if (done) break;
    }
    await this.finish();
  }

  /** Devuelve true si el combate termina por una acción especial (captura/huida). */
  private async commandMenu(): Promise<boolean> {
    const name = this.adapter.player.name;
    this.textbox.setLines('¿Qué hará', `${name}?`);
    const menu = new Menu(this, ['LUCHAR', 'MOCHILA', 'POKéMON', 'HUIR'], { right: 254, bottom: 190, columns: 2 });
    const choice = await menu.choose(-1);
    menu.destroy();
    switch (choice) {
      case 0:
        return this.fightMenu();
      case 1:
        return this.bagMenu();
      case 2:
        return this.switchMenu();
      case 3:
        return this.tryRun();
      default:
        return false;
    }
  }

  private async fightMenu(): Promise<boolean> {
    const moves = this.adapter.moves;
    const info = this.add.container(0, 0).setDepth(1150);
    const infoBg = this.add.graphics();
    drawFrame(infoBg, 150, 110, 104, 32);
    const infoText = this.add.text(160, 120, '', textStyle());
    info.add([infoBg, infoText]);
    const showInfo = (i: number) => {
      const m = moves[i];
      if (m) infoText.setText(`PP ${m.pp}/${m.maxPp}\n${TYPE_ES[m.type] ?? m.type}`);
    };
    const menu = new Menu(
      this,
      moves.map((m) => m.name.toUpperCase().slice(0, 12)),
      { x: 2, y: 142, width: 252, columns: 2 },
      showInfo,
    );
    showInfo(0);
    const choice = await menu.choose(-1);
    menu.destroy();
    info.destroy();
    if (choice < 0) return false;
    const move = moves[choice];
    if (move.pp <= 0) {
      await this.say('¡No quedan PP para este movimiento!');
      return false;
    }
    await this.play(this.adapter.fight(move.slot));
    return false;
  }

  private async bagMenu(): Promise<boolean> {
    const bag = session.state.bag;
    const menu = new Menu(this, [`POKé BALL x${bag.pokeball}`, `POCIÓN    x${bag.potion}`, 'ATRÁS'], { right: 254, bottom: 140 });
    const choice = await menu.choose(2);
    menu.destroy();
    if (choice === 0) {
      if (bag.pokeball <= 0) {
        await this.say('No te quedan Poké Balls.');
        return false;
      }
      if (this.setup.kind === 'trainer') {
        await this.say(['¡El rival bloquea la Poké Ball!', '¡No puedes robar el Pokémon de otro!']);
        return false;
      }
      bag.pokeball--;
      return this.throwBall();
    }
    if (choice === 1) {
      if (bag.potion <= 0) {
        await this.say('No te quedan pociones.');
        return false;
      }
      const index = await this.pickPartyMember({ mode: 'select', prompt: '¿A quién le das la Poción?' });
      if (index < 0) return false;
      const healed = this.adapter.heal(index, 20);
      if (healed === 0) {
        await this.say('No tendría ningún efecto.');
        return false;
      }
      bag.potion--;
      if (index === this.adapter.activeIndex) await this.animateHp(this.playerBox, this.adapter.player.hp, this.adapter.player.maxHp);
      await this.say(`${displayName(this.party[index])} ha recuperado ${healed} PS.`);
      await this.play(this.adapter.passTurn());
    }
    return false;
  }

  private async switchMenu(): Promise<boolean> {
    const index = await this.pickPartyMember({ mode: 'switch', disabled: [this.adapter.activeIndex] });
    if (index < 0) return false;
    await this.say(`¡${this.adapter.player.name}, vuelve!`, 600);
    await this.tween({ targets: this.playerSprite, x: -60, duration: 300 });
    await this.play(this.adapter.switchTo(index));
    return false;
  }

  private async forcedSwitch(): Promise<void> {
    const index = await this.pickPartyMember({ mode: 'switch', forced: true, disabled: [this.adapter.activeIndex] });
    await this.play(this.adapter.switchTo(index));
  }

  private async tryRun(): Promise<boolean> {
    if (this.setup.kind === 'trainer') {
      await this.say('¡No puedes huir de un combate contra un entrenador!');
      return false;
    }
    const r = this.adapter.run(Math.random);
    if (r.escaped) {
      await this.say('¡Escapaste sin problemas!');
      return true;
    }
    await this.say('¡No has podido escapar!');
    await this.play(r.steps);
    return false;
  }

  // ---------- Captura ----------

  private async throwBall(): Promise<boolean> {
    await this.say(`¡${session.state.playerName} lanza una Poké Ball!`, 500);
    const ball = this.add.image(40, 150, 'ball').setDepth(500);
    const target = { x: FOE_POS.x, y: FOE_POS.y - 30 };
    await this.tween({ targets: ball, x: target.x, duration: 500, ease: 'Linear' });
    ball.y = target.y;
    // El Pokémon entra en la ball.
    this.foeSprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    await this.tween({ targets: this.foeSprite, scale: 0, duration: 250 });
    await this.tween({ targets: ball, y: FOE_POS.y - 6, duration: 300, ease: 'Bounce.Out' });

    const speciesMeta = meta(this.adapter.opponent.species);
    const result = this.adapter.throwBall(speciesMeta.catchRate, Math.random);
    for (let i = 0; i < result.shakes; i++) {
      await this.wait(350);
      await this.tween({ targets: ball, angle: i % 2 === 0 ? -25 : 25, duration: 120, yoyo: true });
    }
    await this.wait(400);
    if (result.caught) {
      for (let i = 0; i < 3; i++) {
        const star = this.add.image(ball.x, ball.y, 'star').setDepth(501);
        this.tweens.add({ targets: star, x: ball.x + (i - 1) * 14, y: ball.y - 16, alpha: 0, duration: 600 });
      }
      await this.say(`¡Ya está! ¡Has atrapado a ${this.adapter.opponent.name}!`);
      ball.destroy();
      return true;
    }
    ball.destroy();
    this.foeSprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    await this.tween({ targets: this.foeSprite, scale: 1, duration: 200 });
    const msgs = ['¡Oh, no! ¡El Pokémon se ha escapado!', '¡Vaya! ¡Parecía que lo tenías!', '¡Qué rabia! ¡Casi lo consigues!', '¡Por un pelo!'];
    await this.say(msgs[Math.min(result.shakes, 3)]);
    await this.play(result.steps);
    return false;
  }

  // ---------- Reproducción de pasos ----------

  private async play(steps: BattleStep[]): Promise<void> {
    for (const s of steps) {
      switch (s.kind) {
        case 'text':
          await this.say(s.text);
          break;
        case 'move':
          await this.lunge(s.side);
          break;
        case 'hp': {
          const box = s.side === 'p1' ? this.playerBox : this.foeBox;
          const sprite = s.side === 'p1' ? this.playerSprite : this.foeSprite;
          this.setStatus(box, s.status);
          if (s.hp >= 0) {
            const max = s.side === 'p1' && s.hp > 0 ? s.maxHp : box.maxHp;
            const target = s.side === 'p1' ? s.hp : Math.round((s.hp / s.maxHp) * box.maxHp);
            if (target < box.hp) await this.blink(sprite);
            await this.animateHp(box, target, max);
          }
          break;
        }
        case 'faint': {
          const sprite = s.side === 'p1' ? this.playerSprite : this.foeSprite;
          await this.tween({ targets: sprite, y: sprite.y + 40, alpha: 0, duration: 350, ease: 'Quad.In' });
          if (s.side === 'p2') {
            this.foeFainted = true;
            this.faintedFoes.push(this.foeSpecs[this.foeIndex]);
          }
          break;
        }
        case 'switch':
          await this.sendOut(s.side);
          break;
      }
      this.refreshTiznado();
    }
  }

  private async sendOut(side: Side): Promise<void> {
    if (side === 'p1') {
      const p = this.adapter.player;
      this.playerSprite.setTexture(this.battlerTexture(p.species, true)).setAlpha(1).setPosition(GAME_W + 60, PLAYER_POS.y);
      this.seat(this.playerSprite);
      this.refreshBox(this.playerBox, true);
      await this.say(`¡Adelante, ${p.name}!`, 600);
      await this.tween({ targets: this.playerSprite, x: PLAYER_POS.x, duration: 350 });
    } else {
      this.foeIndex++;
      this.foeFainted = false;
      const f = this.adapter.opponent;
      this.foeSprite.setTexture(this.battlerTexture(f.species, false)).setAlpha(1).setScale(1).setPosition(-60, FOE_POS.y);
      this.seat(this.foeSprite);
      this.refreshBox(this.foeBox, false);
      await this.say(`¡${this.setup.trainer?.name ?? 'El rival'} saca a ${f.name}!`, 600);
      await this.tween({ targets: this.foeSprite, x: FOE_POS.x, duration: 350 });
    }
  }

  // ---------- Final del combate ----------

  private async finish(): Promise<void> {
    let party = this.adapter.exportParty(this.party);
    let outcome: BattleResult['outcome'];
    let caughtNew: string | undefined;

    if (this.adapter.wasCaptured) {
      outcome = 'caught';
      const foe = this.adapter.opponent;
      const spec = this.foeSpecs[this.foeIndex];
      const caught = createMember(foe.species, foe.level, spec.moves);
      caught.hp = Math.max(1, Math.round((foe.hp / foe.maxHp) * maxHp(foe.species, foe.level)));
      caught.status = foe.status;
      markCaught(session.state, foe.species);
      const where = addCaught(party, session.state.box, caught);
      if (where === 'box') await this.say(`${foe.name} se ha enviado a la caja del PC.`);
      else caughtNew = foe.name;
    } else if (this.adapter.hasFled) {
      outcome = 'fled';
    } else if (this.adapter.winner === 'player') {
      outcome = 'won';
      party = await this.awardExp(party);
      const t = this.setup.trainer;
      if (t) {
        const sprite = this.add.sprite(GAME_W + 60, FOE_POS.y + 2, characterKey(t.sprite), 0).setOrigin(0.5, 1).setScale(3).setDepth(10);
        await this.tween({ targets: sprite, x: FOE_POS.x, duration: 400 });
        await this.say(`¡Has derrotado a ${t.className} ${t.name}!`);
        await this.say(t.defeat);
        session.state.money += t.money;
        await this.say(`¡Has ganado ${t.money} chelines!`);
      }
    } else {
      outcome = 'lost';
      await this.say(['¡No te quedan Pokémon en condiciones de luchar!', 'Todo se vuelve negro entre el humo...']);
    }

    if (outcome !== 'lost') party = await this.evolutions(party);
    session.state.party = party;
    await this.wait(200);
    this.cameras.main.fadeOut(300);
    await this.wait(320);
    this.textbox.hide();
    const result: BattleResult = { outcome, caughtNew };
    this.scene.stop();
    this.scene.wake('World', result);
  }

  private async awardExp(party: PartyMember[]): Promise<PartyMember[]> {
    const trainer = this.setup.kind === 'trainer';
    const participants = [...this.adapter.participants].filter((i) => party[i] && party[i].hp > 0);
    if (participants.length === 0) return party;
    const out = party.map((m) => ({ ...m, moves: m.moves.map((mv) => ({ ...mv })) }));
    for (const foe of this.faintedFoes.length > 0 ? this.faintedFoes : [this.foeSpecs[this.foeIndex]]) {
      const total = expGain(meta(foe.species).baseExp, foe.level, trainer);
      const each = Math.max(1, Math.floor(total / participants.length));
      for (const i of participants) {
        const before = out[i];
        await this.say(`¡${displayName(before)} ha ganado ${each} puntos de experiencia!`);
        const { member, events } = gainExp(before, each);
        out[i] = member;
        const active = i === this.adapter.activeIndex;
        if (active) await this.animateExp(before, member);
        for (const e of events) {
          if (e.kind === 'levelUp') {
            if (active) {
              this.playerBox.level.setText(`Nv${e.level}`);
              this.playerBox.maxHp = maxHp(member.species, e.level);
            }
            await this.say(`¡${displayName(member)} ha subido al nivel ${e.level}!`);
          } else if (e.kind === 'learned') {
            await this.say(`¡${displayName(member)} ha aprendido ${moveInfo(e.move).name}!`);
          } else {
            out[i] = await this.askToLearn(out[i], e.move);
          }
        }
        if (active) {
          this.playerBox.hp = Math.min(this.playerBox.maxHp, Math.max(0, this.playerBox.hp + (member.hp - before.hp)));
          this.refreshBoxNumbers(this.playerBox);
        }
      }
    }
    return out;
  }

  private async animateExp(before: PartyMember, after: PartyMember): Promise<void> {
    const bar = this.playerBox.exp;
    if (!bar) return;
    const growth = meta(after.species).growth;
    if (after.level > before.level) {
      await this.tween({ targets: bar, width: 64, duration: 400 });
      bar.width = 0;
    }
    await this.tween({ targets: bar, width: Math.round(64 * levelProgress(growth, after.level, after.exp)), duration: 500 });
  }

  private async askToLearn(member: PartyMember, move: string): Promise<PartyMember> {
    const name = displayName(member);
    const moveEs = moveInfo(move).name;
    await this.say([`${name} quiere aprender ${moveEs}.`, `Pero ${name} ya conoce cuatro movimientos.`]);
    const yes = await this.textbox.ask(`¿Olvidar uno para aprender ${moveEs}?`, ['SÍ', 'NO']);
    if (yes === 0) {
      this.textbox.setInstant('¿Cuál quieres olvidar?');
      const menu = new Menu(this, [...member.moves.map((m) => moveInfo(m.id).name.toUpperCase()), 'CANCELAR'], { right: 254, bottom: 140 });
      const forget = await menu.choose(member.moves.length);
      menu.destroy();
      if (forget >= 0 && forget < member.moves.length) {
        const old = moveInfo(member.moves[forget].id).name;
        await this.say(['1, 2 y... ¡Puf!', `${name} ha olvidado ${old}...`, `...¡y ha aprendido ${moveEs}!`]);
        return replaceMove(member, forget, move);
      }
    }
    await this.say(`${name} no ha aprendido ${moveEs}.`);
    return member;
  }

  private async evolutions(party: PartyMember[]): Promise<PartyMember[]> {
    const out = [...party];
    for (let i = 0; i < out.length; i++) {
      const into = out[i].hp > 0 ? pendingEvolution(out[i]) : null;
      if (!into) continue;
      const name = displayName(out[i]);
      await ensureAssets(this, [['front', into]]);
      this.textbox.hide();
      this.cameras.main.flash(300, 255, 255, 255);
      await this.say(`¿Eh? ¡${name} está evolucionando!`);
      const sprite = this.add.image(128, 100, this.battlerTexture(out[i].species, false)).setDepth(900);
      const bg = this.add.rectangle(0, 0, GAME_W, 192, 0x141416).setOrigin(0).setDepth(899);
      for (let k = 0; k < 6; k++) {
        sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
        await this.wait(140 - k * 15);
        sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
        await this.wait(140 - k * 15);
      }
      sprite.setTexture(this.battlerTexture(into, false));
      this.cameras.main.flash(400, 255, 255, 255);
      out[i] = evolve(out[i], into);
      await this.say(`¡Enhorabuena! ¡${name} ha evolucionado en ${speciesLabel(into)}!`);
      markCaught(session.state, into);
      sprite.destroy();
      bg.destroy();
    }
    return out;
  }

  // ---------- Interfaz ----------

  /** Apoya el dibujo sobre la plataforma: el origen pasa al primer píxel visible desde abajo. */
  private seat(sprite: Phaser.GameObjects.Image): void {
    const gap = transparentBottom(this, sprite.texture.key);
    sprite.setOrigin(0.5, 1 - gap / sprite.height);
  }

  private battlerTexture(species: string, back: boolean): string {
    const kind = back ? 'back' : 'front';
    if (hasTexture(this, kind, species)) return assetKey(kind, species);
    return battlerPlaceholderKey(speciesTypes(species)[0], back);
  }

  private databox(player: boolean): Databox {
    const x = player ? 128 : 6;
    const y = player ? 92 : 10;
    const w = 124;
    const h = player ? 44 : 32;
    const g = this.add.graphics();
    g.fillStyle(UI.frameDarkN).fillRect(x, y, w, h);
    g.fillStyle(0xe8e2d4).fillRect(x + 1, y + 1, w - 2, h - 2);
    g.fillStyle(UI.frameN).fillRect(x + 1, y + h - 3, w - 2, 2);
    const name = this.add.text(x + 6, y + 5, '', textStyle());
    const level = this.add.text(x + w - 38, y + 5, '', textStyle());
    g.fillStyle(0x2a2622).fillRect(x + w - 74, y + 17, 68, 7);
    const psLabel = this.add.text(x + w - 89, y + 16, 'PS', textStyle('#b4532a'));
    const barBg = this.add.rectangle(x + w - 72, y + 18, 64, 5, 0x5a5550).setOrigin(0);
    const bar = this.add.rectangle(x + w - 72, y + 18, 64, 5, PALETTE.hpGood).setOrigin(0);
    const status = this.add.text(x + 6, y + 16, '', textStyle('#b4532a'));
    const smoke = this.add.text(x + 6, y + (player ? 26 : 16), '', textStyle('#5c5850'));
    const parts: Phaser.GameObjects.GameObject[] = [g, name, level, psLabel, barBg, bar, status, smoke];
    let hpText: Phaser.GameObjects.Text | undefined;
    let exp: Phaser.GameObjects.Rectangle | undefined;
    if (player) {
      hpText = this.add.text(x + w - 72, y + 27, '', textStyle());
      const expBg = this.add.rectangle(x + w - 72, y + 37, 64, 2, 0x5a5550).setOrigin(0);
      exp = this.add.rectangle(x + w - 72, y + 37, 0, 2, PALETTE.exp).setOrigin(0);
      parts.push(hpText, expBg, exp);
    }
    const container = this.add.container(0, 0, parts).setDepth(400);
    return { container, name, level, hpText, bar, exp, status, smoke, maxHp: 1, hp: 1 };
  }

  private refreshBox(box: Databox, player: boolean): void {
    const v = player ? this.adapter.player : this.adapter.opponent;
    box.name.setText(v.name.slice(0, 10));
    box.level.setText(`Nv${v.level}`);
    box.maxHp = v.maxHp;
    box.hp = v.hp;
    this.setStatus(box, v.status);
    this.refreshBoxNumbers(box);
    if (player && box.exp) {
      const m = this.party[this.adapter.activeIndex];
      box.exp.width = Math.round(64 * levelProgress(meta(m.species).growth, m.level, m.exp));
    }
    this.refreshTiznado();
  }

  private refreshBoxNumbers(box: Databox): void {
    const ratio = box.maxHp > 0 ? box.hp / box.maxHp : 0;
    box.bar.width = Math.max(0, Math.round(64 * ratio));
    box.bar.fillColor = ratio > 0.5 ? PALETTE.hpGood : ratio > 0.2 ? PALETTE.hpWarn : PALETTE.hpBad;
    box.hpText?.setText(`${Math.max(0, box.hp)}/${box.maxHp}`.padStart(7, ' '));
  }

  private setStatus(box: Databox, status: string): void {
    box.status.setText(STATUS_ES[status] ?? '');
  }

  private refreshTiznado(): void {
    const playerBlind = this.adapter.player.tiznado;
    this.playerBox.smoke.setText(playerBlind ? 'HUMO' : '');
    this.foeBox.smoke.setText(this.adapter.opponent.tiznado ? 'HUMO' : '');
    if (this.foeBox.smoke.text) this.foeBox.status.setText('');
    // Si TU Pokémon está tiznado, no distingues bien al rival.
    if (!this.foeFainted) this.foeSprite.setAlpha(playerBlind ? 0.35 : 1);
    this.foeBox.bar.setAlpha(playerBlind ? 0.15 : 1);
  }

  private async animateHp(box: Databox, hp: number, max: number): Promise<void> {
    box.maxHp = max;
    const from = box.hp;
    const to = Math.max(0, hp);
    if (from === to) return this.refreshBoxNumbers(box);
    const counter = { v: from };
    await this.tween({
      targets: counter,
      v: to,
      duration: Math.min(900, 200 + Math.abs(from - to) * 25),
      onUpdate: () => {
        box.hp = Math.round(counter.v);
        this.refreshBoxNumbers(box);
      },
    });
    box.hp = to;
    this.refreshBoxNumbers(box);
  }

  private async lunge(side: Side): Promise<void> {
    const sprite = side === 'p1' ? this.playerSprite : this.foeSprite;
    const dx = side === 'p1' ? 14 : -14;
    await this.tween({ targets: sprite, x: sprite.x + dx, duration: 90, yoyo: true });
  }

  private async blink(sprite: Phaser.GameObjects.Image): Promise<void> {
    for (let i = 0; i < 3; i++) {
      sprite.setVisible(false);
      await this.wait(60);
      sprite.setVisible(true);
      await this.wait(60);
    }
  }

  private pickPartyMember(opts: Omit<PartySceneData, 'onDone' | 'party'>): Promise<number> {
    return new Promise((resolve) => {
      this.scene.launch('Party', {
        ...opts,
        party: this.adapter.exportParty(this.party),
        onDone: (i: number) => resolve(i),
      } satisfies PartySceneData);
      this.scene.pause();
    });
  }

  private say(text: string | string[], autoMs = 1400): Promise<void> {
    return this.textbox.say(text, { keepOpen: true, autoMs });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, r));
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({ ...config, onComplete: () => resolve() });
    });
  }
}

