import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';
import { EndScene } from './scenes/EndScene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#3f6b35',
  // min size keeps WebGL from failing if the page loads while hidden (zero size)
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%', min: { width: 320, height: 240 } },
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [GameScene, UIScene, EndScene],
});

// Handy for poking at the game from the browser console while developing.
if (import.meta.env.DEV) window.game = game;
