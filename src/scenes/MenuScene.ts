import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TILE } from '../config';
import { ENEMIES } from '../core/data/enemies';
import { TOWER_ORDER, TOWERS } from '../core/data/towers';
import { lighten, mix } from '../render/neon';
import { drawEnemy, drawTower } from '../render/shapes';
import { TEX, ensureTextures } from '../render/textures';
import { Button } from '../ui/Button';
import { makeText } from '../ui/text';
import { SCENE_KEYS } from './keys';

// Ana menü: arkada yavaşça kayan neon ızgara, parıltılı "NEON KALE" başlığı, "Oyna" düğmesi ve kısa "Nasıl oynanır".

/** Menü yerleşimi (e2e testi "Oyna" düğmesine bu koordinattan tıklar). */
export const MENU_LAYOUT = {
  titleY: 150,
  subtitleY: 222,
  playX: GAME_WIDTH / 2,
  playY: 300,
  playWidth: 260,
  playHeight: 64,
  helpY: 390,
  horizonY: 360,
} as const;

const MENU_SIDE_X = 180;
const ENEMY_ORDER = ['runner', 'scout', 'brute'] as const;

const HELP_ROWS: readonly [string[], string][] = [
  [['1', '2', '3'], 'Kule seç, yolun yanındaki boş karoya tıklayarak kur'],
  [['U', 'S'], 'Seçili kuleyi yükselt / sat'],
  [['Boşluk'], 'Dalgayı başlat ya da erken çağır (+altın)'],
  [['F', 'P'], 'Hız 1x/2x · Duraklat'],
  [['Esc'], 'İptal · Sağ tık da iptal eder'],
];

export class MenuScene extends Phaser.Scene {
  private grid!: Phaser.GameObjects.Graphics;
  private leaving = false;

  constructor() {
    super(SCENE_KEYS.menu);
  }

  create(): void {
    this.leaving = false;
    ensureTextures(this);
    this.cameras.main.setBackgroundColor(COLORS.background);

    // Arka plan: başlığın arkasında yumuşak ışık lekeleri, ufukta parlayan çizgi, kayan ızgara.
    this.add.image(GAME_WIDTH / 2, MENU_LAYOUT.titleY, TEX.glow).setScale(4.2, 1.6).setTint(COLORS.pathEdge).setAlpha(0.16).setBlendMode(Phaser.BlendModes.ADD);
    this.add.image(GAME_WIDTH / 2, MENU_LAYOUT.horizonY, TEX.glow).setScale(6, 0.9).setTint(COLORS.menuGrid).setAlpha(0.28).setBlendMode(Phaser.BlendModes.ADD);
    this.grid = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.add.particles(0, 0, TEX.spark, {
      x: { min: 0, max: GAME_WIDTH },
      y: { min: 0, max: MENU_LAYOUT.horizonY },
      lifespan: 4000,
      speedY: { min: -14, max: -4 },
      scale: { start: 0.25, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: [COLORS.pathEdge, COLORS.menuGrid, COLORS.accent],
      frequency: 140,
      blendMode: Phaser.BlendModes.ADD,
    });

    const title = makeText(this, GAME_WIDTH / 2, MENU_LAYOUT.titleY, 'NEON KALE', {
      size: 104,
      bold: true,
      color: lighten(COLORS.pathEdge, 0.55),
      glow: COLORS.pathEdge,
      glowBlur: 30,
      letterSpacing: 10,
    }).setOrigin(0.5);
    // Pembe gölge kopyası: hafif renk kayması etkisi.
    makeText(this, GAME_WIDTH / 2 + 4, MENU_LAYOUT.titleY + 3, 'NEON KALE', {
      size: 104,
      bold: true,
      color: COLORS.menuGrid,
      letterSpacing: 10,
    })
      .setOrigin(0.5)
      .setAlpha(0.35)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(-1);
    this.tweens.add({ targets: title, alpha: 0.86, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    makeText(this, GAME_WIDTH / 2, MENU_LAYOUT.subtitleY, 'Neon bir kule savunması · Kaleyi 10 dalga boyunca koru', {
      size: 20,
      color: COLORS.textDim,
    }).setOrigin(0.5);

    new Button(this, {
      x: MENU_LAYOUT.playX - MENU_LAYOUT.playWidth / 2,
      y: MENU_LAYOUT.playY - MENU_LAYOUT.playHeight / 2,
      width: MENU_LAYOUT.playWidth,
      height: MENU_LAYOUT.playHeight,
      label: 'Oyna',
      fontSize: 26,
      variant: 'primary',
      onClick: () => this.play(),
    });

    this.drawHelp();
    this.drawShowcase();

    makeText(this, GAME_WIDTH - 16, GAME_HEIGHT - 12, 'v0.1', { size: 14, color: COLORS.textDim }).setOrigin(1, 1);
    makeText(this, 16, GAME_HEIGHT - 12, 'Enter: oyna', { size: 14, color: COLORS.textDim }).setOrigin(0, 1);

    this.input.keyboard?.on('keydown', this.onKey, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown', this.onKey, this));
    this.cameras.main.fadeIn(300, 10, 13, 20);
  }

  override update(time: number): void {
    this.drawGrid(time / 1000);
  }

  private onKey(event: KeyboardEvent): void {
    if (event.code === 'Enter' || event.code === 'Space' || event.code === 'NumpadEnter') this.play();
  }

  private play(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(220, 10, 13, 20);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(SCENE_KEYS.game));
  }

  /** Ufka doğru daralan, sürekli yaklaşan perspektif ızgara. */
  private drawGrid(t: number): void {
    const g = this.grid;
    g.clear();
    const horizon = MENU_LAYOUT.horizonY;
    const bottom = GAME_HEIGHT;
    const cx = GAME_WIDTH / 2;
    const depth = bottom - horizon;
    // Yatay çizgiler: z = 1..N, ekranda y = horizon + depth / z; zamanla z küçülür (yaklaşır).
    const speed = 0.35;
    const phase = (t * speed) % 1;
    for (let i = 0; i < 18; i++) {
      const z = 1 + (i + 1 - phase) * 0.55;
      const y = horizon + depth / (z * z * 0.6);
      if (y > bottom || y < horizon) continue;
      const k = (y - horizon) / depth;
      g.lineStyle(1 + k * 1.5, COLORS.menuGrid, 0.08 + k * 0.5);
      g.lineBetween(0, y, GAME_WIDTH, y);
    }
    // Dikey çizgiler: kaybolma noktasından yayılır.
    for (let i = -16; i <= 16; i++) {
      const xBottom = cx + i * 120;
      const k = 1 - Math.abs(i) / 18;
      g.lineStyle(1.2, mix(COLORS.menuGrid, COLORS.pathEdge, 0.3), 0.12 + k * 0.28);
      g.lineBetween(cx + i * 6, horizon, xBottom, bottom);
    }
    g.lineStyle(2, COLORS.menuGrid, 0.8);
    g.lineBetween(0, horizon, GAME_WIDTH, horizon);
  }

  private drawHelp(): void {
    const w = 580;
    const rowH = 30;
    const h = 52 + HELP_ROWS.length * rowH + 10;
    const x = GAME_WIDTH / 2 - w / 2;
    const y = MENU_LAYOUT.helpY;
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 0.88);
    g.fillRoundedRect(x, y, w, h, 14);
    g.lineStyle(1, COLORS.pathEdge, 0.35);
    g.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 14);
    makeText(this, x + 24, y + 16, 'NASIL OYNANIR', { size: 13, bold: true, color: COLORS.textDim, letterSpacing: 2 });
    HELP_ROWS.forEach(([keys, text], i) => {
      const ry = y + 52 + i * rowH;
      let kx = x + 24;
      for (const key of keys) {
        const label = makeText(this, 0, ry, key, { size: 13, bold: true }).setOrigin(0.5);
        const kw = Math.max(26, label.width + 14);
        g.fillStyle(COLORS.card, 1);
        g.fillRoundedRect(kx, ry - 12, kw, 24, 5);
        g.lineStyle(1, lighten(COLORS.panelBorder, 0.3), 1);
        g.strokeRoundedRect(kx + 0.5, ry - 11.5, kw - 1, 23, 5);
        label.setX(kx + kw / 2);
        kx += kw + 6;
      }
      makeText(this, x + 150, ry, text, { size: 15, color: COLORS.text }).setOrigin(0, 0.5);
    });
  }

  /** Yardım kutusunun solunda üç kule, sağında üç düşman: "kim kime karşı". */
  private drawShowcase(): void {
    const g = this.add.graphics();
    const top = MENU_LAYOUT.helpY + 40;
    const step = 92;
    TOWER_ORDER.forEach((kind, i) => {
      const def = TOWERS[kind];
      const x = MENU_SIDE_X;
      const y = top + i * step;
      drawTower(g, kind, x, y, { level: (i + 1) as 1 | 2 | 3, aimAngle: -Math.PI / 4 + i * 0.6, scale: 1.25 });
      makeText(this, x, y + 38, def.name, { size: 14, bold: true, color: lighten(def.color, 0.2) }).setOrigin(0.5);
    });
    ENEMY_ORDER.forEach((kind, i) => {
      const def = ENEMIES[kind];
      const x = GAME_WIDTH - MENU_SIDE_X;
      const y = top + i * step;
      drawEnemy(g, kind, x, y, def.radius * TILE * 1.25, { heading: Math.PI });
      makeText(this, x, y + 38, def.name, { size: 14, bold: true, color: lighten(def.color, 0.2) }).setOrigin(0.5);
    });
  }
}
