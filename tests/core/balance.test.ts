// Denge testleri: gerçek verilerle (MAP_1, TOWERS, ENEMIES, WAVES, RULES) ekransız, betikli oyunlar.
// Hedef eğri: 1–3. dalgalar 2–3 kuleyle rahat; 5. dalgadan itibaren zırhlılar için top/buz gerekir; 9–10 gerilimli.
// Tablolar console.log ile basılır: `npx vitest run tests/core/balance.test.ts --reporter=verbose`.

import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/core/data/rules';
import { formatRows, playScript, type PlaythroughResult, type ScriptStep } from './playthrough';

const build = (kind: 'laser' | 'cannon' | 'frost', col: number, row: number): ScriptStep => ({ build: kind, at: [col, row] });
const upgrade = (col: number, row: number): ScriptStep => ({ upgrade: [col, row] });

/**
 * Dengeli strateji. Yerler yol kıvrımlarının içi: asıl öldürme cebi 14. ve 17. sütunlar arasındaki (15–16, 5–9)
 * karoları (yolun üç kolunu birden görür), yardımcı olarak (11,4) ve (12,4) ikinci U'nun içi.
 * Önce ucuz lazerler, 5. dalgadaki zırhlılardan önce iki top ve bir buz, sonra yükseltmeler ve cebi doldurmak.
 */
const BALANCED: readonly ScriptStep[] = [
  build('laser', 15, 8),
  build('laser', 16, 8),
  build('laser', 11, 4),
  upgrade(15, 8),
  build('cannon', 15, 9),
  upgrade(16, 8),
  build('cannon', 15, 7),
  build('frost', 16, 9),
  upgrade(15, 9),
  upgrade(15, 7),
  upgrade(15, 8),
  upgrade(16, 8),
  upgrade(15, 9),
  upgrade(15, 7),
  upgrade(16, 9),
  build('cannon', 16, 7),
  upgrade(16, 7),
  upgrade(16, 7),
  upgrade(16, 9),
  build('frost', 15, 6),
  upgrade(11, 4),
  build('laser', 16, 6),
  upgrade(16, 6),
  upgrade(15, 6),
  upgrade(16, 6),
  upgrade(11, 4),
  build('cannon', 12, 4),
  upgrade(12, 4),
  upgrade(12, 4),
  upgrade(15, 6),
];

/** Aynı yerler, aynı sıra, aynı altın; ama her kule lazer. */
const LASER_ONLY: readonly ScriptStep[] = BALANCED.map((s) => ('build' in s ? { build: 'laser', at: s.at } : s));

/** Sadece üç lazer ve yükseltmeleri. */
const THREE_LASERS: readonly ScriptStep[] = [
  build('laser', 15, 8),
  build('laser', 16, 8),
  build('laser', 11, 4),
  upgrade(15, 8),
  upgrade(16, 8),
  upgrade(11, 4),
];

const wavesWithLeaks = (r: PlaythroughResult) => r.rows.filter((row) => row.leaked > 0).map((row) => row.wave);
const row = (r: PlaythroughResult, wave: number) => r.rows.find((x) => x.wave === wave)!;

describe('denge (gerçek veri)', () => {
  const balanced = playScript(BALANCED);
  const laserOnly = playScript(LASER_ONLY);

  it('hiç kule kurmayan oyuncu 4. dalga bitmeden kaybeder', () => {
    const result = playScript([]);
    console.log(formatRows('Kulesiz', result));
    expect(result.sim.state.status).toBe('defeat');
    expect(result.sim.state.wavesStarted).toBeLessThanOrEqual(4);
    expect(result.events[result.events.length - 1]).toEqual({ type: 'defeat' });
  });

  it('dengeli strateji (lazer + top + buz) en az iki yıldızla kazanır', () => {
    console.log(formatRows('Dengeli', balanced));
    const s = balanced.sim.state;
    expect(s.status).toBe('victory');
    expect(s.lives).toBeGreaterThanOrEqual(RULES.twoStarLives);
    expect(s.stars).toBeGreaterThanOrEqual(2);
  });

  it('sadece lazer, aynı altınla açıkça daha kötüdür', () => {
    console.log(formatRows('Sadece lazer', laserOnly));
    const s = laserOnly.sim.state;
    const lost = s.status === 'defeat' || s.stars < balanced.sim.state.stars;
    expect(lost).toBe(true);
    expect(s.lives).toBeLessThan(balanced.sim.state.lives);
  });

  it('eğri: 1–3. dalgalar birkaç lazerle rahat', () => {
    const result = playScript(THREE_LASERS);
    console.log(formatRows('Üç lazer', result));
    for (const wave of [1, 2, 3]) expect(row(result, wave).leaked).toBe(0);
    // dengeli oyuncu da ilk dört dalgada hiç can kaybetmez
    for (const wave of [1, 2, 3, 4]) expect(row(balanced, wave).leaked).toBe(0);
  });

  it('eğri: 5. dalgadan itibaren zırhlılar top/buz ister', () => {
    // Lazerler 4. dalgaya kadar yeter, 5. dalgadaki zırhlılar geçer; aynı altınla top/buz kuran geçirmez.
    expect(wavesWithLeaks(laserOnly)[0]).toBe(5);
    expect(row(balanced, 5).leaked).toBe(0);
    expect(laserOnly.rows.length).toBeLessThanOrEqual(10);
  });

  it('eğri: 9–10. dalgalar gerilimli (düşmanlar öldürme cebini aşıp çıkışa yaklaşır)', () => {
    const early = Math.max(...[1, 2, 3].map((w) => row(balanced, w).deepest));
    const late = Math.max(row(balanced, 9).deepest, row(balanced, 10).deepest);
    expect(late).toBeGreaterThanOrEqual(0.85);
    expect(late - early).toBeGreaterThanOrEqual(0.1);
  });

  it('belirlenimci: aynı betik iki kez aynı sonucu verir', () => {
    const again = playScript(BALANCED);
    expect(JSON.stringify(again.sim.state)).toBe(JSON.stringify(balanced.sim.state));
    expect(JSON.stringify(again.events)).toBe(JSON.stringify(balanced.events));
    expect(again.rows).toEqual(balanced.rows);
  });
});
