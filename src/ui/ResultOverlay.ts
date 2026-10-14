import type Phaser from 'phaser';
import { COLORS, LAYOUT } from '../config';
import { DEPTH } from '../render/depth';
import { darken, fillPolygon, glowPolygon, glowRoundRect, lighten, starPoints } from '../render/neon';
import { Button } from './Button';
import { makeText } from './text';

// Sonuç penceresi (haritanın üstünde): Zafer!/Yenilgi, zaferde 1–3 yıldız, dalga ve can istatistiği,
// "Tekrar oyna" ve "Ana menü" düğmeleri.

export interface ResultInfo {
  victory: boolean;
  stars: number;
  wavesReached: number;
  totalWaves: number;
  lives: number;
  maxLives: number;
}

const WIN_W = 480;
const WIN_H = 340;

export class ResultOverlay {
  private readonly container: Phaser.GameObjects.Container;
  private readonly window: Phaser.GameObjects.Container;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly stars: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly waveValue: Phaser.GameObjects.Text;
  private readonly livesValue: Phaser.GameObjects.Text;
  private shown = false;

  constructor(
    private readonly scene: Phaser.Scene,
    handlers: { onRestart: () => void; onMenu: () => void },
  ) {
    const cx = LAYOUT.mapX + LAYOUT.mapWidth / 2;
    const cy = LAYOUT.mapY + LAYOUT.mapHeight / 2;
    this.container = scene.add.container(0, 0).setDepth(DEPTH.overlay).setVisible(false);
    const shade = scene.add.graphics();
    shade.fillStyle(0x000000, 0.62);
    shade.fillRect(LAYOUT.mapX, LAYOUT.mapY, LAYOUT.mapWidth, LAYOUT.mapHeight);
    const blocker = scene.add.zone(LAYOUT.mapX, LAYOUT.mapY, LAYOUT.mapWidth, LAYOUT.mapHeight).setOrigin(0).setInteractive();
    this.container.add([shade, blocker]);

    // Pencere kendi merkezine göre çizilir; açılışta hafifçe büyür.
    this.window = scene.add.container(cx, cy);
    this.frame = scene.add.graphics();
    this.stars = scene.add.graphics();
    this.title = makeText(scene, 0, -WIN_H / 2 + 50, '', { size: 46, bold: true, letterSpacing: 2 }).setOrigin(0.5);
    this.subtitle = makeText(scene, 0, -WIN_H / 2 + 116, '', { size: 18, color: COLORS.textDim }).setOrigin(0.5);
    const statY = 44;
    const waveLabel = makeText(scene, -90, statY - 30, 'DALGA', { size: 12, bold: true, color: COLORS.textDim, letterSpacing: 2 }).setOrigin(0.5);
    const livesLabel = makeText(scene, 90, statY - 30, 'KALAN CAN', { size: 12, bold: true, color: COLORS.textDim, letterSpacing: 2 }).setOrigin(0.5);
    this.waveValue = makeText(scene, -90, statY, '', { size: 26, bold: true, color: COLORS.text }).setOrigin(0.5);
    this.livesValue = makeText(scene, 90, statY, '', { size: 26, bold: true, color: COLORS.lives }).setOrigin(0.5);
    this.window.add([this.frame, this.stars, this.title, this.subtitle, waveLabel, livesLabel, this.waveValue, this.livesValue]);

    const restart = new Button(scene, {
      x: -WIN_W / 2 + 32,
      y: WIN_H / 2 - 82,
      width: 200,
      height: 52,
      label: 'Tekrar oyna',
      fontSize: 18,
      variant: 'primary',
      onClick: handlers.onRestart,
    });
    const menu = new Button(scene, {
      x: WIN_W / 2 - 32 - 184,
      y: WIN_H / 2 - 82,
      width: 184,
      height: 52,
      label: 'Ana menü',
      fontSize: 18,
      color: COLORS.pathEdge,
      onClick: handlers.onMenu,
    });
    this.window.add([restart.container, menu.container]);
    this.container.add(this.window);
  }

  get visible(): boolean {
    return this.shown;
  }

  show(info: ResultInfo): void {
    if (this.shown) return;
    this.shown = true;
    const color = info.victory ? COLORS.valid : COLORS.lives;
    const f = this.frame;
    f.clear();
    f.fillStyle(COLORS.panel, 0.97);
    f.fillRoundedRect(-WIN_W / 2, -WIN_H / 2, WIN_W, WIN_H, 18);
    f.fillStyle(color, 0.05);
    f.fillRoundedRect(-WIN_W / 2, -WIN_H / 2, WIN_W, WIN_H, 18);
    glowRoundRect(f, -WIN_W / 2, -WIN_H / 2, WIN_W, WIN_H, 18, color, { width: 2, glow: 1.4 });
    f.lineStyle(1, COLORS.panelBorder, 1);
    f.lineBetween(0, 0, 0, 62);

    this.title.setText(info.victory ? 'Zafer!' : 'Yenilgi').setShadow(0, 0, `#${color.toString(16).padStart(6, '0')}`, 20, false, true);
    this.title.setColor(`#${lighten(color, 0.35).toString(16).padStart(6, '0')}`);
    this.waveValue.setText(`${info.wavesReached}/${info.totalWaves}`);
    this.livesValue.setText(`${info.lives}/${info.maxLives}`);

    this.stars.clear();
    if (info.victory) {
      this.subtitle.setVisible(false);
      this.drawStars(info.stars);
    } else {
      this.subtitle.setVisible(true).setText('Kale düştü. Kuleleri yolun kıvrımlarına kurmayı dene.');
    }

    this.container.setVisible(true).setAlpha(0);
    this.window.setScale(0.92);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 260, ease: 'Quad.easeOut' });
    this.scene.tweens.add({ targets: this.window, scale: 1, duration: 360, ease: 'Back.easeOut' });
  }

  private drawStars(count: number): void {
    const g = this.stars;
    const y = -WIN_H / 2 + 114;
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 66;
      const big = i === 1 ? 1.15 : 1;
      const pts = starPoints(x, y - (i === 1 ? 6 : 0), 27 * big, 12 * big);
      if (i < count) {
        fillPolygon(g, pts, COLORS.gold, 1);
        glowPolygon(g, pts, COLORS.gold, { width: 2, glow: 1.4 });
        const inner = starPoints(x, y - (i === 1 ? 6 : 0), 13 * big, 6 * big);
        fillPolygon(g, inner, lighten(COLORS.gold, 0.6), 0.8);
      } else {
        fillPolygon(g, pts, darken(COLORS.gold, 0.85), 1);
        glowPolygon(g, pts, COLORS.panelBorder, { width: 2, glow: 0 });
      }
    }
  }
}
