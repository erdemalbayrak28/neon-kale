// Nüfusta hangi oyuncu kararı kazanmayı belirliyor? Parametre dilimlerine göre kazanma oranı ve son kompozisyon.
import { expect, it } from 'vitest';
import { HEAVY, run } from './harness';
import { humanBot, mulberry32, sampleParams, type HumanParams } from './population-lib';

it.skipIf(!HEAVY)('parametre dilimlerine göre kazanma oranı (gerçek veri, 300 bot)', () => {
  const rows: { p: HumanParams; win: boolean; lives: number; comp: { laser: number; cannon: number; frost: number }; frostNearPocket: number }[] = [];
  for (let seed = 1; seed <= 300; seed++) {
    const p = sampleParams(mulberry32(seed));
    const r = run(humanBot(seed, p));
    const comp = { laser: 0, cannon: 0, frost: 0 };
    for (const t of r.sim.state.towers) comp[t.kind] += t.invested;
    rows.push({ p, win: r.status === 'victory', lives: r.lives, comp, frostNearPocket: 0 });
  }
  const bucket = (name: string, f: (x: (typeof rows)[number]) => number, edges: number[]): string => {
    const out: string[] = [];
    for (let i = 0; i < edges.length - 1; i++) {
      const sel = rows.filter((x) => f(x) >= edges[i]! && f(x) < edges[i + 1]!);
      if (sel.length === 0) continue;
      const w = sel.filter((x) => x.win).length;
      out.push(`[${edges[i]}–${edges[i + 1]}): ${w}/${sel.length} (%${Math.round((100 * w) / sel.length)})`);
    }
    return `${name.padEnd(28)} ${out.join('  ')}`;
  };
  const share = (x: (typeof rows)[number], k: 'laser' | 'cannon' | 'frost') => x.comp[k] / (x.comp.laser + x.comp.cannon + x.comp.frost || 1);
  console.log(
    [
      bucket('topK (yerleşim özeni)', (x) => x.p.topK, [1, 2, 3, 4, 6]),
      bucket('ilk lazer sayısı', (x) => x.p.initialLasers, [2, 3, 4, 5]),
      bucket('yükseltme eğilimi', (x) => x.p.upgradeBias, [0.3, 0.45, 0.6, 0.71]),
      bucket('son yatırım: top payı', (x) => share(x, 'cannon'), [0, 0.3, 0.45, 0.6, 1.01]),
      bucket('son yatırım: buz payı', (x) => share(x, 'frost'), [0, 0.1, 0.2, 0.3, 1.01]),
      bucket('son yatırım: lazer payı', (x) => share(x, 'laser'), [0, 0.2, 0.35, 0.5, 1.01]),
    ].join('\n'),
  );
  expect(rows.length).toBe(300);
}, 120_000);
