import type Phaser from 'phaser';
import { COLORS, GAME_WIDTH, LAYOUT } from '../config';
import { DEPTH } from '../render/depth';
import { glowLine, lighten } from '../render/neon';
import { Button } from './Button';
import { drawDiamond, drawHeart, drawPause, drawPlay } from './icons';
import { makeText, setTextColor } from './text';

// Üst çubuk: başlık, ◆ altın, ♥ can, "Dalga x/10", hız [1x/2x] ve duraklatma [⏸] düğmeleri.

export interface TopBarState {
  gold: number;
  lives: number;
  maxLives: number;
  wave: number;
  totalWaves: number;
  speed: 1 | 2;
  paused: boolean;
}

const CHIP_Y = 14;
const CHIP_H = 36;

export class TopBar {
  private readonly goldText: Phaser.GameObjects.Text;
  private readonly livesText: Phaser.GameObjects.Text;
  private readonly waveText: Phaser.GameObjects.Text;
  private readonly speedButton: Button;
  private readonly pauseButton: Button;
  private lastGold = Number.NaN;
  private lastLives = Number.NaN;
  private paused = false;

  constructor(
    private readonly scene: Phaser.Scene,
    handlers: { onSpeed: () => void; onPause: () => void },
  ) {
    const h = LAYOUT.topBarHeight;
    const bg = scene.add.graphics().setDepth(DEPTH.ui);
    bg.fillStyle(COLORS.panel, 1);
    bg.fillRect(0, 0, GAME_WIDTH, h);
    bg.fillStyle(0xffffff, 0.02);
    bg.fillRect(0, 0, GAME_WIDTH, h / 2);
    glowLine(bg, 0, h - 0.5, GAME_WIDTH, h - 0.5, COLORS.pathEdge, { width: 1, alpha: 0.45, glow: 0.6 });

    makeText(scene, 24, h / 2, 'NEON KALE', { size: 24, bold: true, color: lighten(COLORS.pathEdge, 0.3), glow: COLORS.pathEdge, glowBlur: 14, letterSpacing: 3 })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.ui);

    const chips = scene.add.graphics().setDepth(DEPTH.ui);
    this.chip(chips, 214, 112, COLORS.gold);
    this.chip(chips, 338, 92, COLORS.lives);
    this.chip(chips, 442, 140, COLORS.pathEdge);
    drawDiamond(chips, 236, h / 2, 10, COLORS.gold);
    drawHeart(chips, 360, h / 2, 10, COLORS.lives);

    this.goldText = makeText(scene, 252, h / 2, '0', { size: 20, bold: true, color: COLORS.gold }).setOrigin(0, 0.5).setDepth(DEPTH.ui);
    this.livesText = makeText(scene, 376, h / 2, '0', { size: 20, bold: true, color: COLORS.lives }).setOrigin(0, 0.5).setDepth(DEPTH.ui);
    this.waveText = makeText(scene, 512, h / 2, '', { size: 18, bold: true, color: COLORS.text }).setOrigin(0.5).setDepth(DEPTH.ui);

    this.speedButton = new Button(scene, {
      x: GAME_WIDTH - 140,
      y: 12,
      width: 64,
      height: 40,
      label: '1x',
      fontSize: 17,
      color: COLORS.pathEdge,
      onClick: handlers.onSpeed,
      depth: DEPTH.ui,
    });
    this.pauseButton = new Button(scene, {
      x: GAME_WIDTH - 68,
      y: 12,
      width: 52,
      height: 40,
      label: '',
      color: COLORS.pathEdge,
      onClick: handlers.onPause,
      icon: (g, cx, cy, color) => (this.paused ? drawPlay(g, cx, cy, color) : drawPause(g, cx, cy, color)),
      depth: DEPTH.ui,
    });
  }

  update(s: TopBarState): void {
    if (s.gold !== this.lastGold) {
      if (!Number.isNaN(this.lastGold)) this.bump(this.goldText);
      this.lastGold = s.gold;
      this.goldText.setText(String(s.gold));
    }
    if (s.lives !== this.lastLives) {
      if (!Number.isNaN(this.lastLives) && s.lives < this.lastLives) this.bump(this.livesText);
      this.lastLives = s.lives;
      this.livesText.setText(String(s.lives));
      setTextColor(this.livesText, s.lives <= Math.ceil(s.maxLives / 4) ? COLORS.invalid : COLORS.lives);
    }
    this.waveText.setText(`Dalga ${s.wave}/${s.totalWaves}`);
    this.speedButton.setLabel(`${s.speed}x`).setActive(s.speed === 2);
    if (s.paused !== this.paused) {
      this.paused = s.paused;
      this.pauseButton.setActive(s.paused);
    }
  }

  setEnabled(enabled: boolean): void {
    this.speedButton.setEnabled(enabled);
    this.pauseButton.setEnabled(enabled);
  }

  private chip(g: Phaser.GameObjects.Graphics, x: number, w: number, color: number): void {
    g.fillStyle(COLORS.card, 1);
    g.fillRoundedRect(x, CHIP_Y, w, CHIP_H, 10);
    g.lineStyle(1, color, 0.35);
    g.strokeRoundedRect(x + 0.5, CHIP_Y + 0.5, w - 1, CHIP_H - 1, 10);
  }

  private bump(text: Phaser.GameObjects.Text): void {
    this.scene.tweens.killTweensOf(text);
    text.setScale(1.18);
    this.scene.tweens.add({ targets: text, scale: 1, duration: 180, ease: 'Quad.easeOut' });
  }
}
