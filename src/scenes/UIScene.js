import Phaser from 'phaser';
import { CONFIG } from '../config.js';

const TEXT = { fontFamily: 'sans-serif', fontSize: '16px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 };

// HUD drawn on top of the game: weight, clock, leaderboard, swipe cooldown, announcements.
export class UIScene extends Phaser.Scene {
  constructor() {
    super('UI');
  }

  create() {
    this.gameScene = this.scene.get('Game');

    this.weightText = this.add.text(16, 14, '', { ...TEXT, fontSize: '26px' });
    this.clockText = this.add.text(16, 48, '', TEXT);
    this.healthBar = this.add.graphics();
    this.actionText = this.add.text(16, 106, '', TEXT);
    const solo = this.gameScene.mode === 'solo';
    this.helpText = this.add.text(
      16,
      0,
      `WASD: move  ·  mouse: aim  ·  left click: swipe  ·  E: charge  ·  hold right click: block  ·  Space/Shift: dash  ·  Esc: ${solo ? 'pause' : 'menu'}  ·  M: mute${solo ? '  ·  hold T: fast-forward' : ''}`,
      { ...TEXT, fontSize: '13px' },
    );
    this.respawnText = this.add.text(0, 0, '', { ...TEXT, fontSize: '36px' }).setOrigin(0.5);
    this.boardText = this.add.text(0, 14, '', { ...TEXT, align: 'right' }).setOrigin(1, 0);
    this.announceText = this.add.text(0, 110, '', { ...TEXT, fontSize: '28px', color: '#ffd34d' }).setOrigin(0.5, 0);

    this.gameScene.events.on('announce', this.announce, this);
    this.events.once('shutdown', () => this.gameScene.events.off('announce', this.announce, this));
  }

  announce(msg) {
    this.announceText.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.announceText);
    this.tweens.add({ targets: this.announceText, alpha: 0, delay: 3000, duration: 800 });
  }

  update() {
    const g = this.gameScene;
    if (!g.player) return;
    const { width, height } = this.scale;

    this.weightText.setText(`${Math.round(g.player.weight)} lb`);
    const c = g.clock;
    const time = `${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`;
    const left = Math.max(0, c.minutesLeft / g.clockRate);
    const mm = Math.floor(left / 60);
    const ss = String(Math.floor(left % 60)).padStart(2, '0');
    this.clockText.setText(`Day ${c.day}  ${time}   ·   ${mm}:${ss} left`);
    const p = g.player;
    const pct = p.hp / CONFIG.health.max;
    this.healthBar.clear();
    this.healthBar.fillStyle(0x000000, 0.6).fillRect(15, 75, 202, 16);
    this.healthBar.fillStyle(pct > 0.5 ? 0x5ad45a : pct > 0.25 ? 0xe8c33a : 0xe0463a).fillRect(16, 76, 200 * pct, 14);
    // Stamina bar just under health
    this.healthBar.fillStyle(0x000000, 0.6).fillRect(15, 92, 202, 8);
    this.healthBar.fillStyle(0x4fb3ff).fillRect(16, 93, 200 * (p.stamina / CONFIG.stamina.max), 6);

    const ready = (cd) => (cd > 0 ? `${cd.toFixed(1)}s` : 'ready');
    this.actionText.setText(
      `Swipe: ${ready(p.swipeCooldown)}   Charge: ${ready(p.chargeCooldown)}   Dash: ${ready(p.dashCooldown)}`,
    );
    this.respawnText
      .setText(p.dead ? `Knocked out! Respawning in ${Math.ceil(p.respawnTimer)}` : '')
      .setPosition(width / 2, height / 2);
    this.helpText.setY(height - 26);

    const board = [...g.bears]
      .sort((a, b) => b.weight - a.weight)
      .map((b, i) => `${i + 1}. ${b.isPlayer ? `» ${b.name}` : b.name}  ${Math.round(b.weight)} lb`)
      .join('\n');
    this.boardText.setText(board).setX(width - 16);
    this.announceText.setX(width / 2);
  }
}
