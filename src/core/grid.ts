import { TILE } from '../config';
import type { TileCoord, Vec2 } from './types';

// Karo ↔ piksel çevirileri. Piksel koordinatları harita sol üst köşesine göredir.

/** Karonun merkez noktası (piksel). */
export function tileCenter(tile: TileCoord): Vec2 {
  return { x: (tile.col + 0.5) * TILE, y: (tile.row + 0.5) * TILE };
}

/** Piksel konumunun düştüğü karo. */
export function tileAt(pos: Vec2): TileCoord {
  return { col: Math.floor(pos.x / TILE), row: Math.floor(pos.y / TILE) };
}

export function tileKey(tile: TileCoord): string {
  return `${tile.col},${tile.row}`;
}

export function sameTile(a: TileCoord, b: TileCoord): boolean {
  return a.col === b.col && a.row === b.row;
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
