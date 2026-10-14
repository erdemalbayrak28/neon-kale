// Çekirdek oyunun ortak türleri. Çekirdek (src/core) Phaser'ı bilmez; çizim katmanı (src/scenes, src/render, src/ui)
// oyunun durumunu sadece bu türler üzerinden okur ve sadece Simulation'ın komut metotlarıyla değiştirir.
//
// Birimler: veri dosyalarındaki menzil, hız, yarıçap gibi değerler KARO cinsindendir; çalışma anındaki durum
// (konumlar, mesafeler) harita sol üst köşesine göre PİKSEL cinsindendir (1 karo = TILE piksel). Süreler saniyedir.

export interface Vec2 {
  x: number;
  y: number;
}

/** Izgaradaki bir karo. Harita dışını göstermek için -1 ya da cols/rows olabilir (giriş/çıkış noktaları). */
export interface TileCoord {
  col: number;
  row: number;
}

// ── tanımlar (veri) ───────────────────────────────────────────

export type TowerKind = 'laser' | 'cannon' | 'frost';
export type EnemyKind = 'runner' | 'scout' | 'brute';

/** Kule saldırı biçimi: anında isabet eden ışın, uçan mermi (alan hasarı) ya da menzildeki herkese vuran dalga. */
export type AttackKind = 'hitscan' | 'projectile' | 'pulse';

export interface TowerLevelStats {
  /** 1. seviyede kurma bedeli; 2. ve 3. seviyede o seviyeye yükseltme bedeli. */
  cost: number;
  damage: number;
  /** İki atış arası süre (saniye). */
  fireInterval: number;
  /** Menzil (karo). Kulenin merkezinden düşmanın merkezine olan mesafe. */
  range: number;
  /** Mermi hızı (karo/saniye). Sadece 'projectile' kuleler. */
  projectileSpeed?: number;
  /** Alan hasarı yarıçapı (karo). Sadece 'projectile' kuleler. */
  splashRadius?: number;
  /** Yavaşlatma çarpanı (0.6 = %40 yavaşlar). Sadece 'pulse' kuleler. */
  slowFactor?: number;
  /** Yavaşlatma süresi (saniye). */
  slowDuration?: number;
}

export interface TowerDef {
  kind: TowerKind;
  /** Oyuncuya görünen ad (Türkçe). */
  name: string;
  /** Kısa açıklama (Türkçe, tek cümle). */
  description: string;
  color: number;
  /** Kısayol tuşu ('1', '2', '3'). */
  hotkey: string;
  attack: AttackKind;
  levels: readonly [TowerLevelStats, TowerLevelStats, TowerLevelStats];
}

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  color: number;
  /** 1. dalgadaki can. Sonraki dalgalarda RulesConfig.hpGrowthPerWave ile artar. */
  maxHp: number;
  /** Hız (karo/saniye). */
  speed: number;
  /** Her isabetten düşülen sabit zırh. Hasar hiçbir zaman 1'in altına inmez. */
  armor: number;
  /** Öldürünce kazanılan altın. */
  reward: number;
  /** Çıkışa ulaşırsa giden can. */
  leakDamage: number;
  /** Çarpışma/çizim yarıçapı (karo). */
  radius: number;
}

export interface SpawnGroup {
  enemy: EnemyKind;
  count: number;
  /** Aynı gruptaki iki düşman arası süre (saniye). */
  interval: number;
  /** Dalga başladıktan kaç saniye sonra bu grubun ilk düşmanı çıkar. */
  delay: number;
}

export interface WaveDef {
  groups: readonly SpawnGroup[];
}

export interface MapDef {
  id: string;
  name: string;
  cols: number;
  rows: number;
  /**
   * Yolun köşe noktaları (karo). İlk nokta giriş, son nokta çıkış; ikisi de harita dışında olabilir.
   * Ardışık iki nokta aynı satırda ya da aynı sütunda olmalı (sadece yatay/dikey parçalar).
   */
  waypoints: readonly TileCoord[];
  /** Yol dışında, üzerine kule kurulamayan karolar (süs/engel). */
  blocked?: readonly TileCoord[];
}

export interface RulesConfig {
  startingGold: number;
  startingLives: number;
  /** Satışta geri verilen oran (kurma + yükseltme toplamının). */
  sellRefund: number;
  /** Dalga temizlenince verilen ödül: base + perWave × dalgaNo. */
  waveBonusBase: number;
  waveBonusPerWave: number;
  /** Önceki dalga sahadayken sonrakini erken çağırma ödülü. */
  earlyCallBonus: number;
  /** Düşman canı çarpanı: 1 + hpGrowthPerWave × (dalgaNo − 1). */
  hpGrowthPerWave: number;
  /** Zafer yıldızları: kalan can bu eşiklerin üstündeyse 3 / 2 yıldız, değilse 1. */
  threeStarLives: number;
  twoStarLives: number;
}

// ── çalışma anındaki durum (çizim katmanı sadece okur) ────────

export type GameStatus =
  /** Dalgalar arası: oyuncu kule kuruyor, "Dalgayı başlat" bekleniyor. */
  | 'building'
  /** En az bir dalga sahada. */
  | 'wave'
  | 'victory'
  | 'defeat';

export interface EnemyState {
  readonly id: number;
  readonly kind: EnemyKind;
  /** Hangi dalgadan geldiği (1'den başlar). */
  readonly wave: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly armor: number;
  /** Yol üzerinde girişten itibaren alınan mesafe (piksel). */
  readonly distance: number;
  /** Harita koordinatında konum (piksel). */
  readonly pos: Vec2;
  /** Hareket yönü (radyan, 0 = sağ). */
  readonly heading: number;
  /** Şu anki hız çarpanı (1 = normal, yavaşlatılmışsa < 1). */
  readonly speedMultiplier: number;
  /** Yavaşlatma etkisi biteceği oyun zamanı (saniye); yavaş değilse 0. */
  readonly slowUntil: number;
}

export interface TowerState {
  readonly id: number;
  readonly kind: TowerKind;
  readonly level: 1 | 2 | 3;
  readonly tile: TileCoord;
  /** Karonun merkezi (piksel). */
  readonly pos: Vec2;
  /** Namlunun baktığı açı (radyan). Hedef yoksa son açıda kalır. */
  readonly aimAngle: number;
  /** Şu an kilitlendiği düşman. */
  readonly targetId: number | null;
  /** Kurma + yükseltmelere harcanan toplam altın. */
  readonly invested: number;
}

export interface ProjectileState {
  readonly id: number;
  readonly towerKind: TowerKind;
  readonly pos: Vec2;
  /** Hedef ölürse mermi son bilinen konuma gider ve orada patlar. */
  readonly targetPos: Vec2;
}

export interface GameStateView {
  /** Oyun zamanı (saniye). Duraklatma ve hız ayarı çizim katmanında yapılır; bu sadece simülasyon süresidir. */
  readonly time: number;
  readonly status: GameStatus;
  readonly gold: number;
  readonly lives: number;
  /** Başlatılmış dalga sayısı (0 = henüz başlamadı). */
  readonly wavesStarted: number;
  readonly totalWaves: number;
  /** Başlatılan son dalganın bütün düşmanları çıktı mı? (Erken çağırma bundan sonra mümkün.) */
  readonly spawningDone: boolean;
  readonly enemies: readonly EnemyState[];
  readonly towers: readonly TowerState[];
  readonly projectiles: readonly ProjectileState[];
  /** Zaferde kazanılan yıldız (1–3); zafer yoksa 0. */
  readonly stars: number;
}

// ── olaylar: çizim katmanı efekt ve ses için dinler ───────────

export type GameEvent =
  | { type: 'towerBuilt'; towerId: number; kind: TowerKind; tile: TileCoord; pos: Vec2 }
  | { type: 'towerUpgraded'; towerId: number; kind: TowerKind; level: 2 | 3; pos: Vec2 }
  | { type: 'towerSold'; towerId: number; kind: TowerKind; refund: number; tile: TileCoord; pos: Vec2 }
  /** Bir kule ateş etti. Lazerde from→to ışın; topta mermi fırladı; buzda dalga yayıldı (to = from). */
  | { type: 'shot'; towerId: number; kind: TowerKind; from: Vec2; to: Vec2 }
  /** Buz kulesinin dalgası (yarıçap piksel). */
  | { type: 'pulse'; towerId: number; pos: Vec2; radius: number }
  /** Top mermisinin patlaması (yarıçap piksel). */
  | { type: 'explosion'; pos: Vec2; radius: number }
  | { type: 'enemyHit'; enemyId: number; damage: number; pos: Vec2 }
  | { type: 'enemySpawned'; enemyId: number; kind: EnemyKind; wave: number }
  | { type: 'enemyKilled'; enemyId: number; kind: EnemyKind; pos: Vec2; reward: number }
  | { type: 'enemyLeaked'; enemyId: number; kind: EnemyKind; damage: number }
  | { type: 'waveStarted'; wave: number; early: boolean; earlyBonus: number }
  | { type: 'waveCleared'; wave: number; bonus: number }
  | { type: 'victory'; stars: number }
  | { type: 'defeat' };

export type CommandFailure =
  | 'notEnoughGold'
  | 'outOfBounds'
  | 'onPath'
  | 'blocked'
  | 'occupied'
  | 'noTower'
  | 'maxLevel'
  | 'gameOver'
  | 'waveInProgress'
  | 'noMoreWaves';

export type CommandResult = { ok: true } | { ok: false; reason: CommandFailure };
