// "Mükemmel olmayan ama makul" oyuncu nüfusu: tohumlu rastgele parametrelerle insan benzeri botlar.
// Her bot: önce birkaç lazer, sonra ağırlıklı rastgele tür (lazer/top/buz), karoyu en iyi kapsamalı ilk K karodan seçer,
// bir sonraki eylemi seçip parası yetene dek biriktirir, dalga sırasında da harcar. Kazanma oranı ve ölüm dalgası dağılımı.
import type { Simulation, SimulationOptions } from '../../../src/core/simulation';
import type { TileCoord, TowerKind } from '../../../src/core/types';
import { buildableTiles, cachedCoverage, run, synergyCoverage, type Bot, type RunResult } from './harness';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface HumanParams {
  initialLasers: number;
  wLaser: number;
  wCannon: number;
  wFrost: number;
  upgradeBias: number;
  topK: number;
}

export function sampleParams(rng: () => number): HumanParams {
  return {
    initialLasers: 2 + Math.floor(rng() * 3), // 2–4
    wLaser: 0.15 + rng() * 0.35,
    wCannon: 0.3 + rng() * 0.4,
    wFrost: 0.1 + rng() * 0.25,
    upgradeBias: 0.3 + rng() * 0.4,
    topK: 1 + Math.floor(rng() * 5), // 1–5
  };
}

type Intent = { kind: 'build'; tower: TowerKind } | { kind: 'upgrade'; towerId: number };

export function humanBot(seed: number, p: HumanParams): Bot {
  const rng = mulberry32(seed * 7919 + 13);
  let intent: Intent | null = null;
  let built = 0;
  const pickKind = (): TowerKind => {
    if (built < p.initialLasers) return 'laser';
    const r = rng() * (p.wLaser + p.wCannon + p.wFrost);
    return r < p.wLaser ? 'laser' : r < p.wLaser + p.wCannon ? 'cannon' : 'frost';
  };
  const pickTile = (sim: Simulation, kind: TowerKind): TileCoord | null => {
    const range = sim.towerDefs[kind].levels[0].range;
    const tiles = buildableTiles(sim)
      .map((t) => ({ t, c: kind === 'frost' ? synergyCoverage(sim, t, range) : cachedCoverage(t, range) }))
      .sort((a, b) => b.c - a.c || a.t.row - b.t.row || a.t.col - b.t.col);
    if (tiles.length === 0) return null;
    const k = Math.min(p.topK, tiles.length);
    return tiles[Math.floor(rng() * k)]!.t;
  };
  const nextIntent = (sim: Simulation): Intent => {
    const upgradable = sim.state.towers.filter((t) => t.level < 3);
    if (built >= p.initialLasers && upgradable.length > 0 && rng() < p.upgradeBias) {
      // en düşük seviyeli kulelerden birini (top/buz öncelikli) yükselt
      const sorted = [...upgradable].sort((a, b) => a.level - b.level || (a.kind === 'laser' ? 1 : 0) - (b.kind === 'laser' ? 1 : 0));
      return { kind: 'upgrade', towerId: sorted[Math.floor(rng() * Math.min(2, sorted.length))]!.id };
    }
    return { kind: 'build', tower: pickKind() };
  };
  return {
    name: `insan#${seed}`,
    midWave: true,
    act(sim) {
      for (let guard = 0; guard < 20; guard++) {
        intent ??= nextIntent(sim);
        if (intent.kind === 'build') {
          const cost = sim.towerDefs[intent.tower].levels[0].cost;
          if (sim.state.gold < cost) return;
          const tile = pickTile(sim, intent.tower);
          if (!tile) return;
          if (!sim.build(intent.tower, tile).ok) return;
          built++;
        } else {
          const cost = sim.upgradeCost(intent.towerId);
          if (cost === null) {
            intent = null;
            continue;
          }
          if (sim.state.gold < cost) return;
          if (!sim.upgrade(intent.towerId).ok) return;
        }
        intent = null;
      }
    },
  };
}

export interface PopulationStats {
  wins: number;
  threeStars: number;
  n: number;
  deathWave: Record<number, number>;
  avgLives: number;
  /** Dalga başına ortalama sızan can (bütün oyunlar). */
  leakByWave: number[];
}

export function population(n: number, options: SimulationOptions = {}, seed0 = 1): PopulationStats {
  const stats: PopulationStats = { wins: 0, threeStars: 0, n, deathWave: {}, avgLives: 0, leakByWave: Array(11).fill(0) };
  for (let i = 0; i < n; i++) {
    const seed = seed0 + i;
    const rng = mulberry32(seed);
    const r: RunResult = run(humanBot(seed, sampleParams(rng)), options);
    if (r.status === 'victory') {
      stats.wins++;
      if (r.stars === 3) stats.threeStars++;
      stats.avgLives += r.lives / n;
    } else {
      const w = r.rows.length;
      stats.deathWave[w] = (stats.deathWave[w] ?? 0) + 1;
    }
    for (const row of r.rows) stats.leakByWave[row.wave]! += row.leaked / n;
  }
  return stats;
}

export function formatPopulation(title: string, s: PopulationStats): string {
  const deaths = Object.entries(s.deathWave)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([w, c]) => `d${w}:${c}`)
    .join(' ');
  const leaks = s.leakByWave
    .slice(1)
    .map((v, i) => `${i + 1}:${v.toFixed(1)}`)
    .join(' ');
  return (
    `── ${title}: kazanma ${s.wins}/${s.n} (%${Math.round((100 * s.wins) / s.n)}), 3★ ${s.threeStars}, ` +
    `kazananların ort. canı ${(s.wins ? (s.avgLives * s.n) / s.wins : 0).toFixed(1)} ──\n` +
    `ölüm dalgası: ${deaths || '-'}\nort. sızan can/dalga: ${leaks}`
  );
}

