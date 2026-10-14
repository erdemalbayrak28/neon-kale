// F3 üzerine hedefli ek öneriler: 4. dalga sıçraması, topun erken alan hasarı, geniş kuranlar için ucuz top.
import { describe, expect, it } from 'vitest';
import type { GameEvent, TowerKind } from '../../../src/core/types';
import { REAL, type Data } from './curve-lib';
import { evaluate } from './eval-lib';
import { HEAVY, run, scriptBot, summary, type Step } from './harness';
import { humanBot, mulberry32, sampleParams } from './population-lib';
import { BALANCED } from './scripts';
import { F3, opts, variant, type Mutable } from './variants-lib';

const BAL_TILES = ['15,8', '16,8', '11,4', '15,9', '15,7', '16,9', '16,7', '15,6', '16,6', '12,4'];
function remap(script: readonly Step[], targets: [number, number][]): Step[] {
  const map = Object.fromEntries(BAL_TILES.map((k, i) => [k, targets[i]!]));
  const m = (at: readonly [number, number]) => map[`${at[0]},${at[1]}`]!;
  return script.map((s) => ('build' in s ? { build: s.build, at: m(s.at) } : { upgrade: m(s.upgrade) }));
}
const SECOND: [number, number][] = [[6, 8], [7, 8], [11, 4], [5, 8], [6, 7], [8, 8], [7, 7], [5, 7], [8, 7], [12, 4]];
const STRAIGHT: [number, number][] = [[3, 6], [3, 7], [10, 2], [5, 10], [6, 10], [3, 5], [7, 10], [8, 10], [3, 8], [11, 2]];
const swapKinds = (script: readonly Step[], to: (k: TowerKind) => TowerKind): Step[] =>
  script.map((s) => ('build' in s ? { build: to(s.build), at: s.at } : s));

const w4 = (d: Mutable) => {
  d.waves[3].groups[0].count = 12;
  d.waves[3].groups[1].count = 6;
};
const splash = (d: Mutable) => {
  d.towers.cannon.levels[0].splashRadius = 1.0;
};
const cheapCannon = (d: Mutable) => {
  d.towers.cannon.levels[0].cost = 70;
};

const CANDS: [string, Data][] = [
  ['ŞİMDİKİ', REAL],
  ['F3', F3],
  ['G1 F3 + w4 koşucu 12, çevik 6', variant(w4, F3)],
  ['G2 F3 + top L1 patlama 1.0', variant(splash, F3)],
  ['G3 F3 + top L1 bedel 70', variant(cheapCannon, F3)],
];

function multiHitEarly(events: readonly GameEvent[]): string {
  let wave = 0;
  let shots = 0;
  let multi = 0;
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    if (e.type === 'waveStarted') wave = e.wave;
    if (e.type !== 'explosion' || wave > 7) continue;
    let hits = 0;
    for (let j = i + 1; j < events.length; j++) {
      const n = events[j]!;
      if (n.type === 'enemyHit') hits++;
      else if (n.type !== 'enemyKilled') break;
    }
    shots++;
    if (hits >= 2) multi++;
  }
  return `%${Math.round((100 * multi) / Math.max(1, shots))}`;
}

describe.skipIf(!HEAVY)('ek öneriler', () => {
  it('karşılaştırma', () => {
    const out: string[] = [];
    for (const [name, d] of CANDS) {
      const o = opts(d);
      out.push(evaluate(name, d));
      const sec = run(scriptBot('ikinci U', remap(BALANCED, SECOND)), o);
      const str = run(scriptBot('düz', remap(BALANCED, STRAIGHT)), o);
      const cannonOnly = run(scriptBot('sadece top', swapKinds(BALANCED, () => 'cannon'), { midWave: true }), o);
      let wide = 0;
      let wideWins = 0;
      for (let seed = 1; seed <= 300 && wide < 60; seed++) {
        const p = sampleParams(mulberry32(seed));
        if (p.upgradeBias >= 0.45) continue;
        wide++;
        if (run(humanBot(seed, p), o).status === 'victory') wideWins++;
      }
      const balMid = run(scriptBot('dengeli+mid', BALANCED, { midWave: true }), o);
      out.push(
        `    4. dalga sızan: ikinci U ${sec.rows[3]?.leaked}, düz ${str.rows[3]?.leaked} | ikinci U sonuç: ${summary(sec).slice(43)}` +
          ` | geniş kuran alt grup ${wideWins}/${wide} | sadece top +mid: ${summary(cannonOnly).slice(43, 60)}` +
          ` | 2–7. dalga ≥2 isabetli patlama: ${multiHitEarly(balMid.events)}`,
      );
    }
    console.log(out.join('\n'));
    expect(out.length).toBe(CANDS.length * 2);
  }, 600_000);
});
