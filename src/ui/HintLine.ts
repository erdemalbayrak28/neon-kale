import type Phaser from 'phaser';
import { COLORS, LAYOUT } from '../config';
import { DEPTH } from '../render/depth';
import { makeText, setTextColor } from './text';

// Haritanın altındaki ipucu satırı: o anki modu anlatır. Başarısız bir komutun nedeni kısa süre kırmızı gösterilir.

const MESSAGE_TIME = 1.8;

export class HintLine {
  private readonly text: Phaser.GameObjects.Text;
  private readonly dot: Phaser.GameObjects.Graphics;
  private message: { text: string; color: number; until: number } | null = null;

  constructor(scene: Phaser.Scene) {
    const y = LAYOUT.hintY;
    const h = LAYOUT.hintHeight;
    const bg = scene.add.graphics().setDepth(DEPTH.ui);
    bg.fillStyle(COLORS.panel, 1);
    bg.fillRect(LAYOUT.mapX, y, LAYOUT.mapWidth, h);
    bg.lineStyle(1, COLORS.panelBorder, 1);
    bg.lineBetween(LAYOUT.mapX, y + 0.5, LAYOUT.mapX + LAYOUT.mapWidth, y + 0.5);
    this.dot = scene.add.graphics().setDepth(DEPTH.ui);
    this.text = makeText(scene, LAYOUT.mapX + 30, y + h / 2, '', { size: 14, color: COLORS.textDim }).setOrigin(0, 0.5).setDepth(DEPTH.ui);
  }

  /** Geçici mesaj (ör. "Yeterli altın yok"). `now` gerçek zaman, saniye. */
  flash(text: string, now: number, color: number = COLORS.invalid): void {
    this.message = { text, color, until: now + MESSAGE_TIME };
  }

  update(hint: string, now: number): void {
    const msg = this.message && now < this.message.until ? this.message : null;
    if (!msg) this.message = null;
    const value = msg ? msg.text : hint;
    const color = msg ? msg.color : COLORS.textDim;
    this.text.setText(value);
    setTextColor(this.text, color);
    const y = LAYOUT.hintY + LAYOUT.hintHeight / 2;
    this.dot.clear();
    this.dot.fillStyle(msg ? color : COLORS.pathEdge, msg ? 1 : 0.7);
    this.dot.fillCircle(LAYOUT.mapX + 17, y, 3.5);
  }
}
