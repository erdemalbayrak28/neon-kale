import type Phaser from 'phaser';
import { fillPolygon, glowPolygon, lighten } from '../render/neon';

// Kodla çizilen küçük simgeler (yazı tipinde olmayabilecek karakterler yerine).

type Gfx = Phaser.GameObjects.Graphics;

/** Altın: parlayan elmas. */
export function drawDiamond(g: Gfx, cx: number, cy: number, r: number, color: number): void {
  const pts = [
    { x: cx, y: cy - r },
    { x: cx + r * 0.78, y: cy },
    { x: cx, y: cy + r },
    { x: cx - r * 0.78, y: cy },
  ];
  fillPolygon(g, pts, color, 0.9);
  glowPolygon(g, pts, color, { width: 1.5, glow: 0.8 });
  g.fillStyle(lighten(color, 0.7), 0.9);
  g.fillTriangle(cx, cy - r * 0.6, cx + r * 0.35, cy, cx - r * 0.2, cy - r * 0.1);
}

/** Can: kalp. */
export function drawHeart(g: Gfx, cx: number, cy: number, r: number, color: number): void {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = (i / 24) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push({ x: cx + (x / 17) * r, y: cy - (y / 17) * r - r * 0.05 });
  }
  fillPolygon(g, pts, color, 0.9);
  glowPolygon(g, pts, color, { width: 1.5, glow: 0.8 });
}

export function drawPause(g: Gfx, cx: number, cy: number, color: number): void {
  g.fillStyle(color, 1);
  g.fillRoundedRect(cx - 7, cy - 8, 5, 16, 1.5);
  g.fillRoundedRect(cx + 2, cy - 8, 5, 16, 1.5);
}

export function drawPlay(g: Gfx, cx: number, cy: number, color: number): void {
  g.fillStyle(color, 1);
  g.fillTriangle(cx - 5, cy - 8, cx - 5, cy + 8, cx + 8, cy);
}
