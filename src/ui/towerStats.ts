import type { TowerDef, TowerLevelStats } from '../core/types';

// Kule seviyesi → istatistik erişimi (seviye 1'den başlar).

export function levelStats(def: TowerDef, level: 1 | 2 | 3): TowerLevelStats {
  return def.levels[(level - 1) as 0 | 1 | 2];
}

/** Bir sonraki seviyenin istatistikleri; en üst seviyedeyse undefined. */
export function nextLevelStats(def: TowerDef, level: 1 | 2 | 3): TowerLevelStats | undefined {
  return level < 3 ? def.levels[level as 1 | 2] : undefined;
}
