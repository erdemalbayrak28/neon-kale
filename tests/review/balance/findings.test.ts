// Denge merceği bulgularının kanıtı. Her test ŞİMDİKİ veride beklenen (tasarım belgesindeki) davranışı ister ve
// başarısız olur; hata iletisinde önerilen veri setindeki (F3 / F3+patlama) değer de yazılır.
// Ayrıntılı tablolar: strategies / ablation / curve / splash testleri ve REVIEW_HEAVY=1 ile population / traits /
// proposals / verify / addons testleri.
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../../src/core/types';
import { goldAvailable, minGold, REAL, type Data } from './curve-lib';
import { run, scriptBot } from './harness';
import { humanBot, mulberry32, population, sampleParams } from './population-lib';
import { BALANCED, SECOND_POCKETS, remap, swapKinds } from './scripts';
import { F3, F3_SPLASH, opts } from './variants-lib';

const ratio = (d: Data, w: number) => minGold(d, w) / goldAvailable(d, w);
const outcome = (r: ReturnType<typeof run>) =>
  r.status === 'victory' ? `zafer ${r.stars}★ (can ${r.lives})` : `yenilgi @${r.rows.length}. dalga, sızanlar [${r.rows.map((x) => x.leaked).join(',')}]`;

describe('denge bulguları (şimdiki veride başarısız olması beklenir)', () => {
  it('B1: 9. dalga duvar, final (10.) ondan kolay', () => {
    const now = { r9: ratio(REAL, 9), r10: ratio(REAL, 10), need9: minGold(REAL, 9), have9: goldAvailable(REAL, 9) };
    const f3 = { r9: ratio(F3, 9), r10: ratio(F3, 10) };
    const msg =
      `şimdiki: 9. dalga için en az ${now.need9} altın gerekir, sızıntısız oyunda ulaşılan ${now.have9}; ` +
      `oran 9=${now.r9.toFixed(2)} 10=${now.r10.toFixed(2)} | F3: 9=${f3.r9.toFixed(2)} 10=${f3.r10.toFixed(2)}`;
    console.log(msg);
    expect(now.r10, msg).toBeGreaterThanOrEqual(now.r9);
    expect(now.need9, msg).toBeLessThanOrEqual(now.have9);
  }, 60_000);

  it('B1: makul oyuncu nüfusunun en az %40ı kazanmalı (9–10 "mükemmel oyun olmadan kazanılabilir")', () => {
    const now = population(60, opts(REAL), 500);
    const f3 = population(60, opts(F3), 500);
    const msg = `kazanma: şimdiki ${now.wins}/60 (9. dalgada ölen ${now.deathWave[9] ?? 0}), F3 ${f3.wins}/60 (9. dalgada ölen ${f3.deathWave[9] ?? 0})`;
    console.log(msg);
    expect(now.wins / now.n, msg).toBeGreaterThanOrEqual(0.4);
  }, 120_000);

  it('B2: dengeli yapı ikinci en iyi U ceplerinde de kazanabilmeli (dalga sırasında harcayarak)', () => {
    const script = remap(BALANCED, SECOND_POCKETS);
    const now = run(scriptBot('ikinci cep', script, { midWave: true }));
    const f3 = run(scriptBot('ikinci cep', script, { midWave: true }), opts(F3));
    const msg = `şimdiki: ${outcome(now)} | F3: ${outcome(f3)}`;
    console.log(msg);
    expect(now.status, msg).toBe('victory');
  });

  it('B2: buz yerine top kuran dengeli oyuncu kazanabilmeli (dalga sırasında harcayarak)', () => {
    const script = swapKinds(BALANCED, (k) => (k === 'frost' ? 'cannon' : k));
    const now = run(scriptBot('buz→top', script, { midWave: true }));
    const f3 = run(scriptBot('buz→top', script, { midWave: true }), opts(F3));
    const msg = `şimdiki: ${outcome(now)} | F3: ${outcome(f3)}`;
    console.log(msg);
    expect(now.status, msg).toBe('victory');
  });

  it('B3: yükseltmeyi az seven (geniş kuran) oyuncuların en az %15i kazanmalı', () => {
    const count = (d: Data) => {
      let n = 0;
      let wins = 0;
      for (let seed = 1; seed <= 300 && n < 40; seed++) {
        const p = sampleParams(mulberry32(seed));
        if (p.upgradeBias >= 0.45) continue;
        n++;
        if (run(humanBot(seed, p), opts(d)).status === 'victory') wins++;
      }
      return { n, wins };
    };
    const now = count(REAL);
    const f3 = count(F3);
    const msg = `geniş kuran alt grup kazanma: şimdiki ${now.wins}/${now.n}, F3 ${f3.wins}/${f3.n}`;
    console.log(msg);
    expect(now.wins / now.n, msg).toBeGreaterThanOrEqual(0.15);
  }, 120_000);

  it('B4: 4. dalga (zırhsız) 3 ile 5 arasında ılımlı bir basamak olmalı (oran ≤ 0.80)', () => {
    const now = [3, 4, 5].map((w) => ratio(REAL, w));
    const f3 = [3, 4, 5].map((w) => ratio(F3, w));
    const msg = `oran 3/4/5: şimdiki ${now.map((x) => x.toFixed(2)).join('/')} | F3 ${f3.map((x) => x.toFixed(2)).join('/')}`;
    console.log(msg);
    expect(now[1]!, msg).toBeLessThanOrEqual(0.8);
  }, 60_000);

  it('B5: topun alan hasarı 2–7. dalgalarda gerçekten birden çok düşmana vurmalı (patlamaların ≥ %10u)', () => {
    const multi = (d: Data) => {
      const ev: readonly GameEvent[] = run(scriptBot('dengeli', BALANCED, { midWave: true }), opts(d)).events;
      let wave = 0;
      let shots = 0;
      let multiHits = 0;
      let hitsTotal = 0;
      for (let i = 0; i < ev.length; i++) {
        const e = ev[i]!;
        if (e.type === 'waveStarted') wave = e.wave;
        if (e.type !== 'explosion' || wave > 7) continue;
        let hits = 0;
        for (let j = i + 1; j < ev.length; j++) {
          const n = ev[j]!;
          if (n.type === 'enemyHit') hits++;
          else if (n.type !== 'enemyKilled') break;
        }
        shots++;
        hitsTotal += hits;
        if (hits >= 2) multiHits++;
      }
      return { pct: multiHits / shots, perShot: hitsTotal / shots };
    };
    const now = multi(REAL);
    const sp = multi(F3_SPLASH);
    const msg =
      `2–7. dalga ≥2 isabetli patlama: şimdiki %${Math.round(now.pct * 100)} (isabet/patlama ${now.perShot.toFixed(2)}), ` +
      `F3+patlama(1.1/1.0/1.0) %${Math.round(sp.pct * 100)} (${sp.perShot.toFixed(2)})`;
    console.log(msg);
    expect(now.pct, msg).toBeGreaterThanOrEqual(0.1);
  });
});
