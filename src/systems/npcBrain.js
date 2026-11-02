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
  if (npc.thinkTimer <= 0 || goalGone) {
    npc.thinkTimer = N.thinkSeconds;
    if (goalGone) npc.goal = pickFood(npc, food);
    if (!react(npc, bears)) maybeSwipe(npc, bears);
  }

  if (npc.blocking || npc.isWindingUp) {
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

// A rival winding up a swipe aimed at this NPC: block it or dash away. Returns true if it reacted.
function react(npc, bears) {
  const threat = bears.find(
    (b) =>
      b !== npc &&
      !b.dead &&
      b.isWindingUp &&
      inSwipeRange(b, npc) &&
      b.inFrontCone(npc.x, npc.y, CONFIG.swipe.arcDegrees),
  );
  if (!threat || Math.random() > N.reactChance) return false;

  npc.aim(threat.x - npc.x, threat.y - npc.y);
  if (Math.random() < 0.6) {
    npc.setBlocking(true);
    npc.blockTimer = N.blockSeconds;
  } else {
    const away = new Phaser.Math.Vector2(npc.x - threat.x, npc.y - threat.y).rotate(Phaser.Math.FloatBetween(-0.8, 0.8));
    npc.dash(away);
  }
  return true;
}

function maybeSwipe(npc, bears) {
  if (!npc.goal || npc.blocking || Math.random() > N.swipeChance) return;
  const nearGoal = Phaser.Math.Distance.Between(npc.x, npc.y, npc.goal.x, npc.goal.y) < 160;
  if (!nearGoal) return;
  const rival = bears.find((b) => b !== npc && !b.dead && inSwipeRange(npc, b));
  if (!rival) return;
  npc.aim(rival.x - npc.x, rival.y - npc.y);
  npc.startSwipe();
}
