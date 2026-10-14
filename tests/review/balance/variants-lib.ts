// Değiştirilmiş veri setleri (kaynak veriye dokunmadan, derin kopya) ve SimulationOptions'a çevirme.
import type { SimulationOptions } from '../../../src/core/simulation';
import { REAL, type Data } from './curve-lib';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Mutable = { towers: any; enemies: any; waves: any; rules: any };

export function variant(patch: (d: Mutable) => void, base: Data = REAL): Data {
  const d = JSON.parse(JSON.stringify(base)) as Mutable;
  patch(d);
  return d as Data;
}

export const opts = (d: Data): SimulationOptions => ({ towers: d.towers, enemies: d.enemies, waves: d.waves, rules: d.rules });

/** Önerilen asıl değişiklik: HP büyümesi 0.55 → 0.45, 9. dalga zırhlı grubu 12 @ 1.1 sn → 10 @ 1.3 sn. */
export const F3 = variant((d) => {
  d.rules.hpGrowthPerWave = 0.45;
  d.waves[8].groups[1].count = 10;
  d.waves[8].groups[1].interval = 1.3;
});

/**
 * F3 + top patlama yarıçapı 0.75/0.85/1.0 → 1.1/1.0/1.0. Alan hasarı 2–7. dalgalarda %4 → %11 çalışır AMA
 * "sadece top" stratejisi 3 yıldıza çıkar (top baskın olur). Bu yüzden ÖNERİLMEZ; karşılaştırma için tutulur.
 */
export const F3_SPLASH = variant((d) => {
  d.towers.cannon.levels[0].splashRadius = 1.1;
  d.towers.cannon.levels[1].splashRadius = 1.0;
}, F3);
