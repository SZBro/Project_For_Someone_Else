# Fat Bear or Weak

Browser game prototype for Fat Bear Week. You are a bear on a salmon river. Eat to be the heaviest bear when the round ends. Bears don't eat each other; they fight over the best fishing spots.

## Run it

Requires Node 18+.

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Controls

- WASD or arrow keys: move
- Mouse: aim
- Left click: swipe. A red cone shows the wind-up before it lands, so the target can react.
- Hold right click: block hits from the front (takes a little damage, no stun)
- Space or Shift: dash (swipes pass through you mid-dash)
- Stand on food to eat it (salmon in the river, berries on the banks)
- Hold T: fast-forward the clock (testing only)

Bears have health. At zero you're knocked out, lose 10% of your weight, and respawn on a bank after 3 seconds.

## What's in the prototype

- One top-down river map with fishing spots and berry bushes
- Weight goes up when you eat, drains slowly over time, and makes you slower
- Salmon runs: every couple of minutes one fishing spot gets a surge of salmon
- NPC bears (Chunk, 747, Otis, Grazer, Holly) that find food and swipe rivals
- Clock at 1 real second = 1 game minute, one game day per round (24 minutes), with day and night
- HUD with weight, clock, leaderboard; end screen with the final weigh-in

All art is placeholder shapes drawn in code.

## Tuning

Every gameplay number is in [src/config.js](src/config.js): round length, start weight, weight loss, speed vs. weight, food values, salmon spawn rates, swipe strength, NPC behaviour. Save the file and the browser reloads.

## Code layout

```
src/
  main.js            Phaser game setup
  config.js          all tunable numbers
  textures.js        placeholder art generated at runtime
  entities/Bear.js   bear movement, weight, eating, swipe
  systems/Food.js    berry bushes, salmon spawning, salmon runs
  systems/npcBrain.js NPC bear behaviour
  scenes/GameScene.js map, round clock, day/night, main loop
  scenes/UIScene.js   HUD
  scenes/EndScene.js  final weigh-in and restart
```
