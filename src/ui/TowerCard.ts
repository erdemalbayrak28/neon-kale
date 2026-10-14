import type Phaser from 'phaser';
import { COLORS } from '../config';
import type { TowerDef } from '../core/types';
import { glowRoundRect, lighten } from '../render/neon';
import { drawTower } from '../render/shapes';
import { Hotspot } from './Hotspot';
import { GOLD } from './strings';
import { makeText, setTextColor } from './text';

// Paneldeki kule kartı: simge, ad, bedel, kısayol ve tek cümlelik açıklama. Tıklayınca yerleştirme modu açılır.

export const CARD_HEIGHT = 66;

export interface TowerCardState {
  affordable: boolean;
  /** Bu kule şu an yerleştiriliyor mu? */
  active: boolean;
  enabled: boolean;
}

export class TowerCard {
  readonly container: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly cost: Phaser.GameObjects.Text;
  private readonly name: Phaser.GameObjects.Text;
  private readonly desc: Phaser.GameObjects.Text;
  private readonly key: Phaser.GameObjects.Text;
  private readonly hotspot: Hotspot;
  private state: TowerCardState = { affordable: true, active: false, enabled: true };

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly width: number,
    private readonly def: TowerDef,
    onClick: () => void,
  ) {
    this.container = scene.add.container(x, y);
    this.bg = scene.add.graphics();
    const icon = scene.add.graphics();
    drawTower(icon, def.kind, 31, CARD_HEIGHT / 2, { level: 1, aimAngle: -Math.PI / 4, scale: 0.9, pips: false });
    this.name = makeText(scene, 60, 9, def.name, { size: 16, bold: true });
    this.cost = makeText(scene, width - 12, 9, `${def.levels[0].cost} ${GOLD}`, { size: 15, bold: true, color: COLORS.gold }).setOrigin(1, 0);
    this.desc = makeText(scene, 60, 31, def.description, { size: 12, color: COLORS.textDim, wrap: width - 60 - 40, lineSpacing: 1 });
    this.key = makeText(scene, width - 23, CARD_HEIGHT - 20, def.hotkey, { size: 12, bold: true }).setOrigin(0.5);
    this.container.add([this.bg, icon, this.name, this.cost, this.desc, this.key]);
    this.hotspot = new Hotspot(scene, this.container, 0, 0, width, CARD_HEIGHT, () => this.redraw(), onClick);
    this.redraw();
  }

  update(next: TowerCardState): void {
    const s = this.state;
    if (s.affordable === next.affordable && s.active === next.active && s.enabled === next.enabled) return;
    this.state = { ...next };
    this.hotspot.setEnabled(next.enabled);
    this.redraw();
  }

  private redraw(): void {
    const g = this.bg;
    const w = this.width;
    const h = CARD_HEIGHT;
    const color = this.def.color;
    const { active, affordable } = this.state;
    const enabled = this.hotspot?.isEnabled ?? true;
    const hover = enabled && (this.hotspot?.hover ?? false);
    g.clear();
    g.fillStyle(COLORS.card, 1);
    g.fillRoundedRect(0, 0, w, h, 10);
    g.fillStyle(color, active ? 0.16 : hover ? 0.09 : 0.03);
    g.fillRoundedRect(0, 0, w, h, 10);
    glowRoundRect(g, 0.5, 0.5, w - 1, h - 1, 10, color, {
      width: active ? 2 : 1.2,
      alpha: active ? 1 : hover ? 0.8 : 0.4,
      glow: active ? 1.1 : hover ? 0.6 : 0,
    });
    // Kısayol tuşu rozeti.
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(w - 33, h - 30, 20, 20, 5);
    g.lineStyle(1, active ? color : COLORS.panelBorder, active ? 0.9 : 1);
    g.strokeRoundedRect(w - 33, h - 30, 20, 20, 5);

    setTextColor(this.cost, affordable ? COLORS.gold : COLORS.invalid);
    setTextColor(this.name, active ? lighten(color, 0.4) : COLORS.text);
    this.container.setAlpha(enabled ? (affordable || active ? 1 : 0.7) : 0.45);
  }
}
