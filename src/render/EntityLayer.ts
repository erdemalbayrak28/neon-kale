import Phaser from 'phaser';
import { COLORS, LAYOUT, TILE } from '../config';
import type { Simulation } from '../core/simulation';
import type { GameStateView } from '../core/types';
import { DEPTH } from './depth';
import { glowCircle, lighten } from './neon';
import { drawEnemy, drawTower, towerColor } from './shapes';
import { TEX } from './textures';

// Kuleleri, düşmanları ve mermileri her karede çizer. Graphics nesneleri bir kez yaratılır, her karede silinip
// yeniden çizilir; mermi görüntüleri havuzdan alınır.

interface Orb {
  glow: Phaser.GameObjects.Image;
  core: Phaser.GameObjects.Image;
}

const HIT_FLASH = 0.09;
const SHOT_FLASH = 0.16;

export class EntityLayer {
  private readonly towers: Phaser.GameObjects.Graphics;
  private readonly enemies: Phaser.GameObjects.Graphics;
  /** Mermi başına iki görüntü: renkli geniş parıltı + beyaza yakın çekirdek. */
  private readonly orbs = new Map<number, Orb>();
  private readonly freeOrbs: Orb[] = [];
  private readonly lastHit = new Map<number, number>();
  private readonly lastShot = new Map<number, number>();
  private readonly seenOrbs = new Set<number>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sim: Simulation,
  ) {
    this.towers = scene.add.graphics({ x: LAYOUT.mapX, y: LAYOUT.mapY }).setDepth(DEPTH.towers);
    this.enemies = scene.add.graphics({ x: LAYOUT.mapX, y: LAYOUT.mapY }).setDepth(DEPTH.enemies);
  }

  noteHit(enemyId: number, clock: number): void {
    this.lastHit.set(enemyId, clock);
  }

  noteShot(towerId: number, clock: number): void {
    this.lastShot.set(towerId, clock);
  }

  forgetEnemy(enemyId: number): void {
    this.lastHit.delete(enemyId);
  }

  forgetTower(towerId: number): void {
    this.lastShot.delete(towerId);
  }

  draw(state: GameStateView, clock: number): void {
    this.drawTowers(state, clock);
    this.drawEnemies(state, clock);
    this.drawProjectiles(state, clock);
  }

  private drawTowers(state: GameStateView, clock: number): void {
    const g = this.towers;
    g.clear();
    for (const t of state.towers) {
      const shot = this.lastShot.get(t.id);
      const flash = shot === undefined ? 0 : Math.max(0, 1 - (clock - shot) / SHOT_FLASH);
      drawTower(g, t.kind, t.pos.x, t.pos.y, { level: t.level, aimAngle: t.aimAngle, flash });
    }
  }

  private drawEnemies(state: GameStateView, clock: number): void {
    const g = this.enemies;
    g.clear();
    for (const e of state.enemies) {
      const r = this.sim.enemyDefs[e.kind].radius * TILE;
      const hitAt = this.lastHit.get(e.id);
      const hit = hitAt === undefined ? 0 : Math.max(0, 1 - (clock - hitAt) / HIT_FLASH);
      if (e.speedMultiplier < 1) {
        // Yavaşlatılmış: buz renginde halka.
        glowCircle(g, e.pos.x, e.pos.y, r + 5, COLORS.frost, { width: 1.5, alpha: 0.85, glow: 0.6 });
      }
      drawEnemy(g, e.kind, e.pos.x, e.pos.y, r, { heading: e.heading, hit });
      if (e.hp < e.maxHp) {
        const w = Math.max(22, r * 2);
        const x = e.pos.x - w / 2;
        const y = e.pos.y - r - 9;
        const ratio = Phaser.Math.Clamp(e.hp / e.maxHp, 0, 1);
        const color = ratio > 0.55 ? COLORS.valid : ratio > 0.28 ? COLORS.gold : COLORS.invalid;
        g.fillStyle(0x000000, 0.7);
        g.fillRect(x - 1, y - 1, w + 2, 5);
        g.fillStyle(color, 1);
        g.fillRect(x, y, w * ratio, 3);
      }
    }
  }

  private drawProjectiles(state: GameStateView, clock: number): void {
    this.seenOrbs.clear();
    const pulse = 1 + Math.sin(clock * 30) * 0.08;
    for (const p of state.projectiles) {
      this.seenOrbs.add(p.id);
      let orb = this.orbs.get(p.id);
      if (!orb) {
        orb = this.acquireOrb();
        const color = towerColor(p.towerKind);
        orb.glow.setTint(color);
        orb.core.setTint(lighten(color, 0.7));
        this.orbs.set(p.id, orb);
      }
      const x = LAYOUT.mapX + p.pos.x;
      const y = LAYOUT.mapY + p.pos.y;
      orb.glow.setPosition(x, y).setScale(1.05 * pulse);
      orb.core.setPosition(x, y).setScale(0.42);
    }
    for (const [id, orb] of this.orbs) {
      if (this.seenOrbs.has(id)) continue;
      this.orbs.delete(id);
      orb.glow.setVisible(false);
      orb.core.setVisible(false);
      this.freeOrbs.push(orb);
    }
  }

  private acquireOrb(): Orb {
    const orb = this.freeOrbs.pop() ?? {
      glow: this.scene.add.image(0, 0, TEX.spark).setDepth(DEPTH.projectiles).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.85),
      core: this.scene.add.image(0, 0, TEX.spark).setDepth(DEPTH.projectiles).setBlendMode(Phaser.BlendModes.ADD),
    };
    orb.glow.setVisible(true);
    orb.core.setVisible(true);
    return orb;
  }
}
