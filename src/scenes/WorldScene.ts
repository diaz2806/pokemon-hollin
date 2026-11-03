/**
 * Escena del mundo: mapas, movimiento por casillas, Pokémon que te sigue,
 * NPCs, carteles, puertas, encuentros y menú de pausa.
 *
 * Las reglas (qué se puede pisar, con quién hablas, encuentros...) están en
 * src/core; aquí solo se dibujan y se encadenan con la interfaz.
 */
import * as Phaser from 'phaser';
import { step, type Direction, type Point } from '../core/grid';
import { Follower } from '../core/follower';
import { TileMap, canWalk, interactionAt, opposite, visibleNpcs, type NpcData } from '../core/tilemap';
import { rollEncounter } from '../core/encounters';
import { addCaught, anyAble, displayName, firstAbleIndex } from '../core/party';
import { markCaught, markSeen } from '../core/game-state';
import { createMember, healMember, speciesTypes } from '../battle/dex-service';
import { MAPS, ENCOUNTER_TABLES, STARTERS, FICHAS, SHOP } from '../game/content';
import { defeatFlag, findSpotter, isDefeated, type Spotted } from '../core/trainers';
import { session } from '../game/session';
import { controls } from '../ui/input';
import { TextBox, Menu } from '../ui/TextBox';
import { T, TILE_FRAMES } from '../ui/art/tiles';
import { characterKey, followerPlaceholderKey, tileKey, FACINGS } from '../ui/art/textures';
import { textStyle } from '../ui/TextBox';
import { assetKey, hasTexture } from '../ui/assets';
import { PALETTE, GAME_W, GAME_H } from '../ui/palette';
import type { BattleSceneData, BattleResult } from './BattleScene';
import type { PartySceneData } from './PartyScene';

const WALK_MS = 230;
const TURN_MS = 90;

const ROW: Record<Direction, number> = { down: 0, left: 1, right: 2, up: 3 };

interface Animated {
  image: Phaser.GameObjects.Image;
  tile: string;
  frames: number;
}

export class WorldScene extends Phaser.Scene {
  private map!: TileMap;
  private npcs: NpcData[] = [];
  private npcSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private mapLayer!: Phaser.GameObjects.Container;
  private fxLayer!: Phaser.GameObjects.Container;
  private animated: Animated[] = [];
  private player!: Phaser.GameObjects.Sprite;
  private followerSprite: Phaser.GameObjects.Sprite | null = null;
  private follower = new Follower({ x: 0, y: 0 });
  private followerSpecies = '';
  private textbox!: TextBox;
  private busy = false;
  private moving = false;
  private stepToggle = false;
  private turnTimer = 0;
  private animClock = 0;
  private emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  /** Entrenador con el que se está combatiendo (para marcarlo al ganar). */
  private pendingTrainer: NpcData | null = null;

  constructor() {
    super('World');
  }

  private get state() {
    return session.state;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.night);
    this.mapLayer = this.add.container(0, 0);
    this.fxLayer = this.add.container(0, 0).setDepth(600);
    this.textbox = new TextBox(this);
    this.player = this.add.sprite(0, 0, characterKey('hero'), 0).setOrigin(0.5, 1);
    this.loadMap(this.state.map, this.state.pos, this.state.facing);
    this.cameras.main.fadeIn(400);
    this.events.on(Phaser.Scenes.Events.WAKE, (_s: unknown, data?: BattleResult) => this.onWake(data));
  }

  update(_time: number, delta: number): void {
    this.state.playTimeMs += delta;
    this.animClock += delta;
    if (this.animClock >= 500) {
      this.animClock = 0;
      for (const a of this.animated) {
        const current = Number(a.image.texture.key.split('-').pop());
        a.image.setTexture(tileKey(a.tile, (current + 1) % a.frames));
      }
    }
    if (this.busy || this.moving) return;

    if (controls.pressed('START')) {
      void this.lock(() => this.pauseMenu());
      return;
    }
    if (controls.pressed('A')) {
      void this.lock(() => this.interact());
      return;
    }
    const dir = controls.heldDir();
    if (!dir) {
      this.turnTimer = 0;
      return;
    }
    if (dir !== this.state.facing) {
      // Toque corto: solo gira. Mantener: gira y anda.
      this.face(dir);
      this.turnTimer = TURN_MS;
      return;
    }
    if (this.turnTimer > 0) {
      this.turnTimer -= delta;
      return;
    }
    this.tryMove(dir);
  }

  // ---------- Mapa ----------

  private loadMap(id: string, pos: Point, facing: Direction): void {
    const data = MAPS[id];
    if (!data) throw new Error(`Mapa desconocido: ${id}`);
    this.map = new TileMap(data);
    this.state.map = id;
    this.state.pos = { ...pos };
    this.state.facing = facing;
    this.mapLayer.removeAll(true);
    this.fxLayer.removeAll(true);
    this.emitters.forEach((e) => e.destroy());
    this.emitters = [];
    this.animated = [];
    this.npcSprites.forEach((s) => s.destroy());
    this.npcSprites.clear();

    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        const tile = this.map.tileAt({ x, y });
        const image = this.add.image(x * T, y * T, tileKey(tile, 0)).setOrigin(0);
        this.mapLayer.add(image);
        const frames = TILE_FRAMES[tile] ?? 1;
        if (frames > 1) this.animated.push({ image, tile, frames });
      }
    }

    this.spawnNpcs();
    this.placePlayer();
    this.setupFollower(true);
    this.setupAtmosphere();

    const cam = this.cameras.main;
    const w = this.map.width * T;
    const h = this.map.height * T;
    if (w <= GAME_W && h <= GAME_H) {
      cam.stopFollow();
      cam.removeBounds();
      cam.centerOn(w / 2, h / 2 + 8);
    } else {
      cam.setBounds(0, 0, w, h);
      cam.startFollow(this.player, true);
      cam.setFollowOffset(0, -8);
    }
  }

  private spawnNpcs(): void {
    // Copias: los entrenadores se mueven al verte y no queremos tocar los datos del mapa.
    this.npcs = visibleNpcs(this.map.data, this.state.flags).map((n) => ({ ...n }));
    for (const npc of this.npcs) {
      let sprite: Phaser.GameObjects.Sprite;
      if ((npc.sprite === 'cage' || npc.sprite === 'creature') && npc.species) {
        sprite = this.creatureSprite(npc.species, 'down');
        sprite.setPosition(npc.x * T + 8, npc.y * T + 14).setDepth(npc.y * 10 + 6);
      } else {
        sprite = this.add.sprite(npc.x * T + 8, npc.y * T + T, characterKey(npc.sprite), ROW[npc.facing] * 3);
        sprite.setOrigin(0.5, 1).setDepth(npc.y * 10 + 5);
      }
      this.npcSprites.set(npc.id, sprite);
    }
  }

  private placePlayer(): void {
    const { pos, facing } = this.state;
    this.player.setPosition(pos.x * T + 8, pos.y * T + T).setDepth(pos.y * 10 + 5);
    this.player.setFrame(ROW[facing] * 3);
  }

  /** Coloca al Pokémon que te sigue detrás del jugador (o lo quita si no hay equipo). */
  private setupFollower(reset: boolean): void {
    const lead = this.state.party[firstAbleIndex(this.state.party)] ?? this.state.party[0];
    if (!lead) {
      this.followerSprite?.destroy();
      this.followerSprite = null;
      this.followerSpecies = '';
      return;
    }
    if (reset || !this.followerSprite) {
      const behind = step(this.state.pos, opposite(this.state.facing));
      const spot = this.map.isWalkableTile(behind) ? behind : this.state.pos;
      this.follower.placeAt(spot, this.state.facing);
    }
    if (!this.followerSprite || this.followerSpecies !== lead.species) {
      this.followerSprite?.destroy();
      this.followerSprite = this.creatureSprite(lead.species, this.follower.facing);
      this.followerSpecies = lead.species;
    }
    const f = this.follower.position;
    this.followerSprite.setPosition(f.x * T + 8, f.y * T + T).setOrigin(0.5, 1).setDepth(f.y * 10 + 4);
    this.followerSprite.setVisible(!(f.x === this.state.pos.x && f.y === this.state.pos.y));
    this.setCreatureFrame(this.followerSprite, lead.species, this.follower.facing, 0);
  }

  /** Sprite de Pokémon en el mapa: oficial si existe en assets/, si no placeholder por tipo. */
  private creatureSprite(species: string, facing: Direction): Phaser.GameObjects.Sprite {
    const official = hasTexture(this, 'followers', species);
    const key = official ? assetKey('followers', species) : followerPlaceholderKey(speciesTypes(species)[0]);
    const sprite = this.add.sprite(0, 0, key, 0).setOrigin(0.5, 1);
    this.setCreatureFrame(sprite, species, facing, 0);
    return sprite;
  }

  private setCreatureFrame(sprite: Phaser.GameObjects.Sprite, species: string, facing: Direction, frame: number): void {
    const official = hasTexture(this, 'followers', species);
    const row = FACINGS.indexOf(facing);
    sprite.setFrame(official ? row * 4 + (frame % 4) : row * 2 + (frame % 2));
  }

  /** Humo, chispas y luz de gas. */
  private setupAtmosphere(): void {
    const outdoor = !this.map.data.indoor;
    const w = this.map.width * T;
    const h = this.map.height * T;
    if (outdoor) {
      const veil = this.add.rectangle(0, 0, w, h, 0x0e0e14, 0.28).setOrigin(0);
      this.fxLayer.add(veil);
    }
    const lights = [...this.map.positionsOf('lamp'), ...this.map.positionsOf('window'), ...this.map.positionsOf('pubDoor')];
    for (const l of lights) {
      const glow = this.add.image(l.x * T + 8, l.y * T + 4, 'glow').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9);
      this.fxLayer.add(glow);
      this.tweens.add({ targets: glow, alpha: 0.65, duration: 900 + Math.random() * 600, yoyo: true, repeat: -1 });
    }
    const furnaces = this.map.positionsOf('furnace');
    for (const f of furnaces) {
      const glow = this.add.image(f.x * T + 8, f.y * T + 12, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(1.6).setTint(0xff7a3a);
      this.fxLayer.add(glow);
      this.tweens.add({ targets: glow, alpha: 0.6, duration: 200, yoyo: true, repeat: -1 });
      const sparks = this.add.particles(f.x * T + 8, f.y * T + 14, 'ember', {
        speedY: { min: -40, max: -15 },
        speedX: { min: -12, max: 12 },
        lifespan: 1200,
        frequency: 140,
        alpha: { start: 1, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
      });
      sparks.setDepth(650);
      this.emitters.push(sparks);
    }
    // Humo de los callejones y de las chimeneas.
    const smoke = this.map.positionsOf('smoke').filter((_, i) => i % 5 === 0);
    const chimneys = this.map.positionsOf('chimney');
    for (const s of [...smoke, ...chimneys]) {
      const chimney = this.map.tileAt(s) === 'chimney';
      const e = this.add.particles(s.x * T + 8, s.y * T + (chimney ? 0 : 10), 'puff', {
        speedY: { min: chimney ? -14 : -6, max: chimney ? -8 : -2 },
        speedX: { min: 2, max: 8 },
        scale: { start: 0.8, end: chimney ? 2.6 : 1.8 },
        alpha: { start: chimney ? 0.6 : 0.35, end: 0 },
        lifespan: chimney ? 3200 : 2600,
        frequency: chimney ? 260 : 520,
      });
      e.setDepth(chimney ? 640 : 300);
      this.emitters.push(e);
    }
    if (this.map.data.id === 'fabrica') {
      const red = this.add.rectangle(0, 0, w, h, 0xff4a1a, 0.08).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
      this.fxLayer.add(red);
      this.tweens.add({ targets: red, alpha: 0.18, duration: 160, yoyo: true, repeat: -1 });
    }
  }

  // ---------- Movimiento ----------

  private face(dir: Direction): void {
    this.state.facing = dir;
    this.player.setFrame(ROW[dir] * 3);
  }

  private tryMove(dir: Direction): void {
    const target = step(this.state.pos, dir);
    const warp = this.map.warpAt(target);
    if (warp?.requires && !this.state.flags[warp.requires]) {
      void this.lock(() => this.textbox.say(warp.blockedText ?? ['No puedes pasar.']));
      return;
    }
    const followerHere = this.followerSprite && target.x === this.follower.position.x && target.y === this.follower.position.y;
    if (!canWalk(this.map, this.npcs, target) && !followerHere) {
      this.player.setFrame(ROW[dir] * 3);
      return;
    }
    const from = this.state.pos;
    this.state.pos = target;
    this.moving = true;
    this.stepToggle = !this.stepToggle;
    this.player.setFrame(ROW[dir] * 3 + (this.stepToggle ? 1 : 2));
    this.player.setDepth(Math.max(from.y, target.y) * 10 + 5);
    this.tweens.add({
      targets: this.player,
      x: target.x * T + 8,
      y: target.y * T + T,
      duration: WALK_MS,
      onUpdate: (tw) => {
        if (tw.progress > 0.5) this.player.setFrame(ROW[dir] * 3);
      },
      onComplete: () => {
        this.player.setDepth(target.y * 10 + 5);
        void this.afterStep();
      },
    });
    if (this.followerSprite) {
      this.follower.onLeaderMoved(from);
      const f = this.follower.position;
      const species = this.followerSpecies;
      this.followerSprite.setVisible(true);
      this.setCreatureFrame(this.followerSprite, species, this.follower.facing, this.stepToggle ? 1 : 0);
      this.followerSprite.setDepth(Math.max(f.y, from.y) * 10 + 4);
      this.tweens.add({
        targets: this.followerSprite,
        x: f.x * T + 8,
        y: f.y * T + T,
        duration: WALK_MS,
        onComplete: () => {
          this.followerSprite?.setDepth(f.y * 10 + 4);
          if (this.followerSprite) this.setCreatureFrame(this.followerSprite, species, this.follower.facing, 0);
        },
      });
    }
  }

  private async afterStep(): Promise<void> {
    this.moving = false;
    const warp = this.map.warpAt(this.state.pos);
    if (warp) {
      await this.lock(async () => {
        await this.fade(true);
        this.loadMap(warp.to, { x: warp.toX, y: warp.toY }, warp.facing);
        await this.fade(false);
        await this.runOnEnter();
      });
      return;
    }
    if (anyAble(this.state.party)) {
      const spotted = findSpotter(this.map, this.npcs, this.state.flags, this.state.pos);
      if (spotted) {
        await this.lock(() => this.trainerApproach(spotted));
        return;
      }
    }
    if (this.map.isEncounterTile(this.state.pos) && this.map.data.encounterTable && anyAble(this.state.party)) {
      const wild = rollEncounter(ENCOUNTER_TABLES[this.map.data.encounterTable], Math.random);
      if (wild) await this.lock(() => this.startWildBattle(wild.species, wild.level, wild.moves));
    }
  }

  // ---------- Interacción ----------

  private async interact(): Promise<void> {
    const it = interactionAt(this.map, this.npcs, this.state.pos, this.state.facing);
    switch (it.kind) {
      case 'npc':
        return this.talkTo(it.npc);
      case 'sign':
        return this.textbox.say(it.sign.text);
      case 'lockedDoor':
        return this.textbox.say(this.map.data.lockedDoorText ?? ['Está cerrado.']);
      default:
        return;
    }
  }

  private async talkTo(npc: NpcData): Promise<void> {
    const sprite = this.npcSprites.get(npc.id);
    if (sprite && npc.sprite !== 'cage' && npc.sprite !== 'creature') sprite.setFrame(ROW[opposite(this.state.facing)] * 3);
    if (npc.trainer) {
      if (isDefeated(this.state.flags, this.map.data.id, npc)) return this.textbox.say(npc.trainer.after);
      if (!anyAble(this.state.party)) return this.textbox.say('Ahora mismo no tienes Pokémon en condiciones de luchar.');
      return this.trainerBattle(npc);
    }
    switch (npc.action) {
      case 'shop':
        return this.shop(npc);
      case 'heal':
        return this.healAtPub(npc);
      case 'cage':
        return this.openCage(npc);
      case 'giveBalls':
        return this.giveBalls(npc);
      case 'giftSandile':
        return this.giftSandile(npc);
      default:
        await this.textbox.say(npc.dialog);
    }
  }

  private async healAtPub(npc: NpcData): Promise<void> {
    await this.textbox.say(npc.dialog, { keepOpen: true });
    if (this.state.party.length === 0) {
      await this.textbox.say('Vaya, no llevas Pokémon. Pues tómate algo caliente, anda.');
      return;
    }
    const yes = await this.textbox.ask('¿Quieres que cuide de tus Pokémon?', ['SÍ', 'NO']);
    if (yes !== 0) {
      await this.textbox.say('Cuando quieras. Aquí siempre hay sitio junto a la estufa.');
      return;
    }
    await this.textbox.say('Muy bien. Déjamelos un momento...', { keepOpen: true });
    this.cameras.main.flash(500, 232, 196, 106);
    await this.wait(900);
    this.state.party = this.state.party.map(healMember);
    this.state.lastPub = { map: this.map.data.id, pos: { ...this.state.pos } };
    this.setupFollower(false);
    await this.textbox.say(['Listo. Tus Pokémon están como nuevos.', 'Y tranquilo: aquí nadie pregunta de dónde salen.']);
  }

  private async openCage(npc: NpcData): Promise<void> {
    const species = npc.species!;
    if (this.state.flags.starterChosen) {
      await this.textbox.say(['¡No hay tiempo!', 'El humo ya no deja ni respirar. ¡Hay que salir de aquí!']);
      return;
    }
    await this.textbox.say(npc.dialog, { keepOpen: true });
    const choice = await this.textbox.ask(`¿Abrir la jaula de ${species}?`, ['SÍ', 'NO']);
    if (choice !== 0) {
      this.textbox.hide();
      return;
    }
    const starter = STARTERS[species];
    const member = createMember(species, starter.level, starter.moves);
    this.state.party.push(member);
    markCaught(this.state, species);
    this.state.flags.starterChosen = true;
    this.state.flags[`freed_${species.toLowerCase()}`] = true;
    const sprite = this.npcSprites.get(npc.id);
    if (sprite) {
      this.tweens.add({ targets: sprite, y: sprite.y + 14, alpha: 0, duration: 300 });
    }
    this.npcs = this.npcs.filter((n) => n.id !== npc.id);
    await this.textbox.say([`¡Has abierto la jaula! ${species} sale de un salto.`, `${species} se pega a tus piernas. No piensa separarse de ti.`]);
    sprite?.destroy();
    this.npcSprites.delete(npc.id);
    this.setupFollower(true);
    await this.textbox.say('¡Corre hacia la salida, abajo!');
  }

  private async giveBalls(npc: NpcData): Promise<void> {
    if (this.state.flags.gotBalls) {
      await this.textbox.say(['¿Más? Ni hablar, que no me salen gratis.', 'Si atrapas algo bonito, ya me contarás.']);
      return;
    }
    await this.textbox.say(npc.dialog, { keepOpen: true });
    await this.textbox.say(['Toma, para empezar.', 'Y si te pilla un guardia, tú no me conoces.'], { keepOpen: true });
    this.state.bag.pokeball += 5;
    this.state.flags.gotBalls = true;
    await this.textbox.say('¡Has recibido 5 Poké Balls!');
  }

  // ---------- Entrenadores ----------

  /** Un entrenador te ha visto: "!", viene hacia ti y te reta. */
  private async trainerApproach(spotted: Spotted): Promise<void> {
    const { npc, path } = spotted;
    const sprite = this.npcSprites.get(npc.id);
    if (!sprite) return;
    const mark = this.add.text(sprite.x, sprite.y - 26, '!', { ...textStyle('#e8c46a'), fontSize: '16px' }).setOrigin(0.5).setDepth(900);
    mark.setShadow(1, 1, '#000000', 0, false, true);
    await this.wait(700);
    mark.destroy();
    for (const p of path) {
      sprite.setFrame(ROW[npc.facing] * 3 + (p.x + p.y) % 2 + 1);
      await new Promise<void>((r) =>
        this.tweens.add({ targets: sprite, x: p.x * T + 8, y: p.y * T + T, duration: WALK_MS, onComplete: () => r() }),
      );
      npc.x = p.x;
      npc.y = p.y;
      sprite.setDepth(p.y * 10 + 5).setFrame(ROW[npc.facing] * 3);
    }
    this.face(opposite(npc.facing));
    await this.trainerBattle(npc);
  }

  private async trainerBattle(npc: NpcData): Promise<void> {
    const t = npc.trainer!;
    const sprite = this.npcSprites.get(npc.id);
    sprite?.setFrame(ROW[opposite(this.state.facing)] * 3);
    await this.textbox.say(t.intro);
    for (const p of t.party) markSeen(this.state, p.species);
    this.pendingTrainer = npc;
    await this.transitionToBattle({
      kind: 'trainer',
      foes: t.party,
      trainer: { name: t.name, className: t.className, sprite: npc.sprite, money: t.money, defeat: t.defeat },
    });
  }

  private async afterTrainerWin(npc: NpcData): Promise<void> {
    const t = npc.trainer!;
    this.state.flags[defeatFlag(this.map.data.id, npc.id)] = true;
    if (!t.reward) return;
    const sprite = this.npcSprites.get(npc.id);
    sprite?.setFrame(ROW[opposite(this.state.facing)] * 3);
    for (const flag of t.reward.flags) this.state.flags[flag] = true;
    if (t.reward.items?.pokeball) this.state.bag.pokeball += t.reward.items.pokeball;
    if (t.reward.items?.potion) this.state.bag.potion += t.reward.items.potion;
    if (t.reward.flags.some((f) => f.startsWith('ficha_'))) this.cameras.main.flash(400, 232, 196, 106);
    await this.textbox.say([...t.reward.text, ...t.after]);
    // Los NPC que dependen de la ficha (el guardia) cambian.
    this.refreshNpcs();
  }

  /** Vuelve a colocar los NPC del mapa actual según los flags (sin mover al jugador). */
  private refreshNpcs(): void {
    const moved = new Map(this.npcs.map((n) => [n.id, { x: n.x, y: n.y }]));
    this.npcSprites.forEach((s) => s.destroy());
    this.npcSprites.clear();
    this.spawnNpcs();
    for (const n of this.npcs) {
      const pos = moved.get(n.id);
      if (!pos) continue;
      n.x = pos.x;
      n.y = pos.y;
      this.npcSprites.get(n.id)?.setPosition(pos.x * T + 8, pos.y * T + T).setDepth(pos.y * 10 + 5);
    }
  }

  // ---------- Tienda ----------

  private async shop(npc: NpcData): Promise<void> {
    if (!this.state.flags.gotBalls) {
      await this.giveBalls(npc);
      return;
    }
    await this.textbox.say('¡Poké Balls y pociones! ¡Lo mejor del Mercado, casi sin robar!', { keepOpen: true });
    for (;;) {
      await this.textbox.type(`Tienes ${this.state.money} chelines. ¿Qué te llevas?`);
      const options = [...SHOP.map((i) => `${i.name.padEnd(9)} ${String(i.price).padStart(4)}`), 'NADA'];
      const menu = new Menu(this, options, { right: GAME_W - 2, bottom: 140 });
      const choice = await menu.choose(options.length - 1);
      menu.destroy();
      if (choice < 0 || choice >= SHOP.length) break;
      const item = SHOP[choice];
      if (this.state.money < item.price) {
        await this.textbox.say('No te llega, chaval. Aquí no se fía.', { keepOpen: true });
        continue;
      }
      this.state.money -= item.price;
      this.state.bag[item.item]++;
      await this.textbox.say(`¡Has comprado una ${item.name}!`, { keepOpen: true });
    }
    await this.textbox.say('¡Vuelve cuando quieras!');
  }

  /** Evento del Pokémon emblema: un Sandile de Ashbury hambriento en los callejones. */
  private async giftSandile(npc: NpcData): Promise<void> {
    await this.textbox.say(npc.dialog, { keepOpen: true });
    const choice = await this.textbox.ask('¿Compartes tu pan con él?', ['SÍ', 'NO']);
    if (choice !== 0) {
      await this.textbox.say('Sandile se esconde otra vez entre las cajas, gruñendo.');
      return;
    }
    const sprite = this.npcSprites.get(npc.id);
    await this.textbox.say(['Sandile se traga el pan de un bocado.', 'Te mira un buen rato sin parpadear...'], { keepOpen: true });
    if (sprite) await new Promise<void>((r) => this.tweens.add({ targets: sprite, y: sprite.y - 4, duration: 120, yoyo: true, repeat: 1, onComplete: () => r() }));
    const member = createMember('Sandile-Ashbury', 6);
    const where = addCaught(this.state.party, this.state.box, member);
    markCaught(this.state, 'Sandile-Ashbury');
    this.state.flags.gotSandile = true;
    this.npcs = this.npcs.filter((n) => n.id !== npc.id);
    sprite?.destroy();
    this.npcSprites.delete(npc.id);
    this.setupFollower(false);
    await this.textbox.say([
      '...y se pone a tu lado como si siempre hubiera sido así.',
      where === 'party' ? '¡Sandile se ha unido a tu equipo!' : 'Tu equipo está lleno: Sandile se ha ido a la caja del PC.',
    ]);
  }

  private async runOnEnter(): Promise<void> {
    const onEnter = this.map.data.onEnter;
    if (!onEnter || this.state.flags[onEnter.flag]) return;
    this.state.flags[onEnter.flag] = true;
    this.cameras.main.shake(400, 0.006);
    await this.textbox.say(onEnter.text);
  }

  /** Se llama desde el Título al empezar o continuar. */
  async introIfNeeded(): Promise<void> {
    await this.lock(() => this.runOnEnter());
  }

  // ---------- Menú de pausa ----------

  private async pauseMenu(): Promise<void> {
    const options = ['POKéMON', 'MOCHILA', 'FICHAS', 'GUARDAR', 'SALIR'];
    const menu = new Menu(this, options, { right: GAME_W - 2, y: 2 });
    let choice = await menu.choose(4);
    menu.destroy();
    if (choice === 2) {
      const got = FICHAS.filter((f) => this.state.flags[f.flag]);
      await this.textbox.say(
        got.length === 0
          ? ['Todavía no tienes ninguna ficha de banda.', 'Gana a los jefes de las bandas de Ashbury para conseguirlas.']
          : [`Fichas: ${got.length} de ${FICHAS.length}.`, ...got.map((f) => `${f.name} (${f.gang})`)],
      );
      return;
    }
    if (choice > 2) choice--;
    if (choice === 0) {
      if (this.state.party.length === 0) await this.textbox.say('No llevas ningún Pokémon.');
      else await this.openParty({ mode: 'view' });
    } else if (choice === 1) {
      await this.bagMenu();
    } else if (choice === 2) {
      const yes = await this.textbox.ask('¿Quieres guardar la partida?', ['SÍ', 'NO']);
      if (yes === 0) {
        session.save();
        await this.textbox.say(`${this.state.playerName} ha guardado la partida.`);
      } else this.textbox.hide();
    }
  }

  private async bagMenu(): Promise<void> {
    const { bag, money } = this.state;
    const options = [`POKé BALL x${bag.pokeball}`, `POCIÓN    x${bag.potion}`, 'SALIR'];
    await this.textbox.type(`Dinero: ${money} chelines`);
    const menu = new Menu(this, options, { right: GAME_W - 2, bottom: 140 });
    const choice = await menu.choose(2);
    menu.destroy();
    if (choice === 0) await this.textbox.say('No es momento de usar eso.');
    else if (choice === 1) {
      if (bag.potion <= 0) {
        await this.textbox.say('No te quedan pociones.');
        return;
      }
      this.textbox.hide();
      const index = await this.openParty({ mode: 'select', prompt: '¿A quién le das la Poción?' });
      if (index < 0) return;
      const m = this.state.party[index];
      const max = healMember(m).hp;
      if (m.hp <= 0 || m.hp >= max) {
        await this.textbox.say('No tendría ningún efecto.');
        return;
      }
      const healed = Math.min(20, max - m.hp);
      m.hp += healed;
      bag.potion--;
      await this.textbox.say(`${displayName(m)} ha recuperado ${healed} PS.`);
    } else this.textbox.hide();
  }

  private openParty(data: Omit<PartySceneData, 'onDone'>): Promise<number> {
    return new Promise((resolve) => {
      this.scene.launch('Party', {
        ...data,
        onDone: (index: number) => {
          this.setupFollower(false);
          resolve(index);
        },
      } satisfies PartySceneData);
      this.scene.pause();
    });
  }

  // ---------- Combates ----------

  private async startWildBattle(species: string, level: number, moves?: string[]): Promise<void> {
    markSeen(this.state, species);
    this.pendingTrainer = null;
    await this.transitionToBattle({ kind: 'wild', foes: [{ species, level, moves }] });
  }

  private async transitionToBattle(data: BattleSceneData): Promise<void> {
    controls.flush();
    const cam = this.cameras.main;
    for (let i = 0; i < 2; i++) {
      cam.flash(120, 30, 30, 30);
      await this.wait(160);
    }
    await this.fade(true, 250);
    this.scene.launch('Battle', data);
    this.scene.sleep();
    this.busy = true; // se libera en onWake
  }

  private onWake(result?: BattleResult): void {
    void (async () => {
      this.busy = true;
      this.setupFollower(false);
      this.cameras.main.resetFX();
      await this.fade(false, 250);
      if (result?.outcome === 'lost') {
        await this.textbox.say([`A ${this.state.playerName} no le quedan Pokémon en condiciones...`, 'Vuelves corriendo al pub entre la niebla.']);
        await this.fade(true);
        this.state.party = this.state.party.map(healMember);
        this.state.money = Math.floor(this.state.money / 2);
        const pub = this.state.lastPub;
        this.loadMap(pub.map, pub.pos, 'up');
        await this.fade(false);
        await this.textbox.say('El tabernero ha cuidado de tus Pokémon mientras dormías.');
      }
      const trainer = this.pendingTrainer;
      this.pendingTrainer = null;
      if (trainer && result?.outcome === 'won') await this.afterTrainerWin(trainer);
      if (result?.caughtNew) await this.textbox.say(`${result.caughtNew} se ha unido a tu equipo.`);
      this.busy = false;
      controls.flush();
    })();
  }

  // ---------- Utilidades ----------

  private async lock(fn: () => Promise<void>): Promise<void> {
    this.busy = true;
    try {
      await fn();
    } finally {
      this.busy = false;
      controls.flush();
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, r));
  }

  private fade(out: boolean, ms = 220): Promise<void> {
    return new Promise((resolve) => {
      const cam = this.cameras.main;
      if (out) cam.fadeOut(ms, 0, 0, 0);
      else cam.fadeIn(ms, 0, 0, 0);
      cam.once(out ? Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE : Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => resolve());
    });
  }
}

