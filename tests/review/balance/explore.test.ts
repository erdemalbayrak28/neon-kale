// Öneri arama: aday veri setlerinin kısa karşılaştırması (eğri oranları, nüfus kazanma oranı, ana stratejiler).
import { describe, expect, it } from 'vitest';
import { evaluate } from './eval-lib';
import { HEAVY, run, type Bot } from './harness';
import { humanBot, mulberry32, sampleParams } from './population-lib';
import { variant, type Mutable } from './variants-lib';

const w9 = (d: Mutable, count: number, interval: number) => {
  d.waves[8].groups[1].count = count;
  d.waves[8].groups[1].interval = interval;
};

export const EXPLORE: [string, (d: Mutable) => void][] = [
  ['ŞİMDİKİ', () => {}],
  ['E1 büyüme .50 + w9 zırhlı 10@1.3', (d) => { d.rules.hpGrowthPerWave = 0.5; w9(d, 10, 1.3); }],
  ['E2 büyüme .50 + zırhlı ödül 18', (d) => { d.rules.hpGrowthPerWave = 0.5; d.enemies.brute.reward = 18; }],
  ['E3 büyüme .50 + dalga ödülü/dalga 6', (d) => { d.rules.hpGrowthPerWave = 0.5; d.rules.waveBonusPerWave = 6; }],
  ['E4 zırhlı ödül 18 + w9 10@1.3', (d) => { d.enemies.brute.reward = 18; w9(d, 10, 1.3); }],
  ['E5 büyüme .50 + zırh 5', (d) => { d.rules.hpGrowthPerWave = 0.5; d.enemies.brute.armor = 5; }],
  ['E6 büyüme .45', (d) => { d.rules.hpGrowthPerWave = 0.45; }],
  ['E7 büyüme .50 + ödül 18 + w9 10@1.3', (d) => { d.rules.hpGrowthPerWave = 0.5; d.enemies.brute.reward = 18; w9(d, 10, 1.3); }],
];

export const EXPLORE2: [string, (d: Mutable) => void][] = [
  ['F1 büyüme .48 + zırh 5 + w9 10@1.3', (d) => { d.rules.hpGrowthPerWave = 0.48; d.enemies.brute.armor = 5; w9(d, 10, 1.3); }],
  ['F2 büyüme .50 + zırh 5 + w9 10@1.3', (d) => { d.rules.hpGrowthPerWave = 0.5; d.enemies.brute.armor = 5; w9(d, 10, 1.3); }],
  ['F3 büyüme .45 + w9 10@1.3', (d) => { d.rules.hpGrowthPerWave = 0.45; w9(d, 10, 1.3); }],
  ['F4 büyüme .45 + zırh 5', (d) => { d.rules.hpGrowthPerWave = 0.45; d.enemies.brute.armor = 5; }],
  ['F5 büyüme .48 + w9 10@1.3', (d) => { d.rules.hpGrowthPerWave = 0.48; w9(d, 10, 1.3); }],
  ['F6 büyüme .50 + zırh 5 + w9 10@1.3 + dalga/6', (d) => { d.rules.hpGrowthPerWave = 0.5; d.enemies.brute.armor = 5; w9(d, 10, 1.3); d.rules.waveBonusPerWave = 6; }],
];

/** Nüfus botu + "sahada ≤ 2 düşman kalınca erken çağır" alışkanlığı. */
function earlyHuman(seed: number): Bot {
  const b = humanBot(seed, sampleParams(mulberry32(seed)));
  return { ...b, early: (sim) => sim.state.enemies.length <= 2 };
}

describe.skipIf(!HEAVY)('öneri arama', () => {
  it('adaylar 2', () => {
    const lines = EXPLORE2.map(([n, p]) => evaluate(n, variant(p)));
    console.log(lines.join('\n'));
    expect(lines.length).toBe(EXPLORE2.length);
  }, 600_000);

  it('adaylar', () => {
    const lines = EXPLORE.map(([n, p]) => evaluate(n, variant(p)));
    console.log(lines.join('\n'));
    expect(lines.length).toBe(EXPLORE.length);
  }, 600_000);

  it('erken çağırma alışkanlığı nüfusu değiştiriyor mu?', () => {
    let wins = 0;
    let winsEarly = 0;
    let bonus = 0;
    const n = 100;
    for (let seed = 1; seed <= n; seed++) {
      if (run(humanBot(seed, sampleParams(mulberry32(seed)))).status === 'victory') wins++;
      const r = run(earlyHuman(seed));
      if (r.status === 'victory') winsEarly++;
      bonus += r.earlyBonusGold / n;
    }
    console.log(`── erken çağırma (sahada ≤2 düşman): kazanma ${wins}/${n} → ${winsEarly}/${n}, ort. erken bonus ${bonus.toFixed(0)} altın ──`);
    expect(n).toBe(100);
  }, 120_000);
});
