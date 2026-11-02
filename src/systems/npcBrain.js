import Phaser from 'phaser';
import { CONFIG } from '../config.js';

const N = CONFIG.npc;

// Simple NPC behaviour: pick the most worthwhile food, walk to it, eat,
// swipe rivals crowding the same spot, and react to swipes aimed at them.
export function updateNpc(npc, dt, { food, bears }) {
  npc.thinkTimer = (npc.thinkTimer ?? Math.random() * N.thinkSeconds) - dt;
  if (npc.blockTimer > 0) {
    npc.blockTimer -= dt;
    if (npc.blockTimer <= 0) npc.setBlocking(false);
  }

  const goalGone = !npc.goal || !npc.goal.active || !npc.goal.getData('available');
  if (goalGone) npc.goal = pickFood(npc, food);
  // Reactions only on think ticks, so NPCs don't block every single swipe.
  if (npc.thinkTimer <= 0) {
    npc.thinkTimer = N.thinkSeconds;
    if (!react(npc, bears)) maybeSwipe(npc, bears);
  }

  if (npc.blocking || npc.isWindingUp || npc.isChargingUp || npc.isCharging) {
    npc.move(null);
    return;
  }

  const goal = npc.goal;
  if (!goal) {
    npc.move(null);
    return;
  }
  if (npc.canReach(goal)) {
    npc.move(null);
    npc.startEating(goal);
  } else {
    const dir = new Phaser.Math.Vector2(goal.x - npc.x, goal.y - npc.y).normalize();
    npc.aim(dir.x, dir.y);
    npc.move(dir);
  }
}

function pickFood(npc, food) {
  let best = null;
  let bestScore = 0;
  for (const f of food.available()) {
    const dist = Phaser.Math.Distance.Between(npc.x, npc.y, f.x, f.y);
    // Value per distance, with noise so NPCs don't all pick the same item.
    const score = (f.getData('weight') / (dist + 150)) * Phaser.Math.FloatBetween(0.6, 1.4);
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

const CHARGE_REACH = CONFIG.charge.speed * CONFIG.charge.durationSeconds;

// A rival winding up an attack aimed at this NPC. Swipes get blocked or dodged;
// charges break blocks, so those get dodged sideways. Returns true if it reacted.
function react(npc, bears) {
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
  if (!threat || Math.random() > N.reactChance) return false;

  npc.aim(threat.x - npc.x, threat.y - npc.y);
  if (swipe && !charge && Math.random() < 0.6) {
    npc.setBlocking(true);
    npc.blockTimer = N.blockSeconds;
  } else if (charge) {
    const side = new Phaser.Math.Vector2(-threat.facing.y, threat.facing.x).scale(Math.random() < 0.5 ? 1 : -1);
    npc.dash(side);
  } else {
    const away = new Phaser.Math.Vector2(npc.x - threat.x, npc.y - threat.y).rotate(Phaser.Math.FloatBetween(-0.8, 0.8));
    npc.dash(away);
  }
  return true;
}

// Fight for the spot: swipe rivals in reach, sometimes charge ones a bit further out.
function maybeSwipe(npc, bears) {
  if (!npc.goal || npc.blocking) return;
  const nearGoal = Phaser.Math.Distance.Between(npc.x, npc.y, npc.goal.x, npc.goal.y) < 200;
  if (!nearGoal) return;

  const close = bears.find((b) => b !== npc && !b.dead && inSwipeRange(npc, b));
  if (close && Math.random() < N.swipeChance) {
    npc.aim(close.x - npc.x, close.y - npc.y);
    npc.startSwipe();
    return;
  }
  const mid = bears.find((b) => {
    if (b === npc || b.dead) return false;
    const d = Phaser.Math.Distance.Between(npc.x, npc.y, b.x, b.y);
    return d > npc.radius + b.radius + CONFIG.swipe.range && d < CHARGE_REACH;
  });
  if (mid && Math.random() < N.chargeChance) {
    npc.aim(mid.x - npc.x, mid.y - npc.y);
    npc.startCharge();
  }
}
