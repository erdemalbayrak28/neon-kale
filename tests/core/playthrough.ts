// Denge testleri için ekransız, betikli oyun oynatıcı.
// Betik: öncelik sırasına dizilmiş kurma/yükseltme adımları. Her dalgadan önce altın yettiği sürece sıradaki adımlar
// uygulanır; yetmeyen ilk adımda durulur ve dalga başlatılır (erken çağırma yok). Dalga bitince tablo satırı yazılır.

import { FIXED_STEP } from '../../src/config';
import { Simulation, type SimulationOptions } from '../../src/core/simulation';
import type { CommandResult, GameEvent, TowerKind } from '../../src/core/types';

export type ScriptStep =
  | { readonly build: TowerKind; readonly at: readonly [col: number, row: number] }
  | { readonly upgrade: readonly [col: number, row: number] };

export interface WaveRow {
  wave: number;
  lives: number;
  gold: number;
  towers: number;
  /** Kulelerin seviye toplamı (yükseltmelerin kaba göstergesi). */
  levels: number;
  leaked: number;
  /** Dalgada bir düşmanın yolda ulaştığı en ileri nokta (0 = giriş, 1 = çıkış). Gerilimin göstergesi. */
  deepest: number;
}

export interface PlaythroughResult {
  sim: Simulation;
  rows: WaveRow[];
  events: GameEvent[];
}

/** Komut sonucunu uygular; altın yetmiyorsa false, betik hatalıysa (yanlış karo vb.) hata fırlatır. */
function applyStep(sim: Simulation, step: ScriptStep, index: number): boolean {
  let result: CommandResult;
  if ('build' in step) {
    result = sim.build(step.build, { col: step.at[0], row: step.at[1] });
  } else {
    const tower = sim.towerAt({ col: step.upgrade[0], row: step.upgrade[1] });
    if (!tower) throw new Error(`Betiğin ${index}. adımı: (${step.upgrade.join(', ')}) karosunda kule yok.`);
    result = sim.upgrade(tower.id);
  }
  if (result.ok) return true;
  if (result.reason === 'notEnoughGold') return false;
  throw new Error(`Betiğin ${index}. adımı uygulanamadı: ${result.reason}`);
}

/** Betiği baştan sona oynatır. `frameDt` her update çağrısının süresidir (varsayılan: tek sabit adım). */
export function playScript(
  script: readonly ScriptStep[],
  options: SimulationOptions = {},
  frameDt: number = FIXED_STEP,
): PlaythroughResult {
  const sim = new Simulation(options);
  const pathLength = polylineLength(sim.pathPoints);
  const rows: WaveRow[] = [];
  const events: GameEvent[] = [];
  let cursor = 0;
  const maxFrames = Math.ceil(3600 / frameDt); // güvenlik sınırı: bir saatlik oyun zamanı

  for (let frames = 0; frames < maxFrames; ) {
    const status = sim.state.status;
    if (status === 'victory' || status === 'defeat') break;

    while (cursor < script.length && applyStep(sim, script[cursor]!, cursor)) cursor++;
    const started = sim.startNextWave();
    if (!started.ok) throw new Error(`Dalga başlatılamadı: ${started.reason}`);
    const wave = sim.state.wavesStarted;
    const livesBefore = sim.state.lives;
    let deepest = 0;

    while (sim.state.status === 'wave' && frames < maxFrames) {
      events.push(...sim.update(frameDt));
      frames++;
      for (const e of sim.state.enemies) deepest = Math.max(deepest, e.distance);
    }
    // Sızan düşman sahadan çıktığı için listede görünmez; sızma varsa çıkışa ulaşılmış demektir.
    if (sim.state.lives < livesBefore) deepest = pathLength;
    const s = sim.state;
    rows.push({
      wave,
      lives: s.lives,
      gold: s.gold,
      towers: s.towers.length,
      levels: s.towers.reduce((sum, t) => sum + t.level, 0),
      leaked: livesBefore - s.lives,
      deepest: deepest / pathLength,
    });
  }
  return { sim, rows, events };
}

function polylineLength(points: readonly { x: number; y: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  return total;
}

/** Dalga tablosunu okunur metne çevirir (console.log için). */
export function formatRows(title: string, result: PlaythroughResult): string {
  const s = result.sim.state;
  const header = 'Dalga | Can | Altın | Kule (seviye) | Sızan | En derin';
  const lines = result.rows.map(
    (r) =>
      `${String(r.wave).padStart(5)} | ${String(r.lives).padStart(3)} | ${String(r.gold).padStart(5)} | ` +
      `${String(r.towers).padStart(4)} (${String(r.levels).padStart(2)})     | ${String(r.leaked).padStart(5)} | ` +
      `${String(Math.round(r.deepest * 100)).padStart(7)}%`,
  );
  const outcome = s.status === 'victory' ? `zafer, ${s.stars} yıldız` : s.status === 'defeat' ? 'yenilgi' : s.status;
  return [`── ${title}: ${outcome} (can ${s.lives}) ──`, header, ...lines].join('\n');
}
