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
- E: charge. An orange lane shows where you'll lunge. Breaks blocks; dash sideways to dodge one.
- Hold right click: block swipes from the front (takes a little damage and stamina, no stun)
- Space or Shift: dash (attacks pass through you mid-dash)
- Esc: pause or resume during a round
- Adjust music and sound-effects volume from the pause menu
- Stand on food to eat it (salmon in the river, berries on the banks)
- M: mute
- Hold T: fast-forward the clock (testing only)

The start screen sits over a live river with the NPC bears. Enter a name and press Play. After the weigh-in, Enter plays again and Esc goes back to the menu.

Swipe, charge, dash and blocking all use stamina (the blue bar). Run out while blocking and your guard breaks.

Bears have health. At zero you're knocked out, lose 10% of your weight, drop 2 salmon, and respawn on a bank after 3 seconds.

Fish stealing: hit a bear while it's eating salmon and the fish gets knocked toward you, loose and quick to eat.

## What's in the prototype

- One top-down river map with fishing spots and berry bushes
- Weight goes up when you eat, drains slowly over time, and makes you slower
- Salmon runs: every couple of minutes one fishing spot gets a surge of salmon
- NPC bears with personalities: Chunk bullies smaller bears, 747 camps the falls, Otis avoids trouble, Grazer goes after bigger bears, Holly picks on bears that are eating. They hold grudges, retreat to rest when hurt, wander, react with human-ish delays, and sometimes whiff. Tune them in `npc.personalities`.
- Huntable wildlife that drops meat when caught (deer 45 lb, fox 12, eagle 10, gull 4, squirrel 3) and respawns after 45 seconds: deer herds that bolt from bears (charge them), foxes that steal loose salmon (swipe one to make it drop the fish), gulls that scatter from fishing spots, an eagle that swoops down to snatch salmon, and squirrels
- Clock at 1 real second = 1 game minute, one game day per round (24 minutes), with day and night
- HUD with weight, clock, leaderboard; end screen with the final weigh-in

All art is drawn in code and all sound and music is synthesized with Web Audio ([src/audio.js](src/audio.js)), so there are no asset files yet. Both are placeholders until real art and Chris's music exist.

## Tuning

Every gameplay number is in [src/config.js](src/config.js): round length, start weight, weight loss, speed vs. weight, food values, salmon spawn rates, swipe strength, NPC behaviour. Save the file and the browser reloads.

## Code layout

```
src/
  main.js            Phaser game setup
  config.js          all tunable numbers
  textures.js        placeholder art generated at runtime
  audio.js           synthesized sound effects and music loop
  entities/Bear.js   bear movement, weight, eating, swipe
  systems/Food.js    berry bushes, salmon spawning, salmon runs
  systems/npcBrain.js NPC bear behaviour and personalities
  systems/Animals.js  deer, foxes, gulls, eagle, squirrels
  scenes/GameScene.js map, round clock, day/night, main loop
  scenes/UIScene.js   HUD
  scenes/EndScene.js final weigh-in and restart
  scenes/PauseScene.js pause overlay and resume
```
