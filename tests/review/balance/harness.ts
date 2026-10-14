// İnceleme (denge merceği) için ekransız oynatıcı. Botlar karar noktalarında (dalga öncesi ve istenirse dalga
// sırasında her 0,5 sn'de) komut verir; dalga başına can, altın, sızma, en derin nokta, kule türüne göre hasar ve
// "oyuncu boşta" süreleri ölçülür. Çekirdek koda dokunmaz; sadece Simulation'ın açık API'sini kullanır.

import { FIXED_STEP, TILE } from '../../../src/config';
import { MAP_1 } from '../../../src/core/data/maps';
import { Path } from '../../../src/core/path';
import { Simulation, type SimulationOptions } from '../../../src/core/simulation';
import type { EnemyKind, GameEvent, TileCoord, TowerDef, TowerKind, TowerState } from '../../../src/core/types';

export type Step =
  | { readonly build: TowerKind; readonly at: readonly [number, number] }
  | { readonly upgrade: readonly [number, number] };

export const B = (kind: TowerKind, col: number, row: number): Step => ({ build: kind, at: [col, row] });
export const U = (col: number, row: number): Step => ({ upgrade: [col, row] });

export interface Bot {
  name: string;
  /** Karar noktası. `phase` = 'build' (dalga başlamadan hemen önce) ya da 'wave' (dalga sürerken). */
  act(sim: Simulation, phase: 'build' | 'wave'): void;
  /** Dalga sürerken de harcar mı (her 0,5 sn)? */
  midWave?: boolean;
  /** Erken çağırma mümkün olduğunda çağırsın mı? */
  early?(sim: Simulation): boolean;
}

export interface WaveRow {
  wave: number;
  /** Dalga başlarken (kurma sonrası) elde kalan altın. */
  goldAtStart: number;
  /** Dalga temizlendiğinde can. */
  lives: number;
  leaked: number;
  /** Bu dalganın düşmanının yolda ulaştığı en ileri nokta (0–1). */
  deepest: number;
  /** Dalga başlangıcından ilk isabete kadar geçen süre (sn). */
  firstHit: number;
  /** Dalga başlangıcından temizlenmesine kadar (sn). */
  duration: number;
  /** Dalga sırasında oyuncunun hiçbir şey alamadığı (altın < en ucuz kurma/yükseltme) süre (sn). */
  brokeSeconds: number;
  /** Dalga sırasında hiçbir kulenin isabet etmediği toplam süre (sn, 0,5 sn'lik dilimler). */
  quietSeconds: number;
  towers: number;
  levels: number;
  earlyCalled: boolean;
}

export interface RunResult {
  name: string;
  sim: Simulation;
  rows: WaveRow[];
  status: string;
  lives: number;
  stars: number;
  /** Kule türüne göre işe yarayan hasar (fazla vuruş hariç). */
  usefulDamage: Record<TowerKind, number>;
  /** Kule türüne göre yatırılan altın (oyun sonunda sahada olan kuleler). */
  invested: Record<TowerKind, number>;
  totalTime: number;
  earlyBonusGold: number;
  /** Dalga sırasında ilk kez (0,5 sn'lik dilimde) ilk kulenin isabet ettiği an — kale ne kadar geç devreye giriyor. */
  events: GameEvent[];
}

/** Ağır (nüfus/arama) testleri sadece REVIEW_HEAVY=1 ile çalışır; varsayılan `npm test` hızlı kalsın. */
export const HEAVY = Boolean(
  (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env['REVIEW_HEAVY'],
);

const zeroKinds = (): Record<TowerKind, number> => ({ laser: 0, cannon: 0, frost: 0 });

/** Bir adımı uygular. Altın yetmezse false. Karo hatalıysa hata fırlatır. */
export function applyStep(sim: Simulation, step: Step): boolean {
  if ('build' in step) {
    const r = sim.build(step.build, { col: step.at[0], row: step.at[1] });
    if (r.ok) return true;
    if (r.reason === 'notEnoughGold') return false;
    throw new Error(`kurma (${step.at.join(',')}) ${step.build}: ${r.reason}`);
  }
  const t = sim.towerAt({ col: step.upgrade[0], row: step.upgrade[1] });
  if (!t) throw new Error(`yükseltme (${step.upgrade.join(',')}): kule yok`);
  const r = sim.upgrade(t.id);
  if (r.ok) return true;
  if (r.reason === 'notEnoughGold') return false;
  throw new Error(`yükseltme (${step.upgrade.join(',')}): ${r.reason}`);
}

/** Sıralı betik botu (tests/core/playthrough.ts ile aynı mantık; isterse dalga sırasında da harcar / erken çağırır). */
export function scriptBot(name: string, script: readonly Step[], opts: { midWave?: boolean; early?: boolean | ((sim: Simulation) => boolean) } = {}): Bot {
  let cursor = 0;
  const earlyOpt = opts.early;
  return {
    name,
    midWave: opts.midWave ?? false,
    act(sim) {
      while (cursor < script.length && applyStep(sim, script[cursor]!)) cursor++;
    },
    early: earlyOpt === undefined ? undefined : typeof earlyOpt === 'function' ? earlyOpt : () => earlyOpt,
  };
}

/** En ucuz yapılabilir eylemin bedeli (kurma ya da kuruluların yükseltmesi). */
function cheapestAction(sim: Simulation): number {
  let min = Infinity;
  for (const def of Object.values(sim.towerDefs)) min = Math.min(min, def.levels[0].cost);
  for (const t of sim.state.towers) {
    const c = sim.upgradeCost(t.id);
    if (c !== null) min = Math.min(min, c);
  }
  return min;
}

export function run(bot: Bot, options: SimulationOptions = {}): RunResult {
  const sim = new Simulation(options);
  const path = new Path(sim.map);
  const pathLength = path.length;
  const rows = new Map<number, WaveRow>();
  const events: GameEvent[] = [];
  const hp = new Map<number, number>();
  const enemyWave = new Map<number, number>();
  const usefulDamage = zeroKinds();
  let source: TowerKind | null = null;
  let earlyBonusGold = 0;
  let lastHitTime = -1;
  const maxTime = 3600;

  const startWave = (early: boolean): void => {
    const goldAtStart = sim.state.gold;
    const r = sim.startNextWave();
    if (!r.ok) throw new Error(`dalga başlatılamadı: ${r.reason}`);
    const w = sim.state.wavesStarted;
    rows.set(w, {
      wave: w,
      goldAtStart,
      lives: sim.state.lives,
      leaked: 0,
      deepest: 0,
      firstHit: NaN,
      duration: NaN,
      brokeSeconds: 0,
      quietSeconds: 0,
      towers: sim.state.towers.length,
      levels: sim.state.towers.reduce((s, t) => s + t.level, 0),
      earlyCalled: early,
    });
    (rows.get(w) as WaveRow & { start: number }).start = sim.state.time;
  };

  let slice = 0;
  let sliceHit = false;
  while (sim.state.time < maxTime) {
    const st = sim.state.status;
    if (st === 'victory' || st === 'defeat') break;
    if (st === 'building') {
      bot.act(sim, 'build');
      startWave(false);
    }
    const evs = sim.update(FIXED_STEP);
    for (const e of evs) {
      events.push(e);
      switch (e.type) {
        case 'shot':
          source = e.kind === 'laser' ? 'laser' : null;
          break;
        case 'pulse':
          source = 'frost';
          break;
        case 'explosion':
          source = 'cannon';
          break;
        case 'enemySpawned':
          hp.set(e.enemyId, sim.enemyMaxHp(e.kind, e.wave));
          enemyWave.set(e.enemyId, e.wave);
          break;
        case 'enemyHit': {
          const before = hp.get(e.enemyId) ?? 0;
          const useful = Math.min(before, e.damage);
          hp.set(e.enemyId, before - e.damage);
          if (source) usefulDamage[source] += useful;
          lastHitTime = sim.state.time;
          sliceHit = true;
          for (const row of rows.values()) {
            const r = row as WaveRow & { start: number };
            if (Number.isNaN(r.firstHit) && enemyWave.get(e.enemyId) === r.wave) r.firstHit = sim.state.time - r.start;
          }
          break;
        }
        case 'enemyLeaked': {
          const w = enemyWave.get(e.enemyId)!;
          rows.get(w)!.leaked += e.damage;
          break;
        }
        case 'waveStarted':
          if (e.early) earlyBonusGold += e.earlyBonus;
          break;
        case 'waveCleared': {
          const r = rows.get(e.wave)! as WaveRow & { start: number };
          r.duration = sim.state.time - r.start;
          r.lives = sim.state.lives;
          break;
        }
      }
    }
    for (const en of sim.state.enemies) {
      const r = rows.get(en.wave);
      if (r) r.deepest = Math.max(r.deepest, en.distance / pathLength);
    }
    // 0,5 sn'lik dilimler: boşta ve sessiz süre
    if (sim.state.status === 'wave') {
      const cur = Math.floor(sim.state.time / 0.5);
      if (cur !== slice) {
        slice = cur;
        const active = [...rows.values()].filter((r) => Number.isNaN(r.duration));
        const newest = active[active.length - 1];
        if (newest) {
          if (sim.state.gold < cheapestAction(sim)) newest.brokeSeconds += 0.5;
          if (!sliceHit) newest.quietSeconds += 0.5;
        }
        sliceHit = false;
        if (bot.midWave) bot.act(sim, 'wave');
        if (bot.early && sim.state.spawningDone && sim.state.wavesStarted < sim.state.totalWaves && bot.early(sim)) {
          startWave(true);
        }
      }
    }
  }
  // sızma varsa en derin = 1
  for (const r of rows.values()) if (r.leaked > 0) r.deepest = 1;
  const invested = zeroKinds();
  for (const t of sim.state.towers) invested[t.kind] += t.invested;
  const s = sim.state;
  void lastHitTime;
  return {
    name: bot.name,
    sim,
    rows: [...rows.values()],
    status: s.status,
    lives: s.lives,
    stars: s.stars,
    usefulDamage,
    invested,
    totalTime: s.time,
    earlyBonusGold,
    events,
  };
}

const pad = (v: string | number, n: number): string => String(v).padStart(n);

export function table(r: RunResult): string {
  const outcome = r.status === 'victory' ? `ZAFER ${r.stars}★` : r.status === 'defeat' ? 'YENİLGİ' : r.status;
  const head = 'dalga | başAltın |  can | sızan | derin | ilkİsabet |  süre | parasız | sessiz | kule(sv) | erken';
  const lines = r.rows.map(
    (w) =>
      `${pad(w.wave, 5)} | ${pad(w.goldAtStart, 8)} | ${pad(w.lives, 4)} | ${pad(w.leaked, 5)} | ${pad(Math.round(w.deepest * 100) + '%', 5)} | ` +
      `${pad(Number.isNaN(w.firstHit) ? '-' : w.firstHit.toFixed(1), 9)} | ${pad(Number.isNaN(w.duration) ? '-' : w.duration.toFixed(1), 5)} | ` +
      `${pad(w.brokeSeconds.toFixed(1), 7)} | ${pad(w.quietSeconds.toFixed(1), 6)} | ${pad(w.towers, 4)} (${pad(w.levels, 2)}) | ${w.earlyCalled ? 'E' : ''}`,
  );
  const dmg = r.usefulDamage;
  const tot = dmg.laser + dmg.cannon + dmg.frost || 1;
  const inv = r.invested;
  const perGold = (k: TowerKind) => (inv[k] > 0 ? (dmg[k] / inv[k]).toFixed(1) : '-');
  const foot =
    `hasar payı: lazer %${Math.round((100 * dmg.laser) / tot)}, top %${Math.round((100 * dmg.cannon) / tot)}, buz %${Math.round((100 * dmg.frost) / tot)}` +
    ` | hasar/altın: lazer ${perGold('laser')}, top ${perGold('cannon')}, buz ${perGold('frost')}` +
    ` | yatırım: L${inv.laser} T${inv.cannon} B${inv.frost} | süre ${r.totalTime.toFixed(0)} sn | erken bonus ${r.earlyBonusGold}`;
  return [`── ${r.name}: ${outcome} (can ${r.lives}) ──`, head, ...lines, foot].join('\n');
}

export function summary(r: RunResult): string {
  const outcome = r.status === 'victory' ? `ZAFER ${r.stars}★` : `YENİLGİ@${r.rows.length}`;
  return `${r.name.padEnd(42)} ${outcome.padEnd(10)} can ${pad(r.lives, 2)}  sızanlar [${r.rows.map((w) => w.leaked).join(',')}]`;
}

// ── yerleşim yardımcıları ──────────────────────────────────────

export const PATH = new Path(MAP_1);

/** Karo merkezinden `rangeTiles` menzilde kalan yol uzunluğu (karo). */
export function coverage(tile: TileCoord, rangeTiles: number, path: Path = PATH): number {
  const cx = (tile.col + 0.5) * TILE;
  const cy = (tile.row + 0.5) * TILE;
  const r2 = (rangeTiles * TILE) ** 2;
  const stepPx = 2;
  let inside = 0;
  for (let d = 0; d <= path.length; d += stepPx) {
    const p = path.positionAt(d).pos;
    if ((p.x - cx) ** 2 + (p.y - cy) ** 2 <= r2 + 1e-9) inside += stepPx;
  }
  return inside / TILE;
}

const PATH_SAMPLES: { x: number; y: number }[] = [];
for (let d = 0; d <= PATH.length; d += 4) PATH_SAMPLES.push(PATH.positionAt(d).pos);

/**
 * Buz için "eş etki" kapsaması: menzildeki her yol noktası, o noktayı gören hasar kulesi sayısıyla ağırlıklanır
 * (yavaşlatmayı hasarın olduğu yere koy). Hasar kulesi yoksa düz kapsama.
 */
export function synergyCoverage(sim: Simulation, tile: TileCoord, rangeTiles: number): number {
  const cx = (tile.col + 0.5) * TILE;
  const cy = (tile.row + 0.5) * TILE;
  const r2 = (rangeTiles * TILE) ** 2;
  const dmg = sim.state.towers
    .filter((t) => t.kind !== 'frost')
    .map((t) => ({ x: t.pos.x, y: t.pos.y, r2: (sim.towerDefs[t.kind].levels[t.level - 1]!.range * TILE) ** 2 }));
  let score = 0;
  for (const p of PATH_SAMPLES) {
    if ((p.x - cx) ** 2 + (p.y - cy) ** 2 > r2) continue;
    let n = 0;
    for (const t of dmg) if ((p.x - t.x) ** 2 + (p.y - t.y) ** 2 <= t.r2) n++;
    score += dmg.length > 0 ? n : 1;
  }
  return score;
}

export function buildableTiles(sim: Simulation): TileCoord[] {
  const out: TileCoord[] = [];
  for (let row = 0; row < sim.map.rows; row++)
    for (let col = 0; col < sim.map.cols; col++) if (sim.canPlace({ col, row }).ok) out.push({ col, row });
  return out;
}

const coverageCache = new Map<string, number>();
export function cachedCoverage(tile: TileCoord, range: number): number {
  const k = `${tile.col},${tile.row},${range}`;
  let v = coverageCache.get(k);
  if (v === undefined) {
    v = coverage(tile, range);
    coverageCache.set(k, v);
  }
  return v;
}

// ── açgözlü botlar ─────────────────────────────────────────────

export interface GreedyOptions {
  kinds: readonly TowerKind[];
  /** Zırhı hesaba katar mı (sıradaki dalganın düşman karışımına göre)? false = saf DPS (acemi oyuncu). */
  armorAware: boolean;
  midWave?: boolean;
  early?: boolean;
  /** Topun alan hasarı için kaba çarpan. */
  splashFactor?: number;
  /** Buz kulesinin yavaşlatma değeri: menzilindeki diğer kulelerin DPS'ine eklenen oran. */
  frostSlowValue?: number;
  /** Altın biriktirme: bu kadar altın kalana dek harcamaz (0 = hemen harca). */
  reserve?: number;
}

function towerDps(def: TowerDef, level: 1 | 2 | 3, armorMix: readonly { armor: number; w: number }[], splash: number): number {
  const s = def.levels[level - 1]!;
  let eff = 0;
  for (const m of armorMix) eff += m.w * Math.max(1, s.damage - m.armor);
  let dps = eff / s.fireInterval;
  if (def.attack === 'projectile') dps *= splash;
  return dps;
}

/** Sıradaki dalganın (yoksa son dalganın) zırh karışımı, can ağırlıklı. */
function nextArmorMix(sim: Simulation, aware: boolean): { armor: number; w: number }[] {
  if (!aware) return [{ armor: 0, w: 1 }];
  const idx = Math.min(sim.state.wavesStarted, sim.waves.length - 1);
  const wave = sim.waves[idx]!;
  const totals = new Map<EnemyKind, number>();
  for (const g of wave.groups) totals.set(g.enemy, (totals.get(g.enemy) ?? 0) + g.count * sim.enemyMaxHp(g.enemy, idx + 1));
  const sum = [...totals.values()].reduce((a, b) => a + b, 0);
  return [...totals.entries()].map(([k, v]) => ({ armor: sim.enemyDefs[k].armor, w: v / sum }));
}

export function greedyBot(name: string, o: GreedyOptions): Bot {
  const splash = o.splashFactor ?? 1.8;
  return {
    name,
    midWave: o.midWave ?? false,
    early: o.early ? () => true : undefined,
    act(sim) {
      for (let guard = 0; guard < 50; guard++) {
        const mix = nextArmorMix(sim, o.armorAware);
        const gold = sim.state.gold - (o.reserve ?? 0);
        let best: { value: number; apply: () => boolean } | null = null;
        const consider = (value: number, cost: number, apply: () => boolean) => {
          if (cost > gold) return;
          if (!best || value > best.value) best = { value, apply };
        };
        const tiles = buildableTiles(sim);
        for (const kind of o.kinds) {
          const def = sim.towerDefs[kind];
          let bestTile: TileCoord | null = null;
          let bestCov = -1;
          for (const t of tiles) {
            const c = cachedCoverage(t, def.levels[0].range);
            if (c > bestCov) {
              bestCov = c;
              bestTile = t;
            }
          }
          if (!bestTile) continue;
          let gain = towerDps(def, 1, mix, splash) * bestCov;
          if (kind === 'frost') gain += (o.frostSlowValue ?? 0) * frostBoost(sim, bestTile, def.levels[0].range);
          const tile = bestTile;
          consider(gain / def.levels[0].cost, def.levels[0].cost, () => sim.build(kind, tile).ok);
        }
        for (const t of sim.state.towers) {
          if (!o.kinds.includes(t.kind)) continue;
          const cost = sim.upgradeCost(t.id);
          if (cost === null) continue;
          const def = sim.towerDefs[t.kind];
          const next = (t.level + 1) as 2 | 3;
          let gain =
            towerDps(def, next, mix, splash) * cachedCoverage(t.tile, def.levels[next - 1]!.range) -
            towerDps(def, t.level, mix, splash) * cachedCoverage(t.tile, def.levels[t.level - 1]!.range);
          if (t.kind === 'frost') {
            const s0 = def.levels[t.level - 1]!;
            const s1 = def.levels[next - 1]!;
            gain +=
              (o.frostSlowValue ?? 0) *
              ((1 - (s1.slowFactor ?? 1)) / 0.3 * frostBoost(sim, t.tile, s1.range) - (1 - (s0.slowFactor ?? 1)) / 0.3 * frostBoost(sim, t.tile, s0.range));
          }
          const id = t.id;
          consider(gain / cost, cost, () => sim.upgrade(id).ok);
        }
        const chosen = best as { value: number; apply: () => boolean } | null;
        if (!chosen || chosen.value <= 0) break;
        if (!chosen.apply()) break;
      }
    },
  };
}

/** Buzun menzilindeki yol üzerinde ateş eden diğer kulelerin sayısı (kaba yavaşlatma değeri). */
function frostBoost(sim: Simulation, tile: TileCoord, range: number): number {
  let n = 0;
  for (const t of sim.state.towers) {
    if (t.kind === 'frost') continue;
    const d = Math.hypot(t.tile.col - tile.col, t.tile.row - tile.row);
    const r = sim.towerDefs[t.kind].levels[t.level - 1]!.range;
    if (d <= r + range) n += 1;
  }
  return 1 + n;
}

export function towersAt(towers: readonly TowerState[]): string {
  return towers.map((t) => `${t.kind[0]}${t.level}@${t.tile.col},${t.tile.row}`).join(' ');
}

/** Derin kopyayla değiştirilmiş kule tanımları. */
export function patchTowers(base: Readonly<Record<TowerKind, TowerDef>>, patch: (d: Record<TowerKind, TowerDef>) => void): Record<TowerKind, TowerDef> {
  const copy = JSON.parse(JSON.stringify(base)) as Record<TowerKind, TowerDef>;
  patch(copy);
  return copy;
}
