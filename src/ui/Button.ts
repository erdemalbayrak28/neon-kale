import type Phaser from 'phaser';
import { COLORS } from '../config';
import { darken, glowRoundRect, lighten } from '../render/neon';
import { Hotspot } from './Hotspot';
import { GOLD } from './strings';
import { makeText, setTextColor } from './text';

// Yeniden kullanılabilir neon düğme: yuvarlatılmış dikdörtgen; üstüne gelme, basılı, devre dışı ve "açık" (seçili)
// durumları; isteğe bağlı kısayol etiketi ve bedel etiketi (altın yetmiyorsa kırmızı).

export type ButtonVariant = 'primary' | 'secondary';

export interface ButtonOptions {
  /** Sol üst köşe. */
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  onClick: () => void;
  variant?: ButtonVariant;
  /** Vurgu rengi (çerçeve ve parıltı). */
  color?: number;
  fontSize?: number;
  /** Küçük kısayol etiketi (ör. "U"). */
  hotkey?: string;
  /** Simge çizici: düğmenin içine, (cx, cy) merkezine çizer. Simge varken yazı boş bırakılabilir. */
  icon?: (g: Phaser.GameObjects.Graphics, cx: number, cy: number, color: number) => void;
  depth?: number;
}

export class Button {
  readonly container: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly hotkeyText: Phaser.GameObjects.Text | null = null;
  private readonly costText: Phaser.GameObjects.Text;
  private readonly hotspot: Hotspot;
  private cost: { text: string; affordable: boolean } | null = null;
  private active = false;
  private color: number;

  constructor(
    scene: Phaser.Scene,
    private readonly o: ButtonOptions,
  ) {
    this.color = o.color ?? COLORS.accent;
    this.container = scene.add.container(o.x, o.y);
    if (o.depth !== undefined) this.container.setDepth(o.depth);
    this.bg = scene.add.graphics();
    this.label = makeText(scene, o.width / 2, o.height / 2, o.label, { size: o.fontSize ?? 16, bold: true }).setOrigin(0.5);
    if (o.hotkey) {
      this.hotkeyText = makeText(scene, 10 + 9, o.height / 2, o.hotkey, { size: 11, bold: true, color: COLORS.textDim }).setOrigin(0.5);
    }
    this.costText = makeText(scene, o.width - 12, o.height / 2, '', { size: 14, bold: true, color: COLORS.gold }).setOrigin(1, 0.5);
    this.costText.setVisible(false);
    this.container.add([this.bg, this.label, this.costText]);
    if (this.hotkeyText) this.container.add(this.hotkeyText);
    this.hotspot = new Hotspot(scene, this.container, 0, 0, o.width, o.height, () => this.redraw(), o.onClick);
    this.layout();
    this.redraw();
  }

  setLabel(label: string): this {
    if (this.label.text !== label) {
      this.label.setText(label);
      this.layout();
    }
    return this;
  }

  /** Bedel etiketi (ör. "40 ◆"); null gizler. `prefix` "+" ise satış gibi kazanç gösterir. */
  setCost(amount: number | null, affordable = true, prefix = ''): this {
    const next = amount === null ? null : { text: `${prefix}${amount} ${GOLD}`, affordable };
    if (next?.text === this.cost?.text && next?.affordable === this.cost?.affordable) return this;
    this.cost = next;
    this.costText.setVisible(next !== null);
    if (next) this.costText.setText(next.text);
    this.layout();
    this.redraw();
    return this;
  }

  setEnabled(enabled: boolean): this {
    this.hotspot.setEnabled(enabled);
    return this;
  }

  /** "Açık" durumu: hız 2x gibi aç/kapa düğmeleri için. */
  setActive(active: boolean): this {
    if (active !== this.active) {
      this.active = active;
      this.redraw();
    }
    return this;
  }

  setColor(color: number): this {
    if (color !== this.color) {
      this.color = color;
      this.redraw();
    }
    return this;
  }

  setVisible(visible: boolean): this {
    this.container.setVisible(visible);
    return this;
  }

  get visible(): boolean {
    return this.container.visible;
  }

  private layout(): void {
    const { width, height } = this.o;
    if (this.cost) {
      // Bedel sağda, yazı solda.
      const left = this.hotkeyText ? 34 : 14;
      this.label.setOrigin(0, 0.5).setPosition(left, height / 2);
    } else {
      const shift = this.hotkeyText ? 10 : 0;
      this.label.setOrigin(0.5).setPosition(width / 2 + shift, height / 2);
    }
  }

  private redraw(): void {
    const g = this.bg;
    const { width: w, height: h } = this.o;
    const enabled = this.hotspot?.isEnabled ?? true;
    const hover = enabled && (this.hotspot?.hover ?? false);
    const pressed = enabled && (this.hotspot?.pressed ?? false);
    const primary = this.o.variant === 'primary';
    const color = enabled ? this.color : COLORS.panelBorder;
    const yOff = pressed ? 1 : 0;
    g.clear();

    if (primary && enabled) {
      g.fillStyle(darken(color, 0.25), 1);
      g.fillRoundedRect(0, yOff + 2, w, h, 10);
      g.fillStyle(hover ? lighten(color, 0.18) : color, 1);
      g.fillRoundedRect(0, yOff, w, h - 1, 10);
      g.fillStyle(0xffffff, hover ? 0.22 : 0.14);
      g.fillRoundedRect(3, yOff + 3, w - 6, h * 0.42, { tl: 8, tr: 8, bl: 2, br: 2 });
      glowRoundRect(g, 0, yOff, w, h - 1, 10, color, { width: 1, alpha: hover ? 1 : 0.7, glow: hover ? 1.4 : 1 });
    } else {
      const fillAlpha = !enabled ? 0.5 : pressed ? 0.28 : hover || this.active ? 0.16 : 0.06;
      g.fillStyle(COLORS.card, enabled ? 0.95 : 0.7);
      g.fillRoundedRect(0, yOff, w, h, 9);
      g.fillStyle(color, fillAlpha);
      g.fillRoundedRect(0, yOff, w, h, 9);
      glowRoundRect(g, 0.5, yOff + 0.5, w - 1, h - 1, 9, color, {
        width: hover || this.active ? 2 : 1.5,
        alpha: enabled ? (hover || this.active ? 1 : 0.7) : 0.6,
        glow: enabled ? (hover ? 1 : 0.5) : 0,
      });
    }

    if (this.hotkeyText) {
      g.fillStyle(0x000000, primary && enabled ? 0.25 : 0.35);
      g.fillRoundedRect(9, yOff + h / 2 - 10, 20, 20, 5);
      g.lineStyle(1, enabled ? lighten(color, 0.2) : COLORS.panelBorder, primary && enabled ? 0.6 : 0.8);
      g.strokeRoundedRect(9, yOff + h / 2 - 10, 20, 20, 5);
      this.hotkeyText.setY(h / 2 + yOff);
      setTextColor(this.hotkeyText, primary && enabled ? COLORS.background : enabled ? COLORS.text : COLORS.textDim);
    }

    const labelColor = !enabled ? COLORS.textDim : primary ? COLORS.background : hover || this.active ? lighten(color, 0.6) : COLORS.text;
    setTextColor(this.label, labelColor);
    this.label.setAlpha(enabled ? 1 : 0.75);
    this.label.setY(h / 2 + yOff);
    if (this.cost) {
      const costColor = !this.cost.affordable ? COLORS.invalid : primary && enabled ? COLORS.background : COLORS.gold;
      setTextColor(this.costText, costColor);
      this.costText.setAlpha(enabled ? 1 : 0.7);
      this.costText.setY(h / 2 + yOff);
    }

    if (this.o.icon) this.o.icon(g, this.label.text ? 22 : w / 2, h / 2 + yOff, labelColor);
  }
}
