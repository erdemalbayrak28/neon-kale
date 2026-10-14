// Oyunun kalbi: Phaser'dan bağımsız, saf TypeScript simülasyonu.
// Çizim katmanı her karede update(dt) çağırır, dönen olaylarla efekt çizer ve `state` üzerinden her şeyi okur.
// Oyuncu eylemleri (kur, yükselt, sat, dalga başlat) sadece bu sınıfın komut metotlarıyla yapılır.
//
// BU DOSYA BİR SÖZLEŞME İSKELETİDİR: genel (public) imzalar sabittir, gövdeler çekirdek ajanı tarafından yazılacak.

import { ENEMIES } from './data/enemies';
import { MAP_1 } from './data/maps';
import { RULES } from './data/rules';
import { TOWERS } from './data/towers';
import { WAVES } from './data/waves';
import type {
  CommandResult,
  EnemyDef,
  EnemyKind,
  GameEvent,
  GameStateView,
  MapDef,
  RulesConfig,
  TileCoord,
  TowerDef,
  TowerKind,
  TowerState,
  WaveDef,
} from './types';

export interface SimulationOptions {
  map?: MapDef;
  towers?: Readonly<Record<TowerKind, TowerDef>>;
  enemies?: Readonly<Record<EnemyKind, EnemyDef>>;
  waves?: readonly WaveDef[];
  rules?: RulesConfig;
}

export class Simulation {
  readonly map: MapDef;
  readonly towerDefs: Readonly<Record<TowerKind, TowerDef>>;
  readonly enemyDefs: Readonly<Record<EnemyKind, EnemyDef>>;
  readonly waves: readonly WaveDef[];
  readonly rules: RulesConfig;

  constructor(options: SimulationOptions = {}) {
    this.map = options.map ?? MAP_1;
    this.towerDefs = options.towers ?? TOWERS;
    this.enemyDefs = options.enemies ?? ENEMIES;
    this.waves = options.waves ?? WAVES;
    this.rules = options.rules ?? RULES;
    throw new Error('Henüz yazılmadı');
  }

  /** Oyunun anlık durumu. Her çağrıda güncel; çizim katmanı değiştirmemeli. */
  get state(): GameStateView {
    throw new Error('Henüz yazılmadı');
  }

  /** Yolun karo kümesi ve geometrisi (çizim için). */
  get pathPoints(): readonly { x: number; y: number }[] {
    throw new Error('Henüz yazılmadı');
  }

  /**
   * Simülasyonu `dt` saniye ilerletir (içeride FIXED_STEP adımlarıyla; dt en fazla 0.25 sn kabul edilir).
   * Son çağrıdan bu yana oluşan bütün olayları (komutların ürettikleri dahil) sırasıyla döner.
   * Oyun bittiyse (zafer/yenilgi) zaman ilerlemez, boş dizi döner (bekleyen olaylar hariç).
   */
  update(dt: number): GameEvent[] {
    void dt;
    throw new Error('Henüz yazılmadı');
  }

  /** Bu karoya kule kurulabilir mi (altın hariç: harita içi, yol değil, engel değil, boş)? */
  canPlace(tile: TileCoord): CommandResult {
    void tile;
    throw new Error('Henüz yazılmadı');
  }

  /** Kule kurar. Altın yetmiyorsa ya da karo uygun değilse hiçbir şey değişmez. */
  build(kind: TowerKind, tile: TileCoord): CommandResult {
    void kind;
    void tile;
    throw new Error('Henüz yazılmadı');
  }

  /** Kuleyi bir seviye yükseltir (en fazla 3). */
  upgrade(towerId: number): CommandResult {
    void towerId;
    throw new Error('Henüz yazılmadı');
  }

  /** Kuleyi satar; harcanan toplamın `rules.sellRefund` oranı geri verilir. */
  sell(towerId: number): CommandResult {
    void towerId;
    throw new Error('Henüz yazılmadı');
  }

  /**
   * Sonraki dalgayı başlatır. 'building' durumunda her zaman; 'wave' durumunda ancak sahadaki son dalganın
   * bütün düşmanları çıktıysa (spawningDone) mümkündür ve bu "erken çağırma" `rules.earlyCallBonus` altın kazandırır.
   */
  startNextWave(): CommandResult {
    throw new Error('Henüz yazılmadı');
  }

  /** Karodaki kule (yoksa undefined). */
  towerAt(tile: TileCoord): TowerState | undefined {
    void tile;
    throw new Error('Henüz yazılmadı');
  }

  towerById(towerId: number): TowerState | undefined {
    void towerId;
    throw new Error('Henüz yazılmadı');
  }

  /** Bir sonraki seviyenin bedeli; en üst seviyedeyse null. */
  upgradeCost(towerId: number): number | null {
    void towerId;
    throw new Error('Henüz yazılmadı');
  }

  /** Satılırsa geri verilecek altın. */
  sellValue(towerId: number): number {
    void towerId;
    throw new Error('Henüz yazılmadı');
  }

  /** Karo yol üzerinde mi? */
  isPathTile(tile: TileCoord): boolean {
    void tile;
    throw new Error('Henüz yazılmadı');
  }

  /** Dalga numarasına (1'den başlar) göre bir düşman türünün o dalgadaki azami canı. */
  enemyMaxHp(kind: EnemyKind, wave: number): number {
    void kind;
    void wave;
    throw new Error('Henüz yazılmadı');
  }

  /** Sıradaki (henüz başlamamış) dalganın özeti; dalga kalmadıysa null. Panelde "Sıradaki dalga" için. */
  nextWavePreview(): { wave: number; counts: Partial<Record<EnemyKind, number>> } | null {
    throw new Error('Henüz yazılmadı');
  }
}
