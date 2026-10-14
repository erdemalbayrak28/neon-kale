import type Phaser from 'phaser';
import type { Simulation } from './core/simulation';
import type { GameStateView, Vec2 } from './core/types';

// window.__neonKale test kancasının türü (bkz. src/hook.ts).

export interface NeonKaleHook {
  game: Phaser.Game;
  /** Etkin sahnenin anahtarı: 'menu' ya da 'game'. */
  scene(): 'menu' | 'game' | string;
  /** Oyun sahnesi etkinse şu anki simülasyon, değilse null. */
  sim(): Simulation | null;
  /** Karonun merkezinin mantıksal oyun koordinatı (1280 × 720). */
  tileToScreen(col: number, row: number): Vec2;
  /** Simülasyonu duraklatma/hızdan bağımsız `seconds` saniye ileri sarar; olaylar efektlere gider. */
  fastForward(seconds: number): void;
  state(): GameStateView | null;
}

declare global {
  interface Window {
    __neonKale?: NeonKaleHook;
  }
}
