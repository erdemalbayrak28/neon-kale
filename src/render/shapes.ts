import type Phaser from 'phaser';
import { COLORS } from '../config';
import type { EnemyKind, TowerKind } from '../core/types';
import { darken, fillPolygon, glowCircle, glowLine, glowPolygon, glowRoundRect, lighten, regularPolygon } from './neon';

// Kule ve düşman şekilleri. Harita, hayalet ve panel simgeleri aynı çizimi kullanır.

type Gfx = Phaser.GameObjects.Graphics;

export interface TowerDrawOptions {
  level: 1 | 2 | 3;
  aimAngle: number;
  /** Genel saydamlık (hayalet için düşük). */
  alpha?: number;
  /** Ölçek (panel simgesi için küçük). */
  scale?: number;
  /** Rengi zorla (hayaleti yeşil/kırmızı boyamak için). */
  tint?: number;
  /** Seviye noktalarını çiz. */
  pips?: boolean;
  /** Ateş anı parlaması (0–1). */
  flash?: number;
}

const scratch: { x: number; y: number }[] = [];

/** Kuleyi (x, y) merkezine çizer: yuvarlatılmış taban + renkli çekirdek + hedefe dönen namlu + seviye noktaları. */
export function drawTower(g: Gfx, kind: TowerKind, x: number, y: number, o: TowerDrawOptions): void {
  const s = o.scale ?? 1;
  const a = o.alpha ?? 1;
  const color = o.tint ?? towerColor(kind);
  const half = 17 * s;
  const flash = o.flash ?? 0;

  // Taban: koyu dolgu + neon çerçeve. Seviye arttıkça çerçeve kalınlaşır.
  g.fillStyle(COLORS.card, 0.92 * a);
  g.fillRoundedRect(x - half, y - half, half * 2, half * 2, 8 * s);
  g.fillStyle(color, 0.08 * a);
  g.fillRoundedRect(x - half, y - half, half * 2, half * 2, 8 * s);
  glowRoundRect(g, x - half, y - half, half * 2, half * 2, 8 * s, color, {
    width: (1.4 + o.level * 0.4) * s,
    alpha: 0.85 * a,
    glow: 0.6 * s,
  });
  if (o.level >= 2) {
    // 2. seviye: köşe süsleri.
    const c = half - 4 * s;
    g.fillStyle(lighten(color, 0.3), 0.9 * a);
    for (const [dx, dy] of CORNERS) g.fillCircle(x + dx * c, y + dy * c, 1.6 * s);
  }
  if (o.level >= 3) {
    // 3. seviye: tabanın etrafında ince ikinci çerçeve.
    const h3 = half + 3.5 * s;
    g.lineStyle(1 * s, color, 0.55 * a);
    g.strokeRoundedRect(x - h3, y - h3, h3 * 2, h3 * 2, 10 * s);
  }

  const dx = Math.cos(o.aimAngle);
  const dy = Math.sin(o.aimAngle);
  switch (kind) {
    case 'laser': {
      // İnce, uzun namlu ve küçük mercek.
      glowLine(g, x, y, x + dx * 17 * s, y + dy * 17 * s, color, { width: 3 * s, alpha: a, glow: 0.5 * s });
      g.fillStyle(lighten(color, 0.6), a);
      g.fillCircle(x + dx * 17 * s, y + dy * 17 * s, 2 * s);
      g.fillStyle(darken(color, 0.55), a);
      g.fillCircle(x, y, 8 * s);
      glowCircle(g, x, y, 8 * s, color, { width: 2 * s, alpha: a, glow: 0.5 * s });
      g.fillStyle(lighten(color, 0.7 + flash * 0.3), a);
      g.fillCircle(x, y, (3.2 + flash * 1.5) * s);
      break;
    }
    case 'cannon': {
      // Kalın, kısa namlu ve iri gövde.
      const bx = x + dx * 15 * s;
      const by = y + dy * 15 * s;
      g.lineStyle(8 * s, darken(color, 0.4), a);
      g.lineBetween(x, y, bx, by);
      glowLine(g, x + dx * 4 * s, y + dy * 4 * s, bx, by, color, { width: 4 * s, alpha: a, glow: 0.4 * s });
      g.fillStyle(darken(color, 0.5), a);
      g.fillCircle(x, y, 10 * s);
      glowCircle(g, x, y, 10 * s, color, { width: 2.2 * s, alpha: a, glow: 0.5 * s });
      g.fillStyle(lighten(color, 0.35 + flash * 0.5), a);
      g.fillCircle(x, y, (4.5 + flash * 1.5) * s);
      break;
    }
    case 'frost': {
      // Dönen altı kollu kristal; atışta parlar.
      const spokes = regularPolygon(scratch, x, y, 12 * s, 6, o.aimAngle);
      for (const p of spokes) {
        g.lineStyle(2 * s, lighten(color, 0.3), a);
        g.lineBetween(x, y, p.x, p.y);
        g.fillStyle(lighten(color, 0.5), a);
        g.fillCircle(p.x, p.y, 1.6 * s);
      }
      const hex = regularPolygon(scratch, x, y, 7 * s, 6, o.aimAngle + Math.PI / 6);
      fillPolygon(g, hex, darken(color, 0.45), a);
      glowPolygon(g, hex, color, { width: 1.8 * s, alpha: a, glow: 0.5 * s });
      g.fillStyle(lighten(color, 0.75 + flash * 0.25), a);
      g.fillCircle(x, y, (2.6 + flash * 2) * s);
      break;
    }
  }

  if (o.pips !== false) {
    // Seviye noktaları: tabanın hemen altında.
    const py = y + half + 4 * s;
    for (let i = 0; i < 3; i++) {
      const px = x + (i - 1) * 7 * s;
      const on = i < o.level;
      g.fillStyle(on ? lighten(color, 0.3) : COLORS.panelBorder, (on ? 1 : 0.9) * a);
      g.fillCircle(px, py, (on ? 2.2 : 1.8) * s);
    }
  }
}

const CORNERS: readonly [number, number][] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

export function towerColor(kind: TowerKind): number {
  return COLORS[kind];
}

export interface EnemyDrawOptions {
  heading: number;
  alpha?: number;
  /** Vurulma parlaması (0–1). */
  hit?: number;
}

/** Düşmanı çizer: koşucu pembe daire, çevik sarı üçgen (gittiği yöne bakar), zırhlı kırmızı altıgen (kalın çerçeve). */
export function drawEnemy(g: Gfx, kind: EnemyKind, x: number, y: number, r: number, o: EnemyDrawOptions): void {
  const a = o.alpha ?? 1;
  const color = COLORS[kind];
  const hit = o.hit ?? 0;
  const fill = hit > 0 ? lighten(color, 0.4 + hit * 0.5) : darken(color, 0.55);
  switch (kind) {
    case 'runner': {
      g.fillStyle(fill, 0.9 * a);
      g.fillCircle(x, y, r);
      glowCircle(g, x, y, r, color, { width: 2.2, alpha: a, glow: 0.8 });
      g.fillStyle(lighten(color, 0.6), a);
      g.fillCircle(x + Math.cos(o.heading) * r * 0.35, y + Math.sin(o.heading) * r * 0.35, r * 0.28);
      break;
    }
    case 'scout': {
      const tri = regularPolygon(scratch, x, y, r * 1.15, 3, o.heading);
      fillPolygon(g, tri, fill, 0.9 * a);
      glowPolygon(g, tri, color, { width: 2, alpha: a, glow: 0.8 });
      g.fillStyle(lighten(color, 0.6), a);
      g.fillCircle(x + Math.cos(o.heading) * r * 0.3, y + Math.sin(o.heading) * r * 0.3, r * 0.22);
      break;
    }
    case 'brute': {
      const hex = regularPolygon(scratch, x, y, r, 6, 0);
      fillPolygon(g, hex, fill, 0.92 * a);
      glowPolygon(g, hex, color, { width: 4, alpha: a, glow: 0.9 });
      const inner = regularPolygon(scratch, x, y, r * 0.48, 6, 0);
      g.lineStyle(1.5, lighten(color, 0.3), 0.8 * a);
      g.strokePoints(inner, true, true);
      break;
    }
  }
}

/** Düşman simgesi (panel listesi için): küçük ve sağa bakan. */
export function drawEnemyIcon(g: Gfx, kind: EnemyKind, x: number, y: number, r: number): void {
  drawEnemy(g, kind, x, y, r, { heading: kind === 'scout' ? 0 : -Math.PI / 2 });
}
