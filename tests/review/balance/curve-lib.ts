// Zorluk eğrisi ölçümü (stratejiden olabildiğince bağımsız):
// Her dalga w için, dengeli betiğin kurma sırasını izleyen bir oyuncunun w. dalgayı TEK BAŞINA sızıntısız geçmesi için
// gereken en az altın G_min(w), oyuncunun o ana kadar (hiç sızıntı olmadan) kazanabileceği toplam altın G_ulaşılan(w)
// ile karşılaştırılır. Oran = G_min / G_ulaşılan: 1'in üstü = o dalga mükemmel oyunla bile geçilemez.
import { FIXED_STEP } from '../../../src/config';
import { ENEMIES } from '../../../src/core/data/enemies';
import { RULES } from '../../../src/core/data/rules';
import { TOWERS } from '../../../src/core/data/towers';
import { WAVES } from '../../../src/core/data/waves';
import { Simulation } from '../../../src/core/simulation';
import type { EnemyDef, EnemyKind, RulesConfig, TowerDef, TowerKind, WaveDef } from '../../../src/core/types';
import { applyStep, type Step } from './harness';
import { BALANCED } from './scripts';

export interface Data {
  towers: Readonly<Record<TowerKind, TowerDef>>;
  enemies: Readonly<Record<EnemyKind, EnemyDef>>;
  waves: readonly WaveDef[];
  rules: RulesConfig;
}
export const REAL: Data = { towers: TOWERS, enemies: ENEMIES, waves: WAVES, rules: RULES };

/** Sızıntısız oyunda w. dalga başlamadan önce elde edilebilecek toplam altın. */
export function goldAvailable(d: Data, w: number): number {
  let g = d.rules.startingGold;
  for (let i = 1; i < w; i++) {
    for (const grp of d.waves[i - 1]!.groups) g += grp.count * d.enemies[grp.enemy].reward;
    g += d.rules.waveBonusBase + d.rules.waveBonusPerWave * i;
  }
  return g;
}

/** w. dalgayı tek başına, `gold` altınla (betik öneki kurularak) oynar; sızan can sayısını döner. */
export function leaksWith(d: Data, w: number, gold: number, script: readonly Step[]): number {
  const empty: WaveDef = { groups: [] };
  const waves = [...Array.from({ length: w - 1 }, () => empty), d.waves[w - 1]!];
  const rules: RulesConfig = { ...d.rules, startingGold: gold, waveBonusBase: 0, waveBonusPerWave: 0, startingLives: 1000 };
  const sim = new Simulation({ towers: d.towers, enemies: d.enemies, waves, rules });
  for (let i = 1; i < w; i++) {
    sim.startNextWave();
    sim.update(FIXED_STEP);
  }
  let cursor = 0;
  while (cursor < script.length && applyStep(sim, script[cursor]!)) cursor++;
  sim.startNextWave();
  const lives0 = sim.state.lives;
  for (let i = 0; i < 60 * 600 && sim.state.status === 'wave'; i++) sim.update(FIXED_STEP);
  return lives0 - sim.state.lives;
}

export function minGold(d: Data, w: number, script: readonly Step[] = BALANCED): number {
  for (let g = 0; g <= 4000; g += 10) if (leaksWith(d, w, g, script) === 0) return g;
  return Infinity;
}

export function curve(d: Data, script: readonly Step[] = BALANCED): string {
  const lines = ['dalga | G_min | G_ulaşılan | oran  | çubuk'];
  for (let w = 1; w <= d.waves.length; w++) {
    const need = minGold(d, w, script);
    const have = goldAvailable(d, w);
    const ratio = need / have;
    lines.push(
      `${String(w).padStart(5)} | ${String(need).padStart(5)} | ${String(have).padStart(10)} | ${ratio.toFixed(2).padStart(5)} | ${'#'.repeat(Math.min(40, Math.round(ratio * 20)))}`,
    );
  }
  return lines.join('\n');
}

