import * as Phaser from 'phaser';
import { BattleAdapter, type BattlerView, type PokemonSpec } from '../battle/BattleAdapter';
import { FONT, PALETTE, css } from '../ui/palette';

export interface BattleSceneData {
  player: PokemonSpec[];
  opponent: PokemonSpec[];
}

const MESSAGE_MS = 1100;

interface Panel {
  name: Phaser.GameObjects.Text;
  hpText: Phaser.GameObjects.Text;
  bar: Phaser.GameObjects.Rectangle;
  barWidth: number;
  tag: Phaser.GameObjects.Text;
}

/**
 * Escena de combate con placeholders. Toda la lógica la decide BattleAdapter;
 * aquí solo se dibuja y se recoge la elección del jugador.
 */
export class BattleScene extends Phaser.Scene {
  private adapter!: BattleAdapter;
  private message!: Phaser.GameObjects.Text;
  private moveTexts: Phaser.GameObjects.Text[] = [];
  private selected = 0;
  private acceptingInput = false;
  private playerPanel!: Panel;
  private foePanel!: Panel;
  private foeSprite!: Phaser.GameObjects.Container;
  private smokeVeil!: Phaser.GameObjects.Rectangle;
  private advance: (() => void) | null = null;

  constructor() {
    super('Battle');
  }

  create(data: BattleSceneData): void {
    this.moveTexts = [];
    this.selected = 0;
    this.adapter = new BattleAdapter(data.player, data.opponent, { foeLabel: 'salvaje' });
    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, PALETTE.soot).setOrigin(0);
    this.add.rectangle(0, 0, width, 210, PALETTE.brick, 0.5).setOrigin(0);
    this.add.ellipse(470, 200, 220, 46, PALETTE.ink, 0.5);
    this.add.ellipse(170, 330, 260, 54, PALETTE.ink, 0.5);

    this.foeSprite = this.monPlaceholder(470, 150, 52, this.adapter.opponent.species);
    this.monPlaceholder(170, 270, 64, this.adapter.player.species);

    this.foePanel = this.panel(24, 28, this.adapter.opponent);
    this.playerPanel = this.panel(336, 250, this.adapter.player);

    // Velo de humo: se ve cuando TU Pokémon está tiznado y no distingue al rival.
    this.smokeVeil = this.add.rectangle(330, 20, 300, 210, PALETTE.smokePuff, 0.55).setOrigin(0).setVisible(false);

    this.add.rectangle(0, 352, width, 128, PALETTE.night).setOrigin(0).setStrokeStyle(2, PALETTE.gaslight);
    this.message = this.add.text(28, 372, '', {
      fontFamily: FONT,
      fontSize: '20px',
      color: css(PALETTE.paper),
      wordWrap: { width: width - 56 },
    });

    this.setupInput();
    const foe = this.adapter.opponent;
    this.showMessages([`¡Un ${foe.species} salvaje sale de entre el humo!`, `¡Adelante, ${this.adapter.player.name}!`], () =>
      this.showMoves(),
    );
  }

  // ---------- Flujo del combate ----------

  private choose(slot: number): void {
    if (!this.acceptingInput) return;
    this.hideMoves();
    const messages = this.adapter.playTurn(slot);
    this.showMessages(messages, () => {
      this.refresh();
      if (this.adapter.ended) this.finish();
      else this.showMoves();
    });
  }

  private finish(): void {
    const won = this.adapter.winner === 'player';
    const text = won
      ? '¡Has ganado el combate!'
      : `${this.adapter.player.name} no puede más... Volvéis al pub a recuperaros.`;
    this.showMessages([text], () => {
      this.scene.stop();
      this.scene.resume('Overworld');
    });
  }

  private showMessages(messages: string[], done: () => void): void {
    const queue = [...messages];
    const next = () => {
      const msg = queue.shift();
      if (msg === undefined) {
        this.advance = null;
        done();
        return;
      }
      this.message.setText(msg);
      const timer = this.time.delayedCall(MESSAGE_MS, next);
      this.advance = () => {
        timer.remove();
        next();
      };
    };
    next();
  }

  // ---------- Menú de movimientos ----------

  private showMoves(): void {
    this.message.setText('');
    const positions = [
      [40, 372],
      [340, 372],
      [40, 420],
      [340, 420],
    ];
    this.adapter.moves.forEach((m, i) => {
      const [x, y] = positions[i];
      const t = this.add
        .text(x, y, '', { fontFamily: FONT, fontSize: '20px', color: css(PALETTE.paper) })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.selected = i;
          this.choose(m.slot);
        });
      this.moveTexts.push(t);
    });
    this.acceptingInput = true;
    this.highlight();
  }

  private hideMoves(): void {
    this.acceptingInput = false;
    this.moveTexts.forEach((t) => t.destroy());
    this.moveTexts = [];
  }

  private highlight(): void {
    const moves = this.adapter.moves;
    this.moveTexts.forEach((t, i) => {
      const m = moves[i];
      const mark = i === this.selected ? '▶ ' : '  ';
      t.setText(`${mark}${m.name}  ${m.pp}/${m.maxPp}`);
      t.setColor(css(i === this.selected ? PALETTE.gaslight : PALETTE.paper));
    });
  }

  private setupInput(): void {
    const kb = this.input.keyboard!;
    // Cada combate vuelve a crear la escena: limpiamos listeners para no duplicarlos.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb.removeAllListeners();
      this.input.removeAllListeners();
    });
    const move =(dx: number, dy: number) => {
      if (!this.acceptingInput) return;
      const count = this.moveTexts.length;
      const col = this.selected % 2;
      const row = Math.floor(this.selected / 2);
      const nextIndex = Math.min(count - 1, Math.max(0, (row + dy) * 2 + Math.min(1, Math.max(0, col + dx))));
      this.selected = nextIndex;
      this.highlight();
    };
    kb.on('keydown-LEFT', () => move(-1, 0));
    kb.on('keydown-RIGHT', () => move(1, 0));
    kb.on('keydown-UP', () => move(0, -1));
    kb.on('keydown-DOWN', () => move(0, 1));
    const confirm = () => {
      if (this.advance) this.advance();
      else if (this.acceptingInput) this.choose(this.adapter.moves[this.selected].slot);
    };
    kb.on('keydown-ENTER', confirm);
    kb.on('keydown-SPACE', confirm);
    // Tocar la caja de texto también hace avanzar los mensajes.
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0 && this.advance) this.advance();
    });
  }

  // ---------- Dibujo ----------

  private refresh(): void {
    this.updatePanel(this.playerPanel, this.adapter.player, false);
    // Si tu Pokémon está tiznado, no ves bien al rival: barra y vida ocultas.
    const blind = this.adapter.player.tiznado;
    this.updatePanel(this.foePanel, this.adapter.opponent, blind);
    this.foeSprite.setAlpha(blind ? 0.35 : 1);
    this.smokeVeil.setVisible(blind);
  }

  private panel(x: number, y: number, view: BattlerView): Panel {
    this.add.rectangle(x, y, 280, 78, PALETTE.paper).setOrigin(0).setStrokeStyle(2, PALETTE.ink);
    const name = this.add.text(x + 14, y + 10, '', { fontFamily: FONT, fontSize: '18px', color: css(PALETTE.ink) });
    this.add.rectangle(x + 14, y + 42, 200, 10, PALETTE.quiet).setOrigin(0);
    const bar = this.add.rectangle(x + 14, y + 42, 200, 10, PALETTE.hpGood).setOrigin(0);
    const hpText = this.add.text(x + 222, y + 38, '', { fontFamily: FONT, fontSize: '14px', color: css(PALETTE.ink) });
    const tag = this.add
      .text(x + 14, y + 56, 'TIZNADO', {
        fontFamily: FONT,
        fontSize: '12px',
        color: css(PALETTE.paper),
        backgroundColor: css(PALETTE.smoke),
        padding: { x: 4, y: 1 },
      })
      .setVisible(false);
    const panel = { name, hpText, bar, barWidth: 200, tag };
    this.updatePanel(panel, view, false);
    return panel;
  }

  private updatePanel(p: Panel, v: BattlerView, hidden: boolean): void {
    p.name.setText(`${v.name}  Nv.${v.level}`);
    p.tag.setVisible(v.tiznado);
    const ratio = v.maxHp ? v.hp / v.maxHp : 0;
    if (hidden) {
      p.hpText.setText('???');
      p.bar.setAlpha(0.15);
      return;
    }
    p.bar.setAlpha(1);
    p.hpText.setText(`${v.hp}/${v.maxHp}`);
    p.bar.fillColor = ratio > 0.5 ? PALETTE.hpGood : ratio > 0.2 ? PALETTE.hpWarn : PALETTE.hpBad;
    this.tweens.add({ targets: p.bar, width: Math.max(0, p.barWidth * ratio), duration: 350 });
  }

  /** Placeholder hasta tener sprites: un círculo con el nombre de la especie. */
  private monPlaceholder(x: number, y: number, r: number, species: string): Phaser.GameObjects.Container {
    const circle = this.add.circle(0, 0, r, PALETTE.cobble).setStrokeStyle(3, PALETTE.furnace);
    const label = this.add
      .text(0, 0, species, { fontFamily: FONT, fontSize: '16px', color: css(PALETTE.paper) })
      .setOrigin(0.5);
    return this.add.container(x, y, [circle, label]);
  }
}
