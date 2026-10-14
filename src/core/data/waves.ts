import type { WaveDef } from '../types';

// 1. bölümün 10 dalgası. Her grup dalga başladıktan `delay` saniye sonra başlar, `interval` arayla `count` düşman çıkarır.
// Zorluk eğrisi (tests/core/balance.test.ts): 1–3 birkaç lazerle rahat, 5'ten itibaren zırhlılar için top/buz gerekir,
// 9–10 gerilimli.
export const WAVES: readonly WaveDef[] = [
  { groups: [{ enemy: 'runner', count: 8, interval: 1.0, delay: 0 }] },
  { groups: [{ enemy: 'runner', count: 12, interval: 0.8, delay: 0 }] },
  {
    groups: [
      { enemy: 'scout', count: 10, interval: 0.6, delay: 0 },
      { enemy: 'runner', count: 6, interval: 1.0, delay: 4 },
    ],
  },
  {
    groups: [
      { enemy: 'runner', count: 14, interval: 0.7, delay: 0 },
      { enemy: 'scout', count: 8, interval: 0.5, delay: 6 },
    ],
  },
  // İlk zırhlılar: koşucuların arkasından gelir; lazerle tek başına geçilmez.
  {
    groups: [
      { enemy: 'runner', count: 10, interval: 0.8, delay: 0 },
      { enemy: 'brute', count: 3, interval: 3.0, delay: 4 },
    ],
  },
  { groups: [{ enemy: 'scout', count: 18, interval: 0.4, delay: 0 }] },
  {
    groups: [
      { enemy: 'brute', count: 4, interval: 2.0, delay: 0 },
      { enemy: 'scout', count: 10, interval: 0.5, delay: 5 },
    ],
  },
  {
    groups: [
      { enemy: 'runner', count: 20, interval: 0.5, delay: 0 },
      { enemy: 'brute', count: 5, interval: 2.0, delay: 4 },
    ],
  },
  // Son iki dalga gerilimli olmalı: dolu bir savunmayı bile yolun sonuna kadar zorlar.
  {
    groups: [
      { enemy: 'scout', count: 26, interval: 0.3, delay: 0 },
      { enemy: 'brute', count: 10, interval: 1.3, delay: 3 },
    ],
  },
  {
    groups: [
      { enemy: 'brute', count: 18, interval: 1.0, delay: 0 },
      { enemy: 'runner', count: 26, interval: 0.35, delay: 2 },
      { enemy: 'scout', count: 22, interval: 0.3, delay: 8 },
    ],
  },
];
