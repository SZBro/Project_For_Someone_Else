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
    thinkSeconds: 0.35, // average; each think is randomized around this
    blockSeconds: 0.6,
    grudgeSeconds: 10, // how long an NPC holds a grudge against whoever hit it
    wanderChance: 0.04, // per think, chance to stroll somewhere instead of eating
    restUntilHealth: 0.75, // retreating bears rest until this much health

    // Each NPC fights differently. All values 0..1 unless noted.
    //   aggression: how often it swipes/charges rivals near its food
    //   caution:    retreats when health drops below this fraction
    //   skill:      chance to react to an incoming attack
    //   reaction:   [min, max] seconds before it reacts
    //   mistakes:   chance an attack is wasted (swings at air, bad timing)
    //   targets:    who it prefers to fight: 'smaller', 'bigger', 'eating' (fish thieves) or 'any'
    //   favorite:   fishing spot it prefers, if any
    personalities: {
      Chunk: { aggression: 0.75, caution: 0.15, skill: 0.5, reaction: [0.1, 0.3], mistakes: 0.15, targets: 'smaller' },
      747: { aggression: 0.45, caution: 0.2, skill: 0.4, reaction: [0.15, 0.4], mistakes: 0.1, targets: 'any', favorite: 'the falls' },
      Otis: { aggression: 0.15, caution: 0.45, skill: 0.7, reaction: [0.05, 0.2], mistakes: 0.05, targets: 'any' },
      Grazer: { aggression: 0.65, caution: 0.25, skill: 0.75, reaction: [0.05, 0.15], mistakes: 0.1, targets: 'bigger' },
      Holly: { aggression: 0.5, caution: 0.35, skill: 0.55, reaction: [0.1, 0.25], mistakes: 0.2, targets: 'eating' },
    },
  },

  // Wildlife: flees from bears, some steal fish, and all of it can be hunted.
  // hp: damage to bring one down (a swipe does ~22). meat: lbs of food it drops.
  hunting: {
    deer: { hp: 40, meat: 45, eatSeconds: 3 },
    fox: { hp: 20, meat: 12, eatSeconds: 1.5 },
    squirrel: { hp: 1, meat: 3, eatSeconds: 0.5 },
    gull: { hp: 1, meat: 4, eatSeconds: 0.6 }, // only while sitting, not flying
    eagle: { hp: 25, meat: 10, eatSeconds: 1.2 }, // only while swooping low
    respawnSeconds: 45,
  },

  animals: {
    deer: { count: 6, speed: 50, fleeSpeed: 260, fearRadius: 160 }, // faster than a bear: charge them or sneak up
    foxes: { count: 2, speed: 90, fleeSpeed: 280, fearRadius: 110, stealRadius: 500 },
    gulls: { count: 12, fearRadius: 120 },
    eagle: { swoopEverySeconds: [40, 80], speed: 380 },
    squirrels: { count: 6, speed: 160, fearRadius: 70 },
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
