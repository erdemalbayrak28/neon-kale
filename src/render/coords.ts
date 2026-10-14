import { LAYOUT, TILE } from '../config';
import type { MapDef, TileCoord, Vec2 } from '../core/types';

// Harita koordinatı (piksel, harita sol üstüne göre) ↔ oyun ekranı koordinatı (1280 × 720 mantıksal) çevirileri.

/** Karonun merkezinin ekran koordinatı. */
export function tileToScreen(col: number, row: number): Vec2 {
  return { x: LAYOUT.mapX + (col + 0.5) * TILE, y: LAYOUT.mapY + (row + 0.5) * TILE };
}

/** Ekran noktasının düştüğü harita karosu; harita dışındaysa null. */
export function screenToTile(x: number, y: number, map: MapDef): TileCoord | null {
  const col = Math.floor((x - LAYOUT.mapX) / TILE);
  const row = Math.floor((y - LAYOUT.mapY) / TILE);
  if (col < 0 || row < 0 || col >= map.cols || row >= map.rows) return null;
  return { col, row };
}

/** Ekran noktası harita alanının içinde mi? */
export function insideMap(x: number, y: number): boolean {
  return x >= LAYOUT.mapX && x < LAYOUT.mapX + LAYOUT.mapWidth && y >= LAYOUT.mapY && y < LAYOUT.mapY + LAYOUT.mapHeight;
}
