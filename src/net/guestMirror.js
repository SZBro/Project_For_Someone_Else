import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { Bear } from '../entities/Bear.js';
import { audio } from '../audio.js';
import { net } from './lobby.js';
import { readFlags } from './snapshot.js';

// How quickly drawn positions catch up with what the host says (higher = snappier).
const FOLLOW_OTHERS = 14;
const FOLLOW_SELF = 6; // gentle, because your own bear is already predicted locally
const FOLLOW_SELF_FORCED = 16; // while knocked back, dashing or charging, trust the host
const SNAP_DISTANCE = 160; // further off than this, jump straight there

// A guest doesn't run the game. It draws what the host reports, and moves its own
// bear immediately from local input so the controls feel responsive.
export class GuestMirror {
  constructor(scene) {
    this.scene = scene;
    this.bears = new Map();
    this.food = new Map();
    this.animals = new Map();
    this.waveSpot = -1;

    this.spots = CONFIG.food.fishingSpots.map((s) => {
      const g = scene.add.graphics().setDepth(1);
      g.lineStyle(2, 0xffffff, 0.25);
      g.strokeCircle(s.x, s.y, s.radius);
      return { ...s, highlight: scene.add.graphics().setDepth(1) };
    });
  }

  apply(snap) {
    this.scene.gameMinutes = snap.gm;
    this.applyBears(snap.b);
    if (snap.fd) this.applyFood(snap.fd);
    if (snap.an) this.applyAnimals(snap.an);
    if (snap.ws !== undefined) this.waveSpot = snap.ws;
    (snap.fx || []).forEach((e) => this.applyEffect(e));
  }

  applyBears(list) {
    const seen = new Set();
    for (const s of list) {
      seen.add(s.i);
      let bear = this.bears.get(s.i);
      if (!bear) bear = this.addBear(s);

      const f = readFlags(s.f);
      bear.tx = s.x;
      bear.ty = s.y;
      bear.weight = s.w / 10;
      bear.applyWeight();
      bear.hp = s.h;
      bear.stamina = s.s;
      bear.blocking = f.blocking;
      bear.dashTimer = f.dashing ? 1 : 0;
      bear.chargeTimer = f.charging ? 1 : 0;
      bear.stunTimer = f.stunned ? 1 : 0;
      bear.windupTimer = s.wu / 100;
      bear.chargeWindupTimer = s.cu / 100;
      bear.netEatPct = s.e;
      bear.respawnTimer = s.r / 100;
      bear.swipeCooldown = s.sc / 100;
      bear.chargeCooldown = s.cc / 100;
      bear.dashCooldown = s.dc / 100;
      if (f.dead !== bear.dead) {
        bear.dead = f.dead;
        bear.setAlpha(f.dead ? 0.25 : 1);
        if (!f.dead) bear.setPosition(s.x, s.y);
      }
      // Your own aim stays local, except while a wind-up has locked it.
      if (!bear.isPlayer || bear.isWindingUp || bear.isChargingUp || bear.isCharging) {
        bear.facing.setToPolar(s.a / 100);
      }
    }
    for (const [id, bear] of this.bears) {
      if (!seen.has(id)) {
        this.scene.bears = this.scene.bears.filter((b) => b !== bear);
        bear.destroy();
        this.bears.delete(id);
      }
    }
  }

  addBear(s) {
    const scene = this.scene;
    const bear = new Bear(scene, s.x, s.y, { name: s.n, tint: s.c, isPlayer: s.i === net.id });
    bear.netId = s.i;
    bear.body.enable = false;
    bear.tx = s.x;
    bear.ty = s.y;
    this.bears.set(s.i, bear);
    scene.bears.push(bear);
    if (bear.isPlayer) {
      scene.player = bear;
      scene.cameras.main.startFollow(bear, true, 0.1, 0.1);
    }
    return bear;
  }

  applyFood(list) {
    const seen = new Set();
    for (const [id, texture, x, y] of list) {
      seen.add(id);
      let img = this.food.get(id);
      if (!img) {
        img = this.scene.add.image(x, y, texture).setDepth(texture === 'bush' || texture === 'bush-empty' ? 2 : 3);
        if (texture === 'salmon') {
          img.setRotation(Math.random() * Math.PI * 2);
          this.scene.tweens.add({ targets: img, scale: { from: 0.9, to: 1.15 }, yoyo: true, repeat: -1, duration: 400 });
        }
        this.food.set(id, img);
      }
      if (img.texture.key !== texture) img.setTexture(texture);
      img.setPosition(x, y);
    }
    for (const [id, img] of this.food) {
      if (!seen.has(id)) {
        img.destroy();
        this.food.delete(id);
      }
    }
  }

  applyAnimals(list) {
    const seen = new Set();
    for (const [id, kind, x, y, rot, scale, carrying, depth] of list) {
      seen.add(id);
      let a = this.animals.get(id);
      if (!a) {
        a = { sprite: this.scene.add.image(x, y, kind), fish: null, tx: x, ty: y };
        this.animals.set(id, a);
      }
      a.tx = x;
      a.ty = y;
      a.sprite.setRotation(rot / 100).setScale(scale / 100).setDepth(depth);
      if (carrying && !a.fish) a.fish = this.scene.add.image(x, y, 'salmon').setScale(0.7).setDepth(depth + 1);
      if (!carrying && a.fish) {
        a.fish.destroy();
        a.fish = null;
      }
    }
    for (const [id, a] of this.animals) {
      if (!seen.has(id)) {
        a.sprite.destroy();
        a.fish?.destroy();
        this.animals.delete(id);
      }
    }
  }

  applyEffect(e) {
    const scene = this.scene;
    const bear = e.id !== undefined ? this.bears.get(e.id) : null;
    switch (e.k) {
      case 'text':
        scene.drawFloat(e.x, e.y, e.s, e.c);
        break;
      case 'burst':
        scene.drawBurst(e.x, e.y, e.c, e.n);
        break;
      case 'sfx':
        audio[e.n]?.(scene.volumeAt(e));
        break;
      case 'ann':
        scene.events.emit('announce', e.s);
        break;
      case 'shake':
        scene.cameras.main.shake(e.d, e.i);
        break;
      case 'claw':
        bear?.drawClaws();
        break;
      case 'flash':
        bear?.flash(e.c);
        break;
    }
  }

  // Runs every frame: moves everything smoothly toward its latest reported position.
  update(dt, moveDir) {
    for (const bear of this.bears.values()) {
      if (!bear.dead) this.moveBear(bear, dt, moveDir);
      if (bear.isDashing || bear.isCharging) bear.spawnGhost();
      bear.setRotation(bear.facing.angle());
      bear.drawUi();
    }
    const k = 1 - Math.exp(-FOLLOW_OTHERS * dt);
    for (const a of this.animals.values()) {
      const s = a.sprite;
      s.setPosition(s.x + (a.tx - s.x) * k, s.y + (a.ty - s.y) * k);
      a.fish?.setPosition(s.x + Math.cos(s.rotation) * 16, s.y + Math.sin(s.rotation) * 16).setRotation(s.rotation + Math.PI / 2);
    }
    this.spots.forEach((spot, i) => {
      spot.highlight.clear();
      if (i === this.waveSpot) {
        spot.highlight.lineStyle(4, 0xffd34d, 0.6 + 0.4 * Math.sin(this.scene.time.now / 150));
        spot.highlight.strokeCircle(spot.x, spot.y, spot.radius + 6);
      }
    });
  }

  moveBear(bear, dt, moveDir) {
    const forced = bear.isStunned || bear.isDashing || bear.isCharging;
    let x = bear.x;
    let y = bear.y;
    let rate = FOLLOW_OTHERS;

    if (bear.isPlayer) {
      rate = forced ? FOLLOW_SELF_FORCED : FOLLOW_SELF;
      if (!forced && !bear.isChargingUp) {
        x += moveDir.x * bear.speed * dt;
        y += moveDir.y * bear.speed * dt;
      }
    }
    if (Phaser.Math.Distance.Between(x, y, bear.tx, bear.ty) > SNAP_DISTANCE) {
      x = bear.tx;
      y = bear.ty;
    } else {
      const k = 1 - Math.exp(-rate * dt);
      x += (bear.tx - x) * k;
      y += (bear.ty - y) * k;
    }
    bear.setPosition(x, y);
  }
}
