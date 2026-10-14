// Bulguların sağlamlık kontrolleri ve önerilen F3 setinin (büyüme 0.45 + 9. dalga zırhlı 10 @ 1.3 sn) ikinci bakışı.
import { describe, expect, it } from 'vitest';
import type { TileCoord, TowerKind } from '../../../src/core/types';
import { REAL } from './curve-lib';
import { F3, opts, variant } from './variants-lib';
import { HEAVY, cachedCoverage, buildableTiles, run, scriptBot, summary, type Bot, type Step } from './harness';
import { humanBot, mulberry32, population, sampleParams, formatPopulation } from './population-lib';
import { BALANCED } from './scripts';

const swapKinds = (script: readonly Step[], to: (k: TowerKind) => TowerKind): Step[] =>
  script.map((s) => ('build' in s ? { build: to(s.build), at: s.at } : s));
const BAL_TILES = ['15,8', '16,8', '11,4', '15,9', '15,7', '16,9', '16,7', '15,6', '16,6', '12,4'];
function remap(script: readonly Step[], targets: [number, number][]): Step[] {
  const map = Object.fromEntries(BAL_TILES.map((k, i) => [k, targets[i]!]));
  const m = (at: readonly [number, number]) => map[`${at[0]},${at[1]}`]!;
  return script.map((s) => ('build' in s ? { build: s.build, at: m(s.at) } : { upgrade: m(s.upgrade) }));
}
const SECOND_POCKETS: [number, number][] = [[6, 8], [7, 8], [11, 4], [5, 8], [6, 7], [8, 8], [7, 7], [5, 7], [8, 7], [12, 4]];
const EARLY_POCKET: [number, number][] = [[6, 8], [7, 8], [3, 3], [5, 8], [6, 7], [8, 8], [7, 7], [2, 3], [3, 4], [2, 4]];

describe.skipIf(!HEAVY)('sağlamlık', () => {
  it('F3: farklı tohumlarla nüfus (200) ve alt gruplar', () => {
    const out: string[] = [];
    for (const [name, d] of [['ŞİMDİKİ', REAL], ['F3', F3]] as const) {
      out.push(formatPopulation(`${name}, tohum 1001+`, population(200, opts(d), 1001)));
      let wide = 0;
      let wideWins = 0;
      for (let seed = 1; seed <= 300 && wide < 60; seed++) {
        const p = sampleParams(mulberry32(seed));
        if (p.upgradeBias >= 0.45) continue;
        wide++;
        if (run(humanBot(seed, p), opts(d)).status === 'victory') wideWins++;
      }
      out.push(`   ${name}: geniş kuran (yükseltme eğilimi < 0.45) alt grup: ${wideWins}/${wide}`);
    }
    console.log(out.join('\n'));
    expect(out.length).toBe(4);
  }, 300_000);

  it('yerleşim ve buz ablasyonu: şimdiki vs F3', () => {
    const out: string[] = [];
    for (const [name, d] of [['ŞİMDİKİ', REAL], ['F3', F3]] as const) {
      const o = opts(d);
      for (const mid of [false, true]) {
        const m = mid ? ' +mid' : '';
        out.push(`${name}: ` + summary(run(scriptBot(`ikinci U cepleri${m}`, remap(BALANCED, SECOND_POCKETS), { midWave: mid }), o)));
        out.push(`${name}: ` + summary(run(scriptBot(`erken cep + giriş köşesi${m}`, remap(BALANCED, EARLY_POCKET), { midWave: mid }), o)));
        out.push(`${name}: ` + summary(run(scriptBot(`buz→top${m}`, swapKinds(BALANCED, (k) => (k === 'frost' ? 'cannon' : k)), { midWave: mid }), o)));
        out.push(`${name}: ` + summary(run(scriptBot(`buz→lazer${m}`, swapKinds(BALANCED, (k) => (k === 'frost' ? 'laser' : k)), { midWave: mid }), o)));
      }
    }
    console.log(out.join('\n'));
    expect(out.length).toBe(16);
  }, 120_000);

  it('buz yükseltmelerinin değeri (gerçek veri): buzlar 1. seviyede kalsa', () => {
    const frostTiles = ['16,9', '15,6'];
    const noFrostUp = BALANCED.filter((s) => !('upgrade' in s && frostTiles.includes(s.upgrade.join(','))));
    const out = [
      summary(run(scriptBot('dengeli', BALANCED))),
      summary(run(scriptBot('dengeli, buz yükseltmesi yok', noFrostUp))),
      summary(run(scriptBot('dengeli +mid', BALANCED, { midWave: true }))),
      summary(run(scriptBot('dengeli +mid, buz yükseltmesi yok', noFrostUp, { midWave: true }))),
    ];
    console.log(out.join('\n'));
    expect(out.length).toBe(4);
  });

  it('geniş vs uzun (gerçek veri): dengeli betikte her yükseltme yerine aynı türden yeni kule', () => {
    // Yükseltme adımı → o kulenin türünden, en iyi kapsamalı boş karoya yeni kule.
    const wideBot = (mid: boolean): Bot => {
      let cursor = 0;
      const kindAt = new Map<string, TowerKind>();
      return {
        name: `geniş (yükseltme yerine yeni kule)${mid ? ' +mid' : ''}`,
        midWave: mid,
        act(sim) {
          while (cursor < BALANCED.length) {
            const s = BALANCED[cursor]!;
            if ('build' in s) {
              const r = sim.build(s.build, { col: s.at[0], row: s.at[1] });
              if (!r.ok) {
                if (r.reason === 'notEnoughGold') return;
                throw new Error(r.reason);
              }
              kindAt.set(s.at.join(','), s.build);
            } else {
              const kind = kindAt.get(s.upgrade.join(','))!;
              const range = sim.towerDefs[kind].levels[0].range;
              let best: TileCoord | null = null;
              let bc = -1;
              for (const t of buildableTiles(sim)) {
                // dengeli betiğin daha sonra kullanacağı karoları ayır
                if (BAL_TILES.includes(`${t.col},${t.row}`)) continue;
                const c = cachedCoverage(t, range);
                if (c > bc) {
                  bc = c;
                  best = t;
                }
              }
              const r = sim.build(kind, best!);
              if (!r.ok) {
                if (r.reason === 'notEnoughGold') return;
                throw new Error(r.reason);
              }
            }
            cursor++;
          }
        },
      };
    };
    const out = [summary(run(scriptBot('uzun (dengeli)', BALANCED))), summary(run(wideBot(false))), summary(run(wideBot(true)))];
    console.log(out.join('\n'));
    expect(out.length).toBe(3);
  });

  it('erken çağırma bonusu 10 → 20: "hep erken" hâlâ çöker mi, "≤2 düşman" ne kazandırır?', () => {
    const out: string[] = [];
    for (const bonus of [10, 20]) {
      const d = variant((x) => (x.rules.earlyCallBonus = bonus));
      const o = opts(d);
      out.push(`bonus ${bonus}: ` + summary(run(scriptBot('dengeli+mid hep erken', BALANCED, { midWave: true, early: true }), o)));
      const r = run(scriptBot('dengeli+mid ≤2 düşmanda erken', BALANCED, { midWave: true, early: (s) => s.state.enemies.length <= 2 }), o);
      out.push(`bonus ${bonus}: ` + summary(r) + ` (+${r.earlyBonusGold} altın, ${r.totalTime.toFixed(0)} sn)`);
      let wins = 0;
      for (let seed = 1; seed <= 100; seed++) {
        const b = humanBot(seed, sampleParams(mulberry32(seed)));
        if (run({ ...b, early: (s) => s.state.enemies.length <= 2 }, o).status === 'victory') wins++;
      }
      out.push(`bonus ${bonus}: nüfus (≤2 düşmanda erken çağıran) kazanma ${wins}/100`);
    }
    console.log(out.join('\n'));
    expect(out.length).toBe(6);
  }, 120_000);
});
