// Aday veri setini tek satırda değerlendirir: eğri oranları, nüfus kazanma oranı, core denge değişmezleri, ana stratejiler.
import type { TowerKind } from '../../../src/core/types';
import { goldAvailable, minGold, type Data } from './curve-lib';
import { B, U, run, scriptBot, type Step } from './harness';
import { population } from './population-lib';
import { BALANCED } from './scripts';
import { opts } from './variants-lib';

const swapKinds = (script: readonly Step[], to: (k: TowerKind) => TowerKind): Step[] =>
  script.map((s) => ('build' in s ? { build: to(s.build), at: s.at } : s));

export function evaluate(name: string, d: Data, popN = 100): string {
  const o = opts(d);
  const ratios: string[] = [];
  for (let w = 1; w <= d.waves.length; w++) ratios.push((minGold(d, w) / goldAvailable(d, w)).toFixed(2));
  const pop = population(popN, o);
  const bal = run(scriptBot('dengeli', BALANCED), o);
  const balMid = run(scriptBot('dengeli+mid', BALANCED, { midWave: true }), o);
  const laser = run(scriptBot('lazer', swapKinds(BALANCED, () => 'laser')), o);
  const fl = run(scriptBot('buz+lazer', swapKinds(BALANCED, (k) => (k === 'cannon' ? 'laser' : k))), o);
  const none = run(scriptBot('yok', []), o);
  const three = run(scriptBot('üç lazer', [B('laser', 15, 8), B('laser', 16, 8), B('laser', 11, 4), U(15, 8), U(16, 8), U(11, 4)]), o);
  const firstLeak = (r: ReturnType<typeof run>) => r.rows.find((x) => x.leaked > 0)?.wave;
  const early = Math.max(...[0, 1, 2].map((i) => bal.rows[i]!.deepest));
  const late = Math.max(bal.rows[8]?.deepest ?? 0, bal.rows[9]?.deepest ?? 0);
  const inv = [
    none.status === 'defeat' && none.rows.length <= 4,
    bal.status === 'victory' && bal.stars >= 2,
    (laser.status === 'defeat' || laser.stars < bal.stars) && laser.lives < bal.lives,
    [0, 1, 2].every((i) => three.rows[i]!.leaked === 0) && [0, 1, 2, 3].every((i) => bal.rows[i]!.leaked === 0),
    firstLeak(laser) === 5 && bal.rows[4]!.leaked === 0,
    late >= 0.85 && late - early >= 0.1,
  ];
  const invText = inv.every(Boolean) ? 'core-denge ✓' : `core-denge ✗[${inv.map((x) => (x ? '1' : '0')).join('')}]`;
  const res = (r: ReturnType<typeof run>) => (r.status === 'victory' ? `Z${r.stars}★/${r.lives}` : `Y@${r.rows.length}`);
  const deep = (r: ReturnType<typeof run>) => `${Math.round((r.rows[8]?.deepest ?? NaN) * 100)}/${Math.round((r.rows[9]?.deepest ?? NaN) * 100)}`;
  const deaths = Object.entries(pop.deathWave).map(([w, c]) => `${w}:${c}`).join(' ');
  return (
    `${name.padEnd(38)} | oran ${ratios.join(' ')} | nüfus %${Math.round((100 * pop.wins) / pop.n)} (3★ ${pop.threeStars}) ölüm[${deaths}]` +
    ` | ${invText} | dengeli ${res(bal)} derin ${deep(bal)} | +mid ${res(balMid)} derin ${deep(balMid)} | lazer ${res(laser)} | buz+lazer ${res(fl)} | kulesiz ${res(none)}`
  );
}

