import { describe, expect, it } from 'vitest';
import { TILE } from '../../src/config';
import { MAP_1 } from '../../src/core/data/maps';
import { tileCenter, tileKey } from '../../src/core/grid';
import { Path } from '../../src/core/path';
import type { MapDef } from '../../src/core/types';

// Soldan girip aşağı dönen L biçimli küçük bir yol: (-1,1) → (3,1) → (3,5). Harita 5 × 5.
const L_MAP: MapDef = {
  id: 'test-l',
  name: 'L yolu',
  cols: 5,
  rows: 5,
  waypoints: [
    { col: -1, row: 1 },
    { col: 3, row: 1 },
    { col: 3, row: 5 },
  ],
};

describe('Path', () => {
  it('köşe noktalarını karo merkezlerine çevirir', () => {
    const path = new Path(L_MAP);
    expect(path.points).toEqual([
      { x: -0.5 * TILE, y: 1.5 * TILE },
      { x: 3.5 * TILE, y: 1.5 * TILE },
      { x: 3.5 * TILE, y: 5.5 * TILE },
    ]);
  });

  it('toplam uzunluğu piksel olarak hesaplar', () => {
    expect(new Path(L_MAP).length).toBe(8 * TILE);
  });

  it('mesafeden konum ve yön verir', () => {
    const path = new Path(L_MAP);

    const start = path.positionAt(0);
    expect(start.pos).toEqual({ x: -0.5 * TILE, y: 1.5 * TILE });
    expect(start.heading).toBe(0);

    const mid = path.positionAt(2.5 * TILE);
    expect(mid.pos.x).toBeCloseTo(2 * TILE);
    expect(mid.pos.y).toBeCloseTo(1.5 * TILE);
    expect(mid.heading).toBe(0);

    const down = path.positionAt(6 * TILE);
    expect(down.pos.x).toBeCloseTo(3.5 * TILE);
    expect(down.pos.y).toBeCloseTo(3.5 * TILE);
    expect(down.heading).toBeCloseTo(Math.PI / 2);
  });

  it('tam köşede sonraki parçanın yönünü alır', () => {
    const corner = new Path(L_MAP).positionAt(4 * TILE);
    expect(corner.pos.x).toBeCloseTo(3.5 * TILE);
    expect(corner.pos.y).toBeCloseTo(1.5 * TILE);
    expect(corner.heading).toBeCloseTo(Math.PI / 2);
  });

  it('yolun dışına taşan mesafeleri uçlara sıkıştırır', () => {
    const path = new Path(L_MAP);
    expect(path.positionAt(-50).pos).toEqual(path.points[0]);
    const end = path.positionAt(path.length + 100);
    expect(end.pos.x).toBeCloseTo(3.5 * TILE);
    expect(end.pos.y).toBeCloseTo(5.5 * TILE);
    expect(end.heading).toBeCloseTo(Math.PI / 2);
  });

  it('sadece harita içindeki yol karolarını toplar', () => {
    const path = new Path(L_MAP);
    const expected = ['0,1', '1,1', '2,1', '3,1', '3,2', '3,3', '3,4'];
    expect([...path.tiles].sort()).toEqual(expected.sort());
    expect(path.isPathTile({ col: -1, row: 1 })).toBe(false); // giriş harita dışında
    expect(path.isPathTile({ col: 3, row: 5 })).toBe(false); // çıkış harita dışında
    expect(path.isPathTile({ col: 2, row: 2 })).toBe(false);
    expect(path.isPathTile({ col: 3, row: 3 })).toBe(true);
  });

  it('çapraz parçayı Türkçe bir hatayla reddeder', () => {
    const bad: MapDef = { ...L_MAP, waypoints: [{ col: 0, row: 0 }, { col: 2, row: 1 }] };
    expect(() => new Path(bad)).toThrow(/yatay ya da dikey/);
    expect(() => new Path(bad)).toThrow(/\(0, 0\) → \(2, 1\)/);
  });

  it('tek köşe noktasını ve sıfır uzunluklu parçayı reddeder', () => {
    expect(() => new Path({ ...L_MAP, waypoints: [{ col: 0, row: 0 }] })).toThrow(/en az iki/);
    const repeated: MapDef = {
      ...L_MAP,
      waypoints: [
        { col: 0, row: 0 },
        { col: 0, row: 0 },
        { col: 2, row: 0 },
      ],
    };
    expect(() => new Path(repeated)).toThrow(/sıfır/);
  });
});

describe('MAP_1 verisi', () => {
  const path = new Path(MAP_1);

  it('geçerli bir yol oluşturur ve köşe noktaları karo merkezleridir', () => {
    expect(path.points).toEqual(MAP_1.waypoints.map(tileCenter));
    const tiles = MAP_1.waypoints
      .slice(1)
      .reduce((sum, w, i) => sum + Math.abs(w.col - MAP_1.waypoints[i]!.col) + Math.abs(w.row - MAP_1.waypoints[i]!.row), 0);
    expect(path.length).toBe(tiles * TILE);
  });

  it('yol kendini kesmez: yol karosu sayısı = parça uzunlukları + 1 − harita dışı uçlar', () => {
    const segmentTiles = path.length / TILE;
    const outside = [MAP_1.waypoints[0]!, MAP_1.waypoints[MAP_1.waypoints.length - 1]!].filter(
      (w) => w.col < 0 || w.row < 0 || w.col >= MAP_1.cols || w.row >= MAP_1.rows,
    ).length;
    expect(path.tiles.size).toBe(segmentTiles + 1 - outside);
  });

  it('engel karoları harita içinde ve yol dışında', () => {
    for (const tile of MAP_1.blocked ?? []) {
      expect(tile.col).toBeGreaterThanOrEqual(0);
      expect(tile.col).toBeLessThan(MAP_1.cols);
      expect(tile.row).toBeGreaterThanOrEqual(0);
      expect(tile.row).toBeLessThan(MAP_1.rows);
      expect(path.tiles.has(tileKey(tile))).toBe(false);
    }
  });
});
