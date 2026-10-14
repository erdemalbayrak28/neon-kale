// Dengeli betik üzerinde tek değişkenli deneyler: buzun değeri, yerleşimin etkisi, erken çağırma politikaları.
import { describe, expect, it } from 'vitest';
import type { Simulation } from '../../../src/core/simulation';
import type { TowerKind } from '../../../src/core/types';
import { run, scriptBot, summary, table, type Step } from './harness';
import { BALANCED } from './scripts';

const swapKinds = (script: readonly Step[], to: (k: TowerKind) => TowerKind): Step[] =>
  script.map((s) => ('build' in s ? { build: to(s.build), at: s.at } : s));

/** Betikteki karoları sırayla başka karolara taşır. */
function remap(script: readonly Step[], map: Record<string, [number, number]>): Step[] {
  const m = (at: readonly [number, number]): [number, number] => {
    const to = map[`${at[0]},${at[1]}`];
    if (!to) throw new Error(`eşleme yok: ${at.join(',')}`);
    return to;
  };
  return script.map((s) => ('build' in s ? { build: s.build, at: m(s.at) } : { upgrade: m(s.upgrade) }));
}

/** Dengeli betiğin kullandığı 10 karo, kullanım sırasıyla. */
const BAL_TILES = ['15,8', '16,8', '11,4', '15,9', '15,7', '16,9', '16,7', '15,6', '16,6', '12,4'];

const mapping = (targets: [number, number][]): Record<string, [number, number]> =>
  Object.fromEntries(BAL_TILES.map((k, i) => [k, targets[i]!]));

describe('ablasyon', () => {
  it('buzun değeri: buz yerine lazer / top / hiçbir şey', () => {
    const noFrost = BALANCED.filter((s) => !('build' in s && s.build === 'frost')).filter(
      (s) => !('upgrade' in s && ['16,9', '15,6'].includes(s.upgrade.join(','))),
    );
    const variants: [string, Step[]][] = [
      ['dengeli', [...BALANCED]],
      ['buz→lazer', swapKinds(BALANCED, (k) => (k === 'frost' ? 'laser' : k))],
      ['buz→top', swapKinds(BALANCED, (k) => (k === 'frost' ? 'cannon' : k))],
      ['buz yok (altın diğerlerine)', noFrost],
      ['top→buz (buz+lazer)', swapKinds(BALANCED, (k) => (k === 'cannon' ? 'frost' : k))],
    ];
    const out: string[] = [];
    for (const mid of [false, true]) {
      for (const [name, script] of variants) {
        const r = run(scriptBot(`${name}${mid ? ' +mid' : ''}`, script, { midWave: mid }));
        out.push(summary(r) + `  hasar L/T/B: ${Math.round(r.usefulDamage.laser)}/${Math.round(r.usefulDamage.cannon)}/${Math.round(r.usefulDamage.frost)}`);
      }
    }
    console.log(out.join('\n'));
    expect(out.length).toBe(10);
  });

  it('yerleşim: aynı betik, farklı karolar', () => {
    const sets: [string, [number, number][]][] = [
      ['cep (dengeli)', BAL_TILES.map((k) => k.split(',').map(Number) as [number, number])],
      // ikinci en iyi U'lar: (5–8, 7–8) ve (10–13, 4–5)
      ['ikinci U cepleri', [[6, 8], [7, 8], [11, 4], [5, 8], [6, 7], [8, 8], [7, 7], [5, 7], [8, 7], [12, 4]]],
      // ilk U (5–8,7–8) — yolun %26–37'si: erken öldürme bölgesi
      ['erken cep + giriş köşesi', [[6, 8], [7, 8], [3, 3], [5, 8], [6, 7], [8, 8], [7, 7], [2, 3], [3, 4], [2, 4]]],
      // düz kenarlar: tek kolu gören karolar
      ['düz kenarlar', [[3, 6], [3, 7], [10, 2], [5, 10], [6, 10], [3, 5], [7, 10], [8, 10], [3, 8], [11, 2]]],
      // çok uzak (kapsama < 3)
      ['köşe dışı uzak karolar', [[2, 6], [2, 7], [11, 1], [6, 11], [7, 11], [2, 5], [5, 11], [8, 11], [2, 8], [10, 1]]],
    ];
    const out: string[] = [];
    for (const [name, tiles] of sets) {
      for (const mid of [false, true]) {
        const r = run(scriptBot(`${name}${mid ? ' +mid' : ''}`, remap(BALANCED, mapping(tiles)), { midWave: mid }));
        out.push(summary(r) + `  derin9/10: ${Math.round(r.rows[8]?.deepest! * 100)}%/${Math.round((r.rows[9]?.deepest ?? NaN) * 100)}%`);
      }
    }
    console.log(out.join('\n'));
    expect(out.length).toBe(10);
  });

  it('erken çağırma politikaları (dengeli + dalga sırasında harcar)', () => {
    const policies: [string, (sim: Simulation) => boolean][] = [
      ['hiç', () => false],
      ['hep', () => true],
      ['sahada ≤ 2 düşman', (s) => s.state.enemies.length <= 2],
      ['sahada 0 düşman (bonus avı)', (s) => s.state.enemies.length === 0],
      ['en öndeki < %30 yol', (s) => s.state.enemies.every((e) => e.distance < 0.3 * 2208)],
      ['sadece 1–4. dalgalarda hep', (s) => s.state.wavesStarted <= 4],
      ['sadece 1–4, sahada ≤ 2', (s) => s.state.wavesStarted <= 4 && s.state.enemies.length <= 2],
    ];
    const out: string[] = [];
    const results = policies.map(([name, p]) => run(scriptBot(`erken: ${name}`, BALANCED, { midWave: true, early: p })));
    for (const r of results) out.push(summary(r) + `  bonus ${r.earlyBonusGold}, süre ${r.totalTime.toFixed(0)} sn`);
    console.log(out.join('\n'));
    console.log(table(results[3]!));
    expect(results.length).toBe(policies.length);
  });
});
