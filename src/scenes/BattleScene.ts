/**
 * Escena de combate estilo DS. Las reglas las decide BattleAdapter (motor de
 * Showdown); aquí se dibuja, se anima y se recogen las órdenes del jugador.
 */
import * as Phaser from 'phaser';
import { BattleAdapter, type PokemonSpec } from '../battle/BattleAdapter';
import type { BattleStep, Side } from '../battle/log-es';
import { createMember, defaultMoves, maxHp, meta, moveInfo, speciesTypes, typeMultiplier } from '../battle/dex-service';
import { evolve, gainExp, pendingEvolution, replaceMove } from '../battle/progression';
import { expGain, levelProgress } from '../core/experience';
import { addCaught, displayName, speciesLabel, type PartyMember } from '../core/party';
import { markCaught } from '../core/game-state';
import { session } from '../game/session';
import { Menu, TextBox, makeFrame, textStyle } from '../ui/TextBox';
import { BATTLE_BACK, STATUS_LABEL, TYPE_COLOR, TYPE_ROW, TYPE_SHORT_ES, labelStyle, battleResources, battlebackParts, chooseButtons, essentialsBattleUi } from '../ui/battle-ui';
import { SmokeLayer, animationFor, ballSendOut, playSheet } from '../ui/battle-fx';
import { SMOKE_NATIVE_TYPES } from '../battle/hollin-mod';
import { queueRes, resKey, resReady } from '../ui/resources';
import { playBgm, playCry, playMe, playSe, stopBgm } from '../ui/audio';
import { speciesBaseId } from '../battle/dex-service';
import { PALETTE, UI, GAME_W } from '../ui/palette';
import { assetKey, ensureAssets, hasTexture, queueAssets, transparentBottom } from '../ui/assets';
import { battlerPlaceholderKey, characterKey } from '../ui/art/textures';
import type { PartySceneData } from './PartyScene';

export interface BattleSceneData {
  kind: 'wild' | 'trainer';
  /** Densidad de humo de la zona (0-3); ver `humo` en hollin-mod. */
  smoke?: number;
  /** Fondo de combate de Essentials (p. ej. 'city_night', 'rocky_night', 'indoor1'). */
  back?: string;
  foes: { species: string; level: number; moves?: string[] }[];
  trainer?: {
    name: string;
    className: string;
    /** Paleta de personaje (para dibujarlo al empezar y al acabar). */
    sprite: string;
    /** Sprite de combate de Essentials (si existe en assets/trainers). */
    battler?: string;
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

/** Texto al empezar según la densidad de humo de la zona. */
const ZONE_SMOKE_TEXT = ['', 'Una neblina de hollín cubre el lugar.', 'El humo es espeso: cuesta ver al rival.', '¡Hollín negro! El aire quema y no se ve nada.'];

function effectLabel(mult: number): [string, string] {
  if (mult === 0) return ['NO AFECTA', '#8a8478'];
  if (mult >= 2) return ['EFICAZ', '#f2c14e'];
  if (mult < 1) return ['POCO EFICAZ', '#a9a29a'];
  return ['NORMAL', '#d9d2c3'];
}

const FOE_POS = { x: 190, y: 86 };
const PLAYER_POS = { x: 70, y: 142 };

interface Databox {
  container: Phaser.GameObjects.Container;
  name: Phaser.GameObjects.Text;
  level: Phaser.GameObjects.Text;
  hpText?: Phaser.GameObjects.Text;
  /** Pinta la barra de PS (0-1). */
  setHpRatio: (ratio: number) => void;
  /** Pinta la barra de EXP (0-1). */
  setExpRatio?: (ratio: number) => void;
  /** Para animar la EXP con tweens. */
  expValue: { v: number };
  status: Phaser.GameObjects.Text;
  /** El estado se pinta como etiqueta de color (interfaz de Essentials). */
  labelStatus?: boolean;
  smoke: Phaser.GameObjects.Text;
  /** Barra de PS (para atenuarla cuando hay humo). */
  barObject: { setAlpha(value: number): unknown };
  maxHp: number;
  hp: number;
}

/** Posiciones con la interfaz de Essentials (fondo de 256x144 encima del mensaje). */
const ESS_FOE_POS = { x: 192, y: 82 };
const ESS_PLAYER_POS = { x: 64, y: 146 };

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
  /** ¿Hay gráficos de Essentials para el combate? */
  private ess = false;
  private foePos = FOE_POS;
  private playerPos = PLAYER_POS;
  /** Último mensaje de eficacia, para el sonido del golpe. */
  private lastCommand = 0;
  private lastMove = 0;
  private smoke!: SmokeLayer;
  /** Respiración en reposo: los sprites suben y bajan 1 px (desactivado durante animaciones). */
  private idle = { p1: false, p2: false };
  private idleClock = 0;
  private idleUp = false;

  constructor() {
    super('Battle');
  }

  /** Carga los sprites oficiales de los que van a combatir (si existen en assets/). */
  preload(): void {
    // Phaser no pasa los datos a preload(): están en settings.data.
    const data = this.scene.settings.data as BattleSceneData;
    queueRes(this, battleResources(data.back ?? BATTLE_BACK));
    if (data.trainer?.battler) queueRes(this, [{ cat: 'trainers', name: data.trainer.battler }]);
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
    this.adapter = new BattleAdapter(this.party, this.foeSpecs, {
      foeLabel: data.kind === 'wild' ? 'salvaje' : 'rival',
      smoke: data.smoke ?? 0,
    });
    this.idle = { p1: false, p2: false };

    const back = data.back ?? BATTLE_BACK;
    const parts = battlebackParts(back);
    this.ess = essentialsBattleUi(this, back);
    this.foePos = this.ess ? ESS_FOE_POS : FOE_POS;
    this.playerPos = this.ess ? ESS_PLAYER_POS : PLAYER_POS;
    if (this.ess) {
      this.add.image(0, 0, resKey('battlebacks', parts.bg)).setOrigin(0);
      this.add.image(this.foePos.x, this.foePos.y + 10, resKey('battlebacks', parts.base1)).setOrigin(0.5, 0.5);
      this.add.image(this.playerPos.x, 144, resKey('battlebacks', parts.base0)).setOrigin(0.5, 1);
    } else {
      this.add.image(0, 0, 'bg-alley').setOrigin(0);
    }
    this.foeSprite = this.add.image(this.foePos.x, this.foePos.y, this.battlerTexture(this.adapter.opponent.species, false));
    this.playerSprite = this.add.image(this.playerPos.x, this.playerPos.y, this.battlerTexture(this.adapter.player.species, true));
    this.seat(this.foeSprite);
    this.seat(this.playerSprite);
    this.smoke = new SmokeLayer(this, GAME_W, this.ess ? 144 : 192);
    this.smoke.setLevel(this.adapter.smoke, false);
    this.smoke.setVisible(false);
    if (this.ess) this.add.image(0, 144, resKey('battlebacks', parts.message)).setOrigin(0).setDepth(900);
    this.foeBox = this.databox(false);
    this.playerBox = this.databox(true);
    this.textbox = this.ess ? new TextBox(this, 2, 142, 252, 48, false) : new TextBox(this);
    void playBgm(this, data.kind === 'trainer' ? 'battle_trainer' : 'battle_wild');
    this.cameras.main.fadeIn(300);
    void this.run();
  }

  update(_time: number, delta: number): void {
    this.smoke?.update(delta);
    this.idleClock += delta;
    if (this.idleClock < 450) return;
    this.idleClock = 0;
    this.idleUp = !this.idleUp;
    // Paso de 1 px, a destiempo entre los dos, como la "respiración" de los juegos de DS.
    if (this.idle.p2) this.foeSprite.y = this.foePos.y + (this.idleUp ? -1 : 0);
    if (this.idle.p1) this.playerSprite.y = this.playerPos.y + (this.idleUp ? 0 : -1);
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
      const trainerSprite = this.trainerSprite(-60);
      await this.tween({ targets: trainerSprite, x: this.foePos.x, duration: 600, ease: 'Quad.Out' });
      await this.say(`¡${t.className} ${t.name} te desafía!`);
      await this.tween({ targets: trainerSprite, x: GAME_W + 60, duration: 400, ease: 'Quad.In' });
      trainerSprite.destroy();
      await this.say(`¡${t.name} saca a ${foe.name}!`, 700);
      this.foeSprite.x = this.foePos.x;
      playSe(this, 'battle_throw');
      await ballSendOut(this, { x: GAME_W + 10, y: 30 }, { x: this.foePos.x, y: this.foePos.y - 20 }, this.foeSprite);
    } else {
      await this.tween({ targets: this.foeSprite, x: this.foePos.x, duration: 600, ease: 'Quad.Out' });
    }
    this.idle.p2 = true;
    this.refreshBox(this.foeBox, false);
    this.foeBox.container.setVisible(true);
    this.cry(foe.species);
    if (!t) await this.say(`¡Un ${foe.name} salvaje sale de entre el humo!`);
    await this.say(`¡Adelante, ${this.adapter.player.name}!`, 700);
    await this.throwOut();
    this.refreshBox(this.playerBox, true);
    this.playerBox.container.setVisible(true);
    this.smoke.setVisible(true);
    if (this.adapter.smoke > 0) {
      this.smoke.setLevel(this.adapter.smoke);
      await this.say(ZONE_SMOKE_TEXT[this.adapter.smoke]);
    }
    this.refreshTiznado();

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
    let choice: number;
    if (this.ess) {
      // Como en Essentials: texto a la izquierda y cuatro botones de color a la derecha.
      this.textbox.setLines('¿Qué hará', `${name}?`);
      choice = await chooseButtons(
        this,
        [
          { label: 'LUCHAR', row: TYPE_ROW.Fire },
          { label: 'MOCHILA', row: TYPE_ROW.Electric },
          { label: 'POKéMON', row: TYPE_ROW.Grass },
          { label: 'HUIR', row: TYPE_ROW.Water },
        ],
        [
          { x: 100, y: 145, w: 77 },
          { x: 178, y: 145, w: 77 },
          { x: 100, y: 168, w: 77 },
          { x: 178, y: 168, w: 77 },
        ],
        undefined,
        this.lastCommand,
      );
      if (choice >= 0) this.lastCommand = choice;
    } else {
      const menu = new Menu(this, ['LUCHAR', 'MOCHILA', 'POKéMON', 'HUIR'], { right: 254, bottom: 190, columns: 2 });
      choice = await menu.choose(-1);
      menu.destroy();
    }
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
    const choice = this.ess ? await this.essentialsMoves() : await this.classicMoves();
    if (choice < 0) return false;
    const move = this.adapter.moves[choice];
    if (move.pp <= 0) {
      await this.say('¡No quedan PP para este movimiento!');
      return false;
    }
    this.lastMove = choice;
    await this.play(this.adapter.fight(move.slot));
    return false;
  }

  /** Botones coloreados por tipo + panel de PP e icono de tipo (Essentials). */
  private async essentialsMoves(): Promise<number> {
    const moves = this.adapter.moves;
    this.textbox.hide();
    const panel = this.add.image(0, 144, resKey('ui/battle', 'overlay_fight')).setOrigin(0).setDepth(1150);
    // Etiqueta de tipo en español (los iconos de Essentials traen el texto en inglés).
    const typeIcon = this.add.text(224, 151, '', labelStyle('#000000')).setOrigin(0.5, 0).setScale(0.75).setDepth(1151);
    const ppLabel = this.add.text(200, 167, 'PP', textStyle()).setDepth(1151);
    const ppText = this.add.text(250, 179, '', textStyle()).setOrigin(1, 0).setDepth(1151);
    // Pista de eficacia sobre el panel (oculta si el humo no te deja ver al rival).
    const hintBg = this.add.rectangle(194, 132, 60, 11, 0x1a1816, 0.85).setOrigin(0).setStrokeStyle(1, 0x5c5850).setDepth(1151);
    const hint = this.add.text(224, 134, '', textStyle('#d9d2c3')).setOrigin(0.5, 0).setScale(0.75).setDepth(1152);
    const foeTypes = speciesTypes(this.adapter.opponent.species);
    const show = (i: number) => {
      const m = moves[i];
      if (!m) return;
      typeIcon.setText(TYPE_SHORT_ES[m.type] ?? m.type).setBackgroundColor(TYPE_COLOR[m.type] ?? '#68a090');
      const info = moveInfo(m.id);
      const [label, color] =
        info.category === 'Status' ? ['ESTADO', '#d9d2c3'] : this.foeHidden() ? ['¿? HUMO', '#8a8478'] : effectLabel(typeMultiplier(m.type, foeTypes));
      hint.setText(label).setColor(color);
      ppText.setText(`${m.pp}/${m.maxPp}`);
      ppText.setColor(m.pp === 0 ? '#c03028' : m.pp <= m.maxPp / 4 ? '#e08030' : '#303030');
    };
    const slots = [
      { x: 4, y: 146, w: 93 },
      { x: 98, y: 146, w: 93 },
      { x: 4, y: 168, w: 93 },
      { x: 98, y: 168, w: 93 },
    ];
    const choice = await chooseButtons(
      this,
      moves.map((m) => ({ label: m.name.slice(0, 11), row: TYPE_ROW[m.type] ?? 0 })),
      slots,
      show,
      Math.min(this.lastMove, moves.length - 1),
    );
    panel.destroy();
    typeIcon.destroy();
    hint.destroy();
    hintBg.destroy();
    ppLabel.destroy();
    ppText.destroy();
    this.textbox.show();
    return choice;
  }

  private async classicMoves(): Promise<number> {
    const moves = this.adapter.moves;
    const info = this.add.container(0, 0).setDepth(1150);
    const infoBg = this.add.graphics();
    const frame = makeFrame(this, 150, 110, 104, 32);
    const infoText = this.add.text(160, 120, '', textStyle());
    info.add([infoBg, frame, infoText]);
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
    return choice;
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
    playSe(this, 'battle_recall');
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
      playSe(this, 'battle_flee');
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
    playSe(this, 'battle_throw');
    const ball = this.add.image(40, 150, 'ball').setDepth(500);
    const target = { x: this.foePos.x, y: this.foePos.y - 30 };
    await this.tween({ targets: ball, x: target.x, duration: 500, ease: 'Linear' });
    ball.y = target.y;
    playSe(this, 'battle_ball_hit');
    // El Pokémon entra en la ball.
    playSe(this, 'battle_jump_to_ball');
    this.foeSprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    await this.tween({ targets: this.foeSprite, scale: 0, duration: 250 });
    await this.tween({ targets: ball, y: this.foePos.y - 6, duration: 300, ease: 'Bounce.Out' });
    playSe(this, 'battle_ball_drop');

    const speciesMeta = meta(this.adapter.opponent.species);
    const result = this.adapter.throwBall(speciesMeta.catchRate, Math.random);
    for (let i = 0; i < result.shakes; i++) {
      await this.wait(350);
      playSe(this, 'battle_ball_shake');
      await this.tween({ targets: ball, angle: i % 2 === 0 ? -25 : 25, duration: 120, yoyo: true });
    }
    await this.wait(400);
    if (result.caught) {
      playSe(this, 'battle_catch_click');
      void stopBgm(this);
      void playMe(this, 'battle_capture_success');
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
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      switch (s.kind) {
        case 'text':
          await this.say(s.text);
          break;
        case 'move':
          await this.moveAnimation(s.side, s.move);
          break;
        case 'smoke':
          this.smoke.setLevel(s.level);
          if (s.level === 3) this.cameras.main.shake(250, 0.006);
          break;
        case 'hp': {
          const box = s.side === 'p1' ? this.playerBox : this.foeBox;
          const sprite = s.side === 'p1' ? this.playerSprite : this.foeSprite;
          this.setStatus(box, s.status);
          if (s.hp >= 0) {
            const max = s.side === 'p1' && s.hp > 0 ? s.maxHp : box.maxHp;
            const target = s.side === 'p1' ? s.hp : Math.round((s.hp / s.maxHp) * box.maxHp);
            if (target < box.hp) {
              const effect = this.effectAfter(steps, i);
              playSe(this, `battle_damage_${effect}`);
              if (effect === 'super') this.cameras.main.shake(180, 0.008);
              await this.blink(sprite);
            }
            await this.animateHp(box, target, max);
          }
          break;
        }
        case 'faint': {
          const sprite = s.side === 'p1' ? this.playerSprite : this.foeSprite;
          this.idle[s.side] = false;
          this.cry(s.side === 'p1' ? this.adapter.player.species : this.adapter.opponent.species, 0.6);
          playSe(this, 'pkmn_faint');
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

  /** Tu Pokémon sale de su Poké Ball (o entra deslizándose si no hay gráficos de ball). */
  private async throwOut(): Promise<void> {
    playSe(this, 'battle_throw');
    this.playerSprite.setPosition(this.playerPos.x, this.playerPos.y).setAlpha(1);
    await ballSendOut(this, { x: -10, y: 120 }, { x: this.playerPos.x, y: this.playerPos.y - 30 }, this.playerSprite);
    this.cry(this.adapter.player.species);
    this.idle.p1 = true;
  }

  private async sendOut(side: Side): Promise<void> {
    if (side === 'p1') {
      const p = this.adapter.player;
      this.idle.p1 = false;
      this.playerSprite.setTexture(this.battlerTexture(p.species, true)).setAlpha(1);
      this.seat(this.playerSprite);
      this.refreshBox(this.playerBox, true);
      await this.say(`¡Adelante, ${p.name}!`, 600);
      await this.throwOut();
    } else {
      this.foeIndex++;
      this.foeFainted = false;
      const f = this.adapter.opponent;
      this.idle.p2 = false;
      this.foeSprite.setTexture(this.battlerTexture(f.species, false)).setAlpha(1).setScale(1).setPosition(this.foePos.x, this.foePos.y);
      this.seat(this.foeSprite);
      this.refreshBox(this.foeBox, false);
      await this.say(`¡${this.setup.trainer?.name ?? 'El rival'} saca a ${f.name}!`, 600);
      playSe(this, 'battle_throw');
      await ballSendOut(this, { x: GAME_W + 10, y: 30 }, { x: this.foePos.x, y: this.foePos.y - 20 }, this.foeSprite);
      this.cry(f.species);
      this.idle.p2 = true;
    }
  }

  /** Mira los textos que siguen a un golpe para elegir el sonido (normal / muy eficaz / poco eficaz). */
  private effectAfter(steps: BattleStep[], index: number): 'normal' | 'super' | 'weak' {
    for (let j = index + 1; j < steps.length && j <= index + 3; j++) {
      const n = steps[j];
      if (n.kind !== 'text') break;
      if (n.text.includes('muy eficaz')) return 'super';
      if (n.text.includes('poco eficaz')) return 'weak';
    }
    return 'normal';
  }

  private cry(species: string, volume = 0.8): void {
    void playCry(this, species, speciesBaseId(species), volume);
  }

  /** Sprite del entrenador: el de combate de Essentials si existe, si no su personaje del mapa. */
  private trainerSprite(x: number): Phaser.GameObjects.Image {
    const t = this.setup.trainer!;
    if (t.battler && resReady(this, 'trainers', t.battler)) {
      const img = this.add.image(x, this.foePos.y + 8, resKey('trainers', t.battler)).setOrigin(0.5, 1).setDepth(10);
      return img;
    }
    return this.add.sprite(x, this.foePos.y + 2, characterKey(t.sprite), 0).setOrigin(0.5, 1).setScale(3).setDepth(10);
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
      if (!this.setup.trainer) void playBgm(this, 'battle_victory_wild');
      party = await this.awardExp(party);
      const t = this.setup.trainer;
      if (t) {
        const sprite = this.trainerSprite(GAME_W + 60);
        void playBgm(this, t.className === 'Jefa de banda' || t.className === 'Jefe de banda' ? 'battle_victory_leader' : 'battle_victory_trainer');
        await this.tween({ targets: sprite, x: this.foePos.x, duration: 400 });
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
            playSe(this, 'pkmn_level_up');
            await this.say(`¡${displayName(member)} ha subido al nivel ${e.level}!`);
          } else if (e.kind === 'learned') {
            playSe(this, 'pkmn_move_learnt');
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
    const box = this.playerBox;
    const set = box.setExpRatio;
    if (!set) return;
    const growth = meta(after.species).growth;
    playSe(this, 'pkmn_exp_gain', 0.5);
    const animate = (to: number, duration: number) =>
      this.tween({ targets: box.expValue, v: to, duration, onUpdate: () => set(box.expValue.v) });
    if (after.level > before.level) {
      await animate(1, 400);
      box.expValue.v = 0;
      set(0);
    }
    await animate(levelProgress(growth, after.level, after.exp), 500);
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
      void playBgm(this, 'evolution');
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
      this.cry(into);
      void playMe(this, 'evolution_success');
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
    return this.ess ? this.essentialsDatabox(player) : this.classicDatabox(player);
  }

  /** Caja de datos de Essentials: imagen de fondo y barras recortadas de overlay_hp/exp. */
  private essentialsDatabox(player: boolean): Databox {
    const x = player ? 126 : 0;
    const y = player ? 96 : 18;
    const bg = this.add.image(x, y, resKey('ui/battle', player ? 'databox_normal' : 'databox_normal_foe')).setOrigin(0);
    const nx = player ? x + 20 : x + 6;
    const name = this.add.text(nx, y + 6, '', textStyle());
    // Nivel alineado a la derecha para que no se pegue a nombres largos.
    const level = this.add.text(player ? x + 127 : x + 116, y + 6, '', textStyle()).setOrigin(1, 0);
    const barX = player ? x + 68 : x + 59;
    const barY = player ? y + 20 : y + 19;
    const bar = this.add.image(barX, barY, resKey('ui/battle', 'overlay_hp')).setOrigin(0);
    const setHpRatio = (ratio: number) => {
      const row = ratio > 0.5 ? 0 : ratio > 0.2 ? 1 : 2;
      bar.setCrop(0, row * 3, Math.max(0, Math.round(48 * ratio)), 3);
      bar.y = barY - row * 3;
    };
    // Estado como etiqueta en español (QUE, PAR, ENV...) en vez del icono en inglés.
    const status = this.add.text(nx, y + (player ? 18 : 17), '', labelStyle('#000000')).setScale(0.75).setVisible(false);
    const smoke = this.add.text(nx, y + (player ? 28 : 17), '', textStyle('#5c5850'));
    const parts: Phaser.GameObjects.GameObject[] = [bg, name, level, bar, status, smoke];
    let hpText: Phaser.GameObjects.Text | undefined;
    let setExpRatio: ((r: number) => void) | undefined;
    if (player) {
      hpText = this.add.text(x + 60, y + 27, '', textStyle());
      const exp = this.add.image(x + 20, y + 38, resKey('ui/battle', 'overlay_exp')).setOrigin(0);
      setExpRatio = (r: number) => exp.setCrop(0, 0, Math.round(96 * Math.min(1, Math.max(0, r))), 2);
      parts.push(hpText, exp);
    }
    const container = this.add.container(0, 0, parts).setDepth(400);
    return { container, name, level, hpText, setHpRatio, setExpRatio, expValue: { v: 0 }, status, labelStatus: true, smoke, barObject: bar, maxHp: 1, hp: 1 };
  }

  /** Caja de datos propia (sin gráficos de Essentials). */
  private classicDatabox(player: boolean): Databox {
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
    const setHpRatio = (ratio: number) => {
      bar.width = Math.max(0, Math.round(64 * ratio));
      bar.fillColor = ratio > 0.5 ? PALETTE.hpGood : ratio > 0.2 ? PALETTE.hpWarn : PALETTE.hpBad;
    };
    const status = this.add.text(x + 6, y + 16, '', textStyle('#b4532a'));
    const smoke = this.add.text(x + 6, y + (player ? 26 : 16), '', textStyle('#5c5850'));
    const parts: Phaser.GameObjects.GameObject[] = [g, name, level, psLabel, barBg, bar, status, smoke];
    let hpText: Phaser.GameObjects.Text | undefined;
    let setExpRatio: ((r: number) => void) | undefined;
    if (player) {
      hpText = this.add.text(x + w - 72, y + 27, '', textStyle());
      const expBg = this.add.rectangle(x + w - 72, y + 37, 64, 2, 0x5a5550).setOrigin(0);
      const exp = this.add.rectangle(x + w - 72, y + 37, 0, 2, PALETTE.exp).setOrigin(0);
      setExpRatio = (r: number) => (exp.width = Math.round(64 * Math.min(1, Math.max(0, r))));
      parts.push(hpText, expBg, exp);
    }
    const container = this.add.container(0, 0, parts).setDepth(400);
    return { container, name, level, hpText, setHpRatio, setExpRatio, expValue: { v: 0 }, status, smoke, barObject: bar, maxHp: 1, hp: 1 };
  }

  private refreshBox(box: Databox, player: boolean): void {
    const v = player ? this.adapter.player : this.adapter.opponent;
    box.name.setText(v.name.slice(0, 10));
    // Nombres largos: letras un poco más juntas para no pisar el nivel.
    box.name.setLetterSpacing(v.name.length > 8 ? -1 : 0);
    box.level.setText(`Nv${v.level}`);
    box.maxHp = v.maxHp;
    box.hp = v.hp;
    this.setStatus(box, v.status);
    this.refreshBoxNumbers(box);
    if (player && box.setExpRatio) {
      const m = this.party[this.adapter.activeIndex];
      box.expValue.v = levelProgress(meta(m.species).growth, m.level, m.exp);
      box.setExpRatio(box.expValue.v);
    }
    this.refreshTiznado();
  }

  private refreshBoxNumbers(box: Databox): void {
    const ratio = box.maxHp > 0 ? box.hp / box.maxHp : 0;
    box.setHpRatio(ratio);
    box.hpText?.setText(`${Math.max(0, box.hp)}/${box.maxHp}`.padStart(7, ' '));
  }

  private setStatus(box: Databox, status: string): void {
    if (box.labelStatus) {
      const label = STATUS_LABEL[status];
      box.status.setVisible(label !== undefined);
      if (label) box.status.setText(label[0]).setBackgroundColor(label[1]);
      return;
    }
    box.status.setText(STATUS_ES[status] ?? '');
  }

  private refreshTiznado(): void {
    const playerBlind = this.adapter.player.tiznado;
    this.playerBox.smoke.setText(playerBlind ? 'HUMO' : '');
    this.foeBox.smoke.setText(this.adapter.opponent.tiznado ? 'HUMO' : '');
    if (this.foeBox.smoke.text) this.foeBox.status.setText('').setVisible(false);
    // Si TU Pokémon está tiznado, no distingues bien al rival. Con humo denso, tampoco,
    // salvo que tu Pokémon sea de los que ven entre el humo (Fuego, Veneno, Siniestro).
    const hidden = this.foeHidden();
    if (!this.foeFainted) {
      this.foeSprite.setAlpha(playerBlind ? 0.35 : 1);
      const level = this.adapter.smoke;
      if (level >= 2 && !this.playerSeesInSmoke()) this.foeSprite.setTint(level === 3 ? 0x3a3a44 : 0x7a7a84);
      else this.foeSprite.clearTint();
    }
    this.foeBox.barObject.setAlpha(hidden ? 0.12 : 1);
  }

  private playerSeesInSmoke(): boolean {
    return speciesTypes(this.adapter.player.species).some((t) => SMOKE_NATIVE_TYPES.includes(t));
  }

  /** ¿No ves bien al rival? (tu Pokémon tiznado, o humo denso y no es "del humo"). */
  private foeHidden(): boolean {
    if (this.adapter.player.tiznado) return true;
    return this.adapter.smoke >= 2 && !this.playerSeesInSmoke();
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

  /** Golpe recibido: parpadeo en blanco y temblor lateral. */
  private async blink(sprite: Phaser.GameObjects.Image): Promise<void> {
    const x = sprite.x;
    for (let i = 0; i < 3; i++) {
      sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      sprite.x = x + (i % 2 === 0 ? 2 : -2);
      await this.wait(55);
      sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      sprite.x = x;
      await this.wait(55);
    }
    this.refreshTiznado();
  }

  /** Embestida (si es físico) y la animación del ataque sobre el objetivo. */
  private async moveAnimation(side: Side, moveId: string): Promise<void> {
    let info: ReturnType<typeof moveInfo> | undefined;
    try {
      info = moveInfo(moveId);
    } catch {
      info = undefined;
    }
    if (!info) return this.lunge(side);
    if (info.category === 'Physical') await this.lunge(side);
    const anim = animationFor({ id: moveId, ...info });
    if (!anim) return;
    const user = side === 'p1' ? this.playerSprite : this.foeSprite;
    const target = anim.onUser ? user : side === 'p1' ? this.foeSprite : this.playerSprite;
    // El objetivo lejano (el rival) se ve más pequeño.
    const far = target === this.foeSprite;
    const played = await playSheet(this, anim, target.x, target.y - target.displayHeight * 0.45, far ? 0.8 : 1.1);
    if (!played && info.category !== 'Physical') await this.lunge(side);
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

