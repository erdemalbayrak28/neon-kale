// Oyunun kalbi: Phaser'dan bağımsız, saf TypeScript simülasyonu.
// Çizim katmanı her karede update(dt) çağırır, dönen olaylarla efekt çizer ve `state` üzerinden her şeyi okur.
// Oyuncu eylemleri (kur, yükselt, sat, dalga başlat) sadece bu sınıfın komut metotlarıyla yapılır.
//
// Zaman sabit adımlarla (FIXED_STEP) ilerler; aynı komutlar ve aynı dt dizisi her zaman aynı sonucu verir.
// Bir adımın sırası: zaman → düşman çıkışı → düşman hareketi (sızma) → mermiler → kuleler → ölüleri temizle → dalga kontrolü.

import { FIXED_STEP, TILE } from '../config';
import {
  EPS,
  applyArmor,
  combineSlow,
  findFurthestInRange,
  isWithin,
  refundFor,
  scaledHp,
  starsFor,
} from './combat';
import { ENEMIES } from './data/enemies';
import { MAP_1 } from './data/maps';
import { RULES } from './data/rules';
import { TOWERS } from './data/towers';
import { WAVES } from './data/waves';
import { tileCenter, tileKey } from './grid';
import { Path } from './path';
import { buildSpawnSchedule, countWaveEnemies, type SpawnEntry } from './schedule';
import type {
  CommandFailure,
  CommandResult,
  EnemyDef,
  EnemyKind,
  EnemyState,
  GameEvent,
  GameStateView,
  GameStatus,
  MapDef,
  ProjectileState,
  RulesConfig,
  TileCoord,
  TowerDef,
  TowerKind,
  TowerLevelStats,
  TowerState,
  Vec2,
  WaveDef,
} from './types';

export interface SimulationOptions {
  map?: MapDef;
  towers?: Readonly<Record<TowerKind, TowerDef>>;
  enemies?: Readonly<Record<EnemyKind, EnemyDef>>;
  waves?: readonly WaveDef[];
  rules?: RulesConfig;
}

/** Tek bir update çağrısında kabul edilen en uzun süre (saniye). Sekme uzun süre arka planda kalınca oyun sıçramasın. */
export const MAX_FRAME_DT = 0.25;

/** Kulelerin ilk namlu açısı: yukarı. */
const INITIAL_AIM = -Math.PI / 2;

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** Sahadaki düşman. `EnemyState` alanları çizim katmanına olduğu gibi gösterilir; diğerleri iç hesap içindir. */
interface Enemy extends Mutable<EnemyState> {
  /** Yavaşlatılmamış hız (piksel/saniye). */
  speedPx: number;
  reward: number;
  leakDamage: number;
  /** Bu adımda öldürüldüyse ya da sızdıysa false; adımın sonunda listeden çıkarılır. */
  alive: boolean;
}

interface Tower extends Mutable<TowerState> {
  /** Sonraki atışa kalan süre (saniye); 0 ya da altı = hazır. */
  cooldown: number;
}

interface Projectile extends Mutable<ProjectileState> {
  /** Kovaladığı düşman; ölmüş ya da sızmışsa null (son bilinen konuma gider). */
  targetId: number | null;
  damage: number;
  /** Alan hasarı yarıçapı (piksel). */
  splashRadius: number;
  /** Hız (piksel/saniye). */
  speed: number;
  done: boolean;
}

/** Başlatılmış ve henüz temizlenmemiş bir dalga. */
interface ActiveWave {
  readonly number: number;
  readonly startTime: number;
  readonly schedule: readonly SpawnEntry[];
  /** Sıradaki çıkacak düşmanın `schedule` içindeki sırası. */
  nextSpawn: number;
  /** Bu dalgadan sahada canlı olan düşman sayısı. */
  alive: number;
}

const OK: CommandResult = { ok: true };

function fail(reason: CommandFailure): CommandResult {
  return { ok: false, reason };
}

function copyVec(v: Vec2): Vec2 {
  return { x: v.x, y: v.y };
}

function copyTile(t: TileCoord): TileCoord {
  return { col: t.col, row: t.row };
}

/** Kulenin verilen seviyedeki değerleri. */
function statsAt(def: TowerDef, level: 1 | 2 | 3): TowerLevelStats {
  const [first, second, third] = def.levels;
  return level === 1 ? first : level === 2 ? second : third;
}

export class Simulation {
  readonly map: MapDef;
  readonly towerDefs: Readonly<Record<TowerKind, TowerDef>>;
  readonly enemyDefs: Readonly<Record<EnemyKind, EnemyDef>>;
  readonly waves: readonly WaveDef[];
  readonly rules: RulesConfig;

  private readonly path: Path;
  private readonly blockedTiles: ReadonlySet<string>;
  private readonly schedules: readonly (readonly SpawnEntry[])[];

  private stepCount = 0;
  private time = 0;
  private accumulator = 0;
  private status: GameStatus = 'building';
  private gold: number;
  private lives: number;
  private wavesStarted = 0;
  private stars = 0;

  // Çizim katmanına `state` ile doğrudan (kopyalanmadan) verilen diziler. Eleman çıkınca dizi yenisiyle değiştirilir.
  private enemies: Enemy[] = [];
  private towers: Tower[] = [];
  private projectiles: Projectile[] = [];

  private readonly enemiesById = new Map<number, Enemy>();
  private readonly towersById = new Map<number, Tower>();
  private readonly towersByTile = new Map<string, Tower>();
  private readonly activeWaves: ActiveWave[] = [];
  private events: GameEvent[] = [];

  private nextEnemyId = 1;
  private nextTowerId = 1;
  private nextProjectileId = 1;

  constructor(options: SimulationOptions = {}) {
    this.map = options.map ?? MAP_1;
    this.towerDefs = options.towers ?? TOWERS;
    this.enemyDefs = options.enemies ?? ENEMIES;
    this.waves = options.waves ?? WAVES;
    this.rules = options.rules ?? RULES;

    this.path = new Path(this.map);
    this.blockedTiles = new Set((this.map.blocked ?? []).map(tileKey));
    this.schedules = this.waves.map(buildSpawnSchedule);
    this.gold = this.rules.startingGold;
    this.lives = this.rules.startingLives;
  }

  /**
   * Oyunun anlık durumu. Her çağrıda güncel; çizim katmanı değiştirmemeli.
   * Ucuzdur: düşman/kule/mermi dizileri kopyalanmaz (salt okunur olarak verilir).
   */
  get state(): GameStateView {
    return {
      time: this.time,
      status: this.status,
      gold: this.gold,
      lives: this.lives,
      wavesStarted: this.wavesStarted,
      totalWaves: this.waves.length,
      spawningDone: this.isSpawningDone(),
      enemies: this.enemies,
      towers: this.towers,
      projectiles: this.projectiles,
      stars: this.stars,
    };
  }

  /** Yolun piksel çoklu çizgisi (köşe noktalarının karo merkezleri; ilk nokta giriş, son nokta çıkış). */
  get pathPoints(): readonly { x: number; y: number }[] {
    return this.path.points;
  }

  /**
   * Simülasyonu `dt` saniye ilerletir (içeride FIXED_STEP adımlarıyla; dt en fazla 0.25 sn kabul edilir).
   * Son çağrıdan bu yana oluşan bütün olayları (komutların ürettikleri dahil) sırasıyla döner.
   * Oyun bittiyse (zafer/yenilgi) zaman ilerlemez, boş dizi döner (bekleyen olaylar hariç).
   */
  update(dt: number): GameEvent[] {
    if (!this.isOver()) {
      const clamped = Number.isFinite(dt) && dt > 0 ? Math.min(dt, MAX_FRAME_DT) : 0;
      this.accumulator += clamped;
      while (this.accumulator + EPS >= FIXED_STEP) {
        this.accumulator -= FIXED_STEP;
        this.step(FIXED_STEP);
        if (this.isOver()) {
          this.accumulator = 0;
          break;
        }
      }
      if (this.accumulator < 0) this.accumulator = 0;
    }
    const out = this.events;
    this.events = [];
    return out;
  }

  /** Bu karoya kule kurulabilir mi (altın hariç: harita içi, yol değil, engel değil, boş)? */
  canPlace(tile: TileCoord): CommandResult {
    const { col, row } = tile;
    if (!Number.isInteger(col) || !Number.isInteger(row)) return fail('outOfBounds');
    if (col < 0 || row < 0 || col >= this.map.cols || row >= this.map.rows) return fail('outOfBounds');
    const key = tileKey(tile);
    if (this.path.tiles.has(key)) return fail('onPath');
    if (this.blockedTiles.has(key)) return fail('blocked');
    if (this.towersByTile.has(key)) return fail('occupied');
    return OK;
  }

  /** Kule kurar. Altın yetmiyorsa ya da karo uygun değilse hiçbir şey değişmez. */
  build(kind: TowerKind, tile: TileCoord): CommandResult {
    if (this.isOver()) return fail('gameOver');
    const placement = this.canPlace(tile);
    if (!placement.ok) return placement;
    const cost = this.towerDefs[kind].levels[0].cost;
    if (this.gold < cost) return fail('notEnoughGold');

    this.gold -= cost;
    const tower: Tower = {
      id: this.nextTowerId++,
      kind,
      level: 1,
      tile: copyTile(tile),
      pos: tileCenter(tile),
      aimAngle: INITIAL_AIM,
      targetId: null,
      invested: cost,
      cooldown: 0,
    };
    this.towers = [...this.towers, tower];
    this.towersById.set(tower.id, tower);
    this.towersByTile.set(tileKey(tile), tower);
    this.emit({ type: 'towerBuilt', towerId: tower.id, kind, tile: copyTile(tile), pos: copyVec(tower.pos) });
    return OK;
  }

  /** Kuleyi bir seviye yükseltir (en fazla 3). */
  upgrade(towerId: number): CommandResult {
    if (this.isOver()) return fail('gameOver');
    const tower = this.towersById.get(towerId);
    if (!tower) return fail('noTower');
    if (tower.level >= 3) return fail('maxLevel');
    const nextLevel: 2 | 3 = tower.level === 1 ? 2 : 3;
    const cost = statsAt(this.towerDefs[tower.kind], nextLevel).cost;
    if (this.gold < cost) return fail('notEnoughGold');

    this.gold -= cost;
    tower.level = nextLevel;
    tower.invested += cost;
    this.emit({ type: 'towerUpgraded', towerId, kind: tower.kind, level: nextLevel, pos: copyVec(tower.pos) });
    return OK;
  }

  /** Kuleyi satar; harcanan toplamın `rules.sellRefund` oranı geri verilir. */
  sell(towerId: number): CommandResult {
    if (this.isOver()) return fail('gameOver');
    const tower = this.towersById.get(towerId);
    if (!tower) return fail('noTower');

    const refund = refundFor(tower.invested, this.rules.sellRefund);
    this.gold += refund;
    this.towers = this.towers.filter((t) => t !== tower);
    this.towersById.delete(towerId);
    this.towersByTile.delete(tileKey(tower.tile));
    // Havadaki mermileri uçmaya devam eder.
    this.emit({
      type: 'towerSold',
      towerId,
      kind: tower.kind,
      refund,
      tile: copyTile(tower.tile),
      pos: copyVec(tower.pos),
    });
    return OK;
  }

  /**
   * Sonraki dalgayı başlatır. 'building' durumunda her zaman; 'wave' durumunda ancak sahadaki son dalganın
   * bütün düşmanları çıktıysa (spawningDone) mümkündür ve bu "erken çağırma" `rules.earlyCallBonus` altın kazandırır.
   */
  startNextWave(): CommandResult {
    if (this.isOver()) return fail('gameOver');
    if (this.wavesStarted >= this.waves.length) return fail('noMoreWaves');
    const early = this.status === 'wave';
    if (early && !this.isSpawningDone()) return fail('waveInProgress');

    const number = this.wavesStarted + 1;
    this.wavesStarted = number;
    this.activeWaves.push({
      number,
      startTime: this.time,
      schedule: this.schedules[number - 1]!,
      nextSpawn: 0,
      alive: 0,
    });
    const earlyBonus = early ? this.rules.earlyCallBonus : 0;
    this.gold += earlyBonus;
    this.status = 'wave';
    this.emit({ type: 'waveStarted', wave: number, early, earlyBonus });
    return OK;
  }

  /** Karodaki kule (yoksa undefined). */
  towerAt(tile: TileCoord): TowerState | undefined {
    return this.towersByTile.get(tileKey(tile));
  }

  towerById(towerId: number): TowerState | undefined {
    return this.towersById.get(towerId);
  }

  /** Bir sonraki seviyenin bedeli; en üst seviyedeyse null. */
  upgradeCost(towerId: number): number | null {
    const tower = this.towersById.get(towerId);
    if (!tower || tower.level >= 3) return null;
    return statsAt(this.towerDefs[tower.kind], tower.level === 1 ? 2 : 3).cost;
  }

  /** Satılırsa geri verilecek altın. */
  sellValue(towerId: number): number {
    const tower = this.towersById.get(towerId);
    return tower ? refundFor(tower.invested, this.rules.sellRefund) : 0;
  }

  /** Karo yol üzerinde mi? */
  isPathTile(tile: TileCoord): boolean {
    return this.path.isPathTile(tile);
  }

  /** Dalga numarasına (1'den başlar) göre bir düşman türünün o dalgadaki azami canı. */
  enemyMaxHp(kind: EnemyKind, wave: number): number {
    return scaledHp(this.enemyDefs[kind].maxHp, this.rules.hpGrowthPerWave, wave);
  }

  /** Sıradaki (henüz başlamamış) dalganın özeti; dalga kalmadıysa null. Panelde "Sıradaki dalga" için. */
  nextWavePreview(): { wave: number; counts: Partial<Record<EnemyKind, number>> } | null {
    const def = this.waves[this.wavesStarted];
    if (!def) return null;
    return { wave: this.wavesStarted + 1, counts: countWaveEnemies(def) };
  }

  // ── iç işleyiş ──────────────────────────────────────────────

  private isOver(): boolean {
    return this.status === 'victory' || this.status === 'defeat';
  }

  /** Başlatılan dalgaların hiçbirinde çıkmayı bekleyen düşman kalmadı mı? (Hiç dalga başlamadıysa da true.) */
  private isSpawningDone(): boolean {
    for (const wave of this.activeWaves) {
      if (wave.nextSpawn < wave.schedule.length) return false;
    }
    return true;
  }

  private emit(event: GameEvent): void {
    this.events.push(event);
  }

  private levelStats(tower: Tower): TowerLevelStats {
    return statsAt(this.towerDefs[tower.kind], tower.level);
  }

  private step(dt: number): void {
    this.stepCount++;
    this.time = this.stepCount * FIXED_STEP;

    this.spawnDueEnemies();
    if (this.moveEnemies(dt)) return; // yenilgi: bu adımda başka hiçbir şey olmaz
    this.updateProjectiles(dt);
    this.updateTowers(dt);
    this.removeFinished();
    this.checkWaves();
  }

  private spawnDueEnemies(): void {
    for (const wave of this.activeWaves) {
      while (wave.nextSpawn < wave.schedule.length) {
        const entry = wave.schedule[wave.nextSpawn]!;
        if (wave.startTime + entry.time > this.time + EPS) break;
        wave.nextSpawn++;
        this.spawnEnemy(entry.enemy, wave);
      }
    }
  }

  private spawnEnemy(kind: EnemyKind, wave: ActiveWave): void {
    const def = this.enemyDefs[kind];
    const start = this.path.positionAt(0);
    const maxHp = this.enemyMaxHp(kind, wave.number);
    const enemy: Enemy = {
      id: this.nextEnemyId++,
      kind,
      wave: wave.number,
      hp: maxHp,
      maxHp,
      armor: def.armor,
      distance: 0,
      pos: start.pos,
      heading: start.heading,
      speedMultiplier: 1,
      slowUntil: 0,
      speedPx: def.speed * TILE,
      reward: def.reward,
      leakDamage: def.leakDamage,
      alive: true,
    };
    this.enemies.push(enemy);
    this.enemiesById.set(enemy.id, enemy);
    wave.alive++;
    this.emit({ type: 'enemySpawned', enemyId: enemy.id, kind, wave: wave.number });
  }

  /** Düşmanları ilerletir, sızanları işler. Yenilgi olduysa true döner. */
  private moveEnemies(dt: number): boolean {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (enemy.slowUntil > 0 && this.time + EPS >= enemy.slowUntil) {
        enemy.speedMultiplier = 1;
        enemy.slowUntil = 0;
      }
      enemy.distance += enemy.speedPx * enemy.speedMultiplier * dt;
      if (enemy.distance >= this.path.length) {
        enemy.distance = this.path.length;
        const end = this.path.positionAt(enemy.distance);
        enemy.pos.x = end.pos.x;
        enemy.pos.y = end.pos.y;
        if (this.leak(enemy)) {
          this.removeFinished();
          return true;
        }
        continue;
      }
      const sample = this.path.positionAt(enemy.distance);
      enemy.pos.x = sample.pos.x;
      enemy.pos.y = sample.pos.y;
      enemy.heading = sample.heading;
    }
    return false;
  }

  /** Düşman çıkışa ulaştı: can gider, ödül yok. Can bittiyse yenilgi ilan edilir ve true döner. */
  private leak(enemy: Enemy): boolean {
    this.retire(enemy);
    this.lives = Math.max(0, this.lives - enemy.leakDamage);
    this.emit({ type: 'enemyLeaked', enemyId: enemy.id, kind: enemy.kind, damage: enemy.leakDamage });
    if (this.lives > 0) return false;
    this.status = 'defeat';
    this.emit({ type: 'defeat' });
    return true;
  }

  /** Düşmanı sahadan düşer (ölüm ya da sızma). Listeden çıkarılması adımın sonunda yapılır. */
  private retire(enemy: Enemy): void {
    enemy.alive = false;
    this.enemiesById.delete(enemy.id);
    const wave = this.activeWaves.find((w) => w.number === enemy.wave);
    if (wave) wave.alive--;
  }

  private damageEnemy(enemy: Enemy, rawDamage: number): void {
    if (!enemy.alive) return;
    const damage = applyArmor(rawDamage, enemy.armor);
    enemy.hp = Math.max(0, enemy.hp - damage);
    this.emit({ type: 'enemyHit', enemyId: enemy.id, damage, pos: copyVec(enemy.pos) });
    if (enemy.hp > 0) return;
    this.retire(enemy);
    this.gold += enemy.reward;
    this.emit({ type: 'enemyKilled', enemyId: enemy.id, kind: enemy.kind, pos: copyVec(enemy.pos), reward: enemy.reward });
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      if (p.targetId !== null) {
        const target = this.enemiesById.get(p.targetId);
        if (target) {
          p.targetPos.x = target.pos.x;
          p.targetPos.y = target.pos.y;
        } else {
          p.targetId = null; // hedef öldü ya da sızdı: son bilinen konuma git
        }
      }
      const dx = p.targetPos.x - p.pos.x;
      const dy = p.targetPos.y - p.pos.y;
      const dist = Math.hypot(dx, dy);
      const move = p.speed * dt;
      if (dist <= move + EPS) {
        p.pos.x = p.targetPos.x;
        p.pos.y = p.targetPos.y;
        this.explode(p);
      } else {
        p.pos.x += (dx / dist) * move;
        p.pos.y += (dy / dist) * move;
      }
    }
  }

  /** Mermi vardı: yarıçaptaki bütün düşmanlara tam hasar (zırh her birine ayrı). */
  private explode(p: Projectile): void {
    p.done = true;
    this.emit({ type: 'explosion', pos: copyVec(p.pos), radius: p.splashRadius });
    for (const enemy of this.enemies) {
      if (enemy.alive && isWithin(p.pos, enemy.pos, p.splashRadius)) this.damageEnemy(enemy, p.damage);
    }
  }

  private updateTowers(dt: number): void {
    for (const tower of this.towers) {
      const stats = this.levelStats(tower);
      const range = stats.range * TILE;

      // Hedef menzilden çıktıysa ya da öldüyse yeniden seç; değilse kilitli kal.
      let target = tower.targetId !== null ? this.enemiesById.get(tower.targetId) : undefined;
      if (target && !isWithin(tower.pos, target.pos, range)) target = undefined;
      target ??= findFurthestInRange(this.enemies, tower.pos, range);
      tower.targetId = target ? target.id : null;
      if (target) tower.aimAngle = Math.atan2(target.pos.y - tower.pos.y, target.pos.x - tower.pos.x);

      if (tower.cooldown > 0) tower.cooldown -= dt;
      if (!target) {
        // Hedef yoksa ateş etmez; bekleme süresi dolu kalır, ilk gelen düşmana hemen ateş eder.
        if (tower.cooldown < 0) tower.cooldown = 0;
        continue;
      }
      if (tower.cooldown > EPS) continue;
      // Sürekli ateşte adımın taşan kısmı korunur ki atış aralığı adım boyuna yuvarlanmasın.
      tower.cooldown += stats.fireInterval;
      this.fire(tower, stats, target, range);
      if (!target.alive) tower.targetId = null;
    }
  }

  private fire(tower: Tower, stats: TowerLevelStats, target: Enemy, range: number): void {
    const attack = this.towerDefs[tower.kind].attack;
    if (attack === 'hitscan') {
      this.emit({ type: 'shot', towerId: tower.id, kind: tower.kind, from: copyVec(tower.pos), to: copyVec(target.pos) });
      this.damageEnemy(target, stats.damage);
      return;
    }
    if (attack === 'projectile') {
      this.projectiles.push({
        id: this.nextProjectileId++,
        towerKind: tower.kind,
        pos: copyVec(tower.pos),
        targetPos: copyVec(target.pos),
        targetId: target.id,
        damage: stats.damage,
        splashRadius: (stats.splashRadius ?? 0) * TILE,
        speed: (stats.projectileSpeed ?? 0) * TILE,
        done: false,
      });
      this.emit({ type: 'shot', towerId: tower.id, kind: tower.kind, from: copyVec(tower.pos), to: copyVec(target.pos) });
      return;
    }
    // pulse: menzildeki herkese hasar ve yavaşlatma
    this.emit({ type: 'shot', towerId: tower.id, kind: tower.kind, from: copyVec(tower.pos), to: copyVec(tower.pos) });
    this.emit({ type: 'pulse', towerId: tower.id, pos: copyVec(tower.pos), radius: range });
    for (const enemy of this.enemies) {
      if (!enemy.alive || !isWithin(tower.pos, enemy.pos, range)) continue;
      this.damageEnemy(enemy, stats.damage);
      if (!enemy.alive) continue;
      const slow = combineSlow(
        { multiplier: enemy.speedMultiplier, until: enemy.slowUntil },
        this.time,
        stats.slowFactor ?? 1,
        stats.slowDuration ?? 0,
      );
      enemy.speedMultiplier = slow.multiplier;
      enemy.slowUntil = slow.until;
    }
  }

  /** Ölen/sızan düşmanları ve patlayan mermileri listelerden çıkarır; ölü hedeflere kilitli kuleleri bırakır. */
  private removeFinished(): void {
    if (this.enemies.some((e) => !e.alive)) {
      this.enemies = this.enemies.filter((e) => e.alive);
      for (const tower of this.towers) {
        if (tower.targetId !== null && !this.enemiesById.has(tower.targetId)) tower.targetId = null;
      }
    }
    if (this.projectiles.some((p) => p.done)) {
      this.projectiles = this.projectiles.filter((p) => !p.done);
    }
  }

  /** Bütün düşmanları çıkmış ve hepsi ölmüş/sızmış dalgaları temizler (ödül bir kez), durumu günceller. */
  private checkWaves(): void {
    for (let i = 0; i < this.activeWaves.length; ) {
      const wave = this.activeWaves[i]!;
      if (wave.nextSpawn >= wave.schedule.length && wave.alive <= 0) {
        this.activeWaves.splice(i, 1);
        const bonus = this.rules.waveBonusBase + this.rules.waveBonusPerWave * wave.number;
        this.gold += bonus;
        this.emit({ type: 'waveCleared', wave: wave.number, bonus });
      } else {
        i++;
      }
    }

    if (this.activeWaves.length > 0) {
      this.status = 'wave';
    } else if (this.waves.length > 0 && this.wavesStarted >= this.waves.length) {
      this.status = 'victory';
      this.stars = starsFor(this.lives, this.rules);
      this.emit({ type: 'victory', stars: this.stars });
    } else {
      this.status = 'building';
    }
  }
}
