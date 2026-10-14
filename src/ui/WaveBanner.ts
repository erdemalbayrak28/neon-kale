import type Phaser from 'phaser';
import { COLORS, LAYOUT, cssColor } from '../config';
import { DEPTH } from '../render/depth';
import { easeOutCubic, lighten } from '../render/neon';
import { makeText, setTextColor } from './text';

// Haritanın ortasında kısa süre görünen duyuru: "DALGA 3", "Dalga temizlendi +24 ◆".
// Efekt saatiyle ilerler: duraklatınca donar, hızlı ileri sarmada süresi dolmuşsa kaybolur.

const FADE_IN = 0.22;
const HOLD = 1.1;
const FADE_OUT = 0.35;
const RISE = 10;

export class WaveBanner {
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly y: number;
  private t0 = Number.NEGATIVE_INFINITY;

  constructor(scene: Phaser.Scene) {
    const x = LAYOUT.mapX + LAYOUT.mapWidth / 2;
    this.y = LAYOUT.mapY + LAYOUT.mapHeight * 0.3;
    this.title = makeText(scene, x, this.y, '', { size: 46, bold: true, letterSpacing: 6 }).setOrigin(0.5).setDepth(DEPTH.banner).setVisible(false);
    this.subtitle = makeText(scene, x, this.y + 40, '', { size: 17, bold: true, color: COLORS.text }).setOrigin(0.5).setDepth(DEPTH.banner).setVisible(false);
  }

  /** Duyuruyu `clock` anında (efekt saati) başlatır. */
  show(title: string, subtitle: string, color: number, clock: number): void {
    this.t0 = clock;
    this.title.setText(title).setShadow(0, 0, cssColor(color), 18, false, true);
    setTextColor(this.title, lighten(color, 0.35));
    this.subtitle.setText(subtitle);
  }

  update(clock: number): void {
    const t = clock - this.t0;
    const total = FADE_IN + HOLD + FADE_OUT;
    const visible = t >= 0 && t < total;
    this.title.setVisible(visible);
    this.subtitle.setVisible(visible);
    if (!visible) return;
    const alpha = t < FADE_IN ? t / FADE_IN : t < FADE_IN + HOLD ? 1 : 1 - (t - FADE_IN - HOLD) / FADE_OUT;
    const offset = RISE * (1 - easeOutCubic(t / FADE_IN));
    this.title.setAlpha(alpha).setY(this.y + offset);
    this.subtitle.setAlpha(alpha).setY(this.y + 40 + offset);
  }
}
