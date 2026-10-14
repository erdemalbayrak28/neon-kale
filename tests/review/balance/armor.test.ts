// Zırh eşiği: her kule seviyesinin zırhsız ve zırhlı (6) düşmana DPS'i, altın başına DPS ve yükseltmenin marjinal değeri.
import { expect, it } from 'vitest';
import { ENEMIES } from '../../../src/core/data/enemies';
import { TOWERS } from '../../../src/core/data/towers';
import { applyArmor } from '../../../src/core/combat';
import { TOWER_ORDER } from '../../../src/core/data/towers';

it('seviye başına DPS (zırh 0 / zırhlı) ve altın verimi', () => {
  const armor = ENEMIES.brute.armor;
  const lines = [`kule  sv | bedel toplam | hasar→zırhlıya | DPS(0) | DPS(zırhlı) | DPS(zırhlı)/altın | marjinal DPS(zırhlı)/altın`];
  for (const kind of TOWER_ORDER) {
    const def = TOWERS[kind];
    let total = 0;
    let prev = 0;
    def.levels.forEach((s, i) => {
      total += s.cost;
      const d0 = s.damage / s.fireInterval;
      const dA = applyArmor(s.damage, armor) / s.fireInterval;
      const marginal = i === 0 ? dA / s.cost : (dA - prev) / s.cost;
      lines.push(
        `${kind.padEnd(6)} ${i + 1} | ${String(total).padStart(12)} | ${String(s.damage).padStart(5)} → ${String(applyArmor(s.damage, armor)).padStart(2)}    | ` +
          `${d0.toFixed(1).padStart(6)} | ${dA.toFixed(1).padStart(11)} | ${(dA / total).toFixed(3).padStart(17)} | ${marginal.toFixed(3).padStart(10)}`,
      );
      prev = dA;
    });
  }
  console.log(lines.join('\n'));
  expect(lines.length).toBe(10);
});
