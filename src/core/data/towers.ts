import { COLORS } from '../../config';
import type { TowerDef, TowerKind } from '../types';

// Kule tanımları. Denge ayarı buradan yapılır; tests/core/balance.test.ts dengenin bozulmadığını kontrol eder.
export const TOWERS: Readonly<Record<TowerKind, TowerDef>> = {
  laser: {
    kind: 'laser',
    name: 'Lazer Kulesi',
    description: 'Hızlı ateş eder, tek hedefe vurur. Zırha karşı zayıf.',
    color: COLORS.laser,
    hotkey: '1',
    attack: 'hitscan',
    levels: [
      { cost: 50, damage: 5, fireInterval: 0.4, range: 2.6 },
      { cost: 40, damage: 8, fireInterval: 0.35, range: 2.8 },
      { cost: 70, damage: 12, fireInterval: 0.3, range: 3.0 },
    ],
  },
  cannon: {
    kind: 'cannon',
    name: 'Top Kulesi',
    description: 'Yavaş ama güçlü; patlaması etraftaki herkese vurur.',
    color: COLORS.cannon,
    hotkey: '2',
    attack: 'projectile',
    levels: [
      { cost: 80, damage: 16, fireInterval: 1.4, range: 3.0, projectileSpeed: 7, splashRadius: 0.9 },
      { cost: 60, damage: 26, fireInterval: 1.3, range: 3.2, projectileSpeed: 7.5, splashRadius: 1.0 },
      { cost: 100, damage: 42, fireInterval: 1.2, range: 3.4, projectileSpeed: 8, splashRadius: 1.15 },
    ],
  },
  frost: {
    kind: 'frost',
    name: 'Buz Kulesi',
    description: 'Menzildeki herkesi yavaşlatır, az hasar verir.',
    color: COLORS.frost,
    hotkey: '3',
    attack: 'pulse',
    levels: [
      { cost: 70, damage: 2, fireInterval: 1.2, range: 2.0, slowFactor: 0.6, slowDuration: 1.5 },
      { cost: 50, damage: 4, fireInterval: 1.1, range: 2.3, slowFactor: 0.5, slowDuration: 1.8 },
      { cost: 80, damage: 7, fireInterval: 1.0, range: 2.6, slowFactor: 0.4, slowDuration: 2.0 },
    ],
  },
};

/** Paneldeki sıralama. */
export const TOWER_ORDER: readonly TowerKind[] = ['laser', 'cannon', 'frost'];
