import type Phaser from 'phaser';
import { COLORS, FONT_FAMILY, cssColor } from '../config';

// Ortak yazı biçimi: sistem yazı tipi, keskinlik için 2 kat çözünürlük.

export interface TextOptions {
  size?: number;
  color?: number;
  bold?: boolean;
  /** Yazının etrafında neon parıltı (renk). */
  glow?: number;
  glowBlur?: number;
  wrap?: number;
  align?: 'left' | 'center' | 'right';
  letterSpacing?: number;
  lineSpacing?: number;
}

export function makeText(scene: Phaser.Scene, x: number, y: number, value: string, o: TextOptions = {}): Phaser.GameObjects.Text {
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: FONT_FAMILY,
    fontSize: `${o.size ?? 16}px`,
    fontStyle: o.bold ? 'bold' : 'normal',
    color: cssColor(o.color ?? COLORS.text),
    resolution: 2,
    align: o.align ?? 'left',
  };
  if (o.wrap) style.wordWrap = { width: o.wrap, useAdvancedWrap: true };
  const text = scene.add.text(x, y, value, style);
  if (o.glow !== undefined) text.setShadow(0, 0, cssColor(o.glow), o.glowBlur ?? 10, false, true);
  if (o.letterSpacing) text.setLetterSpacing(o.letterSpacing);
  if (o.lineSpacing) text.setLineSpacing(o.lineSpacing);
  return text;
}

/** Yazı rengini Phaser renk sayısıyla değiştirir (aynıysa dokuyu yeniden üretmez). */
export function setTextColor(text: Phaser.GameObjects.Text, color: number): void {
  const css = cssColor(color);
  if (text.style.color !== css) text.setColor(css);
}
