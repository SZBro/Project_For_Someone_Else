import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { createTextures } from '../textures.js';
import { Bear } from '../entities/Bear.js';
import { FoodSystem } from '../systems/Food.js';
import { updateNpc } from '../systems/npcBrain.js';

const W = CONFIG.world;
const R = CONFIG.river;
const NPC_TINTS = [0x8a5a35, 0x6e4a2f, 0x9c6b43, 0x5c3d26, 0xa87850];

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    if (!this.textures.exists('bear')) createTextures(this);
    this.physics.world.setBounds(0, 0, W.width, W.height);
    this.drawMap();

    this.food = new FoodSystem(this);

    this.player = new Bear(this, 1200, 420, { name: 'You', tint: 0xd9a066, isPlayer: true });
    this.bears = [this.player];
    CONFIG.npc.names.forEach((name, i) => {
      const x = Phaser.Math.Between(200, W.width - 200);
      const y = i % 2 ? Phaser.Math.Between(150, R.top - 100) : Phaser.Math.Between(R.bottom + 100, W.height - 150);
      this.bears.push(new Bear(this, x, y, { name, tint: NPC_TINTS[i % NPC_TINTS.length] }));
    });
    this.physics.add.collider(this.bears, this.bears);

    this.cameras.main.setBounds(0, 0, W.width, W.height);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.night = this.add.rectangle(0, 0, 10, 10, 0x0a1030).setOrigin(0).setScrollFactor(0).setDepth(50);

    // Controls: aim with the mouse, left click swipe, hold right click block, Space or Shift dash.
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,SHIFT,T');
    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', (pointer) => {
      if (pointer.leftButtonDown()) this.player.startSwipe();
    });
    const dash = () => this.player.dash(this.moveDir());
    this.input.keyboard.on('keydown-SPACE', dash);
    this.input.keyboard.on('keydown-SHIFT', dash);

    this.events.on('knockout', ({ victim, killer }) => {
      const who = (b) => (b.isPlayer ? 'You' : b.name);
      this.events.emit('announce', `${who(killer)} knocked out ${victim.isPlayer ? 'you' : victim.name}!`);
    });
    // Scene events outlive a restart, so drop this listener when the round ends.
    this.events.once('shutdown', () => this.events.off('knockout'));

    this.gameMinutes = 0;
    this.roundMinutes = CONFIG.time.roundGameDays * 24 * 60;
    this.over = false;

    this.scene.launch('UI');
  }

  drawMap() {
    const g = this.add.graphics().setDepth(0);
    // Banks
    g.fillStyle(0xc2b280);
    g.fillRect(0, R.top - 24, W.width, R.bottom - R.top + 48);
    // River
    g.fillStyle(0x3d7fb5);
    g.fillRect(0, R.top, W.width, R.bottom - R.top);
    g.fillStyle(0x5b9bd0, 0.5);
    for (let x = 0; x < W.width; x += 140) {
      for (let y = R.top + 30; y < R.bottom; y += 70) g.fillRect(x + ((y / 7) % 60), y, 60, 4);
    }
    // Falls: a rocky ledge with white water below it
    g.fillStyle(0x7a7a7a);
    g.fillRect(R.fallsX - 18, R.top, 36, R.bottom - R.top);
    g.fillStyle(0xffffff, 0.7);
    g.fillRect(R.fallsX + 18, R.top, 40, R.bottom - R.top);
  }

  get clock() {
    const total = CONFIG.time.startHour * 60 + this.gameMinutes;
    const day = Math.floor(total / 1440) + 1;
    const hour = Math.floor((total % 1440) / 60);
    const minute = Math.floor(total % 60);
    return { day, hour, minute, minutesLeft: this.roundMinutes - this.gameMinutes };
  }

  update(_time, deltaMs) {
    if (this.over) return;
    const dt = deltaMs / 1000;

    const timeScale = this.keys.T.isDown ? CONFIG.time.fastForward : 1;
    const gameMinutesThisFrame = dt * CONFIG.time.gameMinutesPerSecond * timeScale;
    this.gameMinutes += gameMinutesThisFrame;

    this.handlePlayerInput();
    this.bears.forEach((b) => {
      if (b.dead) {
        if (b.respawnTimer <= 0) {
          const p = this.spawnPoint();
          b.respawn(p.x, p.y);
        }
      } else {
        if (b !== this.player) updateNpc(b, dt, { food: this.food, bears: this.bears });
        b.addWeight((-CONFIG.bear.weightLossPerGameHour * gameMinutesThisFrame) / 60);
      }
      const eaten = b.tick(dt, this.bears);
      if (eaten) {
        b.addWeight(eaten.getData('weight'));
        this.food.consume(eaten);
      }
    });

    const announcement = this.food.update(dt);
    if (announcement) this.events.emit('announce', announcement);

    this.updateNight();
    if (this.gameMinutes >= this.roundMinutes) this.endRound();
  }

  moveDir() {
    const k = this.keys;
    return new Phaser.Math.Vector2(
      (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0),
      (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0),
    ).normalize();
  }

  // A bank position away from other bears, for respawning.
  spawnPoint() {
    let best = null;
    let bestDist = -1;
    for (let i = 0; i < 8; i++) {
      const p = {
        x: Phaser.Math.Between(150, W.width - 150),
        y: Math.random() < 0.5 ? Phaser.Math.Between(120, R.top - 80) : Phaser.Math.Between(R.bottom + 80, W.height - 120),
      };
      const nearest = Math.min(
        ...this.bears.filter((b) => !b.dead).map((b) => Phaser.Math.Distance.Between(p.x, p.y, b.x, b.y)),
      );
      if (nearest > bestDist) {
        best = p;
        bestDist = nearest;
      }
    }
    return best;
  }

  handlePlayerInput() {
    const player = this.player;
    if (player.dead) return;
    player.move(this.moveDir());

    const pointer = this.input.activePointer;
    pointer.updateWorldPoint(this.cameras.main);
    player.aim(pointer.worldX - player.x, pointer.worldY - player.y);
    player.setBlocking(pointer.rightButtonDown());

    // Eat automatically: whatever food is in reach.
    if (!player.eatTarget && player.canEat) {
      const food = this.food.nearestAvailable(player.x, player.y, player.radius + CONFIG.food.eatRange);
      if (food) player.startEating(food);
    }
  }

  updateNight() {
    const cam = this.cameras.main;
    this.night.setSize(cam.width, cam.height);
    // Brightest at noon, darkest at midnight.
    const hour = (CONFIG.time.startHour * 60 + this.gameMinutes) / 60;
    const light = (Math.cos(((hour - 12) / 24) * Math.PI * 2) + 1) / 2;
    this.night.setAlpha(Phaser.Math.Clamp(0.55 - light * 0.9, 0, 0.55));
  }

  endRound() {
    this.over = true;
    this.physics.pause();
    const results = [...this.bears]
      .sort((a, b) => b.weight - a.weight)
      .map((b) => ({ name: b.name, weight: Math.round(b.weight), isPlayer: b.isPlayer }));
    this.scene.stop('UI');
    this.scene.launch('End', { results });
  }
}
