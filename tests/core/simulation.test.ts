import { describe, expect, it } from 'vitest';
import { FIXED_STEP, TILE } from '../../src/config';
import { applyArmor, combineSlow, refundFor, scaledHp, starsFor } from '../../src/core/combat';
import { ENEMIES } from '../../src/core/data/enemies';
import { tileCenter } from '../../src/core/grid';
import { buildSpawnSchedule } from '../../src/core/schedule';
import { MAX_FRAME_DT, Simulation } from '../../src/core/simulation';
import type { EnemyState, GameEvent } from '../../src/core/types';
import {
  L_MAP,
  LINE_MAP,
  SHORT_MAP,
  TEST_RULES,
  TEST_TOWERS,
  enemiesWith,
  group,
  makeSim,
  ofType,
  step,
  stepUntil,
  wave,
} from './fixtures';

const isOver = (sim: Simulation) => sim.state.status === 'victory' || sim.state.status === 'defeat';
const enemy = (sim: Simulation, id: number): EnemyState => {
  const found = sim.state.enemies.find((e) => e.id === id);
  if (!found) throw new Error(`${id} numaralı düşman sahada yok`);
  return found;
};
/** Kule karosunun merkezinden düşmana uzaklık (piksel). */
const distTo = (col: number, row: number, e: EnemyState) => {
  const c = tileCenter({ col, row });
  return Math.hypot(e.pos.x - c.x, e.pos.y - c.y);
};

describe('başlangıç ve durum', () => {
  it('kurallardaki altın ve canla, "building" durumunda başlar', () => {
    const sim = makeSim({ waves: [wave(group('runner', 1)), wave(group('scout', 1))] });
    expect(sim.state).toEqual({
      time: 0,
      status: 'building',
      gold: 1000,
      lives: 10,
      wavesStarted: 0,
      totalWaves: 2,
      spawningDone: true,
      enemies: [],
      towers: [],
      projectiles: [],
      stars: 0,
    });
  });

  it('state okumak ucuzdur: diziler kopyalanmaz, okumak hiçbir şeyi değiştirmez', () => {
    const sim = makeSim();
    sim.build('laser', { col: 1, row: 0 });
    const a = sim.state;
    const b = sim.state;
    expect(a.towers).toBe(b.towers);
    expect(a.enemies).toBe(b.enemies);
    expect(a).toEqual(b);
  });

  it('pathPoints yolun piksel çoklu çizgisidir', () => {
    const sim = makeSim({ map: L_MAP });
    expect(sim.pathPoints).toEqual(L_MAP.waypoints.map(tileCenter));
  });

  it('varsayılan veriyle (MAP_1) kurulur', () => {
    const sim = new Simulation();
    expect(sim.pathPoints.length).toBe(sim.map.waypoints.length);
    expect(sim.state.totalWaves).toBe(sim.waves.length);
    expect(sim.enemyMaxHp('runner', 1)).toBe(ENEMIES.runner.maxHp);
  });
});

describe('kurma, yükseltme, satma', () => {
  it('canPlace: harita dışı, yol, engel, dolu ve uygun karolar', () => {
    const sim = makeSim();
    expect(sim.canPlace({ col: -1, row: 0 })).toEqual({ ok: false, reason: 'outOfBounds' });
    expect(sim.canPlace({ col: 20, row: 0 })).toEqual({ ok: false, reason: 'outOfBounds' });
    expect(sim.canPlace({ col: 0, row: 5 })).toEqual({ ok: false, reason: 'outOfBounds' });
    expect(sim.canPlace({ col: 1.5, row: 0 })).toEqual({ ok: false, reason: 'outOfBounds' });
    expect(sim.canPlace({ col: 0, row: 2 })).toEqual({ ok: false, reason: 'onPath' });
    expect(sim.canPlace({ col: 3, row: 0 })).toEqual({ ok: false, reason: 'blocked' });
    expect(sim.canPlace({ col: 1, row: 0 })).toEqual({ ok: true });
    sim.build('laser', { col: 1, row: 0 });
    expect(sim.canPlace({ col: 1, row: 0 })).toEqual({ ok: false, reason: 'occupied' });
  });

  it('isPathTile yolun harita içi karolarını bilir', () => {
    const sim = makeSim();
    expect(sim.isPathTile({ col: 0, row: 2 })).toBe(true);
    expect(sim.isPathTile({ col: 19, row: 2 })).toBe(true);
    expect(sim.isPathTile({ col: -1, row: 2 })).toBe(false);
    expect(sim.isPathTile({ col: 0, row: 1 })).toBe(false);
  });

  it('kule kurar, altını düşer; olay sonraki update(0) ile gelir ve zaman ilerlemez', () => {
    const sim = makeSim();
    expect(sim.build('laser', { col: 1, row: 0 })).toEqual({ ok: true });
    expect(sim.state.gold).toBe(990);
    const tower = sim.towerAt({ col: 1, row: 0 })!;
    expect(tower).toMatchObject({ id: 1, kind: 'laser', level: 1, tile: { col: 1, row: 0 }, targetId: null, invested: 10 });
    expect(tower.pos).toEqual(tileCenter({ col: 1, row: 0 }));
    expect(sim.towerById(1)).toBe(tower);
    expect(sim.state.towers).toEqual([tower]);

    expect(sim.update(0)).toEqual([
      { type: 'towerBuilt', towerId: 1, kind: 'laser', tile: { col: 1, row: 0 }, pos: tileCenter({ col: 1, row: 0 }) },
    ]);
    expect(sim.state.time).toBe(0);
    expect(sim.update(0)).toEqual([]);
  });

  it('başarısız kurma hiçbir şeyi değiştirmez ve kimlik harcamaz', () => {
    const sim = makeSim({ rules: { ...TEST_RULES, startingGold: 15 } });
    expect(sim.build('cannon', { col: 1, row: 0 })).toEqual({ ok: false, reason: 'notEnoughGold' });
    expect(sim.build('laser', { col: 0, row: 2 })).toEqual({ ok: false, reason: 'onPath' });
    expect(sim.build('laser', { col: 3, row: 0 })).toEqual({ ok: false, reason: 'blocked' });
    expect(sim.build('laser', { col: 25, row: 0 })).toEqual({ ok: false, reason: 'outOfBounds' });
    expect(sim.state.gold).toBe(15);
    expect(sim.state.towers).toEqual([]);
    expect(sim.update(0)).toEqual([]);

    expect(sim.build('laser', { col: 1, row: 0 })).toEqual({ ok: true });
    expect(sim.build('laser', { col: 1, row: 0 })).toEqual({ ok: false, reason: 'occupied' });
    expect(sim.state.towers.map((t) => t.id)).toEqual([1]);
    expect(sim.state.gold).toBe(5);
  });

  it('yükseltme: bedel, seviye, yatırım, en üst seviye ve olaylar', () => {
    const sim = makeSim();
    sim.build('laser', { col: 1, row: 0 });
    sim.update(0);
    expect(sim.upgradeCost(1)).toBe(20);
    expect(sim.upgrade(1)).toEqual({ ok: true });
    expect(sim.towerById(1)).toMatchObject({ level: 2, invested: 30 });
    expect(sim.state.gold).toBe(970);
    expect(sim.upgradeCost(1)).toBe(30);
    expect(sim.upgrade(1)).toEqual({ ok: true });
    expect(sim.upgradeCost(1)).toBeNull();
    expect(sim.upgrade(1)).toEqual({ ok: false, reason: 'maxLevel' });
    expect(sim.state.gold).toBe(940);
    const pos = tileCenter({ col: 1, row: 0 });
    expect(sim.update(0)).toEqual([
      { type: 'towerUpgraded', towerId: 1, kind: 'laser', level: 2, pos },
      { type: 'towerUpgraded', towerId: 1, kind: 'laser', level: 3, pos },
    ]);
    expect(sim.upgrade(99)).toEqual({ ok: false, reason: 'noTower' });
    expect(sim.upgradeCost(99)).toBeNull();
  });

  it('altın yetmezse yükseltme hiçbir şeyi değiştirmez', () => {
    const sim = makeSim({ rules: { ...TEST_RULES, startingGold: 25 } });
    sim.build('laser', { col: 1, row: 0 });
    sim.update(0);
    expect(sim.upgrade(1)).toEqual({ ok: false, reason: 'notEnoughGold' });
    expect(sim.towerById(1)).toMatchObject({ level: 1, invested: 10 });
    expect(sim.state.gold).toBe(15);
    expect(sim.update(0)).toEqual([]);
  });

  it('satış harcananın %70ini (aşağı yuvarlanmış) geri verir ve karoyu boşaltır', () => {
    const sim = makeSim();
    sim.build('laser', { col: 1, row: 0 });
    sim.upgrade(1);
    sim.update(0);
    expect(sim.sellValue(1)).toBe(21);
    expect(sim.sell(1)).toEqual({ ok: true });
    expect(sim.state.gold).toBe(1000 - 30 + 21);
    expect(sim.towerAt({ col: 1, row: 0 })).toBeUndefined();
    expect(sim.towerById(1)).toBeUndefined();
    expect(sim.state.towers).toEqual([]);
    expect(sim.canPlace({ col: 1, row: 0 })).toEqual({ ok: true });
    expect(sim.update(0)).toEqual([
      { type: 'towerSold', towerId: 1, kind: 'laser', refund: 21, tile: { col: 1, row: 0 }, pos: tileCenter({ col: 1, row: 0 }) },
    ]);
    expect(sim.sell(1)).toEqual({ ok: false, reason: 'noTower' });
    expect(sim.sellValue(1)).toBe(0);
  });

  it('satış geri ödemesi kayan nokta hatasına düşmez (140 × 0.7 = 98)', () => {
    expect(refundFor(140, 0.7)).toBe(98);
    expect(refundFor(125, 0.7)).toBe(87);
  });

  it('kimlikler artar ve asla tekrar kullanılmaz', () => {
    const sim = makeSim({ waves: [wave(group('runner', 3, 0.5))] });
    sim.build('laser', { col: 1, row: 0 });
    sim.sell(1);
    sim.build('laser', { col: 1, row: 0 });
    sim.build('cannon', { col: 2, row: 0 });
    expect(sim.state.towers.map((t) => t.id)).toEqual([2, 3]);
    sim.startNextWave();
    const events = step(sim, 120);
    expect(ofType(events, 'enemySpawned').map((e) => e.enemyId)).toEqual([1, 2, 3]);
  });

  it('komut olayları adım olaylarından önce, sırasıyla gelir', () => {
    const sim = makeSim();
    sim.build('laser', { col: 10, row: 0 });
    sim.startNextWave();
    const events = sim.update(FIXED_STEP);
    expect(events.map((e) => e.type)).toEqual(['towerBuilt', 'waveStarted', 'enemySpawned']);
  });
});

describe('zaman', () => {
  it('sabit adımla ilerler ve dt en fazla 0.25 sn kabul edilir', () => {
    const sim = makeSim();
    sim.update(1);
    expect(sim.state.time).toBeCloseTo(MAX_FRAME_DT, 12);
    expect(MAX_FRAME_DT).toBe(0.25);
  });

  it('adımdan kısa dt birikir', () => {
    const sim = makeSim();
    sim.update(0.01);
    expect(sim.state.time).toBe(0);
    sim.update(0.01);
    expect(sim.state.time).toBeCloseTo(FIXED_STEP, 12);
  });

  it('negatif, NaN ve sonsuz dt zamanı ilerletmez', () => {
    const sim = makeSim();
    sim.update(-1);
    sim.update(Number.NaN);
    sim.update(Number.POSITIVE_INFINITY);
    expect(sim.state.time).toBe(0);
  });

  it('dt nasıl bölünürse bölünsün sonuç aynıdır', () => {
    const play = (dt: number, calls: number) => {
      const sim = makeSim({ waves: [wave(group('runner', 6, 0.4), group('brute', 2, 1, 1), group('scout', 4, 0.3, 2))] });
      sim.build('laser', { col: 4, row: 1 });
      sim.build('cannon', { col: 8, row: 0 });
      sim.build('frost', { col: 6, row: 3 });
      sim.startNextWave();
      const events: GameEvent[] = [];
      for (let i = 0; i < calls; i++) events.push(...sim.update(dt));
      return JSON.stringify({ state: sim.state, events });
    };
    const reference = play(FIXED_STEP, 600);
    expect(play(2 * FIXED_STEP, 300)).toBe(reference);
    expect(play(0.1, 100)).toBe(reference);
  });
});

describe('dalgalar ve düşman çıkışı', () => {
  it('çıkış listesi zamana göre sıralıdır; eşitlikte grup sırası korunur', () => {
    const schedule = buildSpawnSchedule(wave(group('scout', 2, 0.5, 2), group('runner', 3, 1, 0)));
    expect(schedule.map((s) => [s.time, s.enemy])).toEqual([
      [0, 'runner'],
      [1, 'runner'],
      [2, 'scout'],
      [2, 'runner'],
      [2.5, 'scout'],
    ]);
  });

  it('gruplar delay/interval/count ile, doğru anda çıkar', () => {
    const sim = makeSim({ waves: [wave(group('runner', 3, 1, 0), group('scout', 2, 0.5, 2))] });
    expect(sim.startNextWave()).toEqual({ ok: true });
    expect(sim.state.status).toBe('wave');
    expect(sim.state.spawningDone).toBe(false);
    const spawns: { time: number; kind: string; wave: number }[] = [];
    for (let i = 0; i < 180; i++) {
      for (const e of ofType(sim.update(FIXED_STEP), 'enemySpawned')) spawns.push({ time: sim.state.time, kind: e.kind, wave: e.wave });
    }
    expect(spawns.map((s) => s.kind)).toEqual(['runner', 'runner', 'runner', 'scout', 'scout']);
    expect(spawns.every((s) => s.wave === 1)).toBe(true);
    const expected = [0, 1, 2, 2, 2.5];
    spawns.forEach((s, i) => {
      expect(s.time).toBeGreaterThanOrEqual(expected[i]! - 1e-9);
      expect(s.time).toBeLessThanOrEqual(expected[i]! + FIXED_STEP + 1e-9);
    });
    expect(sim.state.spawningDone).toBe(true);
  });

  it('düşman canı dalgayla büyür (en yakın tam sayıya yuvarlanır)', () => {
    const sim = makeSim({
      rules: { ...TEST_RULES, hpGrowthPerWave: 0.15 },
      waves: [wave(group('runner', 1)), wave(group('brute', 1))],
    });
    expect(sim.enemyMaxHp('runner', 1)).toBe(10);
    expect(sim.enemyMaxHp('runner', 3)).toBe(13);
    expect(sim.enemyMaxHp('brute', 2)).toBe(115);
    expect(scaledHp(15, 0.1, 2)).toBe(17); // 16.5 yukarı yuvarlanır
    sim.startNextWave();
    stepUntil(sim, () => sim.state.status === 'building');
    sim.startNextWave();
    step(sim, 1);
    expect(sim.state.enemies[0]).toMatchObject({ kind: 'brute', wave: 2, hp: 115, maxHp: 115, armor: 3 });
  });

  it('nextWavePreview sıradaki dalgayı türlere göre sayar', () => {
    const sim = makeSim({ waves: [wave(group('runner', 2), group('brute', 1), group('runner', 3)), wave(group('scout', 4))] });
    expect(sim.nextWavePreview()).toEqual({ wave: 1, counts: { runner: 5, brute: 1 } });
    sim.startNextWave();
    expect(sim.nextWavePreview()).toEqual({ wave: 2, counts: { scout: 4 } });
    stepUntil(sim, () => sim.state.spawningDone);
    expect(sim.startNextWave()).toEqual({ ok: true });
    expect(sim.nextWavePreview()).toBeNull();
  });

  it('dalga sürerken bütün düşmanlar çıkmadan sonraki dalga çağrılamaz', () => {
    const sim = makeSim({ waves: [wave(group('runner', 2, 1)), wave(group('scout', 1))] });
    sim.startNextWave();
    sim.update(0);
    expect(sim.startNextWave()).toEqual({ ok: false, reason: 'waveInProgress' });
    expect(sim.state.wavesStarted).toBe(1);
    expect(sim.state.gold).toBe(1000);
    expect(sim.update(0)).toEqual([]);
  });

  it('erken çağırma: dalgalar üst üste biner, ödül verilir, her dalga bir kez temizlenir', () => {
    const sim = makeSim({ map: SHORT_MAP, waves: [wave(group('runner', 2, 1)), wave(group('scout', 1))] });
    sim.startNextWave();
    expect(sim.update(0)).toEqual([{ type: 'waveStarted', wave: 1, early: false, earlyBonus: 0 }]);
    stepUntil(sim, () => sim.state.spawningDone);
    expect(sim.state.status).toBe('wave');

    expect(sim.startNextWave()).toEqual({ ok: true });
    expect(sim.state.gold).toBe(1007);
    expect(sim.state.wavesStarted).toBe(2);
    expect(sim.state.spawningDone).toBe(false);
    const first = step(sim, 1);
    expect(first[0]).toEqual({ type: 'waveStarted', wave: 2, early: true, earlyBonus: 7 });
    // İki dalganın düşmanları aynı anda sahada
    expect(sim.state.enemies.map((e) => e.wave)).toEqual([1, 1, 2]);

    const events = [...first, ...stepUntil(sim, () => isOver(sim))];
    const cleared = ofType(events, 'waveCleared');
    expect(cleared.map((e) => e.wave).sort()).toEqual([1, 2]);
    expect(cleared.find((e) => e.wave === 1)!.bonus).toBe(15);
    expect(cleared.find((e) => e.wave === 2)!.bonus).toBe(20);
    expect(sim.state.status).toBe('victory');
    expect(sim.state.gold).toBe(1007 + 15 + 20);
  });

  it('erken çağrılan dalgada önceki dalganın düşmanları hâlâ sahadadır', () => {
    const sim = makeSim({ waves: [wave(group('runner', 1)), wave(group('runner', 1))] });
    sim.startNextWave();
    step(sim, 30);
    sim.startNextWave();
    step(sim, 1);
    expect(sim.state.enemies.map((e) => e.wave)).toEqual([1, 2]);
    expect(sim.state.status).toBe('wave');
  });

  it('dalga ödülü bir kez verilir ve durum "building"e döner', () => {
    const sim = makeSim({ map: SHORT_MAP, waves: [wave(group('runner', 2, 0.5)), wave(group('runner', 1))] });
    sim.startNextWave();
    const events = stepUntil(sim, () => sim.state.status === 'building');
    expect(ofType(events, 'waveCleared')).toEqual([{ type: 'waveCleared', wave: 1, bonus: 15 }]);
    expect(sim.state.gold).toBe(1015);
    expect(ofType(step(sim, 300), 'waveCleared')).toEqual([]);
    expect(sim.state.gold).toBe(1015);
  });

  it('bütün dalgalar başlatıldıysa yenisi çağrılamaz', () => {
    const sim = makeSim();
    sim.startNextWave();
    step(sim, 2);
    expect(sim.state.spawningDone).toBe(true);
    expect(sim.startNextWave()).toEqual({ ok: false, reason: 'noMoreWaves' });
  });
});

describe('hareket', () => {
  it('düşman speed × TILE piksel/sn ile yol boyunca ilerler', () => {
    const sim = makeSim({ waves: [wave(group('runner', 1), group('scout', 1))] });
    sim.startNextWave();
    step(sim, 60);
    const [runner, scout] = sim.state.enemies;
    expect(runner!.distance).toBeCloseTo(TILE, 6);
    expect(runner!.pos.x).toBeCloseTo(-0.5 * TILE + TILE, 6);
    expect(runner!.pos.y).toBeCloseTo(2.5 * TILE, 6);
    expect(runner!.heading).toBe(0);
    expect(scout!.distance).toBeCloseTo(2 * TILE, 6);
  });

  it('köşeden sonra yönü değişir', () => {
    const sim = makeSim({ map: L_MAP });
    sim.startNextWave();
    step(sim, 300); // 300 × 0.8 = 240 piksel: köşeden (192) 48 piksel sonra
    const e = sim.state.enemies[0]!;
    expect(e.pos.x).toBeCloseTo(3.5 * TILE, 6);
    expect(e.pos.y).toBeCloseTo(2.5 * TILE, 6);
    expect(e.heading).toBeCloseTo(Math.PI / 2);
  });

  it('sızan düşman ödül vermez, leakDamage kadar can götürür', () => {
    const sim = makeSim({ map: SHORT_MAP, waves: [wave(group('brute', 1))] });
    sim.startNextWave();
    const events = stepUntil(sim, (b) => b.some((e) => e.type === 'enemyLeaked'));
    expect(ofType(events, 'enemyLeaked')).toEqual([{ type: 'enemyLeaked', enemyId: 1, kind: 'brute', damage: 2 }]);
    expect(ofType(events, 'enemyKilled')).toEqual([]);
    expect(sim.state.lives).toBe(8);
    expect(sim.state.enemies).toEqual([]);
    expect(sim.state.gold).toBe(1000 + 15); // sadece dalga ödülü
  });
});

describe('hedef seçimi', () => {
  it('menzildekilerden yolda en ileride olanı seçer (kimliği büyük olsa bile)', () => {
    // Koşucu (1) önce çıkar, çevik (2) sonra çıkıp onu geçer.
    const sim = makeSim({ waves: [wave(group('runner', 1), group('scout', 1, 1, 1))] });
    sim.startNextWave();
    step(sim, 150);
    expect(enemy(sim, 2).distance).toBeGreaterThan(enemy(sim, 1).distance);
    expect(distTo(2, 0, enemy(sim, 1))).toBeLessThanOrEqual(3 * TILE);
    sim.build('laser', { col: 2, row: 0 });
    const events = step(sim, 1);
    expect(sim.towerById(1)!.targetId).toBe(2);
    expect(ofType(events, 'enemyHit').map((e) => e.enemyId)).toEqual([2]); // kurulunca hemen ateş eder
  });

  it('hedef menzilde ve canlı kaldıkça kilitli kalır; menzilden çıkınca yeniden seçer', () => {
    const tough = enemiesWith({ runner: { maxHp: 100000 }, scout: { maxHp: 100000 } });
    const sim = makeSim({ enemies: tough, waves: [wave(group('runner', 2, 1.5), group('scout', 1, 1, 1))] });
    sim.build('laser', { col: 2, row: 0 });
    sim.startNextWave();
    // Kimlikler çıkış sırasıyla: koşucu 1 (0 sn), çevik 2 (1 sn), koşucu 3 (1.5 sn).
    step(sim, 140);
    expect(enemy(sim, 2).distance).toBeGreaterThan(enemy(sim, 1).distance); // çevik öne geçti
    expect(distTo(2, 0, enemy(sim, 2))).toBeLessThanOrEqual(3 * TILE);
    expect(sim.towerById(1)!.targetId).toBe(1); // ama kule koşucuda kalır

    step(sim, 180); // koşucu 1 menzilden çıktı (x > 227 piksel)
    expect(distTo(2, 0, enemy(sim, 1))).toBeGreaterThan(3 * TILE);
    expect(sim.towerById(1)!.targetId).toBe(3);
    const tower = sim.towerById(1)!;
    const target = enemy(sim, 3);
    expect(tower.aimAngle).toBeCloseTo(Math.atan2(target.pos.y - tower.pos.y, target.pos.x - tower.pos.x));
  });

  it('hedef ölünce yenisini seçer', () => {
    const sim = makeSim({ waves: [wave(group('runner', 2, 1))] });
    sim.build('laser', { col: 2, row: 0 });
    sim.startNextWave();
    const events = stepUntil(sim, () => sim.state.status !== 'wave');
    expect(ofType(events, 'enemyHit').map((e) => e.enemyId)).toEqual([1, 1, 2, 2]);
    expect(ofType(events, 'enemyKilled').map((e) => e.enemyId)).toEqual([1, 2]);
    expect(sim.towerById(1)!.targetId).toBeNull();
  });

  it('menzil dışındaki düşmana ateş etmez', () => {
    const sim = makeSim();
    sim.build('laser', { col: 19, row: 4 }); // yolun sonunda; düşman 5 sn'de oraya varamaz
    sim.startNextWave();
    const events = step(sim, 60 * 5);
    expect(distTo(19, 4, sim.state.enemies[0]!)).toBeGreaterThan(3 * TILE);
    expect(ofType(events, 'shot')).toEqual([]);
    expect(sim.towerById(1)!.targetId).toBeNull();
  });
});

describe('lazer (hitscan)', () => {
  it('atış anında hasar verir; ışın kuleden düşmanın konumuna gider', () => {
    const sim = makeSim({ enemies: enemiesWith({ runner: { maxHp: 1000 } }) });
    sim.build('laser', { col: 2, row: 0 });
    sim.startNextWave();
    const events = stepUntil(sim, (b) => b.some((e) => e.type === 'shot'));
    const shot = ofType(events, 'shot')[0]!;
    const hit = ofType(events, 'enemyHit')[0]!;
    expect(shot).toMatchObject({ towerId: 1, kind: 'laser', from: tileCenter({ col: 2, row: 0 }) });
    expect(shot.to).toEqual(hit.pos);
    expect(hit).toMatchObject({ enemyId: 1, damage: 5 });
    expect(sim.state.enemies[0]!.hp).toBe(995);
  });

  it('her fireInterval saniyede bir ateş eder', () => {
    const sim = makeSim({ enemies: enemiesWith({ runner: { maxHp: 100000 } }) });
    sim.build('laser', { col: 2, row: 0 });
    sim.startNextWave();
    const times: number[] = [];
    for (let i = 0; i < 240; i++) {
      if (sim.update(FIXED_STEP).some((e) => e.type === 'shot')) times.push(sim.state.time);
    }
    expect(times.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < times.length; i++) expect(times[i]! - times[i - 1]!).toBeCloseTo(0.5, 9);
  });

  it('olaylardaki konumlar o anın kopyasıdır, sonradan değişmez', () => {
    const sim = makeSim({ enemies: enemiesWith({ runner: { maxHp: 1000 } }) });
    sim.build('laser', { col: 2, row: 0 });
    sim.startNextWave();
    const events = stepUntil(sim, (b) => b.some((e) => e.type === 'enemyHit'));
    const hit = ofType(events, 'enemyHit')[0]!;
    const snapshot = { ...hit.pos };
    step(sim, 30);
    expect(hit.pos).toEqual(snapshot);
    expect(sim.state.enemies[0]!.pos.x).toBeGreaterThan(snapshot.x);
  });
});

describe('zırh', () => {
  it('isabet başına max(1, hasar − zırh)', () => {
    expect(applyArmor(5, 3)).toBe(2);
    expect(applyArmor(1, 3)).toBe(1);
    expect(applyArmor(10, 0)).toBe(10);

    const sim = makeSim({ waves: [wave(group('brute', 1))] });
    sim.build('laser', { col: 1, row: 0 });
    sim.build('frost', { col: 1, row: 1 });
    sim.startNextWave();
    const events = step(sim, 60);
    const damages = new Set(ofType(events, 'enemyHit').map((e) => e.damage));
    expect(damages).toEqual(new Set([2, 1])); // lazer 5 → 2, buz 1 → 1
  });
});

describe('top (projectile)', () => {
  it('mermi uçar, hedefi kovalar, varınca yarıçaptaki herkese tam hasar verir', () => {
    const tough = enemiesWith({ runner: { maxHp: 1000 } });
    // Üç koşucu üst üste (interval 0), dördüncüsü 0.6 sn (28.8 piksel) arkada: patlama yarıçapı (24) dışında.
    const sim = makeSim({ enemies: tough, waves: [wave(group('runner', 3, 0), group('runner', 1, 1, 0.6))] });
    sim.build('cannon', { col: 2, row: 0 });
    sim.startNextWave();

    const first = step(sim, 1);
    const shot = ofType(first, 'shot')[0]!;
    expect(shot).toMatchObject({ towerId: 1, kind: 'cannon', from: tileCenter({ col: 2, row: 0 }) });
    expect(ofType(first, 'enemyHit')).toEqual([]);
    expect(sim.state.projectiles).toHaveLength(1);
    expect(sim.state.projectiles[0]).toMatchObject({ id: 1, towerKind: 'cannon' });

    step(sim, 10);
    const p = sim.state.projectiles[0]!;
    expect(p.targetPos).toEqual(enemy(sim, 1).pos); // her adımda hedefin güncel konumuna yönelir

    const events = stepUntil(sim, (b) => b.some((e) => e.type === 'explosion'));
    const explosion = ofType(events, 'explosion')[0]!;
    expect(explosion.radius).toBe(0.5 * TILE);
    const hits = ofType(events, 'enemyHit');
    expect(hits.map((h) => h.enemyId).sort()).toEqual([1, 2, 3]);
    expect(hits.every((h) => h.damage === 10)).toBe(true);
    expect(enemy(sim, 4).hp).toBe(1000); // yarıçap dışında
    expect(sim.state.projectiles).toEqual([]);
  });

  it('zırh patlamadaki her düşmana ayrı uygulanır', () => {
    const sim = makeSim({ waves: [wave(group('brute', 2, 0))] });
    sim.build('cannon', { col: 2, row: 0 });
    sim.startNextWave();
    const events = stepUntil(sim, (b) => b.some((e) => e.type === 'explosion'));
    expect(ofType(events, 'enemyHit').map((h) => [h.enemyId, h.damage])).toEqual([
      [1, 7],
      [2, 7],
    ]);
  });

  it('hedef ölürse son bilinen konuma gider ve orada patlar', () => {
    // İkinci dalga var ki ilk dalga bitince zafer ilan edilip zaman durmasın.
    const sim = makeSim({ waves: [wave(group('runner', 1)), wave(group('runner', 1))] });
    // Top koşucuya x ≈ 50'de ateş eder; 3. seviye lazer (tek atışta öldürür) onu x ≈ 61'de, mermi varmadan öldürür.
    sim.build('cannon', { col: 4, row: 0 });
    sim.build('laser', { col: 3, row: 4 });
    sim.upgrade(2);
    sim.upgrade(2);
    sim.startNextWave();
    const events = stepUntil(sim, (b) => b.some((e) => e.type === 'explosion'));
    const killed = ofType(events, 'enemyKilled')[0]!;
    const explosion = ofType(events, 'explosion')[0]!;
    const shot = ofType(events, 'shot').find((e) => e.kind === 'cannon')!;
    expect(events.indexOf(shot)).toBeLessThan(events.indexOf(killed));
    expect(events.indexOf(killed)).toBeLessThan(events.indexOf(explosion));
    expect(ofType(events, 'enemyHit')).toHaveLength(1); // sadece lazer vurdu; patlamada kimse yok
    expect(explosion.pos.x).toBeCloseTo(killed.pos.x, 9);
    expect(explosion.pos.y).toBeCloseTo(killed.pos.y, 9);
  });

  it('kule satılsa da havadaki mermi patlar', () => {
    const sim = makeSim({ enemies: enemiesWith({ runner: { maxHp: 1000 } }) });
    sim.build('cannon', { col: 2, row: 0 });
    sim.startNextWave();
    step(sim, 1);
    expect(sim.state.projectiles).toHaveLength(1);
    sim.sell(1);
    const events = stepUntil(sim, (b) => b.some((e) => e.type === 'explosion'));
    expect(ofType(events, 'enemyHit')).toHaveLength(1);
  });
});

describe('buz (pulse)', () => {
  it('menzilde düşman yokken ateş etmez; ilk giren düşmana hemen ateş eder', () => {
    const sim = makeSim();
    sim.build('frost', { col: 2, row: 1 });
    sim.startNextWave();
    const range = 2 * TILE;
    let previousDistance = Infinity;
    for (let i = 0; i < 600; i++) {
      const events = sim.update(FIXED_STEP);
      const e = sim.state.enemies[0];
      const d = e ? distTo(2, 1, e) : Infinity;
      if (events.some((ev) => ev.type === 'pulse')) {
        expect(d).toBeLessThanOrEqual(range);
        expect(previousDistance).toBeGreaterThan(range);
        return;
      }
      expect(d).toBeGreaterThan(range);
      previousDistance = d;
    }
    throw new Error('buz kulesi hiç ateş etmedi');
  });

  it('menzildeki bütün düşmanlara vurur ve yavaşlatır', () => {
    // İki koşucu üst üste, üçüncüsü 1 sn geride (menzil dışında).
    const sim = makeSim({ waves: [wave(group('runner', 2, 0), group('runner', 1, 1, 1))] });
    sim.build('frost', { col: 2, row: 1 });
    sim.startNextWave();
    const events = stepUntil(sim, (b) => b.some((e) => e.type === 'pulse'));
    const pulse = ofType(events, 'pulse')[0]!;
    expect(pulse).toEqual({ type: 'pulse', towerId: 1, pos: tileCenter({ col: 2, row: 1 }), radius: 2 * TILE });
    const shot = ofType(events, 'shot')[0]!;
    expect(shot.from).toEqual(shot.to);
    const lastBatchHits = ofType(events, 'enemyHit').filter((h) => h.damage === 1);
    expect(lastBatchHits.map((h) => h.enemyId)).toEqual([1, 2]);
    const now = sim.state.time;
    for (const id of [1, 2]) {
      expect(enemy(sim, id).speedMultiplier).toBe(0.5);
      expect(enemy(sim, id).slowUntil).toBeCloseTo(now + 1, 9);
    }
    expect(enemy(sim, 3)).toMatchObject({ speedMultiplier: 1, slowUntil: 0, hp: 10 });
  });

  it('yavaşlatılan düşman yavaş ilerler, süre bitince eski hızına döner', () => {
    const sim = makeSim();
    sim.build('frost', { col: 2, row: 1 });
    sim.startNextWave();
    stepUntil(sim, (b) => b.some((e) => e.type === 'pulse'));
    const before = sim.state.enemies[0]!.distance;
    step(sim, 1);
    expect(sim.state.enemies[0]!.distance - before).toBeCloseTo(0.4, 9); // 0.8 × 0.5
    // Menzilden çıkıp son dalgadan 1 sn geçene kadar ilerle
    stepUntil(sim, () => distTo(2, 1, sim.state.enemies[0]!) > 2 * TILE);
    step(sim, 61);
    const e = sim.state.enemies[0]!;
    expect(e.speedMultiplier).toBe(1);
    expect(e.slowUntil).toBe(0);
    const d0 = e.distance;
    step(sim, 1);
    expect(sim.state.enemies[0]!.distance - d0).toBeCloseTo(0.8, 9);
  });

  it('üst üste yavaşlatma: en güçlü çarpan geçerli, süre en uzuna uzar, çarpılmaz', () => {
    const sim = makeSim();
    sim.build('frost', { col: 2, row: 1 }); // seviye 1: ×0.5, 1 sn
    sim.build('frost', { col: 2, row: 3 }); // seviye 2: ×0.8, 3 sn
    sim.upgrade(2);
    sim.startNextWave();
    const events = stepUntil(sim, (b) => b.some((e) => e.type === 'pulse'));
    expect(ofType(events, 'pulse').map((p) => p.towerId)).toEqual([1, 2]);
    const e = sim.state.enemies[0]!;
    expect(e.speedMultiplier).toBe(0.5);
    expect(e.slowUntil).toBeCloseTo(sim.state.time + 3, 9);
  });

  it('combineSlow kuralı', () => {
    const none = { multiplier: 1, until: 0 };
    expect(combineSlow(none, 10, 0.6, 2)).toEqual({ multiplier: 0.6, until: 12 });
    // güçlü ama kısa + zayıf ama uzun → güçlü çarpan, uzun süre
    expect(combineSlow({ multiplier: 0.4, until: 11 }, 10, 0.7, 3)).toEqual({ multiplier: 0.4, until: 13 });
    // zayıf ama uzun mevcut + güçlü kısa yeni
    expect(combineSlow({ multiplier: 0.7, until: 15 }, 10, 0.4, 1)).toEqual({ multiplier: 0.4, until: 15 });
    // süresi geçmiş etki sayılmaz
    expect(combineSlow({ multiplier: 0.2, until: 9 }, 10, 0.6, 1)).toEqual({ multiplier: 0.6, until: 11 });
    // etkisiz değerler
    expect(combineSlow(none, 10, 1, 2)).toBe(none);
    expect(combineSlow(none, 10, 0.5, 0)).toBe(none);
  });
});

describe('ödül, can, bitiş', () => {
  it('öldürülen düşmanın ödülü altına eklenir', () => {
    const sim = makeSim();
    sim.build('laser', { col: 2, row: 0 });
    sim.startNextWave();
    const events = stepUntil(sim, (b) => b.some((e) => e.type === 'enemyKilled'));
    const killed = ofType(events, 'enemyKilled')[0]!;
    expect(killed).toMatchObject({ enemyId: 1, kind: 'runner', reward: 5 });
    expect(sim.state.gold).toBe(1000 - 10 + 5 + 15); // tek düşmandı: dalga ödülü de aynı adımda
    expect(sim.state.enemies).toEqual([]);
  });

  it('can 0 olunca hemen yenilgi: sonraki olaylar üretilmez, zaman durur, komutlar reddedilir', () => {
    const sim = makeSim({
      map: SHORT_MAP,
      enemies: enemiesWith({ runner: { maxHp: 100000 } }),
      rules: { ...TEST_RULES, startingLives: 2 },
      waves: [wave(group('runner', 5, 0)), wave(group('runner', 1))],
    });
    sim.build('laser', { col: 0, row: 2 });
    sim.startNextWave();
    const events = stepUntil(sim, () => isOver(sim));
    const tail = events.slice(events.findIndex((e) => e.type === 'enemyLeaked'));
    expect(tail.map((e) => e.type)).toEqual(['enemyLeaked', 'enemyLeaked', 'defeat']);
    expect(sim.state.status).toBe('defeat');
    expect(sim.state.lives).toBe(0);
    expect(sim.state.stars).toBe(0);
    expect(sim.state.enemies).toHaveLength(3);

    const frozen = JSON.stringify(sim.state);
    expect(sim.update(1)).toEqual([]);
    expect(JSON.stringify(sim.state)).toBe(frozen);
    expect(sim.build('laser', { col: 1, row: 0 })).toEqual({ ok: false, reason: 'gameOver' });
    expect(sim.upgrade(1)).toEqual({ ok: false, reason: 'gameOver' });
    expect(sim.sell(1)).toEqual({ ok: false, reason: 'gameOver' });
    expect(sim.startNextWave()).toEqual({ ok: false, reason: 'gameOver' });
    expect(sim.update(0)).toEqual([]);
  });

  it.each([
    { leaks: 0, stars: 3 },
    { leaks: 1, stars: 2 },
    { leaks: 5, stars: 2 },
    { leaks: 6, stars: 1 },
  ])('son dalga temizlenince zafer: $leaks sızma → $stars yıldız', ({ leaks, stars }) => {
    const groups = leaks > 0 ? [group('runner', leaks, 0.2)] : [group('runner', 1)];
    const sim = makeSim({ map: SHORT_MAP, waves: [wave(...groups)] });
    if (leaks === 0) sim.build('laser', { col: 2, row: 0 });
    sim.startNextWave();
    const events = stepUntil(sim, () => isOver(sim));
    expect(events[events.length - 1]).toEqual({ type: 'victory', stars });
    expect(ofType(events, 'waveCleared')).toHaveLength(1);
    expect(sim.state).toMatchObject({ status: 'victory', stars, lives: 10 - leaks });

    const time = sim.state.time;
    expect(sim.update(1)).toEqual([]);
    expect(sim.state.time).toBe(time);
    expect(sim.startNextWave()).toEqual({ ok: false, reason: 'gameOver' });
    expect(sim.nextWavePreview()).toBeNull();
  });

  it('yıldız eşikleri', () => {
    expect(starsFor(10, TEST_RULES)).toBe(3);
    expect(starsFor(9, TEST_RULES)).toBe(2);
    expect(starsFor(5, TEST_RULES)).toBe(2);
    expect(starsFor(4, TEST_RULES)).toBe(1);
  });

  it('kule kendi düşmanlarını öldürerek oyunu kazandırır (tam akış)', () => {
    const sim = makeSim({
      waves: [wave(group('runner', 3, 0.5)), wave(group('scout', 3, 0.5), group('brute', 1, 1, 1))],
      towers: TEST_TOWERS,
    });
    sim.build('laser', { col: 2, row: 1 });
    sim.build('cannon', { col: 4, row: 1 });
    sim.build('frost', { col: 3, row: 3 });
    sim.upgrade(1);
    sim.upgrade(1);
    for (let w = 0; w < 2; w++) {
      expect(sim.startNextWave()).toEqual({ ok: true });
      stepUntil(sim, () => sim.state.status !== 'wave');
    }
    expect(sim.state.status).toBe('victory');
    expect(sim.state.lives).toBe(10);
  });
});

describe('LINE_MAP geometrisi (testlerin varsayımı)', () => {
  it('(2,0) karosu yola 2 karo uzaklıkta', () => {
    expect(tileCenter({ col: 2, row: 0 })).toEqual({ x: 120, y: 24 });
    const sim = makeSim();
    expect(sim.pathPoints[0]).toEqual({ x: -24, y: 120 });
    expect(LINE_MAP.cols).toBe(20);
  });
});
