// Simulation testleri için küçük, elle hesaplanabilir veriler ve yardımcılar.

import { FIXED_STEP } from '../../src/config';
import { Simulation, type SimulationOptions } from '../../src/core/simulation';
import type {
  EnemyDef,
  EnemyKind,
  GameEvent,
  MapDef,
  RulesConfig,
  SpawnGroup,
  TowerDef,
  TowerKind,
  WaveDef,
} from '../../src/core/types';

/**
 * Düz yol: (-1,2) → (20,2). 20 × 5 harita, (3,0) engel. Yol y = 120 piksel boyunca, x = -24'ten 984'e (1008 piksel).
 * (2,0) karosunun merkezi (120, 24): yola dik uzaklığı 96 piksel (2 karo).
 */
export const LINE_MAP: MapDef = {
  id: 'test-line',
  name: 'Düz yol',
  cols: 20,
  rows: 5,
  waypoints: [
    { col: -1, row: 2 },
    { col: 20, row: 2 },
  ],
  blocked: [{ col: 3, row: 0 }],
};

/** Kısa yol: (-1,1) → (5,1), 6 karo = 288 piksel. Koşucu 6 saniyede çıkar. */
export const SHORT_MAP: MapDef = {
  id: 'test-short',
  name: 'Kısa yol',
  cols: 5,
  rows: 3,
  waypoints: [
    { col: -1, row: 1 },
    { col: 5, row: 1 },
  ],
};

/** L yolu: (-1,1) → (3,1) → (3,5). Köşe 4 karo (192 piksel) sonra. */
export const L_MAP: MapDef = {
  id: 'test-l',
  name: 'L yolu',
  cols: 5,
  rows: 5,
  waypoints: [
    { col: -1, row: 1 },
    { col: 3, row: 1 },
    { col: 3, row: 5 },
  ],
};

export const TEST_ENEMIES: Readonly<Record<EnemyKind, EnemyDef>> = {
  // 1 karo/sn = 48 piksel/sn = adım başına 0.8 piksel
  runner: { kind: 'runner', name: 'Koşucu', color: 0, maxHp: 10, speed: 1, armor: 0, reward: 5, leakDamage: 1, radius: 0.3 },
  scout: { kind: 'scout', name: 'Çevik', color: 0, maxHp: 10, speed: 2, armor: 0, reward: 3, leakDamage: 1, radius: 0.2 },
  brute: { kind: 'brute', name: 'Zırhlı', color: 0, maxHp: 100, speed: 0.5, armor: 3, reward: 20, leakDamage: 2, radius: 0.4 },
};

export const TEST_TOWERS: Readonly<Record<TowerKind, TowerDef>> = {
  laser: {
    kind: 'laser',
    name: 'Lazer',
    description: 'Test lazeri.',
    color: 0,
    hotkey: '1',
    attack: 'hitscan',
    levels: [
      { cost: 10, damage: 5, fireInterval: 0.5, range: 3 },
      { cost: 20, damage: 8, fireInterval: 0.5, range: 3 },
      { cost: 30, damage: 12, fireInterval: 0.5, range: 3 },
    ],
  },
  cannon: {
    kind: 'cannon',
    name: 'Top',
    description: 'Test topu.',
    color: 0,
    hotkey: '2',
    attack: 'projectile',
    levels: [
      // mermi 144 piksel/sn (düşmanlardan hızlı), patlama yarıçapı 24 piksel
      { cost: 20, damage: 10, fireInterval: 5, range: 4, projectileSpeed: 3, splashRadius: 0.5 },
      { cost: 20, damage: 20, fireInterval: 5, range: 4, projectileSpeed: 3, splashRadius: 0.5 },
      { cost: 20, damage: 30, fireInterval: 5, range: 4, projectileSpeed: 3, splashRadius: 0.5 },
    ],
  },
  frost: {
    kind: 'frost',
    name: 'Buz',
    description: 'Test buzu.',
    color: 0,
    hotkey: '3',
    attack: 'pulse',
    levels: [
      { cost: 15, damage: 1, fireInterval: 1, range: 2, slowFactor: 0.5, slowDuration: 1 },
      { cost: 15, damage: 1, fireInterval: 1, range: 2, slowFactor: 0.8, slowDuration: 3 },
      { cost: 15, damage: 1, fireInterval: 1, range: 2, slowFactor: 0.3, slowDuration: 0.5 },
    ],
  },
};

export const TEST_RULES: RulesConfig = {
  startingGold: 1000,
  startingLives: 10,
  sellRefund: 0.7,
  waveBonusBase: 10,
  waveBonusPerWave: 5,
  earlyCallBonus: 7,
  hpGrowthPerWave: 0,
  threeStarLives: 10,
  twoStarLives: 5,
};

export function group(enemy: EnemyKind, count: number, interval = 1, delay = 0): SpawnGroup {
  return { enemy, count, interval, delay };
}

export function wave(...groups: SpawnGroup[]): WaveDef {
  return { groups };
}

/** Test verileriyle simülasyon; varsayılan tek dalga: bir koşucu. */
export function makeSim(options: SimulationOptions = {}): Simulation {
  return new Simulation({
    map: LINE_MAP,
    towers: TEST_TOWERS,
    enemies: TEST_ENEMIES,
    rules: TEST_RULES,
    waves: [wave(group('runner', 1))],
    ...options,
  });
}

/** Bir düşman türünü değiştirilmiş değerlerle döner (örn. hiç ölmeyen koşucu). */
export function enemiesWith(patch: Partial<Record<EnemyKind, Partial<EnemyDef>>>): Record<EnemyKind, EnemyDef> {
  return {
    runner: { ...TEST_ENEMIES.runner, ...patch.runner },
    scout: { ...TEST_ENEMIES.scout, ...patch.scout },
    brute: { ...TEST_ENEMIES.brute, ...patch.brute },
  };
}

/** `steps` sabit adım ilerletir (her update bir adım), olayları toplar. */
export function step(sim: Simulation, steps = 1): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < steps; i++) events.push(...sim.update(FIXED_STEP));
  return events;
}

/** Koşul sağlanana kadar adım adım ilerletir; sağlanmazsa hata fırlatır. */
export function stepUntil(sim: Simulation, done: (events: GameEvent[]) => boolean, maxSteps = 60 * 300): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < maxSteps; i++) {
    const batch = sim.update(FIXED_STEP);
    events.push(...batch);
    if (done(batch)) return events;
  }
  throw new Error(`Koşul ${maxSteps} adımda sağlanmadı.`);
}

export type EventOf<T extends GameEvent['type']> = Extract<GameEvent, { type: T }>;

export function ofType<T extends GameEvent['type']>(events: readonly GameEvent[], type: T): EventOf<T>[] {
  return events.filter((e): e is EventOf<T> => e.type === type);
}
