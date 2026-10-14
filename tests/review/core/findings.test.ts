// İnceleme (çekirdek kuralları): bulguları kanıtlayan testler. Kırmızı olanlar hatanın kanıtıdır; düzeltilince yeşile döner.

import { describe, expect, it } from 'vitest';
import { FIXED_STEP, TILE } from '../../../src/config';
import { combineSlow } from '../../../src/core/combat';
import { TOWERS } from '../../../src/core/data/towers';
import { MAX_FRAME_DT } from '../../../src/core/simulation';
import type { TowerDef } from '../../../src/core/types';
import { TEST_TOWERS, enemiesWith, group, makeSim, ofType, step, stepUntil, wave } from '../../core/fixtures';

describe('2x hız ve dt kırpma', () => {
  it('2x hızda yavaş karelerde simülasyon 2 kat ilerlemez (dt iki kez kırpılıyor)', () => {
    // GameScene.update: dt = min(delta, MAX_FRAME_DT); sim.update(dt * hız). Phaser'ın smoothDelta'sı kareyi en fazla
    // 200 ms'ye (minFps 5) kırpar. 2x'te 0.4 sn istenir ama çekirdek ikinci kez 0.25 sn'ye kırpar.
    const sim = makeSim();
    const delta = 0.2;
    const dt = Math.min(delta, MAX_FRAME_DT);
    sim.update(dt * 2);
    expect(sim.state.time).toBeCloseTo(2 * delta, 9); // gerçekte 0.25: 2x yerine 1.25x
  });
});

describe('yavaşlatma süresi', () => {
  it('slowDuration kadar yavaşlatır, bir adım eksik değil', () => {
    // Tek atışlık buz: ×0.5, 1 sn; sonraki atış 10 sn sonra (ölçümü bozmasın).
    const frost: TowerDef = {
      ...TEST_TOWERS.frost,
      levels: [
        { cost: 15, damage: 1, fireInterval: 10, range: 2, slowFactor: 0.5, slowDuration: 1 },
        TEST_TOWERS.frost.levels[1],
        TEST_TOWERS.frost.levels[2],
      ],
    };
    const sim = makeSim({ towers: { ...TEST_TOWERS, frost }, enemies: enemiesWith({ runner: { maxHp: 100000 } }) });
    sim.build('frost', { col: 2, row: 1 });
    sim.startNextWave();
    stepUntil(sim, (b) => b.some((e) => e.type === 'pulse'));
    const d0 = sim.state.enemies[0]!.distance;
    step(sim, 60); // yavaşlatmanın tam 1 saniyesi
    const moved = sim.state.enemies[0]!.distance - d0;
    // 1 sn × 48 piksel/sn × 0.5 = 24 piksel. Gerçekte 24.4: son adım (t + 1.0) tam hızla atılıyor,
    // çünkü moveEnemies `time >= slowUntil` olunca hareketten ÖNCE çarpanı 1'e döndürüyor.
    expect(moved).toBeCloseTo(0.5 * TILE * 1, 9);
  });

  it('atış aralığı = süre olan buzda, düşman her atış öncesi bir adım tam hızla kaçar', () => {
    // TEST_TOWERS.frost 1. seviye: aralık 1 sn, süre 1 sn → menzilde kesintisiz ×0.5 beklenir.
    const sim = makeSim({ enemies: enemiesWith({ runner: { maxHp: 100000 } }) });
    sim.build('frost', { col: 2, row: 1 });
    sim.startNextWave();
    stepUntil(sim, (b) => b.some((e) => e.type === 'pulse'));
    const fullSpeedSteps: number[] = [];
    for (let i = 0; i < 180; i++) {
      const before = sim.state.enemies[0]!.distance;
      step(sim, 1);
      const delta = sim.state.enemies[0]!.distance - before;
      if (delta > 0.5) fullSpeedSteps.push(i); // 0.4 = yavaş, 0.8 = tam hız
    }
    expect(fullSpeedSteps).toEqual([]); // gerçekte her 60 adımda bir tam hız adımı: [59, 119, 179]
  });
});

describe('yavaşlatma birleştirme', () => {
  it('zayıf buz kulesi, güçlü buzun çarpanını süresi bittikten sonra da sürdürmemeli', () => {
    // Gerçek denge verileri: 3. seviye buz ×0.5 / 2 sn, 1. seviye buz ×0.7 / 1.5 sn (aralık 1.2 sn).
    // Düşman önce 3. seviye buzun menzilinden geçer, sonra 1. seviye buzların kesintisiz menzilinde yürür.
    const sim = makeSim({ towers: TOWERS, enemies: enemiesWith({ runner: { maxHp: 100000 } }) });
    expect(sim.build('frost', { col: 1, row: 1 }).ok).toBe(true);
    sim.upgrade(1);
    sim.upgrade(1);
    for (const col of [4, 6, 8, 10, 12, 14, 16]) expect(sim.build('frost', { col, row: 1 }).ok).toBe(true);
    sim.startNextWave();

    let lastStrongPulse = -1;
    const deadline = 60 * 60;
    for (let i = 0; i < deadline; i++) {
      const events = sim.update(FIXED_STEP);
      if (ofType(events, 'pulse').some((p) => p.towerId === 1)) lastStrongPulse = sim.state.time;
      // 3. seviye buzun son atışının etkisi (2 sn) bitti, üstüne 1 sn pay.
      if (lastStrongPulse > 0 && sim.state.time > lastStrongPulse + 3) break;
    }
    const e = sim.state.enemies[0]!;
    expect(e.pos.x).toBeLessThan(16 * TILE); // hâlâ 1. seviye buzların menzilinde
    // Güçlü etkinin süresi çoktan bitti; geçerli olan sadece 1. seviye buzun ×0.7'si olmalı.
    // Gerçekte 0.5: combineSlow en güçlü çarpanı en uzun süreye taşıdığı için her ×0.7 atışı ×0.5'i yeniden uzatır.
    expect(e.speedMultiplier).toBeCloseTo(0.7, 9);
  });

  it('combineSlow: süresi kısa güçlü etki, sonradan gelen zayıf etkiyle sonsuza uzar', () => {
    let slow = combineSlow({ multiplier: 1, until: 0 }, 0, 0.5, 2); // ×0.5, 2 sn'de biter
    for (let t = 1; t <= 10; t += 1) slow = combineSlow(slow, t, 0.7, 1.5); // her saniye ×0.7 / 1.5 sn
    // 10. saniyede ×0.5 etkisi 8 sn önce bitmişti; beklenen ×0.7.
    expect(slow.multiplier).toBe(0.7); // gerçekte 0.5
  });
});

describe('referans: mevcut kurallar (geçmeli)', () => {
  it('erken çağrılan son dalga temizlense de önceki dalga sahadayken zafer gelmez', () => {
    const tough = enemiesWith({ brute: { maxHp: 100000 } });
    const sim = makeSim({ enemies: tough, waves: [wave(group('brute', 1)), wave(group('runner', 1))] });
    sim.build('laser', { col: 2, row: 1 });
    sim.upgrade(1);
    sim.upgrade(1);
    sim.startNextWave();
    step(sim, 1);
    expect(sim.startNextWave()).toEqual({ ok: true });
    const events = stepUntil(sim, (b) => b.some((e) => e.type === 'waveCleared'));
    expect(ofType(events, 'waveCleared').map((e) => e.wave)).toEqual([2]);
    expect(sim.state.status).toBe('wave');
    expect(ofType(events, 'victory')).toEqual([]);
  });
});
