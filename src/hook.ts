import type Phaser from 'phaser';
import type { NeonKaleHook } from './types-global';
import { tileToScreen } from './render/coords';
import type { GameScene } from './scenes/GameScene';
import { SCENE_KEYS } from './scenes/keys';

// Test kancası: uçtan uca testler (Playwright) oyunun durumunu buradan okur ve zamanı ileri sarar.

export function installTestHook(game: Phaser.Game): void {
  const gameScene = (): GameScene | null => {
    const scene = game.scene.getScene(SCENE_KEYS.game) as GameScene | null;
    return scene && scene.sys.isActive() && scene.currentSim ? scene : null;
  };

  const hook: NeonKaleHook = {
    game,
    scene: () => game.scene.getScenes(true)[0]?.scene.key ?? '',
    sim: () => gameScene()?.currentSim ?? null,
    tileToScreen: (col, row) => tileToScreen(col, row),
    fastForward: (seconds) => gameScene()?.fastForward(seconds),
    state: () => gameScene()?.currentSim?.state ?? null,
  };
  window.__neonKale = hook;
}
