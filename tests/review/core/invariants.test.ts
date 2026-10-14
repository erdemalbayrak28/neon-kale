// İnceleme (çekirdek kuralları): gerçek verilerle, belirlenimci sahte rastgele komutlarla oynanan oyunlarda
// kuralların değişmezlerini denetler. Bu dosya geçmeli: incelemede bu alanlarda hata bulunmadığının kanıtıdır.
// (Çekirdekte Math.random yasak; buradaki üreteç sadece testin komut dizisini üretir.)

import { describe, expect, it } from 'vitest';
import { FIXED_STEP } from '../../../src/config';
import { RULES } from '../../../src/core/data/rules';
import { buildSpawnSchedule } from '../../../src/core/schedule';
import { Simulation } from '../../../src/core/simulation';
import type { GameEvent, TileCoord, TowerKind } from '../../../src/core/types';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const KINDS: readonly TowerKind[] = ['laser', 'cannon', 'frost'];

/** Yol kenarındaki kurulabilir karolar. */
function spotsNearPath(sim: Simulation): TileCoord[] {
  const spots: TileCoord[] = [];
  for (let col = 0; col < sim.map.cols; col++) {
    for (let row = 0; row < sim.map.rows; row++) {
      if (!sim.canPlace({ col, row }).ok) continue;
      const near = [-1, 0, 1].some((dc) => [-1, 0, 1].some((dr) => sim.isPathTile({ col: col + dc, row: row + dr })));
      if (near) spots.push({ col, row });
    }
  }
  return spots;
}

function play(seed: number, startingGold: number): { sim: Simulation; events: GameEvent[] } {
  const rnd = lcg(seed);
  const sim = new Simulation({ rules: { ...RULES, startingGold } });
  const spots = spotsNearPath(sim);
  const events: GameEvent[] = [];
  for (let frame = 0; frame < 60 * 60 * 20; frame++) {
    const s = sim.state;
    if (s.status === 'victory' || s.status === 'defeat') {
      // Bitişten sonra da update ve komutlar: hiçbir şey değişmemeli, olay gelmemeli.
      expect(sim.build('laser', spots[0]!)).toEqual({ ok: false, reason: 'gameOver' });
      events.push(...sim.update(0.25), ...sim.update(0));
      break;
    }
    const r = rnd();
    const goldBefore = s.gold;
    if (r < 0.04) {
      const res = sim.build(KINDS[Math.floor(rnd() * 3)]!, spots[Math.floor(rnd() * spots.length)]!);
      if (!res.ok) expect(sim.state.gold).toBe(goldBefore);
    } else if (r < 0.06 && s.towers.length) {
      const res = sim.upgrade(s.towers[Math.floor(rnd() * s.towers.length)]!.id);
      if (!res.ok) expect(sim.state.gold).toBe(goldBefore);
    } else if (r < 0.062 && s.towers.length) {
      sim.sell(s.towers[Math.floor(rnd() * s.towers.length)]!.id);
    }
    // Mümkün olan her an dalga çağır (erken çağırma dahil).
    if (s.status !== 'wave' || s.spawningDone) sim.startNextWave();
    else {
      const reason = s.wavesStarted >= s.totalWaves ? 'noMoreWaves' : 'waveInProgress';
      expect(sim.startNextWave()).toEqual({ ok: false, reason });
    }
    const c = rnd();
    const dt = c < 0.4 ? FIXED_STEP : c < 0.7 ? 2 * FIXED_STEP : c < 0.9 ? rnd() * 0.05 : 0.25;
    events.push(...sim.update(dt));
  }
  return { sim, events };
}

describe('değişmezler: erken çağırma, üst üste dalgalar, bitiş', () => {
  for (const [seed, gold] of [
    [1, 4000],
    [2, 4000],
    [3, 1200],
    [4, 600],
    [5, 300],
    [6, 160],
    [7, 160],
    [8, 2500],
  ] as const) {
    it(`tohum ${seed}, altın ${gold}`, () => {
      const { sim, events } = play(seed, gold);
      const st = sim.state;

      // Bitiş olayından sonra hiçbir olay yok.
      const end = events.findIndex((e) => e.type === 'victory' || e.type === 'defeat');
      if (end >= 0) expect(events.slice(end + 1)).toEqual([]);

      // Her dalga en fazla bir kez temizlenir; erken bayrağı doğru.
      const cleared = new Set<number>();
      for (const e of events) {
        if (e.type === 'waveCleared') {
          expect(cleared.has(e.wave)).toBe(false);
          cleared.add(e.wave);
          expect(e.bonus).toBe(RULES.waveBonusBase + RULES.waveBonusPerWave * e.wave);
        }
        if (e.type === 'waveStarted') {
          const allPrevCleared = Array.from({ length: e.wave - 1 }, (_, i) => i + 1).every((w) => cleared.has(w));
          expect(e.early).toBe(!allPrevCleared);
          expect(e.earlyBonus).toBe(e.early ? RULES.earlyCallBonus : 0);
        }
      }

      // Her düşman tek kez çıkar, tek kez ölür/sızar; öldükten sonra isabet almaz.
      const finished = new Set<number>();
      const spawned = new Set<number>();
      for (const e of events) {
        if (e.type === 'enemySpawned') {
          expect(spawned.has(e.enemyId)).toBe(false);
          spawned.add(e.enemyId);
        }
        if (e.type === 'enemyHit') expect(finished.has(e.enemyId)).toBe(false);
        if (e.type === 'enemyKilled' || e.type === 'enemyLeaked') {
          expect(finished.has(e.enemyId)).toBe(false);
          finished.add(e.enemyId);
        }
      }

      // Altın ve can muhasebesi olaylarla birebir tutar.
      let gold2 = gold;
      let lives = RULES.startingLives;
      for (const e of events) {
        if (e.type === 'enemyKilled') gold2 += e.reward;
        else if (e.type === 'waveCleared') gold2 += e.bonus;
        else if (e.type === 'waveStarted') gold2 += e.earlyBonus;
        else if (e.type === 'towerSold') gold2 += e.refund;
        else if (e.type === 'towerBuilt') gold2 -= sim.towerDefs[e.kind].levels[0].cost;
        else if (e.type === 'towerUpgraded') gold2 -= sim.towerDefs[e.kind].levels[e.level - 1]!.cost;
        else if (e.type === 'enemyLeaked') lives -= e.damage;
      }
      expect(st.gold).toBe(gold2);
      expect(st.lives).toBe(Math.max(0, lives));

      if (st.status === 'victory') {
        expect([...cleared].sort((a, b) => a - b)).toEqual(sim.waves.map((_, i) => i + 1));
        const total = sim.waves.reduce((n, w) => n + buildSpawnSchedule(w).length, 0);
        expect(spawned.size).toBe(total);
        expect(finished.size).toBe(total);
        expect(st.enemies).toEqual([]);
        expect(events[end - 1]!.type).toBe('waveCleared');
        expect(st.lives).toBeGreaterThan(0);
      } else {
        expect(st.status).toBe('defeat');
        expect(st.lives).toBe(0);
        expect(events[end - 1]!.type).toBe('enemyLeaked');
      }
    });
  }
});
