// What the host sends guests. Numbers are rounded to keep messages small.
const FLAGS = { dead: 1, blocking: 2, dashing: 4, charging: 8, stunned: 16 };

export function bearFlags(b) {
  return (
    (b.dead ? FLAGS.dead : 0) |
    (b.blocking ? FLAGS.blocking : 0) |
    (b.isDashing ? FLAGS.dashing : 0) |
    (b.isCharging ? FLAGS.charging : 0) |
    (b.isStunned ? FLAGS.stunned : 0)
  );
}

export function readFlags(f) {
  return {
    dead: !!(f & FLAGS.dead),
    blocking: !!(f & FLAGS.blocking),
    dashing: !!(f & FLAGS.dashing),
    charging: !!(f & FLAGS.charging),
    stunned: !!(f & FLAGS.stunned),
  };
}

const cs = (seconds) => Math.max(0, Math.round(seconds * 100)); // centiseconds

export function snapBears(bears) {
  return bears.map((b) => ({
    i: b.netId,
    n: b.name,
    c: b.baseTint,
    x: Math.round(b.x),
    y: Math.round(b.y),
    a: Math.round(b.facing.angle() * 100),
    w: Math.round(b.weight * 10),
    h: Math.round(b.hp),
    s: Math.round(b.stamina),
    f: bearFlags(b),
    wu: cs(b.windupTimer),
    cu: cs(b.chargeWindupTimer),
    e: b.eatTarget ? Math.round((b.eatProgress / b.eatTarget.getData('eatSeconds')) * 100) : -1,
    r: cs(b.respawnTimer),
    sc: cs(b.swipeCooldown),
    cc: cs(b.chargeCooldown),
    dc: cs(b.dashCooldown),
  }));
}

// [id, texture, x, y]
export function snapFood(food) {
  return food.items
    .filter((f) => f.active)
    .map((f) => {
      const type = f.getData('type');
      const texture = type === 'berries' ? (f.getData('available') ? 'bush' : 'bush-empty') : type;
      return [f.getData('id'), texture, Math.round(f.x), Math.round(f.y)];
    });
}

// [id, kind, x, y, rotation, scale, carrying, depth]
export function snapAnimals(animals) {
  return animals.critters.map((c) => [
    c.id,
    c.kind,
    Math.round(c.sprite.x),
    Math.round(c.sprite.y),
    Math.round(c.sprite.rotation * 100),
    Math.round(c.sprite.scaleX * 100),
    c.carrying ? 1 : 0,
    c.sprite.depth,
  ]);
}
