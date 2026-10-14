import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from './config';
import { installTestHook } from './hook';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { installOrientationWarning } from './ui/OrientationWarning';

// Giriş noktası: Phaser oyununu kurar (menü + oyun sahnesi), dikey ekran uyarısını ve test kancasını ekler.

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.background,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 2 },
  render: { antialias: true, powerPreference: 'high-performance' },
  banner: false,
  scene: [MenuScene, GameScene],
});

installOrientationWarning();
installTestHook(game);
