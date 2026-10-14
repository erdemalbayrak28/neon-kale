import type Phaser from 'phaser';
import { COLORS, LAYOUT } from '../config';
import { DEPTH } from '../render/depth';
import { Button } from './Button';
import { makeText } from './text';

// Duraklatma katmanı: haritanın üstünde yarı saydam perde, "DURAKLATILDI" ve "Devam et" düğmesi.
// Perde tıklamaları tutar; duraklatılmışken haritaya kule kurulamaz.

export class PauseOverlay {
  private readonly container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, onResume: () => void) {
    const cx = LAYOUT.mapX + LAYOUT.mapWidth / 2;
    const cy = LAYOUT.mapY + LAYOUT.mapHeight / 2;
    this.container = scene.add.container(0, 0).setDepth(DEPTH.overlay).setVisible(false);
    const shade = scene.add.graphics();
    shade.fillStyle(COLORS.background, 0.72);
    shade.fillRect(LAYOUT.mapX, LAYOUT.mapY, LAYOUT.mapWidth, LAYOUT.mapHeight);
    const blocker = scene.add.zone(LAYOUT.mapX, LAYOUT.mapY, LAYOUT.mapWidth, LAYOUT.mapHeight).setOrigin(0).setInteractive();
    const title = makeText(scene, cx, cy - 48, 'DURAKLATILDI', {
      size: 52,
      bold: true,
      color: 0xffffff,
      glow: COLORS.pathEdge,
      glowBlur: 22,
      letterSpacing: 8,
    }).setOrigin(0.5);
    const sub = makeText(scene, cx, cy + 4, 'P tuşuyla da devam edebilirsin', { size: 15, color: COLORS.textDim }).setOrigin(0.5);
    this.container.add([shade, blocker, title, sub]);
    const button = new Button(scene, {
      x: cx - 110,
      y: cy + 36,
      width: 220,
      height: 54,
      label: 'Devam et',
      fontSize: 20,
      variant: 'primary',
      onClick: onResume,
    });
    this.container.add(button.container);
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }
}
