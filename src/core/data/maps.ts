import type { MapDef } from '../types';

// 1. bölüm: soldan girip yılan gibi kıvrılan, sağdan çıkan bir yol. 20 × 13 karo.
export const MAP_1: MapDef = {
  id: 'neon-vadi',
  name: 'Neon Vadi',
  cols: 20,
  rows: 13,
  waypoints: [
    { col: -1, row: 2 },
    { col: 4, row: 2 },
    { col: 4, row: 9 },
    { col: 9, row: 9 },
    { col: 9, row: 3 },
    { col: 14, row: 3 },
    { col: 14, row: 10 },
    { col: 17, row: 10 },
    { col: 17, row: 5 },
    { col: 20, row: 5 },
  ],
  blocked: [
    { col: 1, row: 7 },
    { col: 2, row: 11 },
    { col: 7, row: 5 },
    { col: 11, row: 11 },
    { col: 12, row: 0 },
    { col: 16, row: 1 },
    { col: 19, row: 12 },
  ],
};
