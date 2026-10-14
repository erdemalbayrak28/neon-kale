// Gerçek verilerle farklı oyuncu stratejileri. Tablolar: `npx vitest run tests/review/balance --reporter=verbose`.
import { describe, expect, it } from 'vitest';
import type { TowerKind } from '../../../src/core/types';
import { greedyBot, run, scriptBot, summary, table, type Step } from './harness';
import { BALANCED } from './scripts';



const swapKinds = (script: readonly Step[], to: (k: TowerKind) => TowerKind): Step[] =>
  script.map((s) => ('build' in s ? { build: to(s.build), at: s.at } : s));

/** Buz + lazer: dengeli betikteki topların yerine lazer. */
const FROST_LASER = swapKinds(BALANCED, (k) => (k === 'cannon' ? 'laser' : k));

describe('stratejiler (gerçek veri)', () => {
  it('karşılaştırma tablosu', () => {
    const results = [
      run(scriptBot('kulesiz', [])),
      run(scriptBot('dengeli (dalga arası harcar)', BALANCED)),
      run(scriptBot('dengeli + dalga sırasında harcar', BALANCED, { midWave: true })),
      run(scriptBot('dengeli + her zaman erken çağır', BALANCED, { early: true })),
      run(scriptBot('dengeli + mid + erken', BALANCED, { early: true, midWave: true })),
      run(scriptBot('sadece lazer (dengeli yerler)', swapKinds(BALANCED, () => 'laser'))),
      run(scriptBot('sadece top (dengeli yerler)', swapKinds(BALANCED, () => 'cannon'))),
      run(scriptBot('buz + lazer (dengeli yerler)', FROST_LASER)),
      run(greedyBot('açgözlü-acemi (saf DPS/altın, her tür)', { kinds: ['laser', 'cannon', 'frost'], armorAware: false, splashFactor: 1 })),
      run(greedyBot('açgözlü-acemi + mid', { kinds: ['laser', 'cannon', 'frost'], armorAware: false, splashFactor: 1, midWave: true })),
      run(greedyBot('açgözlü-zırh bilen (lazer+top)', { kinds: ['laser', 'cannon'], armorAware: true })),
      run(greedyBot('açgözlü-zırh bilen (lazer+top) + mid', { kinds: ['laser', 'cannon'], armorAware: true, midWave: true })),
      run(greedyBot('açgözlü sadece lazer + mid', { kinds: ['laser'], armorAware: true, midWave: true })),
      run(greedyBot('açgözlü sadece top + mid', { kinds: ['cannon'], armorAware: true, midWave: true })),
      run(greedyBot('açgözlü sadece top + mid + erken', { kinds: ['cannon'], armorAware: true, midWave: true, early: true })),
      run(greedyBot('açgözlü lazer+top+buz + mid', { kinds: ['laser', 'cannon', 'frost'], armorAware: true, midWave: true, frostSlowValue: 10 })),
    ];
    console.log(results.map(summary).join('\n'));
    for (const r of results) console.log(table(r));
    expect(results.length).toBeGreaterThan(0);
  });
});
