// Ortak betikler.
import type { TileCoord, TowerKind } from '../../../src/core/types';
import { B, U, buildableTiles, cachedCoverage, type Bot, type Step } from './harness';

/** tests/core/balance.test.ts'teki dengeli betiğin aynısı. */
export const BALANCED: readonly Step[] = [
  B('laser', 15, 8), B('laser', 16, 8), B('laser', 11, 4), U(15, 8), B('cannon', 15, 9), U(16, 8), B('cannon', 15, 7),
  B('frost', 16, 9), U(15, 9), U(15, 7), U(15, 8), U(16, 8), U(15, 9), U(15, 7), U(16, 9), B('cannon', 16, 7), U(16, 7),
  U(16, 7), U(16, 9), B('frost', 15, 6), U(11, 4), B('laser', 16, 6), U(16, 6), U(15, 6), U(16, 6), U(11, 4),
  B('cannon', 12, 4), U(12, 4), U(12, 4), U(15, 6),
];

/** Dengeli betiğin kullandığı 10 karo, kullanım sırasıyla. */
export const BAL_TILES = ['15,8', '16,8', '11,4', '15,9', '15,7', '16,9', '16,7', '15,6', '16,6', '12,4'];

/** Dengeli betiğin karolarını sırayla başka karolara taşır. */
export function remap(script: readonly Step[], targets: readonly (readonly [number, number])[]): Step[] {
  const map = Object.fromEntries(BAL_TILES.map((k, i) => [k, targets[i]!]));
  const m = (at: readonly [number, number]): [number, number] => {
    const to = map[`${at[0]},${at[1]}`];
    if (!to) throw new Error(`eşleme yok: ${at.join(',')}`);
    return [to[0], to[1]];
  };
  return script.map((s) => ('build' in s ? { build: s.build, at: m(s.at) } : { upgrade: m(s.upgrade) }));
}

/** İkinci en iyi U cepleri: (5–8, 7–8) ve (10–13, 4). Lazer menzilinde ~7 karo yol görür (asıl cep ~10). */
export const SECOND_POCKETS: readonly (readonly [number, number])[] = [
  [6, 8], [7, 8], [11, 4], [5, 8], [6, 7], [8, 8], [7, 7], [5, 7], [8, 7], [12, 4],
];
/** Düz kenarlar: tek kolu gören karolar (~5 karo yol). */
export const STRAIGHTS: readonly (readonly [number, number])[] = [
  [3, 6], [3, 7], [10, 2], [5, 10], [6, 10], [3, 5], [7, 10], [8, 10], [3, 8], [11, 2],
];

export const swapKinds = (script: readonly Step[], to: (k: TowerKind) => TowerKind): Step[] =>
  script.map((s) => ('build' in s ? { build: to(s.build), at: s.at } : s));

/** Geniş oyuncu: dengeli betikteki her yükseltme yerine aynı türden yeni kule (en iyi kapsamalı boş karoya). */
export function wideBot(mid: boolean): Bot {
  let cursor = 0;
  const kindAt = new Map<string, TowerKind>();
  return {
    name: `geniş (yükseltme yerine yeni kule)${mid ? ' +mid' : ''}`,
    midWave: mid,
    act(sim) {
      while (cursor < BALANCED.length) {
        const s = BALANCED[cursor]!;
        let kind: TowerKind;
        let tile: TileCoord;
        if ('build' in s) {
          kind = s.build;
          tile = { col: s.at[0], row: s.at[1] };
        } else {
          kind = kindAt.get(s.upgrade.join(','))!;
          const range = sim.towerDefs[kind].levels[0].range;
          let best: TileCoord | null = null;
          let bc = -1;
          for (const t of buildableTiles(sim)) {
            if (BAL_TILES.includes(`${t.col},${t.row}`)) continue; // dengeli betiğin sonra kullanacağı karolar
            const c = cachedCoverage(t, range);
            if (c > bc) {
              bc = c;
              best = t;
            }
          }
          tile = best!;
        }
        const r = sim.build(kind, tile);
        if (!r.ok) {
          if (r.reason === 'notEnoughGold') return;
          throw new Error(r.reason);
        }
        if ('build' in s) kindAt.set(s.at.join(','), kind);
        cursor++;
      }
    },
  };
}
