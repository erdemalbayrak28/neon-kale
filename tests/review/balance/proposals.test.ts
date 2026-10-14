// Önerilen sayı değişikliklerinin simülasyonla önce/sonra karşılaştırması (ağır: REVIEW_HEAVY=1 ile çalışır).
// Kaynak veriye dokunmaz; değiştirilmiş tanımlar SimulationOptions ile verilir.
//   F3        = rules.hpGrowthPerWave 0.55 → 0.45; waves[8] zırhlı grubu 12 @ 1.1 sn → 10 @ 1.3 sn
//   F3+patlama = F3 + towers.cannon splashRadius 0.75/0.85/1.0 → 1.1/1.0/1.0 (önerilmez: sadece top 3★ olur)
import { describe, expect, it } from 'vitest';
import { curve, REAL, type Data } from './curve-lib';
import { HEAVY, greedyBot, run, scriptBot, summary } from './harness';
import { formatPopulation, population } from './population-lib';
import { BALANCED, SECOND_POCKETS, STRAIGHTS, remap, swapKinds, wideBot } from './scripts';
import { F3, F3_SPLASH, opts } from './variants-lib';


export const CANDIDATES: [string, Data][] = [
  ['ŞİMDİKİ', REAL],
  ['F3 (büyüme 0.45 + 9. dalga zırhlı 10@1.3)', F3],
  ['F3 + top patlama 1.1/1.0/1.0 (önerilmez)', F3_SPLASH],
];

function keyStrategies(d: Data): string {
  const o = opts(d);
  const rs = [
    run(scriptBot('  kulesiz', []), o),
    run(scriptBot('  dengeli', BALANCED), o),
    run(scriptBot('  dengeli + mid', BALANCED, { midWave: true }), o),
    run(scriptBot('  dengeli + mid + ≤2 düşmanda erken', BALANCED, { midWave: true, early: (s) => s.state.enemies.length <= 2 }), o),
    run(scriptBot('  dengeli + mid + hep erken', BALANCED, { midWave: true, early: true }), o),
    run(scriptBot('  sadece lazer (dengeli yerler)', swapKinds(BALANCED, () => 'laser')), o),
    run(scriptBot('  sadece top (dengeli yerler) + mid', swapKinds(BALANCED, () => 'cannon'), { midWave: true }), o),
    run(scriptBot('  buz + lazer', swapKinds(BALANCED, (k) => (k === 'cannon' ? 'laser' : k))), o),
    run(scriptBot('  buz→top (buzsuz) + mid', swapKinds(BALANCED, (k) => (k === 'frost' ? 'cannon' : k)), { midWave: true }), o),
    run(scriptBot('  ikinci U cepleri + mid', remap(BALANCED, SECOND_POCKETS), { midWave: true }), o),
    run(scriptBot('  düz kenarlar + mid', remap(BALANCED, STRAIGHTS), { midWave: true }), o),
    run(wideBot(true), o),
    run(greedyBot('  açgözlü-acemi + mid', { kinds: ['laser', 'cannon', 'frost'], armorAware: false, splashFactor: 1, midWave: true }), o),
  ];
  return rs
    .map((r) => {
      const d9 = r.rows[8] ? Math.round(r.rows[8].deepest * 100) : NaN;
      const d10 = r.rows[9] ? Math.round(r.rows[9].deepest * 100) : NaN;
      return `${summary(r)}  derin9/10 ${d9}%/${d10}%`;
    })
    .join('\n');
}

describe.skipIf(!HEAVY)('öneriler (önce/sonra)', () => {
  for (const [name, d] of CANDIDATES) {
    it(name, () => {
      const pop = population(200, opts(d));
      const pop2 = population(200, opts(d), 1001);
      console.log(
        [
          `════ ${name} ════`,
          curve(d),
          keyStrategies(d),
          formatPopulation('200 insan benzeri bot (tohum 1+)', pop),
          formatPopulation('200 insan benzeri bot (tohum 1001+)', pop2),
        ].join('\n'),
      );
      expect(pop.n).toBe(200);
    }, 300_000);
  }
});
