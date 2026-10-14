import Phaser from 'phaser';
import { COLORS, LAYOUT, TILE } from '../config';
import { tileKey } from '../core/grid';
import type { Simulation } from '../core/simulation';
import type { MapDef, TileCoord, Vec2 } from '../core/types';
import { DEPTH } from './depth';
import { darken, fillPolygon, glowLine, lighten, strokeClosed, withGlow } from './neon';

// Haritanın durağan katmanı (bir kez çizilir): zemin ızgarası, yol karoları ve neon kenarları, engeller,
// giriş kapısı ve kale. Ayrıca yol üzerinde yönü gösteren yavaş akan oklar (her karede).

const FLOW_SPACING = TILE;
const FLOW_SPEED = 26;

export class MapLayer {
  private readonly base: Phaser.GameObjects.RenderTexture;
  private readonly markers: Phaser.GameObjects.Graphics;
  private readonly flow: Phaser.GameObjects.Graphics;
  private readonly polyline: Vec2[];
  private readonly cumulative: number[];
  private readonly totalLength: number;

  constructor(scene: Phaser.Scene, private readonly sim: Simulation) {
    // Durağan zemin bir kez çizilip dokuya basılır; her karede binlerce çizim komutu yeniden işlenmesin.
    this.base = scene.add
      .renderTexture(LAYOUT.mapX, LAYOUT.mapY, sim.map.cols * TILE, sim.map.rows * TILE)
      .setOrigin(0, 0)
      .setDepth(DEPTH.mapBase);
    this.flow = scene.add.graphics({ x: LAYOUT.mapX, y: LAYOUT.mapY }).setDepth(DEPTH.mapFlow);
    this.markers = scene.add.graphics({ x: LAYOUT.mapX, y: LAYOUT.mapY }).setDepth(DEPTH.mapMarkers);
    this.flow.setBlendMode(Phaser.BlendModes.ADD);

    this.polyline = sim.pathPoints.map((p) => ({ x: p.x, y: p.y }));
    this.cumulative = [0];
    let total = 0;
    for (let i = 1; i < this.polyline.length; i++) {
      total += Phaser.Math.Distance.BetweenPoints(this.polyline[i - 1]!, this.polyline[i]!);
      this.cumulative.push(total);
    }
    this.totalLength = total;

    const painter = scene.make.graphics({}, false);
    this.drawBase(painter);
    this.base.draw(painter, 0, 0);
    painter.destroy();
    this.drawMarkers();
    scene.tweens.add({ targets: this.markers, alpha: 0.65, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Yol üzerindeki akış oklarını kaydırır (gerçek zaman, saniye). */
  update(time: number): void {
    const g = this.flow;
    g.clear();
    if (this.totalLength <= 0) return;
    const offset = (time * FLOW_SPEED) % FLOW_SPACING;
    const w = LAYOUT.mapWidth;
    const h = LAYOUT.mapHeight;
    g.lineStyle(2, COLORS.pathEdge, 0.2);
    for (let d = offset; d < this.totalLength; d += FLOW_SPACING) {
      const at = this.pointAt(d);
      if (at.x < 6 || at.y < 6 || at.x > w - 6 || at.y > h - 6) continue;
      const c = Math.cos(at.angle);
      const s = Math.sin(at.angle);
      // Küçük ok başı (>) gittiği yöne bakar.
      const tipX = at.x + c * 4;
      const tipY = at.y + s * 4;
      g.lineBetween(tipX, tipY, tipX - c * 6 - s * 5, tipY - s * 6 + c * 5);
      g.lineBetween(tipX, tipY, tipX - c * 6 + s * 5, tipY - s * 6 - c * 5);
    }
  }

  private pointAt(d: number): { x: number; y: number; angle: number } {
    let i = 1;
    while (i < this.cumulative.length - 1 && this.cumulative[i]! < d) i++;
    const a = this.polyline[i - 1]!;
    const b = this.polyline[i]!;
    const segStart = this.cumulative[i - 1]!;
    const segLen = this.cumulative[i]! - segStart || 1;
    const t = (d - segStart) / segLen;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  private drawBase(g: Phaser.GameObjects.Graphics): void {
    const map = this.sim.map;
    const w = map.cols * TILE;
    const h = map.rows * TILE;

    g.fillStyle(COLORS.background, 1);
    g.fillRect(0, 0, w, h);

    // Soluk ızgara.
    g.lineStyle(1, COLORS.grid, 0.75);
    for (let c = 0; c <= map.cols; c++) g.lineBetween(c * TILE + 0.5, 0, c * TILE + 0.5, h);
    for (let r = 0; r <= map.rows; r++) g.lineBetween(0, r * TILE + 0.5, w, r * TILE + 0.5);
    g.fillStyle(lighten(COLORS.grid, 0.25), 0.8);
    for (let c = 1; c < map.cols; c++) {
      for (let r = 1; r < map.rows; r++) g.fillRect(c * TILE - 1, r * TILE - 1, 2, 2);
    }

    // Yol karoları.
    const outside = segmentTiles(map);
    const isPath = (col: number, row: number): boolean => {
      if (col >= 0 && row >= 0 && col < map.cols && row < map.rows) return this.sim.isPathTile({ col, row });
      return outside.has(tileKey({ col, row }));
    };
    const edges: [number, number, number, number][] = [];
    for (let row = 0; row < map.rows; row++) {
      for (let col = 0; col < map.cols; col++) {
        if (!isPath(col, row)) continue;
        const x = col * TILE;
        const y = row * TILE;
        g.fillStyle(COLORS.path, 1);
        g.fillRect(x, y, TILE, TILE);
        if (!isPath(col, row - 1)) edges.push([x, y, x + TILE, y]);
        if (!isPath(col, row + 1)) edges.push([x, y + TILE, x + TILE, y + TILE]);
        if (!isPath(col - 1, row)) edges.push([x, y, x, y + TILE]);
        if (!isPath(col + 1, row)) edges.push([x + TILE, y, x + TILE, y + TILE]);
      }
    }
    // Yolun ortasında çok soluk şerit.
    g.lineStyle(10, COLORS.pathEdge, 0.035);
    for (let i = 1; i < this.polyline.length; i++) {
      const a = this.polyline[i - 1]!;
      const b = this.polyline[i]!;
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    withGlow(g, COLORS.pathEdge, { width: 1.5, alpha: 0.85, glow: 0.8 }, () => {
      for (const [x1, y1, x2, y2] of edges) g.lineBetween(x1, y1, x2, y2);
    });

    for (const tile of map.blocked ?? []) drawCrystals(g, tile);
  }

  private drawMarkers(): void {
    const g = this.markers;
    const map = this.sim.map;
    const entry = edgeTile(map, 'entry');
    const exit = edgeTile(map, 'exit');
    if (entry) drawEntry(g, entry.tile, entry.dir);
    if (exit) drawCastle(g, exit.tile, exit.dir);
  }
}

/** Yol köşe noktaları arasındaki bütün karolar (harita dışındakiler dahil). */
function segmentTiles(map: MapDef): Set<string> {
  const set = new Set<string>();
  for (let i = 1; i < map.waypoints.length; i++) {
    const a = map.waypoints[i - 1]!;
    const b = map.waypoints[i]!;
    const dc = Math.sign(b.col - a.col);
    const dr = Math.sign(b.row - a.row);
    let col = a.col;
    let row = a.row;
    set.add(tileKey({ col, row }));
    while (col !== b.col || row !== b.row) {
      col += dc;
      row += dr;
      set.add(tileKey({ col, row }));
    }
  }
  return set;
}

/** Yolun haritaya girdiği ilk (ya da çıktığı son) karo ve o noktadaki hareket yönü. */
function edgeTile(map: MapDef, which: 'entry' | 'exit'): { tile: TileCoord; dir: Vec2 } | null {
  const wps = map.waypoints;
  if (wps.length < 2) return null;
  const inside = (t: TileCoord): boolean => t.col >= 0 && t.row >= 0 && t.col < map.cols && t.row < map.rows;
  if (which === 'entry') {
    const a = wps[0]!;
    const b = wps[1]!;
    const dir = { x: Math.sign(b.col - a.col), y: Math.sign(b.row - a.row) };
    const t = { col: a.col, row: a.row };
    while (!inside(t) && (t.col !== b.col || t.row !== b.row)) {
      t.col += dir.x;
      t.row += dir.y;
    }
    return { tile: t, dir };
  }
  const a = wps[wps.length - 2]!;
  const b = wps[wps.length - 1]!;
  const dir = { x: Math.sign(b.col - a.col), y: Math.sign(b.row - a.row) };
  const t = { col: b.col, row: b.row };
  while (!inside(t) && (t.col !== a.col || t.row !== a.row)) {
    t.col -= dir.x;
    t.row -= dir.y;
  }
  return { tile: t, dir };
}

/** Giriş kapısı: harita kenarında parlayan çizgi ve yolun yönünü gösteren üç ok. */
function drawEntry(g: Phaser.GameObjects.Graphics, tile: TileCoord, dir: Vec2): void {
  const cx = (tile.col + 0.5) * TILE;
  const cy = (tile.row + 0.5) * TILE;
  const px = -dir.y;
  const py = dir.x;
  // Kenar çizgisi (girişin geldiği taraf).
  const ex = cx - dir.x * (TILE / 2 - 2);
  const ey = cy - dir.y * (TILE / 2 - 2);
  glowLine(g, ex - px * 20, ey - py * 20, ex + px * 20, ey + py * 20, COLORS.entry, { width: 3, glow: 1.2 });
  for (let i = 0; i < 3; i++) {
    const off = -10 + i * 9;
    const tx = cx + dir.x * (off + 5);
    const ty = cy + dir.y * (off + 5);
    const alpha = 0.45 + i * 0.27;
    withGlow(g, COLORS.entry, { width: 2.2, alpha, glow: 0.6 }, () => {
      g.lineBetween(tx, ty, tx - dir.x * 7 - px * 7, ty - dir.y * 7 - py * 7);
      g.lineBetween(tx, ty, tx - dir.x * 7 + px * 7, ty - dir.y * 7 + py * 7);
    });
  }
}

/** Kale (çıkış): mazgallı küçük kale silueti ve kemerli kapı. */
function drawCastle(g: Phaser.GameObjects.Graphics, tile: TileCoord, dir: Vec2): void {
  const cx = (tile.col + 0.5) * TILE;
  const cy = (tile.row + 0.5) * TILE;
  const color = COLORS.exit;
  const w = 30;
  const h = 26;
  const left = cx - w / 2;
  const top = cy - h / 2 + 3;
  const m = 5; // mazgal yüksekliği
  const outline = [
    { x: left, y: top + h },
    { x: left, y: top - m },
    { x: left + 6, y: top - m },
    { x: left + 6, y: top },
    { x: left + 12, y: top },
    { x: left + 12, y: top - m },
    { x: left + 18, y: top - m },
    { x: left + 18, y: top },
    { x: left + 24, y: top },
    { x: left + 24, y: top - m },
    { x: left + w, y: top - m },
    { x: left + w, y: top + h },
  ];
  fillPolygon(g, outline, darken(color, 0.7), 0.95);
  withGlow(g, color, { width: 2, glow: 1 }, () => strokeClosed(g, outline));
  // Kapı.
  g.fillStyle(lighten(color, 0.2), 0.9);
  g.fillRect(cx - 5, top + h - 12, 10, 12);
  g.fillCircle(cx, top + h - 12, 5);
  // Kalenin arkasındaki kenar çizgisi (düşmanların çıktığı taraf).
  const ex = cx + dir.x * (TILE / 2 - 2);
  const ey = cy + dir.y * (TILE / 2 - 2);
  glowLine(g, ex + dir.y * 20, ey - dir.x * 20, ex - dir.y * 20, ey + dir.x * 20, color, { width: 3, glow: 1.2 });
}

/** Engel karosu: soluk mor kristal kümesi. Biçim karonun konumundan belirlenir (her açılışta aynı). */
function drawCrystals(g: Phaser.GameObjects.Graphics, tile: TileCoord): void {
  const x0 = tile.col * TILE;
  const y0 = tile.row * TILE;
  let seed = (tile.col * 73856093) ^ (tile.row * 19349663);
  const rand = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  g.fillStyle(0x000000, 0.35);
  g.fillEllipse(x0 + TILE / 2, y0 + TILE - 10, 34, 9);
  const shards = 3;
  for (let i = 0; i < shards; i++) {
    const cx = x0 + 13 + i * 11 + (rand() - 0.5) * 4;
    const baseY = y0 + TILE - 10 - rand() * 3;
    const height = 14 + rand() * 16 + (i === 1 ? 6 : 0);
    const half = 4 + rand() * 2.5;
    const lean = (rand() - 0.5) * 6;
    const pts = [
      { x: cx - half, y: baseY },
      { x: cx - half * 0.8 + lean * 0.5, y: baseY - height * 0.7 },
      { x: cx + lean, y: baseY - height },
      { x: cx + half * 0.8 + lean * 0.5, y: baseY - height * 0.7 },
      { x: cx + half, y: baseY },
    ];
    fillPolygon(g, pts, darken(COLORS.rock, 0.6), 0.9);
    withGlow(g, COLORS.rock, { width: 1.2, alpha: 0.55, glow: 0.5 }, () => strokeClosed(g, pts));
    g.lineStyle(1, lighten(COLORS.rock, 0.3), 0.3);
    g.lineBetween(cx + lean, baseY - height, cx + lean * 0.3, baseY - 2);
  }
}
