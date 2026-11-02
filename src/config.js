// Every number worth tuning lives here. Change values, save, and the dev server reloads.

export const CONFIG = {
  world: { width: 2400, height: 1600 },

  // Horizontal river band across the map (y range).
  river: { top: 620, bottom: 980, fallsX: 1650 },

  time: {
    gameMinutesPerSecond: 1, // 1 real second = 1 game minute
    roundGameDays: 1, // 1 game day = 24 real minutes
    startHour: 6, // clock starts at 6:00 AM
    fastForward: 30, // hold T to speed up the clock (testing only)
  },

  bear: {
    startWeight: 600, // lbs
    minWeight: 350,
    weightLossPerGameHour: 10,
    maxSpeed: 230,
    minSpeed: 80,
    slowdownStartWeight: 600, // bears start slowing above this weight
    slowdownEndWeight: 1400, // bears reach minSpeed at this weight
    radius: 24, // collision radius at start weight; grows with weight
  },

  food: {
    eatRange: 18, // extra distance beyond the bear's radius where eating works
    salmon: { weight: 18, eatSeconds: 1.5 },
    berries: { weight: 6, eatSeconds: 0.8 },
    berryBushes: 24,
    berryRegrowSeconds: 30,

    // Fishing spots are the territory worth fighting over. richness = relative spawn rate.
    fishingSpots: [
      { name: 'the falls', x: 1620, y: 690, radius: 70, richness: 3 },
      { name: 'the falls pool', x: 1780, y: 880, radius: 90, richness: 2 },
      { name: 'the riffles', x: 950, y: 820, radius: 90, richness: 1.5 },
      { name: 'the river mouth', x: 300, y: 760, radius: 100, richness: 1 },
    ],
    salmonPerSpotMax: 4,
    salmonSpawnSeconds: 7, // base time between spawns at a spot with richness 1
    waveEverySeconds: 120,
    waveDurationSeconds: 35,
    waveSpawnMultiplier: 5,
  },

  health: {
    max: 100,
    regenPerSecond: 5,
    regenDelaySeconds: 4, // seconds without being hit before health regenerates
    respawnSeconds: 3,
    deathWeightPenalty: 0.1, // lose 10% of your weight when knocked out
  },

  swipe: {
    windupSeconds: 0.35, // visible tell before the hit lands; time to react
    cooldownSeconds: 0.6, // after the hit lands
    range: 40, // extra distance beyond both bears' radii
    arcDegrees: 120, // width of the hit cone in front of the bear
    damage: 22,
    knockback: 420,
    stunSeconds: 0.3,
    moveSpeedMultiplier: 0.5, // movement while winding up
  },

  stamina: {
    max: 100,
    regenPerSecond: 30,
    regenDelaySeconds: 0.7, // pause after spending stamina before it refills
    swipeCost: 15,
    dashCost: 30,
    chargeCost: 40,
    blockDrainPerSecond: 12,
    blockHitCost: 15, // blocking a swipe costs stamina; run out and your guard breaks
    guardBreakStunSeconds: 0.8,
  },

  // Slow, heavy lunge that breaks blocks. Dash sideways to dodge it.
  charge: {
    windupSeconds: 0.45,
    speed: 620,
    durationSeconds: 0.32,
    damage: 16,
    knockback: 800,
    stunSeconds: 0.7,
    cooldownSeconds: 2.5,
  },

  dash: {
    speed: 700,
    durationSeconds: 0.18,
    cooldownSeconds: 1.2,
    invulnerable: true, // swipes pass through a dashing bear
  },

  block: {
    arcDegrees: 150, // hits from inside this front cone are blocked
    damageMultiplier: 0.15,
    knockbackMultiplier: 0.3,
    moveSpeedMultiplier: 0.4,
  },

  npc: {
    names: ['Chunk', '747', 'Otis', 'Grazer', 'Holly'],
    thinkSeconds: 0.3,
    swipeChance: 0.5, // chance to swipe a nearby rival when contesting food
    reactChance: 0.55, // chance to block or dash when a swipe or charge is aimed at them
    blockSeconds: 0.6,
    chargeChance: 0.25, // chance to charge a rival at medium range near their food
  },

  // Fish stealing: hit a bear while it eats salmon and the fish gets knocked toward you.
  loot: {
    knockDistance: 55,
    looseEatSeconds: 0.5, // loose fish are quick to grab
    salmonDroppedOnKnockout: 2,
  },

  feel: {
    hitStopMs: 70, // brief freeze on hits involving the player
    damageNumbers: true,
  },
};
