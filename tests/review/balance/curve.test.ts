// Zorluk eğrisi: G_min / G_ulaşılan (açıklama curve-lib.ts'te).
import { describe, expect, it } from 'vitest';
import { curve, REAL } from './curve-lib';

describe('zorluk eğrisi', () => {
  it('gerçek veri: G_min / G_ulaşılan', () => {
    const text = curve(REAL);
    console.log('── gerçek veri (dengeli kurma sırası) ──\n' + text);
    expect(text.length).toBeGreaterThan(0);
  });
});
