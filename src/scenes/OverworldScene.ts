import * as Phaser from 'phaser';
import { step, type Direction, type Point } from '../core/grid';
import { Follower } from '../core/follower';
import { TileMap, type MapData } from '../core/tilemap';
import { rollEncounter, type EncounterTable } from '../core/encounters';
import { newGame, type GameState } from '../core/game-state';
import { TILE } from './BootScene';
import { FONT, PALETTE, css } from '../ui/palette';
import mercado from '../../data/maps/mercado.json';
import mercadoTable from '../../data/encounters/mercado-callejones.json';

const STEP_MS = 160;
const TABLES: Record<string, EncounterTable> = { 'mercado-callejones': mercadoTable as EncounterTable };

export class OverworldScene extends Phaser.Scene {
  private map!: TileMap;
  private state!: GameState;
  private playerPos!: Point;
  private follower!: Follower;
  private playerSprite!: Phaser.GameObjects.Image;
  private followerSprite!: Phaser.GameObjects.Image;
  private moving = false;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private touchDir: Direction | null = null;

  constructor() {
    super('Overworld');
  }

  create(): void {
    this.state = newGame();
    this.map = new TileMap(mercado as MapData);
    this.drawMap();

    this.playerPos = { ...this.map.start };
    this.follower = new Follower({ x: this.playerPos.x, y: this.playerPos.y - 1 }, 'down');
    this.followerSprite = this.add.image(0, 0, 'follower').setOrigin(0);
    this.playerSprite = this.add.image(0, 0, 'player').setOrigin(0);
    this.snapSprites();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.map.width * TILE, this.map.height * TILE);
    cam.startFollow(this.playerSprite, true);
    cam.setBackgroundColor(PALETTE.night);

    // Velo de humo sobre toda la ciudad: tono gris del juego.
    this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, PALETTE.smokePuff, 0.08)
      .setOrigin(0)
      .setScrollFactor(0);
    this.add
      .text(12, 10, this.map.data.name.toUpperCase(), {
        fontFamily: FONT,
        fontSize: '16px',
        color: css(PALETTE.paper),
        backgroundColor: css(PALETTE.soot),
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0);

    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = kb.addKeys('W,A,S,D') as OverworldScene['wasd'];
    this.setupTouch();

    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.moving = false;
      this.touchDir = null;
    });
  }

  update(): void {
    if (this.moving) return;
    const dir = this.readInput();
    if (dir) this.tryMove(dir);
  }

  private readInput(): Direction | null {
    if (this.cursors.left.isDown || this.wasd.A.isDown) return 'left';
    if (this.cursors.right.isDown || this.wasd.D.isDown) return 'right';
    if (this.cursors.up.isDown || this.wasd.W.isDown) return 'up';
    if (this.cursors.down.isDown || this.wasd.S.isDown) return 'down';
    return this.touchDir;
  }

  /** En el móvil: mantener pulsado hacia un lado del protagonista para andar en esa dirección. */
  private setupTouch(): void {
    const update = (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      const cx = this.playerSprite.x + TILE / 2 - this.cameras.main.scrollX;
      const cy = this.playerSprite.y + TILE / 2 - this.cameras.main.scrollY;
      const dx = p.x - cx;
      const dy = p.y - cy;
      if (Math.abs(dx) < TILE / 2 && Math.abs(dy) < TILE / 2) return;
      this.touchDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    };
    this.input.on('pointerdown', update);
    this.input.on('pointermove', update);
    this.input.on('pointerup', () => (this.touchDir = null));
  }

  private tryMove(dir: Direction): void {
    const target = step(this.playerPos, dir);
    // Contra un muro no se mueve nadie. Si vas hacia tu Pokémon, intercambiáis el sitio.
    if (!this.map.isWalkable(target)) return;
    const from = this.playerPos;
    this.playerPos = target;
    this.follower.onLeaderMoved(from);
    this.moving = true;

    this.tweens.add({
      targets: this.playerSprite,
      x: target.x * TILE,
      y: target.y * TILE,
      duration: STEP_MS,
    });
    this.tweens.add({
      targets: this.followerSprite,
      x: this.follower.position.x * TILE,
      y: this.follower.position.y * TILE,
      duration: STEP_MS,
      onComplete: () => this.afterStep(),
    });
  }

  private afterStep(): void {
    this.moving = false;
    if (this.map.tileAt(this.playerPos) !== 'smoke' || !this.map.data.encounterTable) return;
    const table = TABLES[this.map.data.encounterTable];
    const wild = rollEncounter(table, Math.random);
    if (!wild) return;
    this.moving = true;
    this.cameras.main.flash(250, 40, 40, 40);
    this.time.delayedCall(260, () => {
      this.scene.launch('Battle', {
        player: this.state.party,
        opponent: [{ species: wild.species, level: wild.level, moves: wild.moves }],
      });
      this.scene.pause();
    });
  }

  private snapSprites(): void {
    this.playerSprite.setPosition(this.playerPos.x * TILE, this.playerPos.y * TILE);
    const f = this.follower.position;
    this.followerSprite.setPosition(f.x * TILE, f.y * TILE);
  }

  private drawMap(): void {
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        const tile = this.map.tileAt({ x, y });
        this.add.image(x * TILE, y * TILE, `tile-${tile}`).setOrigin(0);
      }
    }
  }
}
