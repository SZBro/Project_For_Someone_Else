import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { BEAR_TEXTURE } from '../textures.js';

const B = CONFIG.bear;
const H = CONFIG.health;
const SW = CONFIG.swipe;
const DA = CONFIG.dash;
const BL = CONFIG.block;
const DEG = Math.PI / 180;

export class Bear extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, { name, tint, isPlayer = false }) {
    super(scene, x, y, 'bear');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.name = name;
    this.baseTint = tint;
    this.isPlayer = isPlayer;
    this.weight = B.startWeight;
    this.hp = H.max;
    this.facing = new Phaser.Math.Vector2(1, 0);

    this.eatTarget = null;
    this.eatProgress = 0;
    this.stunTimer = 0;
    this.windupTimer = 0; // > 0 while a swipe is being wound up
    this.swipeCooldown = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.blocking = false;
    this.regenTimer = 0;
    this.dead = false;
    this.respawnTimer = 0;

    this.setTint(tint);
    this.setOrigin(BEAR_TEXTURE.originX / BEAR_TEXTURE.width, BEAR_TEXTURE.originY / BEAR_TEXTURE.height);
    this.body.setCircle(
      BEAR_TEXTURE.radius,
      BEAR_TEXTURE.originX - BEAR_TEXTURE.radius,
      BEAR_TEXTURE.originY - BEAR_TEXTURE.radius,
    );
    this.body.setCollideWorldBounds(true);
    this.body.setBounce(0.3);
    this.setDepth(10);

    this.label = scene.add
      .text(x, y, name, { fontFamily: 'sans-serif', fontSize: '13px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setDepth(20);
    this.fx = scene.add.graphics().setDepth(9); // wind-up cone and block shield, under the bear
    this.overlay = scene.add.graphics().setDepth(21); // health bar and eat ring, over the bear
    this.strikeFx = scene.add.graphics().setDepth(22);

    this.applyWeight();
  }

  get radius() {
    return B.radius * this.scale;
  }

  get speed() {
    const t = Phaser.Math.Clamp(
      (this.weight - B.slowdownStartWeight) / (B.slowdownEndWeight - B.slowdownStartWeight),
      0,
      1,
    );
    let speed = Phaser.Math.Linear(B.maxSpeed, B.minSpeed, t);
    if (this.blocking) speed *= BL.moveSpeedMultiplier;
    if (this.windupTimer > 0) speed *= SW.moveSpeedMultiplier;
    return speed;
  }

  get isStunned() {
    return this.stunTimer > 0;
  }

  get isDashing() {
    return this.dashTimer > 0;
  }

  get isWindingUp() {
    return this.windupTimer > 0;
  }

  // Free to start a new action (swipe, dash, block, eat).
  get canAct() {
    return !this.dead && !this.isStunned && !this.isDashing;
  }

  get canEat() {
    return this.canAct && !this.blocking && !this.isWindingUp;
  }

  // Size and push resistance follow weight.
  applyWeight() {
    this.setScale(Math.sqrt(this.weight / B.startWeight));
    this.body.mass = this.weight / 100;
  }

  addWeight(lbs) {
    this.weight = Math.max(B.minWeight, this.weight + lbs);
    this.applyWeight();
  }

  // dir: normalized vector or null to stand still.
  move(dir) {
    if (this.dead || this.isStunned || this.isDashing) return;
    if (!dir || dir.lengthSq() === 0) {
      this.body.setVelocity(0, 0);
      return;
    }
    this.body.setVelocity(dir.x * this.speed, dir.y * this.speed);
  }

  // Facing is locked while a swipe winds up, so the target can see where it will land.
  aim(x, y) {
    if (this.dead || this.isWindingUp) return;
    const v = new Phaser.Math.Vector2(x, y);
    if (v.lengthSq() > 0) this.facing.copy(v.normalize());
  }

  startEating(food) {
    if (this.eatTarget === food) return;
    this.eatTarget = food;
    this.eatProgress = 0;
  }

  stopEating() {
    this.eatTarget = null;
    this.eatProgress = 0;
  }

  canReach(food) {
    return Phaser.Math.Distance.Between(this.x, this.y, food.x, food.y) <= this.radius + CONFIG.food.eatRange;
  }

  startSwipe() {
    if (!this.canAct || this.blocking || this.isWindingUp || this.swipeCooldown > 0) return false;
    this.windupTimer = SW.windupSeconds;
    this.stopEating();
    return true;
  }

  dash(dir) {
    if (!this.canAct || this.dashCooldown > 0) return false;
    const d = dir && dir.lengthSq() > 0 ? dir.clone().normalize() : this.facing.clone();
    this.windupTimer = 0; // dashing cancels a wind-up, so it can be used to feint
    this.blocking = false;
    this.stopEating();
    this.dashTimer = DA.durationSeconds;
    this.dashCooldown = DA.cooldownSeconds;
    this.body.setVelocity(d.x * DA.speed, d.y * DA.speed);
    return true;
  }

  setBlocking(on) {
    if (on && (!this.canAct || this.isWindingUp)) return;
    this.blocking = on;
    if (on) this.stopEating();
  }

  // Is the point (x, y) inside this bear's front cone of the given width?
  inFrontCone(x, y, arcDegrees) {
    const to = new Phaser.Math.Vector2(x - this.x, y - this.y).normalize();
    return Math.acos(Phaser.Math.Clamp(to.dot(this.facing), -1, 1)) <= (arcDegrees * DEG) / 2;
  }

  // Wind-up finished: hit every bear in the cone in front.
  landSwipe(bears) {
    this.swipeCooldown = SW.cooldownSeconds;
    this.drawStrike();
    for (const other of bears) {
      if (other === this || other.dead) continue;
      const dist = Phaser.Math.Distance.Between(this.x, this.y, other.x, other.y);
      if (dist > this.radius + other.radius + SW.range) continue;
      if (!this.inFrontCone(other.x, other.y, SW.arcDegrees)) continue;
      other.takeHit(this);
    }
  }

  takeHit(attacker) {
    if (this.dead || (this.isDashing && DA.invulnerable)) return;

    const blocked = this.blocking && this.inFrontCone(attacker.x, attacker.y, BL.arcDegrees);
    // Heavier attackers hit a bit harder; capped so weight doesn't snowball fights.
    const ratio = Phaser.Math.Clamp(Math.sqrt(attacker.weight / this.weight), 0.75, 1.35);
    const damage = SW.damage * ratio * (blocked ? BL.damageMultiplier : 1);
    const force = SW.knockback * ratio * (blocked ? BL.knockbackMultiplier : 1);

    const away = new Phaser.Math.Vector2(this.x - attacker.x, this.y - attacker.y).normalize();
    this.body.setVelocity(away.x * force, away.y * force);
    this.hp -= damage;
    this.regenTimer = H.regenDelaySeconds;

    if (blocked) {
      this.flash(0x7fc8ff);
    } else {
      this.stunTimer = SW.stunSeconds;
      this.windupTimer = 0; // getting hit interrupts a wind-up
      this.stopEating();
      this.flash(0xff4040);
    }
    if (this.isPlayer) this.scene.cameras.main.shake(blocked ? 60 : 140, blocked ? 0.002 : 0.006);

    if (this.hp <= 0) this.die(attacker);
  }

  flash(color) {
    this.setTint(color);
    this.scene.time.delayedCall(110, () => this.active && !this.dead && this.setTint(this.baseTint));
  }

  die(killer) {
    this.dead = true;
    this.hp = 0;
    this.respawnTimer = H.respawnSeconds;
    this.weight = Math.max(B.minWeight, this.weight * (1 - H.deathWeightPenalty));
    this.applyWeight();
    this.windupTimer = 0;
    this.blocking = false;
    this.stopEating();
    this.body.setVelocity(0, 0);
    this.body.enable = false;
    this.setAlpha(0.25);
    this.scene.events.emit('knockout', { victim: this, killer });
  }

  respawn(x, y) {
    this.dead = false;
    this.hp = H.max;
    this.stunTimer = 0;
    this.body.reset(x, y);
    this.body.enable = true;
    this.setAlpha(1);
    this.setTint(this.baseTint);
  }

  // Returns the food finished this frame, or null.
  tick(dt, bears) {
    if (this.dead) {
      this.respawnTimer -= dt;
      this.drawUi();
      return null;
    }

    this.swipeCooldown = Math.max(0, this.swipeCooldown - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.body.velocity.scale(0.9);
    }
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.spawnDashGhost();
      if (this.dashTimer <= 0) this.body.setVelocity(0, 0);
    }
    if (this.windupTimer > 0) {
      this.windupTimer -= dt;
      if (this.windupTimer <= 0) this.landSwipe(bears);
    }
    if (this.regenTimer > 0) this.regenTimer -= dt;
    else this.hp = Math.min(H.max, this.hp + H.regenPerSecond * dt);

    this.setRotation(this.facing.angle());

    let eaten = null;
    const food = this.eatTarget;
    if (food && (!this.canEat || !food.active || !food.getData('available') || !this.canReach(food))) {
      this.stopEating();
    } else if (food) {
      this.eatProgress += dt;
      if (this.eatProgress >= food.getData('eatSeconds')) {
        eaten = food;
        this.stopEating();
      }
    }

    this.drawUi();
    return eaten;
  }

  spawnDashGhost() {
    const ghost = this.scene.add
      .image(this.x, this.y, 'bear')
      .setOrigin(this.originX, this.originY)
      .setScale(this.scale)
      .setRotation(this.rotation)
      .setTint(this.baseTint)
      .setAlpha(0.35)
      .setDepth(8);
    this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 220, onComplete: () => ghost.destroy() });
  }

  drawStrike() {
    const r = this.radius + SW.range;
    const a = this.facing.angle();
    const half = (SW.arcDegrees * DEG) / 2;
    this.strikeFx.clear().setAlpha(1);
    this.strikeFx.lineStyle(6, 0xffffff, 1);
    this.strikeFx.beginPath();
    this.strikeFx.arc(this.x, this.y, r, a - half, a + half);
    this.strikeFx.strokePath();
    this.scene.tweens.add({ targets: this.strikeFx, alpha: 0, duration: 180 });
  }

  drawUi() {
    const { x, y } = this;
    const r = this.radius;
    this.fx.clear();
    this.overlay.clear();

    this.label.setPosition(x, y - r - 14);
    this.label.setText(this.dead ? `${this.name}  KO ${Math.ceil(this.respawnTimer)}` : `${this.name}  ${Math.round(this.weight)} lb`);
    if (this.dead) return;

    const a = this.facing.angle();

    // Wind-up tell: a red cone that fills in as the swipe gets closer to landing.
    if (this.isWindingUp) {
      const half = (SW.arcDegrees * DEG) / 2;
      const pct = 1 - this.windupTimer / SW.windupSeconds;
      const reach = r + SW.range;
      this.fx.fillStyle(0xff3030, 0.15 + 0.35 * pct);
      this.fx.slice(x, y, reach * (0.4 + 0.6 * pct), a - half, a + half, false);
      this.fx.fillPath();
      this.fx.lineStyle(2, 0xff3030, 0.8);
      this.fx.beginPath();
      this.fx.arc(x, y, reach, a - half, a + half);
      this.fx.strokePath();
    }

    // Block shield: a blue arc in front.
    if (this.blocking) {
      const half = (BL.arcDegrees * DEG) / 2;
      this.fx.lineStyle(6, 0x7fc8ff, 0.9);
      this.fx.beginPath();
      this.fx.arc(x, y, r + 10, a - half, a + half);
      this.fx.strokePath();
    }

    // Health bar
    const w = 44;
    const pct = this.hp / H.max;
    this.overlay.fillStyle(0x000000, 0.6);
    this.overlay.fillRect(x - w / 2 - 1, y - r - 11, w + 2, 6);
    this.overlay.fillStyle(pct > 0.5 ? 0x5ad45a : pct > 0.25 ? 0xe8c33a : 0xe0463a);
    this.overlay.fillRect(x - w / 2, y - r - 10, w * pct, 4);

    // Eat progress ring
    if (this.eatTarget) {
      const p = this.eatProgress / this.eatTarget.getData('eatSeconds');
      this.overlay.lineStyle(4, 0xffd34d, 1);
      this.overlay.beginPath();
      this.overlay.arc(x, y, r + 8, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
      this.overlay.strokePath();
    }
  }

  destroy(fromScene) {
    this.label.destroy();
    this.fx.destroy();
    this.overlay.destroy();
    this.strikeFx.destroy();
    super.destroy(fromScene);
  }
}
