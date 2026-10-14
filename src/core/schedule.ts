import type { EnemyKind, WaveDef } from './types';

// Dalga tanımından (gruplar: delay/interval/count) zamana göre sıralı bir çıkış listesi üretir.

export interface SpawnEntry {
  /** Dalga başladıktan kaç saniye sonra çıkar. */
  readonly time: number;
  readonly enemy: EnemyKind;
}

/**
 * Dalganın bütün düşmanlarını çıkış zamanına göre sıralar. Aynı anda çıkanlarda grup sırası, grup içinde çıkış sırası
 * korunur (kararlı sıralama), böylece sonuç her zaman aynıdır.
 */
export function buildSpawnSchedule(wave: WaveDef): SpawnEntry[] {
  const entries: SpawnEntry[] = [];
  for (const group of wave.groups) {
    for (let i = 0; i < group.count; i++) {
      entries.push({ time: group.delay + i * group.interval, enemy: group.enemy });
    }
  }
  // Array.prototype.sort kararlıdır (ES2019); eşit zamanlarda ekleme sırası korunur.
  return entries.sort((a, b) => a.time - b.time);
}

/** Dalgadaki düşman sayıları (türe göre). */
export function countWaveEnemies(wave: WaveDef): Partial<Record<EnemyKind, number>> {
  const counts: Partial<Record<EnemyKind, number>> = {};
  for (const group of wave.groups) {
    if (group.count <= 0) continue;
    counts[group.enemy] = (counts[group.enemy] ?? 0) + group.count;
  }
  return counts;
}
