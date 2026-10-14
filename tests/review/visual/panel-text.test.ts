// İnceleme (görsel/UX): panelde yükseltme önizlemesinin metinleri. Kırmızı olan test hatanın kanıtıdır.
// SidePanel.fillStats atış hızını `num(1 / fireInterval)` ile tek ondalığa yuvarlar ve sonraki seviyeyi
// "→ x" olarak gösterir. Değer gerçekten değişip yuvarlamada aynı kalırsa oyuncu "0,8/sn → 0,8/sn" görür.

import { describe, expect, it } from 'vitest';
import { TOWERS, TOWER_ORDER } from '../../../src/core/data/towers';
import { num } from '../../../src/ui/strings';

describe('yükseltme önizlemesi', () => {
  for (const kind of TOWER_ORDER) {
    const def = TOWERS[kind];
    for (const level of [1, 2] as const) {
      const cur = def.levels[level - 1]!;
      const next = def.levels[level]!;
      if (cur.fireInterval === next.fireInterval) continue;
      it(`${def.name} ${level}→${level + 1}: atış hızı değişince önizleme de farklı görünür`, () => {
        // SidePanel.fillStats ile aynı biçim.
        const shownCur = `${num(1 / cur.fireInterval)}/sn`;
        const shownNext = `${num(1 / next.fireInterval)}/sn`;
        expect(shownNext).not.toBe(shownCur); // Top 2→3: "0,8/sn → 0,8/sn"
      });
    }
  }
});
