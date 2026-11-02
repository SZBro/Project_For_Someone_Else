import Phaser from 'phaser';
import { CONFIG } from '../config.js';

const N = CONFIG.npc;
const W = CONFIG.world;
const R = CONFIG.river;
const CHARGE_REACH = CONFIG.charge.speed * CONFIG.charge.durationSeconds;
const DEFAULT_PERSONALITY = { aggression: 0.4, caution: 0.3, skill: 0.5, reaction: [0.1, 0.3], mistakes: 0.1, targets: 'any' };

// NPC behaviour. Each bear has a personality (see config.npc.personalities) and moves between:
//   forage  - pick the most worthwhile food and eat it, fighting rivals near it
//   retreat - low on health: back away from the nearest bear, then rest until healed
//   wander  - stroll to a random spot for a few seconds, so bears don't look like robots
export function updateNpc(npc, dt, { food, bears }) {
  if (!npc.brain) initBrain(npc);
  const brain = npc.brain;

  if (npc.blockTimer > 0) {
    npc.blockTimer -= dt;
    if (npc.blockTimer <= 0) npc.setBlocking(false);
  }

  // A reaction decided earlier fires after this bear's reaction delay (it may be too late).
  if (brain.pendingReaction) {
    brain.pendingReaction.delay -= dt;
    if (brain.pendingReaction.delay <= 0) {
      brain.pendingReaction.run();
      brain.pendingReaction = null;
    }
  }

  brain.thinkTimer -= dt;
  if (brain.thinkTimer <= 0) {
    brain.thinkTimer = N.thinkSeconds * Phaser.Math.FloatBetween(0.6, 1.5);
    think(npc, food, bears);
  }

  if (npc.blocking || npc.isWindingUp || npc.isChargingUp || npc.isCharging) {
    npc.move(null);
    return;
  }

  if (brain.state === 'retreat' || brain.state === 'wander') {
    const d = Phaser.Math.Distance.Between(npc.x, npc.y, brain.dest.x, brain.dest.y);
    if (d < 20) {
      npc.move(null);
      if (brain.state === 'wander' && (brain.stateTimer -= dt) <= 0) brain.state = 'forage';
    } else {
      walk(npc, brain.dest.x, brain.dest.y, dt);
    }
    if (brain.state === 'retreat' && npc.hp >= CONFIG.health.max * N.restUntilHealth) brain.state = 'forage';
    return;
  }

  const goal = npc.goal;
  const goalGone = !goal || !goal.active || !goal.getData('available');
  if (goalGone) {
    npc.goal = pickFood(npc, food);
    npc.move(null);
    return;
  }
  if (npc.canReach(goal)) {
    npc.move(null);
    npc.startEating(goal);
  } else {
    walk(npc, goal.x, goal.y, dt);
  }
}

function initBrain(npc) {
  npc.brain = {
    p: { ...DEFAULT_PERSONALITY, ...N.personalities[npc.name] },
    state: 'forage',
    thinkTimer: Math.random() * N.thinkSeconds,
    pendingReaction: null,
    dest: { x: npc.x, y: npc.y },
    stateTimer: 0,
    wobble: Math.random() * 1000,
  };
}

// Walk toward a point with a little side-to-side wobble, so paths look natural.
function walk(npc, x, y, dt) {
  const brain = npc.brain;
  brain.wobble += dt;
  const dir = new Phaser.Math.Vector2(x - npc.x, y - npc.y).normalize();
  dir.rotate(Math.sin(brain.wobble * 2.3) * 0.25).normalize();
  npc.aim(dir.x, dir.y);
  npc.move(dir);
}

function think(npc, food, bears) {
  const brain = npc.brain;
  const p = brain.p;

  if (react(npc, bears)) return;

  // Low health: cautious bears back off and rest.
  if (brain.state !== 'retreat' && npc.hp < CONFIG.health.max * p.caution) {
    brain.state = 'retreat';
    brain.dest = retreatPoint(npc, bears);
    npc.stopEating();
    return;
  }
  if (brain.state === 'retreat') return;

  if (brain.state === 'forage' && !npc.eatTarget && Math.random() < N.wanderChance) {
    brain.state = 'wander';
    brain.stateTimer = Phaser.Math.FloatBetween(1, 3);
    brain.dest = randomBankPoint();
    return;
  }
  if (brain.state !== 'forage') return;

  // Sometimes rethink the food choice, so NPCs switch spots instead of tunnel-visioning.
  if (!npc.eatTarget && Math.random() < 0.15) npc.goal = pickFood(npc, food);

  fight(npc, bears);
}

function pickFood(npc, food) {
  const fav = npc.brain.p.favorite;
  let best = null;
  let bestScore = 0;
  for (const f of food.available()) {
    const dist = Phaser.Math.Distance.Between(npc.x, npc.y, f.x, f.y);
    let score = (f.getData('weight') / (dist + 150)) * Phaser.Math.FloatBetween(0.5, 1.5);
    if (fav && f.getData('spot')?.name === fav) score *= 2.5;
    if (score > bestScore) {
      best = f;
      bestScore = score;
    }
  }
  return best;
}

function inSwipeRange(a, b) {
  return Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) <= a.radius + b.radius + CONFIG.swipe.range;
}

// Spot an attack aimed at this NPC and plan a response after its reaction delay.
// Swipes get blocked or dodged; charges break blocks, so those get dodged sideways.
function react(npc, bears) {
  const p = npc.brain.p;
  const swipe = bears.find(
    (b) =>
      b !== npc && !b.dead && b.isWindingUp && inSwipeRange(b, npc) && b.inFrontCone(npc.x, npc.y, CONFIG.swipe.arcDegrees),
  );
  const charge = bears.find(
    (b) =>
      b !== npc &&
      !b.dead &&
      b.isChargingUp &&
      Phaser.Math.Distance.Between(b.x, b.y, npc.x, npc.y) < CHARGE_REACH + npc.radius + b.radius &&
      b.inFrontCone(npc.x, npc.y, 50),
  );
  const threat = charge || swipe;
  if (!threat || npc.brain.pendingReaction || Math.random() > p.skill) return false;

  const delay = Phaser.Math.FloatBetween(p.reaction[0], p.reaction[1]);
  npc.brain.pendingReaction = {
    delay,
    run: () => {
      if (npc.dead) return;
      npc.aim(threat.x - npc.x, threat.y - npc.y);
      if (charge) {
        const side = new Phaser.Math.Vector2(-threat.facing.y, threat.facing.x).scale(Math.random() < 0.5 ? 1 : -1);
        npc.dash(side);
      } else if (Math.random() < 0.6) {
        npc.setBlocking(true);
        npc.blockTimer = N.blockSeconds * Phaser.Math.FloatBetween(0.7, 1.4);
      } else {
        const away = new Phaser.Math.Vector2(npc.x - threat.x, npc.y - threat.y).rotate(Phaser.Math.FloatBetween(-0.8, 0.8));
        npc.dash(away);
      }
    },
  };
  return true;
}

// Who this bear would rather fight, by personality. Grudges trump everything.
function rivalScore(npc, b) {
  const p = npc.brain.p;
  if (npc.lastAttacker === b && npc.scene.time.now - npc.lastHitAt < N.grudgeSeconds * 1000) return 5;
  if (p.targets === 'smaller') return b.weight < npc.weight ? 2 : 0.5;
  if (p.targets === 'bigger') return b.weight > npc.weight ? 2 : 0.6;
  if (p.targets === 'eating') return b.eatTarget ? 3 : 0.4;
  return 1;
}

function fight(npc, bears) {
  const p = npc.brain.p;
  if (npc.blocking) return;
  const goal = npc.goal;
  const nearGoal = goal && Phaser.Math.Distance.Between(npc.x, npc.y, goal.x, goal.y) < 220;
  const grudge = npc.lastAttacker && !npc.lastAttacker.dead && npc.scene.time.now - npc.lastHitAt < N.grudgeSeconds * 1000;
  if (!nearGoal && !grudge) return;

  const rivals = bears
    .filter((b) => b !== npc && !b.dead)
    .map((b) => ({ b, d: Phaser.Math.Distance.Between(npc.x, npc.y, b.x, b.y), s: rivalScore(npc, b) }))
    .filter((r) => r.d < CHARGE_REACH + 40)
    .sort((a, b) => b.s / (b.d + 50) - a.s / (a.d + 50));
  const target = rivals[0];
  if (!target || Math.random() > p.aggression * Math.min(1.5, target.s)) return;

  // Mistakes: swing at the wrong angle.
  const miss = Math.random() < p.mistakes ? Phaser.Math.FloatBetween(0.8, 1.6) * (Math.random() < 0.5 ? 1 : -1) : 0;
  const aim = new Phaser.Math.Vector2(target.b.x - npc.x, target.b.y - npc.y).rotate(miss);
  npc.aim(aim.x, aim.y);

  if (inSwipeRange(npc, target.b)) npc.startSwipe();
  else if (Math.random() < 0.4) npc.startCharge();
}

// Away from the nearest bear, toward the closest bank.
function retreatPoint(npc, bears) {
  const others = bears.filter((b) => b !== npc && !b.dead);
  const nearest = others.sort(
    (a, b) => Phaser.Math.Distance.Between(npc.x, npc.y, a.x, a.y) - Phaser.Math.Distance.Between(npc.x, npc.y, b.x, b.y),
  )[0];
  const away = nearest ? new Phaser.Math.Vector2(npc.x - nearest.x, npc.y - nearest.y).normalize() : new Phaser.Math.Vector2(0, 1);
  const x = Phaser.Math.Clamp(npc.x + away.x * 350, 100, W.width - 100);
  const north = npc.y < (R.top + R.bottom) / 2;
  const y = north ? Phaser.Math.Between(120, R.top - 80) : Phaser.Math.Between(R.bottom + 80, W.height - 120);
  return { x, y };
}

function randomBankPoint() {
  return {
    x: Phaser.Math.Between(150, W.width - 150),
    y: Math.random() < 0.5 ? Phaser.Math.Between(120, R.top - 60) : Phaser.Math.Between(R.bottom + 60, W.height - 120),
  };
}
