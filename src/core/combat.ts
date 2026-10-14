import type { RulesConfig, Vec2 } from './types';

// Savaş kurallarının saf (durumsuz) parçaları. Simulation bunları kullanır; testler doğrudan da çağırabilir.

/** Kayan nokta karşılaştırmaları için tolerans. */
export const EPS = 1e-9;

/** Zırh: isabet başına `max(1, hasar − zırh)`. */
export function applyArmor(damage: number, armor: number): number {
  return Math.max(1, damage - armor);
}

/** En yakın tam sayıya yuvarlar; kayan nokta gürültüsü yüzünden x.5'ler aşağı kaçmasın diye küçük pay ekler. */
export function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5 + EPS);
}

/** Dalga `wave` (1'den başlar) için düşman canı: `maxHp × (1 + büyüme × (wave − 1))`, yuvarlanmış. */
export function scaledHp(baseHp: number, hpGrowthPerWave: number, wave: number): number {
  return roundHalfUp(baseHp * (1 + hpGrowthPerWave * (wave - 1)));
}

/** Satışta geri verilen altın (aşağı yuvarlanır). */
export function refundFor(invested: number, sellRefund: number): number {
  return Math.floor(invested * sellRefund + EPS);
}

/** Zafer yıldızı: kalan can ≥ threeStarLives → 3, ≥ twoStarLives → 2, değilse 1. */
export function starsFor(lives: number, rules: RulesConfig): number {
  if (lives >= rules.threeStarLives) return 3;
  if (lives >= rules.twoStarLives) return 2;
  return 1;
}

export interface SlowEffect {
  /** Hız çarpanı (1 = normal). */
  multiplier: number;
  /** Etkinin biteceği oyun zamanı (saniye); yavaş değilse 0. */
  until: number;
}

/**
 * Yeni bir yavaşlatmayı mevcut etkiyle birleştirir: en güçlü (en küçük) çarpan geçerlidir, süre en uzun olana uzar.
 * Çarpanlar üst üste çarpılmaz. `factor >= 1` ya da `duration <= 0` etkisizdir.
 */
export function combineSlow(current: SlowEffect, now: number, factor: number, duration: number): SlowEffect {
  if (factor >= 1 || duration <= 0) return current;
  const until = now + duration;
  const active = current.until > now && current.multiplier < 1;
  if (!active) return { multiplier: factor, until };
  return { multiplier: Math.min(current.multiplier, factor), until: Math.max(current.until, until) };
}

/** İki nokta arası mesafe `radius`'tan büyük değil mi? (kenar dahil) */
export function isWithin(a: Vec2, b: Vec2, radius: number): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = radius + EPS;
  return dx * dx + dy * dy <= r * r;
}

export interface Targetable {
  readonly alive: boolean;
  readonly distance: number;
  readonly pos: Vec2;
}

/**
 * Menzildeki canlı düşmanlardan yolda en ileride olanı (`distance` en büyük) seçer.
 * Eşitlikte dizideki ilk (yani daha önce çıkan, kimliği küçük olan) kazanır.
 */
export function findFurthestInRange<T extends Targetable>(
  enemies: readonly T[],
  center: Vec2,
  range: number,
): T | undefined {
  let best: T | undefined;
  for (const enemy of enemies) {
    if (!enemy.alive || !isWithin(center, enemy.pos, range)) continue;
    if (best === undefined || enemy.distance > best.distance) best = enemy;
  }
  return best;
}
