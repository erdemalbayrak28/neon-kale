// Makul oyuncu nüfusu (açıklama population-lib.ts'te).
import { describe, expect, it } from 'vitest';
import { HEAVY, run } from './harness';
import { formatPopulation, humanBot, mulberry32, population, sampleParams } from './population-lib';

describe.skipIf(!HEAVY)('makul oyuncu nüfusu (gerçek veri)', () => {
  it('kazanma oranı ve ölüm dalgası dağılımı', () => {
    const s = population(200);
    console.log(formatPopulation('gerçek veri, 200 insan benzeri bot', s));
    expect(s.n).toBe(200);
  }, 120_000);

  it('en iyi alt grup: topK=1 (hep en iyi karo), buz ağırlığı ≥ 0.2, top ağırlığı ≥ 0.5', () => {
    let n = 0;
    let wins = 0;
    const deaths: Record<number, number> = {};
    for (let seed = 1; seed <= 3000 && n < 60; seed++) {
      const p = sampleParams(mulberry32(seed));
      p.topK = 1;
      if (p.wFrost < 0.2 || p.wCannon < 0.5) continue;
      n++;
      const r = run(humanBot(seed, p));
      if (r.status === 'victory') wins++;
      else deaths[r.rows.length] = (deaths[r.rows.length] ?? 0) + 1;
    }
    console.log(`── seçkin alt grup: kazanma ${wins}/${n}; ölüm dalgası ${JSON.stringify(deaths)} ──`);
    expect(n).toBeGreaterThan(0);
  }, 120_000);
});
