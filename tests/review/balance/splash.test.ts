// Top patlamalarının kaçı birden fazla düşmana vuruyor? (dalgaya göre; dengeli betik ve buzsuz sürümü)
import { expect, it } from 'vitest';
import type { GameEvent, TowerKind } from '../../../src/core/types';
import { run, scriptBot, type Step } from './harness';
import { BALANCED } from './scripts';

function splashStats(events: readonly GameEvent[]): Map<number, { shots: number; multi: number; hits: number }> {
  const byWave = new Map<number, { shots: number; multi: number; hits: number }>();
  let wave = 0;
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    if (e.type === 'waveStarted') wave = e.wave;
    if (e.type !== 'explosion') continue;
    let hits = 0;
    for (let j = i + 1; j < events.length; j++) {
      const n = events[j]!;
      if (n.type === 'enemyHit') hits++;
      else if (n.type !== 'enemyKilled') break;
    }
    const s = byWave.get(wave) ?? { shots: 0, multi: 0, hits: 0 };
    s.shots++;
    s.hits += hits;
    if (hits >= 2) s.multi++;
    byWave.set(wave, s);
  }
  return byWave;
}

const swapKinds = (script: readonly Step[], to: (k: TowerKind) => TowerKind): Step[] =>
  script.map((s) => ('build' in s ? { build: to(s.build), at: s.at } : s));

it('top alan hasarı: ≥2 düşmana vuran patlama oranı', () => {
  const out: string[] = [];
  for (const [name, script] of [
    ['dengeli', BALANCED],
    ['dengeli, buz→lazer', swapKinds(BALANCED, (k) => (k === 'frost' ? 'laser' : k))],
  ] as const) {
    const r = run(scriptBot(name, script, { midWave: true }));
    const st = splashStats(r.events);
    out.push(`── ${name} ──  (dalga: patlama, ≥2 isabet %, isabet/patlama)`);
    out.push(
      [...st.entries()]
        .map(([w, s]) => `${w}: ${s.shots}, %${Math.round((100 * s.multi) / s.shots)}, ${(s.hits / s.shots).toFixed(2)}`)
        .join(' | '),
    );
  }
  console.log(out.join('\n'));
  expect(out.length).toBe(4);
});
