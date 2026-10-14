import { tileCenter, tileKey } from './grid';
import type { MapDef, TileCoord, Vec2 } from './types';

// Yol geometrisi: MapDef.waypoints köşe noktalarından (karo) piksel çoklu çizgisi üretir.
// Düşmanlar yol üzerindeki mesafeleriyle (piksel) ilerler; konum ve yön bu mesafeden hesaplanır.

/** Yol üzerindeki bir noktanın konumu (piksel) ve hareket yönü (radyan, 0 = sağ, π/2 = aşağı). */
export interface PathSample {
  pos: Vec2;
  heading: number;
}

export class Path {
  /** Köşe noktalarının karo merkezleri (piksel). İlk nokta giriş, son nokta çıkış. */
  readonly points: readonly Vec2[];
  /** Yolun toplam uzunluğu (piksel). */
  readonly length: number;
  /** Yolun kapsadığı harita içi karolar (`tileKey` biçiminde). Bu karolara kule kurulamaz. */
  readonly tiles: ReadonlySet<string>;

  /** Her parçanın başladığı mesafe (piksel). */
  private readonly segmentStarts: readonly number[];
  private readonly segmentLengths: readonly number[];
  private readonly segmentHeadings: readonly number[];

  constructor(map: MapDef) {
    const waypoints = map.waypoints;
    if (waypoints.length < 2) {
      throw new Error(`Yol en az iki köşe noktası içermeli (harita: ${map.id}).`);
    }

    for (let i = 1; i < waypoints.length; i++) {
      const a = waypoints[i - 1]!;
      const b = waypoints[i]!;
      if (a.col === b.col && a.row === b.row) {
        throw new Error(
          `Yolun ${i}. parçasının uzunluğu sıfır: (${a.col}, ${a.row}) iki kez üst üste yazılmış (harita: ${map.id}).`,
        );
      }
      if (a.col !== b.col && a.row !== b.row) {
        throw new Error(
          `Yolun ${i}. parçası yatay ya da dikey olmalı: (${a.col}, ${a.row}) → (${b.col}, ${b.row}) çapraz (harita: ${map.id}).`,
        );
      }
    }

    const points = waypoints.map((w) => tileCenter(w));
    const starts: number[] = [];
    const lengths: number[] = [];
    const headings: number[] = [];
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!;
      const b = points[i]!;
      const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y); // parçalar eksene paralel
      starts.push(total);
      lengths.push(len);
      headings.push(Math.atan2(b.y - a.y, b.x - a.x));
      total += len;
    }

    this.points = Object.freeze(points.map((p) => Object.freeze(p)));
    this.length = total;
    this.segmentStarts = starts;
    this.segmentLengths = lengths;
    this.segmentHeadings = headings;
    this.tiles = collectPathTiles(map);
  }

  /**
   * Girişten `distance` piksel sonraki nokta. Mesafe [0, length] aralığına sıkıştırılır.
   * Tam bir köşedeki nokta, sonraki parçanın yönünü alır (yolun sonu hariç).
   */
  positionAt(distance: number): PathSample {
    const d = Math.min(Math.max(distance, 0), this.length);
    let index = this.segmentStarts.length - 1;
    for (let i = 0; i < this.segmentStarts.length; i++) {
      if (d < this.segmentStarts[i]! + this.segmentLengths[i]!) {
        index = i;
        break;
      }
    }
    const start = this.points[index]!;
    const end = this.points[index + 1]!;
    const len = this.segmentLengths[index]!;
    const t = len > 0 ? (d - this.segmentStarts[index]!) / len : 0;
    return {
      pos: { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t },
      heading: this.segmentHeadings[index]!,
    };
  }

  /** Karo yolun kapsadığı harita içi karolardan biri mi? */
  isPathTile(tile: TileCoord): boolean {
    return this.tiles.has(tileKey(tile));
  }
}

/** Köşe noktaları arasındaki bütün karoları gezer; harita içindekileri toplar. */
function collectPathTiles(map: MapDef): ReadonlySet<string> {
  const tiles = new Set<string>();
  const add = (col: number, row: number): void => {
    if (col >= 0 && col < map.cols && row >= 0 && row < map.rows) tiles.add(tileKey({ col, row }));
  };
  for (let i = 1; i < map.waypoints.length; i++) {
    const a = map.waypoints[i - 1]!;
    const b = map.waypoints[i]!;
    const stepCol = Math.sign(b.col - a.col);
    const stepRow = Math.sign(b.row - a.row);
    let col = a.col;
    let row = a.row;
    add(col, row);
    while (col !== b.col || row !== b.row) {
      col += stepCol;
      row += stepRow;
      add(col, row);
    }
  }
  return tiles;
}

