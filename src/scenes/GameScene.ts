import Phaser from 'phaser';
import { COLORS, FIXED_STEP, LAYOUT } from '../config';
import { TOWER_ORDER } from '../core/data/towers';
import { Simulation } from '../core/simulation';
import type { CommandFailure, CommandResult, GameEvent, GameStateView, TileCoord, TowerKind } from '../core/types';
import { insideMap, screenToTile } from '../render/coords';
import { DEPTH } from '../render/depth';
import { EffectsLayer } from '../render/EffectsLayer';
import { EntityLayer } from '../render/EntityLayer';
import { MapLayer } from '../render/MapLayer';
import { MapOverlay } from '../render/MapOverlay';
import { ensureTextures } from '../render/textures';
import { HintLine } from '../ui/HintLine';
import { isPortraitPhone } from '../ui/OrientationWarning';
import { PauseOverlay } from '../ui/PauseOverlay';
import { ResultOverlay } from '../ui/ResultOverlay';
import { SidePanel } from '../ui/SidePanel';
import { FAILURE_TEXT, GOLD, WAVE_BUTTON, hintFor } from '../ui/strings';
import { TopBar } from '../ui/TopBar';
import { WaveBanner } from '../ui/WaveBanner';
import { SCENE_KEYS } from './keys';

// Oyun sahnesi: her oyunda yeni bir Simulation kurar. Her karede (duraklatılmamışsa) sim.update(dt × hız) çağırır,
// dönen olayları efekt katmanına iletir, durumu çizer ve oyuncu girdisini simülasyon komutlarına çevirir.

/**
 * Oyun bitince sonuç penceresinin açılmadan önceki beklemesi (gerçek zaman, saniye; son patlamalar görünsün).
 * Phaser'ın saati yavaş karelerde gerçek zamanın gerisinde kalabildiği için gerçek zamanla ölçülür.
 */
const RESULT_DELAY = 0.9;
/** Kare süresinin üst sınırı (sekme arka plandan dönünce dev bir adım olmasın). */
const MAX_FRAME_DT = 0.1;

type Speed = 1 | 2;

export class GameScene extends Phaser.Scene {
  private simulation: Simulation | null = null;
  private mapLayer!: MapLayer;
  private entities!: EntityLayer;
  private effects!: EffectsLayer;
  private overlay!: MapOverlay;
  private topBar!: TopBar;
  private panel!: SidePanel;
  private hint!: HintLine;
  private banner!: WaveBanner;
  private pauseOverlay!: PauseOverlay;
  private result!: ResultOverlay;

  private placing: TowerKind | null = null;
  private selectedId: number | null = null;
  private hoverTile: TileCoord | null = null;
  private paused = false;
  private speed: Speed = 1;
  /** Oyunun bittiği gerçek zaman (saniye); bitmediyse null. */
  private endedAt: number | null = null;
  private realTime = 0;
  private status: GameStateView['status'] = 'building';
  private leaving = false;

  constructor() {
    super(SCENE_KEYS.game);
  }

  /** Şu anki oyunun simülasyonu (test kancası ve e2e için). */
  get sim(): Simulation {
    if (!this.simulation) throw new Error('Oyun sahnesi henüz kurulmadı');
    return this.simulation;
  }

  get currentSim(): Simulation | null {
    return this.simulation;
  }

  init(): void {
    // Sahne nesnesi yeniden başlatmada korunur; oyun durumunu burada sıfırla.
    this.simulation = null;
    this.placing = null;
    this.selectedId = null;
    this.hoverTile = null;
    this.paused = false;
    this.speed = 1;
    this.endedAt = null;
    this.status = 'building';
    this.leaving = false;
  }

  create(): void {
    ensureTextures(this);
    this.cameras.main.setBackgroundColor(COLORS.background);
    const sim = new Simulation();
    this.simulation = sim;

    this.mapLayer = new MapLayer(this, sim);
    this.entities = new EntityLayer(this, sim);
    this.effects = new EffectsLayer(this, sim);
    this.overlay = new MapOverlay(this, sim);
    this.banner = new WaveBanner(this);

    this.topBar = new TopBar(this, { onSpeed: () => this.toggleSpeed(), onPause: () => this.togglePause() });
    this.panel = new SidePanel(this, sim, {
      onPickTower: (kind) => this.pickTower(kind),
      onUpgrade: () => this.upgradeSelected(),
      onSell: () => this.sellSelected(),
      onWave: () => this.callWave(),
    });
    this.hint = new HintLine(this);
    this.pauseOverlay = new PauseOverlay(this, () => this.setPaused(false));
    this.result = new ResultOverlay(this, {
      onRestart: () => this.restart(),
      onMenu: () => this.goToMenu(),
    });

    this.setupInput();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.cameras.main.fadeIn(250, 10, 13, 20);
    this.renderFrame();
  }

  override update(time: number, delta: number): void {
    this.realTime = time / 1000;
    const dt = Math.min(delta / 1000, MAX_FRAME_DT);
    if (!this.paused && this.status === 'wave' && isPortraitPhone()) this.setPaused(true);
    if (!this.paused) {
      this.process(this.sim.update(dt * this.speed), 0);
      this.effects.update(dt);
    } else {
      this.effects.draw();
    }
    this.renderFrame();
  }

  /**
   * Simülasyonu duraklatma ve hızdan bağımsız olarak `seconds` saniye ileri sarar (FIXED_STEP adımlarla) ve
   * oluşan olayları efekt katmanına yaşlarıyla birlikte verir. Test kancası kullanır.
   */
  fastForward(seconds: number): void {
    const steps = Math.max(0, Math.round(seconds / FIXED_STEP));
    this.effects.skip(steps * FIXED_STEP);
    for (let i = 0; i < steps; i++) {
      this.process(this.sim.update(FIXED_STEP), (steps - 1 - i) * FIXED_STEP);
    }
    this.effects.draw();
    this.renderFrame();
  }

  // ── olaylar ───────────────────────────────────────────────

  private process(events: readonly GameEvent[], age: number): void {
    const clock = this.effects.clock - age;
    // Oyun bittiyse dalga duyurusu gösterme (sonuç penceresi açılacak).
    const status = events.length > 0 ? this.sim.state.status : this.status;
    const announce = age < 1 && status !== 'victory' && status !== 'defeat';
    for (const ev of events) {
      this.effects.handle(ev, age);
      switch (ev.type) {
        case 'enemyHit':
          this.entities.noteHit(ev.enemyId, clock);
          break;
        case 'shot':
          this.entities.noteShot(ev.towerId, clock);
          break;
        case 'enemyKilled':
        case 'enemyLeaked':
          this.entities.forgetEnemy(ev.enemyId);
          break;
        case 'towerSold':
          this.entities.forgetTower(ev.towerId);
          if (this.selectedId === ev.towerId) this.selectedId = null;
          break;
        case 'waveStarted':
          if (announce) {
            const total = this.sim.waves[ev.wave - 1]?.groups.reduce((sum, g) => sum + g.count, 0) ?? 0;
            const sub = ev.early ? `Erken çağrı: +${ev.earlyBonus} ${GOLD}` : `${total} düşman yolda`;
            this.banner.show(`DALGA ${ev.wave}`, sub, COLORS.menuGrid, clock);
          }
          break;
        case 'waveCleared':
          if (announce && ev.wave < this.sim.waves.length) {
            this.banner.show('DALGA TEMİZLENDİ', `Ödül: +${ev.bonus} ${GOLD}`, COLORS.valid, clock);
          }
          break;
        default:
          break;
      }
    }
  }

  // ── çizim ─────────────────────────────────────────────────

  private renderFrame(): void {
    const sim = this.sim;
    const state = sim.state;
    this.status = state.status;
    const ended = state.status === 'victory' || state.status === 'defeat';
    if (ended) {
      this.placing = null;
      this.selectedId = null;
    }
    if (this.selectedId !== null && !sim.towerById(this.selectedId)) this.selectedId = null;
    const selected = this.selectedId !== null ? (sim.towerById(this.selectedId) ?? null) : null;
    const blocked = this.paused || ended;
    const hoverTile = blocked ? null : this.hoverTile;

    this.mapLayer.update(this.realTime);
    this.entities.draw(state, this.effects.clock);
    this.banner.update(this.effects.clock);

    let placeProblem: string | null = null;
    let placeValid = false;
    if (this.placing && hoverTile) {
      const cost = sim.towerDefs[this.placing].levels[0].cost;
      const check = sim.canPlace(hoverTile);
      if (!check.ok) placeProblem = FAILURE_TEXT[check.reason];
      else if (state.gold < cost) placeProblem = `${FAILURE_TEXT.notEnoughGold} (${cost} ${GOLD} gerekli)`;
      placeValid = placeProblem === null;
    }
    const hoverTower = !this.placing && hoverTile ? (sim.towerAt(hoverTile) ?? null) : null;
    this.overlay.draw({ placing: this.placing, hoverTile, placeValid, selected, hoverTower, time: this.realTime });

    this.topBar.update({
      gold: state.gold,
      lives: state.lives,
      maxLives: sim.rules.startingLives,
      wave: state.wavesStarted,
      totalWaves: state.totalWaves,
      speed: this.speed,
      paused: this.paused,
    });

    const preview = sim.nextWavePreview();
    const canCallEarly = state.status === 'wave' && state.spawningDone && state.wavesStarted < state.totalWaves;
    this.panel.update({
      gold: state.gold,
      placing: this.placing,
      selected,
      upgradeCost: selected ? sim.upgradeCost(selected.id) : null,
      sellValue: selected ? sim.sellValue(selected.id) : 0,
      locked: blocked,
      preview,
      totalWaves: state.totalWaves,
      waveButton: this.waveButtonModel(state, canCallEarly),
    });

    this.hint.update(
      hintFor({
        status: state.status,
        paused: this.paused,
        placing: this.placing,
        placingName: this.placing ? sim.towerDefs[this.placing].name : null,
        hoverTile,
        placeProblem,
        selectedName: selected ? sim.towerDefs[selected.kind].name : null,
        selectedMaxed: selected ? selected.level >= 3 : false,
        wavesStarted: state.wavesStarted,
        totalWaves: state.totalWaves,
        canCallEarly,
        earlyBonus: sim.rules.earlyCallBonus,
      }),
      this.realTime,
    );

    if (ended) {
      if (this.endedAt === null) {
        this.endedAt = this.realTime;
        if (this.paused) this.setPaused(false);
      }
      if (!this.result.visible && this.realTime - this.endedAt >= RESULT_DELAY) {
        this.result.show({
          victory: state.status === 'victory',
          stars: state.stars,
          wavesReached: state.wavesStarted,
          totalWaves: state.totalWaves,
          lives: state.lives,
          maxLives: sim.rules.startingLives,
        });
      }
    }
  }

  private waveButtonModel(state: GameStateView, canCallEarly: boolean): { label: string; enabled: boolean } {
    if (state.status === 'victory' || state.status === 'defeat') return { label: WAVE_BUTTON.over, enabled: false };
    if (state.status === 'building') return { label: WAVE_BUTTON.start, enabled: state.wavesStarted < state.totalWaves };
    if (canCallEarly) return { label: WAVE_BUTTON.early(this.sim.rules.earlyCallBonus), enabled: true };
    return { label: WAVE_BUTTON.running, enabled: false };
  }

  // ── girdi ─────────────────────────────────────────────────

  private setupInput(): void {
    const zone = this.add.zone(LAYOUT.mapX, LAYOUT.mapY, LAYOUT.mapWidth, LAYOUT.mapHeight).setOrigin(0).setDepth(DEPTH.mapBase);
    zone.setInteractive();
    zone.on('pointerdown', this.onMapDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerdown', this.onAnyPointerDown, this);
    this.input.on('gameout', this.onGameOut, this);
    this.input.mouse?.disableContextMenu();
    this.input.keyboard?.addCapture('SPACE');
    this.input.keyboard?.on('keydown', this.onKeyDown, this);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  private cleanup(): void {
    this.input.off('pointermove', this.onPointerMove, this);
    this.input.off('pointerdown', this.onAnyPointerDown, this);
    this.input.off('gameout', this.onGameOut, this);
    this.input.keyboard?.off('keydown', this.onKeyDown, this);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.time.removeAllEvents();
    this.tweens.killAll();
    this.simulation = null;
  }

  private readonly onVisibilityChange = (): void => {
    if (document.hidden && this.status === 'wave' && !this.paused) this.setPaused(true);
  };

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    this.hoverTile = insideMap(pointer.x, pointer.y) ? screenToTile(pointer.x, pointer.y, this.sim.map) : null;
  }

  private onGameOut(): void {
    this.hoverTile = null;
  }

  private onAnyPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.rightButtonDown()) this.cancel();
  }

  private onMapDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.button !== 0 || this.locked()) return;
    const tile = screenToTile(pointer.x, pointer.y, this.sim.map);
    if (!tile) return;
    this.hoverTile = tile;
    const existing = this.sim.towerAt(tile);
    if (this.placing) {
      if (existing) {
        // Kurulu kuleye tıklamak yerleştirmeyi bırakıp onu seçer.
        this.placing = null;
        this.selectedId = existing.id;
        return;
      }
      const kind = this.placing;
      const result = this.sim.build(kind, tile);
      if (result.ok) {
        const shift = (pointer.event as MouseEvent | undefined)?.shiftKey === true;
        if (!shift) this.placing = null;
        this.selectedId = null;
      } else {
        this.fail(result);
      }
      return;
    }
    this.selectedId = existing ? existing.id : null;
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (this.result.visible) {
      if (event.code === 'Enter' || event.code === 'NumpadEnter') this.restart();
      return;
    }
    const code = event.code;
    if (code === 'KeyP') {
      if (!event.repeat) this.togglePause();
      return;
    }
    if (code === 'KeyF') {
      if (!event.repeat) this.toggleSpeed();
      return;
    }
    if (code === 'Escape') {
      if (this.paused && !this.placing && this.selectedId === null) this.setPaused(false);
      else this.cancel();
      return;
    }
    if (this.locked() || event.repeat) return;
    const digit = /^(?:Digit|Numpad)(\d)$/.exec(code)?.[1];
    if (digit) {
      const kind = TOWER_ORDER.find((k) => this.sim.towerDefs[k].hotkey === digit);
      if (kind) this.pickTower(kind);
      return;
    }
    if (code === 'KeyU') this.upgradeSelected();
    else if (code === 'KeyS') this.sellSelected();
    else if (code === 'Space') this.callWave();
  }

  // ── eylemler ──────────────────────────────────────────────

  /** Duraklatılmış ya da bitmiş oyunda eylemler kapalı. */
  private locked(): boolean {
    return this.paused || this.status === 'victory' || this.status === 'defeat';
  }

  private pickTower(kind: TowerKind): void {
    if (this.locked()) return;
    this.placing = this.placing === kind ? null : kind;
    this.selectedId = null;
  }

  private upgradeSelected(): void {
    if (this.locked()) return;
    if (this.selectedId === null) {
      this.hint.flash('Önce haritada bir kule seç', this.realTime, COLORS.textDim);
      return;
    }
    this.fail(this.sim.upgrade(this.selectedId));
  }

  private sellSelected(): void {
    if (this.locked()) return;
    if (this.selectedId === null) {
      this.hint.flash('Önce haritada bir kule seç', this.realTime, COLORS.textDim);
      return;
    }
    const result = this.sim.sell(this.selectedId);
    if (result.ok) this.selectedId = null;
    else this.fail(result);
  }

  private callWave(): void {
    if (this.locked()) return;
    this.fail(this.sim.startNextWave());
  }

  private cancel(): void {
    if (this.placing) this.placing = null;
    else this.selectedId = null;
  }

  private toggleSpeed(): void {
    this.speed = this.speed === 1 ? 2 : 1;
  }

  private togglePause(): void {
    if (this.status === 'victory' || this.status === 'defeat') return;
    this.setPaused(!this.paused);
  }

  private setPaused(paused: boolean): void {
    this.paused = paused;
    this.pauseOverlay.setVisible(paused);
    this.effects.setPaused(paused);
  }

  /** Komut başarısızsa nedenini ipucu satırında gösterir. */
  private fail(result: CommandResult): void {
    if (result.ok) return;
    const reason: CommandFailure = result.reason;
    this.hint.flash(FAILURE_TEXT[reason], this.realTime);
  }

  private restart(): void {
    this.scene.restart();
  }

  private goToMenu(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(200, 10, 13, 20);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(SCENE_KEYS.menu));
  }
}
