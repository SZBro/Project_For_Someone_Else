import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { createTextures } from '../textures.js';
import { Bear } from '../entities/Bear.js';
import { FoodSystem } from '../systems/Food.js';
import { updateNpc } from '../systems/npcBrain.js';
import { audio } from '../audio.js';

const W = CONFIG.world;
const R = CONFIG.river;
const NPC_TINTS = [0x8a5a35, 0x6e4a2f, 0x9c6b43, 0x5c3d26, 0xa87850];

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  // data.started: false shows the start screen over a live river; true starts a round right away.
  create(data = {}) {
    this.started = !!data.started;
    if (!this.textures.exists('bear')) createTextures(this);
    this.physics.world.setBounds(0, 0, W.width, W.height);
    this.drawMap();

    this.food = new FoodSystem(this);

    const name = this.registry.get('playerName') || 'You';
    this.player = new Bear(this, 1200, 420, { name, tint: 0xd9a066, isPlayer: true });
    this.bears = [this.player];
    CONFIG.npc.names.forEach((name, i) => {
      const x = Phaser.Math.Between(200, W.width - 200);
      const y = i % 2 ? Phaser.Math.Between(150, R.top - 100) : Phaser.Math.Between(R.bottom + 100, W.height - 150);
      this.bears.push(new Bear(this, x, y, { name, tint: NPC_TINTS[i % NPC_TINTS.length] }));
    });
    this.physics.add.collider(this.bears, this.bears);

    this.cameras.main.setBounds(0, 0, W.width, W.height);

    this.night = this.add.rectangle(0, 0, 10, 10, 0x0a1030).setOrigin(0).setScrollFactor(0).setDepth(50);

    // Controls: aim with the mouse, left click swipe, hold right click block, E charge, Space or Shift dash.
    // No key capture, so typing a name on the start screen still works.
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,SHIFT,E,T', false);
    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', (pointer) => {
      if (pointer.leftButtonDown()) this.player.startSwipe();
    });
    const dash = () => this.player.dash(this.moveDir());
    this.input.keyboard.on('keydown-SPACE', dash);
    this.input.keyboard.on('keydown-SHIFT', dash);
    this.input.keyboard.on('keydown-E', () => this.player.startCharge());

    this.input.keyboard.on('keydown-M', () => {
      if (this.started) this.events.emit('announce', audio.toggleMute() ? 'Muted' : 'Sound on');
    });

    this.events.on('hit', this.onHit, this);
    this.events.on('guardBreak', ({ victim }) => {
      this.floatText(victim.x, victim.y - victim.radius, 'GUARD BREAK', '#ff7a3c');
      audio.guardBreak(this.volumeAt(victim));
    });
    this.events.on('knockout', this.onKnockout, this);
    this.events.on('sfx', (name, bear) => audio[name](this.volumeAt(bear)));
    // Scene events outlive a restart, so drop these listeners when the round ends.
    this.events.once('shutdown', () => ['hit', 'guardBreak', 'knockout', 'sfx'].forEach((e) => this.events.off(e)));

    this.hitStop = 0;
    this.gameMinutes = 0;
    this.roundMinutes = CONFIG.time.roundGameDays * 24 * 60;
    this.over = false;

    if (this.started) {
      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      this.scene.launch('UI');
    } else {
      this.showMenu();
    }
  }

  // Start screen: the river keeps running with NPC bears while the menu card sits on top.
  showMenu() {
    const p = this.player;
    p.dead = true; // out of play: NPCs ignore it and controls do nothing
    p.respawnTimer = Infinity;
    p.setVisible(false);
    p.label.setVisible(false);
    p.shadow.setVisible(false);
    p.body.enable = false;
    this.cameras.main.centerOn(W.width / 2, (R.top + R.bottom) / 2);

    const menu = document.getElementById('menu');
    const nameInput = document.getElementById('name');
    const sound = document.getElementById('sound');
    const music = document.getElementById('music');
    menu.hidden = false;
    nameInput.value = this.registry.get('playerName') || '';
    sound.checked = audio.soundOn;
    music.checked = audio.musicOn;
    sound.onchange = () => audio.setSound(sound.checked);
    music.onchange = () => audio.setMusic(music.checked);
    setTimeout(() => nameInput.focus(), 50);

    const play = () => {
      this.registry.set('playerName', nameInput.value.trim() || 'You');
      menu.hidden = true;
      audio.unlock();
      this.scene.restart({ started: true });
    };
    document.getElementById('play').onclick = play;
    // Block body on purpose: an on* handler that returns false cancels the keystroke.
    nameInput.onkeydown = (e) => {
      if (e.key === 'Enter') play();
    };
  }

  // Sounds fade with distance from the middle of the screen.
  volumeAt(obj) {
    const cam = this.cameras.main;
    const d = Phaser.Math.Distance.Between(obj.x, obj.y, cam.midPoint.x, cam.midPoint.y);
    return Phaser.Math.Clamp(1 - d / 900, 0, 1);
  }

  drawMap() {
    // Seeded so the map looks the same every round.
    const rnd = new Phaser.Math.RandomDataGenerator(['fat-bear-river']);
    const g = this.add.graphics().setDepth(0);

    // Grass with darker and lighter patches, and little tufts
    g.fillStyle(0x4a7a3c);
    g.fillRect(0, 0, W.width, W.height);
    for (let i = 0; i < 140; i++) {
      g.fillStyle(rnd.pick([0x426e35, 0x55894a, 0x4f8041]), 0.6);
      g.fillEllipse(rnd.between(0, W.width), rnd.between(0, W.height), rnd.between(60, 200), rnd.between(30, 90));
    }
    g.lineStyle(2, 0x3a6330, 0.7);
    for (let i = 0; i < 500; i++) {
      const x = rnd.between(0, W.width);
      const y = rnd.between(0, W.height);
      g.lineBetween(x, y, x - 3, y - 6);
      g.lineBetween(x, y, x + 3, y - 6);
    }

    // Sandy banks with pebbles
    g.fillStyle(0xb9a173);
    g.fillRect(0, R.top - 34, W.width, R.bottom - R.top + 68);
    g.fillStyle(0xcdb98a);
    g.fillRect(0, R.top - 22, W.width, R.bottom - R.top + 44);
    for (let i = 0; i < 260; i++) {
      const top = rnd.frac() < 0.5;
      g.fillStyle(rnd.pick([0x8f8a7e, 0xa39d90, 0x7c776c]));
      g.fillCircle(rnd.between(0, W.width), top ? rnd.between(R.top - 30, R.top) : rnd.between(R.bottom, R.bottom + 30), rnd.between(2, 5));
    }

    // River: lighter shallows at the edges, darker deep channel in the middle
    const depthBands = [0x4f8fc2, 0x4584b8, 0x3a78ad, 0x326a9b];
    const h = R.bottom - R.top;
    depthBands.forEach((c, i) => {
      g.fillStyle(c);
      const inset = (h / 2) * (i / depthBands.length);
      g.fillRect(0, R.top + inset, W.width, h - inset * 2);
    });

    // Falls: a rocky ledge with white water below it
    for (let y = R.top; y < R.bottom; y += 22) {
      g.fillStyle(rnd.pick([0x6e6e6e, 0x7d7d7d, 0x666666]));
      g.fillCircle(R.fallsX + rnd.between(-6, 6), y + 10, rnd.between(14, 19));
      g.fillStyle(0x9a9a9a);
      g.fillCircle(R.fallsX - 4 + rnd.between(-4, 4), y + 6, 5);
    }

    // Rocks bears can fish from at each spot
    CONFIG.food.fishingSpots.forEach((s) => {
      for (let i = 0; i < 3; i++) {
        const a = rnd.frac() * Math.PI * 2;
        g.fillStyle(0x6f6a62);
        g.fillCircle(s.x + Math.cos(a) * s.radius * 0.8, s.y + Math.sin(a) * s.radius * 0.8, rnd.between(8, 13));
      }
    });

    // Flowing water and foam, animated in update()
    this.ripples = this.add.tileSprite(0, R.top, W.width, h, 'ripples').setOrigin(0).setDepth(0.5);
    const foam = this.add.graphics().setDepth(0.6);
    for (let y = R.top + 6; y < R.bottom; y += 16) {
      foam.fillStyle(0xffffff, 0.75);
      foam.fillEllipse(R.fallsX + 30 + rnd.between(0, 25), y, rnd.between(26, 44), 12);
    }
    this.tweens.add({ targets: foam, alpha: { from: 0.6, to: 1 }, yoyo: true, repeat: -1, duration: 700 });

    // Trees framing the top and bottom edges
    for (let x = 30; x < W.width; x += rnd.between(70, 120)) {
      this.add.image(x, rnd.between(10, 50), 'tree').setDepth(2).setScale(rnd.realInRange(0.8, 1.2));
      this.add.image(x + 40, W.height - rnd.between(10, 50), 'tree').setDepth(2).setScale(rnd.realInRange(0.8, 1.2));
    }
  }

  get clock() {
    const total = CONFIG.time.startHour * 60 + this.gameMinutes;
    const day = Math.floor(total / 1440) + 1;
    const hour = Math.floor((total % 1440) / 60);
    const minute = Math.floor(total % 60);
    return { day, hour, minute, minutesLeft: this.roundMinutes - this.gameMinutes };
  }

  onHit({ attacker, victim, damage, blocked, guardBreak, kind, foodLost }) {
    const playerInvolved = attacker.isPlayer || victim.isPlayer;
    if (foodLost) this.food.knockLoose(foodLost, attacker);

    const vol = this.volumeAt(victim);
    if (blocked) {
      this.burst(victim.x, victim.y, 0x7fc8ff, 5);
      audio.block(vol);
    } else {
      this.burst(victim.x, victim.y, 0x6b4a2f, kind === 'charge' ? 14 : 9);
      if (playerInvolved) this.hitStop = CONFIG.feel.hitStopMs * (kind === 'charge' ? 1.6 : 1);
      if (kind === 'charge') audio.heavyHit(vol);
      else audio.hit(vol);
    }
    if (guardBreak) {
      this.floatText(victim.x, victim.y - victim.radius - 20, 'GUARD BREAK', '#ff7a3c');
      audio.guardBreak(vol);
    }
    this.floatText(victim.x, victim.y - victim.radius, `-${Math.round(damage)}`, blocked ? '#7fc8ff' : '#ff5a4a');

    if (victim.isPlayer) this.cameras.main.shake(blocked ? 60 : kind === 'charge' ? 220 : 140, blocked ? 0.002 : 0.007);
    else if (attacker.isPlayer && !blocked) this.cameras.main.shake(70, 0.003);
  }

  onKnockout({ victim, killer }) {
    const who = (b) => (b.isPlayer ? 'You' : b.name);
    this.events.emit('announce', `${who(killer)} knocked out ${victim.isPlayer ? 'you' : victim.name}!`);
    this.food.dropSalmon(victim.x, victim.y, CONFIG.loot.salmonDroppedOnKnockout);
    this.burst(victim.x, victim.y, 0x6b4a2f, 20);
    audio.knockout(this.volumeAt(victim));
  }

  floatText(x, y, text, color) {
    if (!CONFIG.feel.damageNumbers) return;
    const t = this.add
      .text(x + Phaser.Math.Between(-8, 8), y, text, {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color,
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(40);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 800, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  // Little puffs of fur (or shield sparks) flying out from a hit.
  burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const dot = this.add.circle(x, y, Phaser.Math.Between(2, 5), color).setDepth(30);
      const p = Phaser.Math.RandomXY(new Phaser.Math.Vector2(), Phaser.Math.Between(20, 50));
      this.tweens.add({
        targets: dot,
        x: x + p.x,
        y: y + p.y,
        alpha: 0,
        scale: 0.3,
        duration: Phaser.Math.Between(250, 450),
        onComplete: () => dot.destroy(),
      });
    }
  }

  update(_time, deltaMs) {
    if (this.over) return;

    // Hit-stop: freeze the action for a few frames so hits feel heavy.
    if (this.hitStop > 0) {
      this.hitStop -= deltaMs;
      this.physics.world.isPaused = true;
      return;
    }
    this.physics.world.isPaused = false;
    const dt = deltaMs / 1000;
    this.ripples.tilePositionX -= 40 * dt; // river flows left to right

    // On the start screen the clock is frozen and the camera drifts along the river.
    let gameMinutesThisFrame = 0;
    if (this.started) {
      const timeScale = this.keys.T.isDown ? CONFIG.time.fastForward : 1;
      gameMinutesThisFrame = dt * CONFIG.time.gameMinutesPerSecond * timeScale;
      this.gameMinutes += gameMinutesThisFrame;
      this.handlePlayerInput();
    } else {
      const cam = this.cameras.main;
      cam.scrollX = (W.width - cam.width) / 2 + Math.sin(this.time.now / 9000) * (W.width - cam.width) * 0.45;
    }

    this.bears.forEach((b) => {
      if (b.isPlayer && !this.started) return;
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
        if (b.isPlayer) {
          this.floatText(b.x, b.y - b.radius, `+${eaten.getData('weight')} lb`, '#ffd34d');
          audio.eat();
        }
        this.food.consume(eaten);
      }
    });

    const announcement = this.food.update(dt);
    if (announcement && this.started) {
      this.events.emit('announce', announcement);
      audio.splash();
    }

    this.updateNight();
    if (this.started && this.gameMinutes >= this.roundMinutes) this.endRound();
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
    if (results[0].isPlayer) audio.fanfare();
    this.scene.stop('UI');
    this.scene.launch('End', { results });
  }
}
