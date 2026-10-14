// Haritadaki her kurulabilir karonun gördüğü yol uzunluğu (karo). Köşe/U içi karolar ile düz kenar karolarının farkı.
import { it } from 'vitest';
import { Simulation } from '../../../src/core/simulation';
import { buildableTiles, coverage } from './harness';

it('kapsama haritası (lazer 2.6 / top 3.0 / buz 2.0 menzil)', () => {
  const sim = new Simulation();
  for (const range of [2.0, 2.6, 3.0]) {
    const lines: string[] = [`── menzil ${range} karo: karonun gördüğü yol uzunluğu (karo); ## yol, XX engel ──`];
    lines.push('    ' + Array.from({ length: sim.map.cols }, (_, c) => String(c).padStart(3)).join(''));
    const all: { col: number; row: number; c: number }[] = [];
    for (let row = 0; row < sim.map.rows; row++) {
      let line = String(row).padStart(3) + ' ';
      for (let col = 0; col < sim.map.cols; col++) {
        const r = sim.canPlace({ col, row });
        if (!r.ok) line += r.reason === 'onPath' ? ' ##' : ' XX';
        else {
          const c = coverage({ col, row }, range);
          all.push({ col, row, c });
          line += String(Math.round(c)).padStart(3);
        }
      }
      lines.push(line);
    }
    all.sort((a, b) => b.c - a.c);
    lines.push('en iyi 12: ' + all.slice(0, 12).map((t) => `(${t.col},${t.row})=${t.c.toFixed(1)}`).join(' '));
    const adjacent = all.filter((t) => t.c > 0);
    lines.push(`yola komşu karo sayısı (kapsama>0): ${adjacent.length}, kurulabilir: ${buildableTiles(sim).length}`);
    console.log(lines.join('\n'));
  }
});
