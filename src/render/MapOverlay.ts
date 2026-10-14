import type Phaser from 'phaser';
import { COLORS, LAYOUT, TILE } from '../config';
import { tileCenter } from '../core/grid';
import type { Simulation } from '../core/simulation';
import type { TileCoord, TowerKind, TowerState } from '../core/types';
import { DEPTH } from './depth';
import { glowCircle, glowRoundRect } from './neon';
import { levelStats } from '../ui/towerStats';
import { drawTower, towerColor } from './shapes';

// Haritanın üstündeki etkileşim çizimleri: yerleştirme hayaleti (kule + menzil, yeşil/kırmızı),
// seçili kulenin menzil çemberi ve köşe işaretleri, fareyle üstüne gelinen kule karosu.

export interface OverlayContext {
  placing: TowerKind | null;
  hoverTile: TileCoord | null;
  /** Hayalet yeşil mi (karo uygun VE altın yetiyor)? */
  placeValid: boolean;
  selected: TowerState | null;
  /** Yerleştirme modu kapalıyken fare altındaki kule. */
  hoverTower: TowerState | null;
  /** Gerçek zaman (saniye), yanıp sönme için. */
  time: number;
}

export class MapOverlay {
  private readonly under: Phaser.GameObjects.Graphics;
  private readonly ghost: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private readonly sim: Simulation,
  ) {
    this.under = scene.add.graphics({ x: LAYOUT.mapX, y: LAYOUT.mapY }).setDepth(DEPTH.underlay);
    this.ghost = scene.add.graphics({ x: LAYOUT.mapX, y: LAYOUT.mapY }).setDepth(DEPTH.ghost);
  }

  draw(ctx: OverlayContext): void {
    const u = this.under;
    const g = this.ghost;
    u.clear();
    g.clear();

    if (ctx.hoverTower && ctx.hoverTower.id !== ctx.selected?.id) {
      const c = ctx.hoverTower.pos;
      u.fillStyle(towerColor(ctx.hoverTower.kind), 0.08);
      u.fillRoundedRect(c.x - TILE / 2 + 2, c.y - TILE / 2 + 2, TILE - 4, TILE - 4, 8);
      this.rangeCircle(u, c.x, c.y, this.rangeOf(ctx.hoverTower), towerColor(ctx.hoverTower.kind), 0.35);
    }

    if (ctx.selected) {
      const t = ctx.selected;
      const color = towerColor(t.kind);
      this.rangeCircle(u, t.pos.x, t.pos.y, this.rangeOf(t), color, 0.9);
      this.brackets(u, t.pos.x, t.pos.y, color, ctx.time);
    }

    if (ctx.placing && ctx.hoverTile) {
      const c = tileCenter(ctx.hoverTile);
      const color = ctx.placeValid ? COLORS.valid : COLORS.invalid;
      const range = this.sim.towerDefs[ctx.placing].levels[0].range * TILE;
      g.fillStyle(color, 0.05);
      g.fillCircle(c.x, c.y, range);
      glowCircle(g, c.x, c.y, range, color, { width: 1.5, alpha: 0.75, glow: 0.6 });
      g.fillStyle(color, 0.16);
      g.fillRect(c.x - TILE / 2, c.y - TILE / 2, TILE, TILE);
      glowRoundRect(g, c.x - TILE / 2 + 1, c.y - TILE / 2 + 1, TILE - 2, TILE - 2, 6, color, { width: 1.5, glow: 0.6 });
      drawTower(g, ctx.placing, c.x, c.y, { level: 1, aimAngle: -Math.PI / 2, alpha: 0.55, pips: false });
      if (!ctx.placeValid) {
        // Kırmızı çarpı: buraya kurulamaz.
        g.lineStyle(3, COLORS.invalid, 0.9);
        g.lineBetween(c.x - 9, c.y - 9, c.x + 9, c.y + 9);
        g.lineBetween(c.x + 9, c.y - 9, c.x - 9, c.y + 9);
      }
    }
  }

  private rangeOf(t: TowerState): number {
    return levelStats(this.sim.towerDefs[t.kind], t.level).range * TILE;
  }

  private rangeCircle(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number, alpha: number): void {
    g.fillStyle(color, 0.06 * alpha);
    g.fillCircle(x, y, r);
    glowCircle(g, x, y, r, color, { width: 1.5, alpha: 0.7 * alpha, glow: 0.6 });
  }

  /** Seçili karonun köşelerinde nabız gibi atan işaretler. */
  private brackets(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, time: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(time * 5);
    const h = TILE / 2 + 1 + pulse * 2;
    const len = 9;
    g.lineStyle(2.5, color, 0.75 + pulse * 0.25);
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      const cx = x + sx * h;
      const cy = y + sy * h;
      g.lineBetween(cx, cy, cx - sx * len, cy);
      g.lineBetween(cx, cy, cx, cy - sy * len);
    }
  }
}
