import Phaser from 'phaser';
import { CONFIG } from '../config.js';

const F = CONFIG.food;
const R = CONFIG.river;
const W = CONFIG.world;

// Owns berry bushes, salmon at fishing spots, and salmon-run waves.
export class FoodSystem {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.spots = F.fishingSpots.map((s) => ({ ...s, salmon: [], spawnTimer: 0 }));
    this.waveSpot = null;
    this.waveTimer = F.waveEverySeconds;
    this.waveRemaining = 0;

    this.spots.forEach((spot) => this.drawSpot(spot));
    for (let i = 0; i < F.berryBushes; i++) this.addBush();
    this.spots.forEach((spot) => this.spawnSalmon(spot));
  }

  drawSpot(spot) {
    const g = this.scene.add.graphics().setDepth(1);
    g.lineStyle(2, 0xffffff, 0.25);
    g.strokeCircle(spot.x, spot.y, spot.radius);
    spot.highlight = this.scene.add.graphics().setDepth(1);
  }

  addBush() {
    // Bushes grow on either bank, away from the water.
    const north = Math.random() < 0.5;
    const y = north
      ? Phaser.Math.Between(80, R.top - 60)
      : Phaser.Math.Between(R.bottom + 60, W.height - 80);
    const x = Phaser.Math.Between(80, W.width - 80);
    const bush = this.scene.add.image(x, y, 'bush').setDepth(2);
    bush.setData({ type: 'berries', weight: F.berries.weight, eatSeconds: F.berries.eatSeconds, available: true });
    this.items.push(bush);
  }

  spawnSalmon(spot, max = F.salmonPerSpotMax) {
    if (spot.salmon.length >= max) return;
    const p = Phaser.Math.RandomXY(new Phaser.Math.Vector2(), Math.random() * spot.radius);
    const fish = this.scene.add.image(spot.x + p.x, spot.y + p.y, 'salmon').setDepth(3);
    fish.setRotation(Math.random() * Math.PI * 2);
    fish.setData({ type: 'salmon', weight: F.salmon.weight, eatSeconds: F.salmon.eatSeconds, available: true, spot });
    this.scene.tweens.add({ targets: fish, scale: { from: 0.9, to: 1.15 }, yoyo: true, repeat: -1, duration: 400 });
    spot.salmon.push(fish);
    this.items.push(fish);
  }

  // Called when a bear finishes eating an item.
  consume(item) {
    item.setData('available', false);
    if (item.getData('type') === 'salmon') {
      const spot = item.getData('spot');
      spot.salmon = spot.salmon.filter((f) => f !== item);
      this.items = this.items.filter((f) => f !== item);
      item.destroy();
    } else {
      item.setTexture('bush-empty');
      this.scene.time.delayedCall(F.berryRegrowSeconds * 1000, () => {
        item.setTexture('bush');
        item.setData('available', true);
      });
    }
  }

  available() {
    return this.items.filter((f) => f.active && f.getData('available'));
  }

  nearestAvailable(x, y, maxDist = Infinity) {
    let best = null;
    let bestDist = maxDist;
    for (const f of this.available()) {
      const d = Phaser.Math.Distance.Between(x, y, f.x, f.y);
      if (d < bestDist) {
        best = f;
        bestDist = d;
      }
    }
    return best;
  }

  // Returns a message when a salmon run starts, so the UI can announce it.
  update(dt) {
    let announcement = null;

    this.waveTimer -= dt;
    if (this.waveTimer <= 0) {
      this.waveSpot = Phaser.Utils.Array.GetRandom(this.spots);
      this.waveRemaining = F.waveDurationSeconds;
      this.waveTimer = F.waveEverySeconds;
      announcement = `Salmon run at ${this.waveSpot.name}!`;
    }
    if (this.waveRemaining > 0) {
      this.waveRemaining -= dt;
      if (this.waveRemaining <= 0) this.waveSpot = null;
    }

    for (const spot of this.spots) {
      const boost = spot === this.waveSpot ? F.waveSpawnMultiplier : 1;
      const max = spot === this.waveSpot ? F.salmonPerSpotMax * 2 : F.salmonPerSpotMax;
      spot.spawnTimer += dt * spot.richness * boost;
      if (spot.spawnTimer >= F.salmonSpawnSeconds) {
        spot.spawnTimer = 0;
        this.spawnSalmon(spot, max);
      }
      spot.highlight.clear();
      if (spot === this.waveSpot) {
        spot.highlight.lineStyle(4, 0xffd34d, 0.6 + 0.4 * Math.sin(this.scene.time.now / 150));
        spot.highlight.strokeCircle(spot.x, spot.y, spot.radius + 6);
      }
    }
    return announcement;
  }
}
