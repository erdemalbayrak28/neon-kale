import { COLORS } from '../../config';
import type { EnemyDef, EnemyKind } from '../types';

export const ENEMIES: Readonly<Record<EnemyKind, EnemyDef>> = {
  runner: {
    kind: 'runner',
    name: 'Koşucu',
    color: COLORS.runner,
    maxHp: 26,
    speed: 1.5,
    armor: 0,
    reward: 6,
    leakDamage: 1,
    radius: 0.28,
  },
  scout: {
    kind: 'scout',
    name: 'Çevik',
    color: COLORS.scout,
    maxHp: 15,
    speed: 2.6,
    armor: 0,
    reward: 5,
    leakDamage: 1,
    radius: 0.22,
  },
  brute: {
    kind: 'brute',
    name: 'Zırhlı',
    color: COLORS.brute,
    maxHp: 80,
    speed: 0.95,
    armor: 3,
    reward: 14,
    leakDamage: 2,
    radius: 0.36,
  },
};
