import Phaser from 'phaser';
import { CONFIG } from '../config.js';

const A = CONFIG.animals;
const W = CONFIG.world;
const R = CONFIG.river;

// Wildlife that makes the river feel alive. Bears can hunt any of it for meat:
//   deer      graze in herds on the banks and bolt when a bear comes close
//   foxes     sneak in to steal loose salmon; swipe one to make it drop the fish
//   gulls     sit around fishing spots and scatter when bears get near
//   eagle     circles overhead and now and then swoops down to snatch a salmon
//   squirrels dart around the banks
export class AnimalSystem {
  constructor(scene, food) {
    this.scene = scene;
    this.food = food;
    this.critters = [];
    this.nextId = 1;

    for (let h = 0; h < 2; h++) {
      const home = bankPoint(h === 0);
      for (let i = 0; i < A.deer.count / 2; i++) {
        this.add('deer', home.x + Phaser.Math.Between(-60, 60), home.y + Phaser.Math.Between(-40, 40), { home, north: h === 0 });
      }
    }
    for (let i = 0; i < A.foxes.count; i++) {
      const p = bankPoint(i % 2 === 0);
      this.add('fox', p.x, p.y, { north: i % 2 === 0, home: p });
    }
    const spots = CONFIG.food.fishingSpots;
    for (let i = 0; i < A.gulls.count; i++) {
      const spot = spots[i % spots.length];
      const perch = perchNear(spot);
      this.add('gull', perch.x, perch.y, { spot });
    }
    for (let i = 0; i < A.squirrels.count; i++) {
      const p = bankPoint(i % 2 === 0);
      this.add('squirrel', p.x, p.y, { north: i % 2 === 0 });
    }

    this.spawnEagle(W.width / 2, 300);
  }

  spawnEagle(x, y) {
    this.eagle = this.add('eagle', x, y, { angle: 0 });
    this.eagle.sprite.setDepth(27);
    this.eagle.shadow = this.scene.add.image(0, 0, 'eagle').setTint(0x000000).setAlpha(0.18).setDepth(4).setScale(0.8);
    this.eagle.swoopTimer = Phaser.Math.Between(...A.eagle.swoopEverySeconds);
  }

  add(kind, x, y, extra = {}) {
    const c = {
      id: this.nextId++,
      kind,
      sprite: this.scene.add.image(x, y, kind).setDepth(kind === 'gull' ? 7 : 6),
      state: 'idle',
      timer: Math.random() * 3,
      dest: { x, y },
      carrying: null,
      hp: CONFIG.hunting[kind].hp,
      ...extra,
    };
    this.critters.push(c);
    return c;
  }

  // Bring a hunted animal back somewhere on the map after a while.
  respawn(kind) {
    const north = Math.random() < 0.5;
    const p = bankPoint(north);
    if (kind === 'eagle') this.spawnEagle(p.x, -100);
    else if (kind === 'gull') {
      const spot = Phaser.Utils.Array.GetRandom(CONFIG.food.fishingSpots);
      const perch = perchNear(spot);
      this.add('gull', perch.x, perch.y, { spot });
    } else this.add(kind, p.x, p.y, { north, home: p });
  }

  // Can a bear reach this animal right now? Flying gulls and a circling eagle are out of reach.
  hittable(c) {
    if (c.kind === 'gull') return c.state !== 'flying';
    if (c.kind === 'eagle') return c.state === 'swoop';
    return true;
  }

  // A bear's swipe landed: animals in the swipe cone get hit, the rest nearby scatter.
  onSwipe(bear, reach) {
    for (const c of [...this.critters]) {
      const s = c.sprite;
      const d = Phaser.Math.Distance.Between(bear.x, bear.y, s.x, s.y);
      if (d > reach + 12) continue;
      if (this.hittable(c) && bear.inFrontCone(s.x, s.y, CONFIG.swipe.arcDegrees)) {
        this.damage(c, CONFIG.swipe.damage, bear);
      } else if (c.kind !== 'eagle' && c.state !== 'flying') {
        if (c.carrying) this.drop(c);
        this.startFlee(c, bear);
      }
    }
  }

  // A charging bear runs over any animal it touches.
  onCharge(bear) {
    for (const c of [...this.critters]) {
      if (!this.hittable(c) || c.chargedBy === bear) continue;
      if (Phaser.Math.Distance.Between(bear.x, bear.y, c.sprite.x, c.sprite.y) > bear.radius + 14) continue;
      c.chargedBy = bear; // one hit per charge
      this.scene.time.delayedCall(500, () => (c.chargedBy = null));
      this.damage(c, CONFIG.charge.damage * 2, bear);
    }
  }

  damage(c, amount, bear) {
    const s = c.sprite;
    c.hp -= amount;
    this.scene.floatText(s.x, s.y - 12, `-${Math.round(amount)}`, '#ff5a4a');
    if (c.hp <= 0) {
      this.kill(c, bear);
      return;
    }
    s.setTint(0xff4040);
    this.scene.time.delayedCall(110, () => s.active && s.clearTint());
    this.scene.burst(s.x, s.y, 0x8a6a4a, 5);
    this.scene.events.emit('sfx', 'hit', s);
    if (c.carrying) this.drop(c);
    if (c.kind === 'eagle') {
      c.state = 'leave'; // a wounded eagle gives up the swoop
      c.dest = { x: s.x, y: -150 };
    } else {
      this.startFlee(c, bear);
    }
  }

  kill(c, bear) {
    const s = c.sprite;
    const h = CONFIG.hunting[c.kind];
    if (c.carrying) this.drop(c);
    this.scene.burst(s.x, s.y, 0x8a6a4a, 14);
    this.scene.events.emit('sfx', 'heavyHit', s);
    this.food.addMeat(s.x, s.y, h.meat, h.eatSeconds);
    if (bear.isPlayer) this.scene.floatText(s.x, s.y - 30, `Caught a ${c.kind}!`, '#ffd34d');

    s.destroy();
    c.shadow?.destroy();
    this.critters = this.critters.filter((x) => x !== c);
    if (c === this.eagle) this.eagle = null;
    this.scene.time.delayedCall(CONFIG.hunting.respawnSeconds * 1000, () => this.respawn(c.kind));
  }

  update(dt, bears) {
    const alive = bears.filter((b) => !b.dead && b.visible);
    for (const c of this.critters) {
      const near = nearest(c.sprite, alive);
      switch (c.kind) {
        case 'deer':
          this.updateGrazer(c, dt, near, A.deer);
          break;
        case 'squirrel':
          this.updateSquirrel(c, dt, near);
          break;
        case 'fox':
          this.updateFox(c, dt, near, alive);
          break;
        case 'gull':
          this.updateGull(c, dt, near);
          break;
        case 'eagle':
          this.updateEagle(c, dt, alive);
          break;
      }
      if (c.carrying) {
        const s = c.sprite;
        c.carrying.setPosition(s.x + Math.cos(s.rotation) * 16, s.y + Math.sin(s.rotation) * 16).setRotation(s.rotation + Math.PI / 2);
      }
    }
  }

  // ---- behaviours ----

  updateGrazer(c, dt, near, cfg) {
    if (c.state !== 'flee' && near && near.d < cfg.fearRadius) this.startFlee(c, near.b);
    if (c.state === 'flee') {
      this.step(c, c.dest, cfg.fleeSpeed, dt);
      if ((c.timer -= dt) <= 0) {
        c.state = 'idle';
        c.home = { x: c.sprite.x, y: c.sprite.y };
      }
      return;
    }
    if (c.state === 'walk') {
      if (this.step(c, c.dest, cfg.speed, dt)) {
        c.state = 'idle';
        c.timer = Phaser.Math.FloatBetween(2, 6); // graze for a while
      }
      return;
    }
    if ((c.timer -= dt) <= 0) {
      c.state = 'walk';
      c.dest = onBank(c.home.x + Phaser.Math.Between(-150, 150), c.home.y + Phaser.Math.Between(-80, 80), c.north);
    }
  }

  updateSquirrel(c, dt, near) {
    if (c.state !== 'flee' && near && near.d < A.squirrels.fearRadius) this.startFlee(c, near.b);
    if (c.state === 'flee' || c.state === 'walk') {
      const arrived = this.step(c, c.dest, A.squirrels.speed * (c.state === 'flee' ? 1.6 : 1), dt);
      if (arrived || (c.state === 'flee' && (c.timer -= dt) <= 0)) {
        c.state = 'idle';
        c.timer = Phaser.Math.FloatBetween(0.5, 2.5);
      }
      return;
    }
    if ((c.timer -= dt) <= 0) {
      c.state = 'walk';
      c.dest = onBank(c.sprite.x + Phaser.Math.Between(-140, 140), c.sprite.y + Phaser.Math.Between(-100, 100), c.north);
    }
  }

  updateFox(c, dt, near, bears) {
    const cfg = A.foxes;
    if (c.state === 'flee') {
      this.step(c, c.dest, cfg.fleeSpeed, dt);
      if ((c.timer -= dt) <= 0) c.state = c.carrying ? 'escape' : 'idle';
      return;
    }
    if (near && near.d < cfg.fearRadius && !c.carrying) {
      this.startFlee(c, near.b);
      return;
    }

    if (c.carrying) {
      // Run off with the fish and eat it somewhere quiet.
      if (c.state !== 'escape') {
        c.state = 'escape';
        c.dest = this.quietSpot(bears);
        c.timer = 6;
      }
      this.step(c, c.dest, cfg.fleeSpeed * 0.8, dt);
      if ((c.timer -= dt) <= 0) {
        c.carrying.destroy();
        c.carrying = null;
        c.state = 'idle';
      }
      return;
    }

    // Look for a loose salmon nobody is guarding.
    if (c.state !== 'steal' || !c.target?.active || !c.target.getData('available')) {
      c.target = this.food
        .available()
        .filter((f) => f.getData('type') === 'salmon' && !f.getData('spot'))
        .find(
          (f) =>
            Phaser.Math.Distance.Between(c.sprite.x, c.sprite.y, f.x, f.y) < cfg.stealRadius &&
            !bears.some((b) => Phaser.Math.Distance.Between(b.x, b.y, f.x, f.y) < 90),
        );
      c.state = c.target ? 'steal' : c.state === 'steal' ? 'idle' : c.state;
    }
    if (c.state === 'steal') {
      if (this.step(c, c.target, cfg.fleeSpeed, dt)) this.grab(c, c.target);
      return;
    }
    this.updateGrazer(c, dt, null, { ...cfg, fearRadius: 0 }); // prowl like a grazer when idle
  }

  updateGull(c, dt, near) {
    const s = c.sprite;
    if (c.state === 'flying') {
      s.scaleY = 1 + Math.sin(this.scene.time.now / 60) * 0.35; // flapping
      if (this.step(c, c.dest, 220, dt) || (c.timer -= dt) <= 0) {
        if (c.returning) {
          c.state = 'idle';
          c.returning = false;
          s.setScale(1).setDepth(7);
          c.timer = Phaser.Math.FloatBetween(1, 4);
        } else {
          c.returning = true;
          c.dest = perchNear(c.spot);
          c.timer = 8;
        }
      }
      return;
    }
    if (near && near.d < A.gulls.fearRadius) {
      c.state = 'flying';
      c.returning = false;
      const away = new Phaser.Math.Vector2(s.x - near.b.x, s.y - near.b.y).normalize().scale(Phaser.Math.Between(200, 320));
      c.dest = { x: s.x + away.x, y: s.y + away.y };
      c.timer = Phaser.Math.FloatBetween(2, 4);
      s.setScale(1.25).setDepth(26);
      return;
    }
    // Hop around the perch now and then.
    if ((c.timer -= dt) <= 0) {
      c.timer = Phaser.Math.FloatBetween(1, 4);
      const hop = Phaser.Math.RandomXY(new Phaser.Math.Vector2(), 14);
      this.scene.tweens.add({ targets: s, x: s.x + hop.x, y: s.y + hop.y, duration: 160 });
      s.setRotation(Math.random() * Math.PI * 2);
    }
  }

  updateEagle(c, dt, bears) {
    const s = c.sprite;
    const cfg = A.eagle;
    if (c.state === 'idle' || c.state === 'circle') {
      c.state = 'circle';
      c.angle += dt * 0.35;
      const center = { x: W.width / 2 + Math.sin(c.angle * 0.3) * 600, y: (R.top + R.bottom) / 2 };
      const target = { x: center.x + Math.cos(c.angle) * 320, y: center.y + Math.sin(c.angle) * 260 };
      this.step(c, target, cfg.speed * 0.6, dt);
      if ((c.swoopTimer -= dt) <= 0) {
        c.target = this.swoopTarget(bears);
        c.state = c.target ? 'swoop' : 'circle';
        c.swoopTimer = Phaser.Math.Between(...cfg.swoopEverySeconds);
      }
    } else if (c.state === 'swoop') {
      if (!c.target.active || !c.target.getData('available')) c.state = 'circle';
      else if (this.step(c, c.target, cfg.speed * 1.4, dt)) {
        this.grab(c, c.target);
        if (this.isOnScreen(s)) this.scene.floatText(s.x, s.y - 20, 'Eagle stole a salmon!', '#ffffff');
        c.state = 'leave';
        c.dest = { x: s.x + Phaser.Math.Between(-300, 300), y: -150 };
      }
    } else if (c.state === 'leave') {
      if (this.step(c, c.dest, cfg.speed, dt)) {
        c.carrying?.destroy();
        c.carrying = null;
        c.state = 'circle';
      }
    }
    // Shadow on the ground, offset more the higher it flies.
    const swooping = c.state === 'swoop';
    c.shadow.setPosition(s.x + (swooping ? 8 : 40), s.y + (swooping ? 10 : 60)).setRotation(s.rotation);
    s.setScale(swooping ? 1 : 1.2);
  }

  // ---- helpers ----

  // Move toward a point; returns true on arrival. Faces the direction of travel.
  step(c, dest, speed, dt) {
    const s = c.sprite;
    const dx = dest.x - s.x;
    const dy = dest.y - s.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) return true;
    const move = Math.min(d, speed * dt);
    s.x += (dx / d) * move;
    s.y += (dy / d) * move;
    s.setRotation(Math.atan2(dy, dx));
    return false;
  }

  startFlee(c, bear) {
    const s = c.sprite;
    if (c.kind === 'gull') {
      c.state = 'flying';
      c.returning = false;
      c.dest = { x: s.x + Phaser.Math.Between(-300, 300), y: s.y + Phaser.Math.Between(-300, 300) };
      c.timer = 3;
      s.setScale(1.25).setDepth(26);
      return;
    }
    const away = new Phaser.Math.Vector2(s.x - bear.x, s.y - bear.y).normalize().rotate(Phaser.Math.FloatBetween(-0.5, 0.5));
    const dist = c.kind === 'deer' ? 380 : 220;
    c.state = 'flee';
    c.timer = Phaser.Math.FloatBetween(1.2, 2.2);
    c.dest = clampToMap(s.x + away.x * dist, s.y + away.y * dist, c.north);
  }

  grab(c, item) {
    if (!item.active || !item.getData('available')) return;
    this.food.consume(item); // removes the salmon from play
    c.carrying = this.scene.add.image(c.sprite.x, c.sprite.y, 'salmon').setScale(0.7).setDepth(c.sprite.depth + 1);
    c.target = null;
  }

  drop(c) {
    const s = c.sprite;
    c.carrying.destroy();
    c.carrying = null;
    this.food.addLooseSalmon(s.x, s.y);
  }

  // Salmon the eagle can see: loose fish first, otherwise fish at a spot that no bear is eating.
  swoopTarget(bears) {
    const eaten = new Set(bears.map((b) => b.eatTarget).filter(Boolean));
    const salmon = this.food.available().filter((f) => f.getData('type') === 'salmon' && !eaten.has(f));
    const loose = salmon.filter((f) => !f.getData('spot'));
    return Phaser.Utils.Array.GetRandom(loose.length ? loose : salmon) || null;
  }

  quietSpot(bears) {
    let best = null;
    let bestDist = -1;
    for (let i = 0; i < 6; i++) {
      const p = bankPoint(Math.random() < 0.5);
      const d = Math.min(...bears.map((b) => Phaser.Math.Distance.Between(p.x, p.y, b.x, b.y)), 9999);
      if (d > bestDist) {
        best = p;
        bestDist = d;
      }
    }
    return best;
  }

  isOnScreen(s) {
    return this.scene.cameras.main.worldView.contains(s.x, s.y);
  }
}

function nearest(s, bears) {
  let best = null;
  for (const b of bears) {
    const d = Phaser.Math.Distance.Between(s.x, s.y, b.x, b.y);
    if (!best || d < best.d) best = { b, d };
  }
  return best;
}

function bankPoint(north) {
  return {
    x: Phaser.Math.Between(150, W.width - 150),
    y: north ? Phaser.Math.Between(120, R.top - 80) : Phaser.Math.Between(R.bottom + 80, W.height - 120),
  };
}

// Keep land animals on their own bank, out of the river.
function onBank(x, y, north) {
  return {
    x: Phaser.Math.Clamp(x, 60, W.width - 60),
    y: north ? Phaser.Math.Clamp(y, 80, R.top - 50) : Phaser.Math.Clamp(y, R.bottom + 50, W.height - 80),
  };
}

function clampToMap(x, y, north) {
  return north === undefined ? { x: Phaser.Math.Clamp(x, 40, W.width - 40), y: Phaser.Math.Clamp(y, 40, W.height - 40) } : onBank(x, y, north);
}

function perchNear(spot) {
  const a = Math.random() * Math.PI * 2;
  const r = spot.radius + Phaser.Math.Between(10, 50);
  return { x: spot.x + Math.cos(a) * r, y: spot.y + Math.sin(a) * r };
}
