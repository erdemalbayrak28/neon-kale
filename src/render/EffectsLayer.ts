import Phaser from 'phaser';
import { COLORS, FONT_FAMILY, LAYOUT, TILE, cssColor } from '../config';
import type { Simulation } from '../core/simulation';
import type { GameEvent } from '../core/types';
import { DEPTH } from './depth';
import { easeOutCubic, glowCircle, glowLine, lighten } from './neon';
import { towerColor } from './shapes';
import { TEX } from './textures';

// Olaylardan doğan kısa ömürlü efektler. Hepsi tek bir ADD karışımlı Graphics'e her karede yeniden çizilir;
// parçacıklar tek bir yayıcıdan, "+N" yazıları havuzdan gelir. Böylece kare başına yeni nesne yaratılmaz.
//
// `age`: olayın kaç saniye önce olduğu. Hızlı ileri sarmada (fastForward) çoktan bitmiş efektler atlanır.

const BEAM_TIME = 0.08;
const FLOAT_TIME = 0.95;
const FLOAT_POOL = 24;
const MAX_EFFECTS = 220;

interface Beam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: number;
  t0: number;
}

interface Ring {
  x: number;
  y: number;
  r0: number;
  r1: number;
  color: number;
  t0: number;
  dur: number;
  width: number;
  /** Halkanın içini dolduran ilk parlamanın saydamlığı. */
  fill: number;
}

interface FloatSlot {
  text: Phaser.GameObjects.Text;
  t0: number;
  x: number;
  y: number;
  active: boolean;
}

export class EffectsLayer {
  /** Efekt saati (saniye). Duraklatılınca ilerlemez. */
  clock = 0;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly edge: Phaser.GameObjects.Graphics;
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly beams: Beam[] = [];
  private readonly rings: Ring[] = [];
  private readonly floats: FloatSlot[] = [];
  private leakAt = -10;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sim: Simulation,
  ) {
    this.gfx = scene.add.graphics({ x: LAYOUT.mapX, y: LAYOUT.mapY }).setDepth(DEPTH.effects).setBlendMode(Phaser.BlendModes.ADD);
    this.edge = scene.add.graphics({ x: LAYOUT.mapX, y: LAYOUT.mapY }).setDepth(DEPTH.edgeFlash).setBlendMode(Phaser.BlendModes.ADD);
    this.sparks = scene.add.particles(0, 0, TEX.spark, {
      emitting: false,
      speed: { min: 50, max: 190 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 260, max: 620 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      maxParticles: 600,
    });
    this.sparks.setDepth(DEPTH.particles);
    for (let i = 0; i < FLOAT_POOL; i++) {
      const text = scene.add
        .text(0, 0, '', {
          fontFamily: FONT_FAMILY,
          fontSize: '15px',
          fontStyle: 'bold',
          color: cssColor(COLORS.gold),
          resolution: 2,
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.floatText)
        .setShadow(0, 0, cssColor(COLORS.gold), 8, false, true)
        .setVisible(false);
      this.floats.push({ text, t0: 0, x: 0, y: 0, active: false });
    }
  }

  /** Duraklatmada parçacıkları da dondurur. */
  setPaused(paused: boolean): void {
    this.sparks.timeScale = paused ? 0 : 1;
  }

  handle(ev: GameEvent, age = 0): void {
    const t0 = this.clock - age;
    switch (ev.type) {
      case 'shot': {
        if (ev.kind === 'laser') {
          if (age < BEAM_TIME) this.beams.push({ x1: ev.from.x, y1: ev.from.y, x2: ev.to.x, y2: ev.to.y, color: COLORS.laser, t0 });
        } else if (ev.kind === 'cannon') {
          this.ring(ev.from.x, ev.from.y, 6, 16, COLORS.cannon, t0, 0.18, 2, 0.25);
        }
        break;
      }
      case 'pulse':
        this.ring(ev.pos.x, ev.pos.y, 10, ev.radius, COLORS.frost, t0, 0.5, 2.5, 0.12);
        break;
      case 'explosion':
        this.ring(ev.pos.x, ev.pos.y, ev.radius * 0.25, ev.radius, COLORS.cannon, t0, 0.38, 3, 0.3);
        if (age < 0.25) this.burst(ev.pos.x, ev.pos.y, COLORS.cannon, 10);
        break;
      case 'towerBuilt':
        this.ring(ev.pos.x, ev.pos.y, 12, TILE * 0.85, towerColor(ev.kind), t0, 0.45, 3, 0.35);
        if (age < 0.3) this.burst(ev.pos.x, ev.pos.y, towerColor(ev.kind), 12);
        break;
      case 'towerUpgraded':
        this.ring(ev.pos.x, ev.pos.y, 14, TILE, towerColor(ev.kind), t0, 0.5, 3, 0.4);
        this.ring(ev.pos.x, ev.pos.y, 6, TILE * 0.6, 0xffffff, t0 + 0.08, 0.4, 1.5, 0);
        if (age < 0.3) this.burst(ev.pos.x, ev.pos.y, towerColor(ev.kind), 18);
        break;
      case 'towerSold':
        this.ring(ev.pos.x, ev.pos.y, TILE * 0.7, 6, COLORS.gold, t0, 0.35, 2, 0.2);
        this.floatText(`+${ev.refund}`, ev.pos.x, ev.pos.y - 8, t0);
        break;
      case 'enemyKilled': {
        const def = this.sim.enemyDefs[ev.kind];
        if (age < 0.3) this.burst(ev.pos.x, ev.pos.y, def.color, ev.kind === 'brute' ? 22 : 14);
        this.ring(ev.pos.x, ev.pos.y, def.radius * TILE * 0.6, def.radius * TILE * 1.8, def.color, t0, 0.3, 2, 0.2);
        if (ev.reward > 0) this.floatText(`+${ev.reward}`, ev.pos.x, ev.pos.y - 10, t0);
        break;
      }
      case 'enemyLeaked':
        this.leakAt = t0;
        if (age < 0.15) this.scene.cameras.main.shake(140, 0.0035);
        break;
      default:
        break;
    }
  }

  update(dt: number): void {
    this.clock += dt;
    this.draw();
  }

  /**
   * Hızlı ileri sarmanın başında çağrılır: efekt saati simülasyonla birlikte `seconds` ilerler, böylece art arda
   * ileri sarmalarda eski efektler birikmez. Yaşlandırılamayan parçacıklar silinir.
   */
  skip(seconds: number): void {
    this.clock += seconds;
    this.sparks.killAll();
  }

  /** Çizimi saati ilerletmeden yeniler (duraklatılmış karede). */
  draw(): void {
    const g = this.gfx;
    const now = this.clock;
    g.clear();

    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i]!;
      const p = (now - b.t0) / BEAM_TIME;
      if (p >= 1) {
        swapRemove(this.beams, i);
        continue;
      }
      const a = 1 - p;
      glowLine(g, b.x1, b.y1, b.x2, b.y2, b.color, { width: 2.4, alpha: a, glow: 0.9 });
      g.lineStyle(1, 0xffffff, a);
      g.lineBetween(b.x1, b.y1, b.x2, b.y2);
      g.fillStyle(lighten(b.color, 0.5), a);
      g.fillCircle(b.x2, b.y2, 4 * a + 1);
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]!;
      const p = (now - r.t0) / r.dur;
      if (p >= 1) {
        swapRemove(this.rings, i);
        continue;
      }
      if (p < 0) continue;
      const radius = r.r0 + (r.r1 - r.r0) * easeOutCubic(p);
      const a = 1 - p;
      if (r.fill > 0) {
        g.fillStyle(r.color, r.fill * a * a);
        g.fillCircle(r.x, r.y, radius);
      }
      glowCircle(g, r.x, r.y, radius, r.color, { width: r.width * (0.4 + 0.6 * a), alpha: a, glow: 0.8 });
    }

    for (const f of this.floats) {
      if (!f.active) continue;
      const p = (now - f.t0) / FLOAT_TIME;
      if (p >= 1) {
        f.active = false;
        f.text.setVisible(false);
        continue;
      }
      f.text
        .setVisible(p >= 0)
        .setPosition(LAYOUT.mapX + f.x, LAYOUT.mapY + f.y - 26 * easeOutCubic(Math.max(0, p)))
        .setAlpha(p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4);
    }

    this.drawLeakFlash(now);
  }

  private drawLeakFlash(now: number): void {
    const e = this.edge;
    e.clear();
    const p = (now - this.leakAt) / 0.55;
    if (p < 0 || p >= 1) return;
    const a = 1 - p;
    const w = LAYOUT.mapWidth;
    const h = LAYOUT.mapHeight;
    const steps = 9;
    for (let i = 0; i < steps; i++) {
      const inset = i * 5;
      e.lineStyle(6, COLORS.lives, 0.32 * a * (1 - i / steps));
      e.strokeRect(inset + 3, inset + 3, w - inset * 2 - 6, h - inset * 2 - 6);
    }
  }

  private ring(x: number, y: number, r0: number, r1: number, color: number, t0: number, dur: number, width: number, fill: number): void {
    if (this.clock - t0 >= dur) return;
    if (this.rings.length >= MAX_EFFECTS) this.rings.shift();
    this.rings.push({ x, y, r0, r1, color, t0, dur, width, fill });
  }

  private burst(x: number, y: number, color: number, count: number): void {
    this.sparks.setParticleTint(color);
    this.sparks.explode(count, LAYOUT.mapX + x, LAYOUT.mapY + y);
  }

  private floatText(label: string, x: number, y: number, t0: number): void {
    if (this.clock - t0 >= FLOAT_TIME) return;
    let slot = this.floats.find((f) => !f.active);
    if (!slot) {
      // Havuz doluysa en eskisini yeniden kullan.
      slot = this.floats.reduce((oldest, f) => (f.t0 < oldest.t0 ? f : oldest));
    }
    slot.active = true;
    slot.t0 = t0;
    slot.x = x;
    slot.y = y;
    slot.text.setText(label).setAlpha(1).setVisible(false);
  }
}

function swapRemove<T>(list: T[], index: number): void {
  const last = list.pop();
  if (index < list.length && last !== undefined) list[index] = last;
}
