# Project Log: Fat Bear or Weak

Development log for the Fat Bear Week browser game, built by Skyler Broussard and Chris with Claude Code as a coding assistant. Each entry records what was done and why, in the order it happened.

---

## 2026-11-01: Brainstorm setup in Google Docs

**Type:** Planning

**What:** Set up the shared Google Doc ("For Someone Else Project") with a section for each of us, Skyler and Chris, to brainstorm game ideas separately.

**Why:** So we could each get our ideas down without influencing the other first, then compare.

---

## 2026-11-01: Core concept (Skyler)

**Type:** Planning

**What:** Wrote the starting concept: an online multiplayer game based on Fat Bear Week, where you play a bear trying to be the heaviest when the week ends. Style: an .io game like agar.io, but more modern with better art and design.

**Why:** Fat Bear Week is a well-known yearly event with a built-in goal (get fat), which maps cleanly onto a simple, competitive game loop.

---

## 2026-11-01: Combat direction and open questions (Skyler)

**Type:** Planning

**What:** Decided bears are obstacles, not food: being bigger shouldn't win on its own, and bears fight over food territory with swipes and other moves. Added lists for combat ideas, food and territory, round structure, things to decide before building, and more feature ideas.

**Why:** A pure "eat to grow, bigger eats smaller" loop felt too close to existing .io games. Fighting over fishing spots gives the game its own identity and matches how real bears behave at the falls.

---

## 2026-11-01: Early decisions (Skyler)

**Type:** Decision

**What:**
- Platform: browser (no install, easy to share during Fat Bear Week)
- Cheating and lag: not a concern for the prototype; handle later
- Camera: top-down; 2D vs 3D left open
- Time scale: 1 real second = 1 game minute, so one game day lasts 24 real minutes
- NPC bears based on real Katmai bears (Chunk, 747, Otis, and others)
- Working name: "Fat Bear or Weak"

**Why:** These were the decisions needed before any code could be written. The time scale was chosen because it maps cleanly (1 second to 1 minute, 1 minute to 1 hour).

---

## 2026-11-01: Chris's brainstorm and the Finalized section

**Type:** Planning

**What:** Chris added a core gameplay loop (start at a standard weight, weight drains without food, eating adds weight but lowers speed, round ends on a timer), a cozy 2D look (hand-drawn or paper-cutout art, fall music), and a plan to build the core loop before multiplayer. Created a **Finalized** section in the doc listing the points we both agreed on:
- You play a bear and gain weight by eating food from different sources
- Weight drops over time when not eating
- Gaining weight makes the bear slower
- Rounds end after a set time limit (length still open: 24 vs ~15 minutes)
- 2D top-down view fits both sections
- Build the core gameplay loop first

**Why:** To separate what's agreed from what's still one person's idea, so we don't build on assumptions.

---

## 2026-11-01: Prototype plan

**Type:** Planning

**What:** Defined the basic prototype: single-player with NPC bears (bridges the single-player vs online question), Phaser 3 in the browser, one river map, eating with weight gain and loss, speed vs weight, NPC bears, timer with day/night, HUD, end screen, and an optional swipe to test combat. Everything tunable kept in one config file. Left out for now: online multiplayer, accounts, customization, real art, mobile controls.

**Why:** Keep the first build small and focused on whether the core loop is fun.

---

## 2026-11-01: Project setup

**Type:** Setup

**What:** Created the project in `FatBearWeek/` with Vite (dev server and build) and Phaser 3. Added `index.html`, `package.json`, `.gitignore`, a dev server config, and a README.

**Why:** Vite gives instant reloads while tuning; Phaser is a mature 2D browser game engine that fits a top-down game.

---

## 2026-11-01: First playable prototype

**Type:** Feature

**What:**
- Top-down river map with a waterfall, 4 fishing spots, and berry bushes on the banks
- Eating by standing on food; salmon worth more than berries but slower to eat
- Weight drains over time; heavier bears are bigger and slower
- Salmon runs: every 2 minutes one fishing spot gets a surge of salmon
- Five NPC bears that pick food by value and distance
- 24-minute round (one game day) with day/night tinting
- HUD (weight, clock, leaderboard) and an end-of-round weigh-in screen
- A basic swipe attack

**Why:** To get the agreed core loop running as early as possible.

**Fix along the way:** The game failed to start when the page loaded hidden (zero-size canvas); added a minimum canvas size.

**Commit:** included in `8d1c5fb`

---

## 2026-11-01: Combat rework

**Type:** Feature

**What:** The first swipe hit everything in a circle with no warning, so it was replaced with:
- Mouse aiming
- Swipes with a visible red wind-up cone before they land, so the target can react
- Dash (Space/Shift) with brief invulnerability
- Block (hold right click) that cuts damage from the front
- Health bars, health regeneration, knockouts that cost 10% weight, and respawning
- NPCs that block or dash when a swipe is aimed at them

**Why:** Playtesting showed combat needed work. Wind-ups and counters make fights readable and skill-based instead of random.

**Commit:** `8d1c5fb` "Add Fat Bear Week browser prototype with combat"

---

## 2026-11-01: Gameplay depth

**Type:** Feature

**What:**
- **Stamina** shared by swipe, dash, charge and blocking; running out while blocking breaks your guard
- **Charge (E):** a slower lunge with an orange lane tell that breaks blocks; dodge it sideways
- **Fish stealing:** hitting a bear mid-meal knocks its salmon toward you; knocked-out bears drop salmon
- **Hit feel:** hit-stop, damage numbers, claw-mark slashes, fur particles, screen shake

**Why:** Give fights a reason to happen (stealing), stop spamming (stamina), complete the counter system (swipe beats nothing on its own, block beats swipe, charge beats block, dash beats charge), and make hits feel good.

**Fix along the way:** NPCs with no food target were reacting every frame and blocking nearly every swipe; reactions now only happen on their think ticks.

---

## 2026-11-01: Polish pass

**Type:** Feature

**What:**
- **Start screen:** a cozy card over the live river with name entry, Play, and sound/music toggles; Esc from the weigh-in returns to it
- **Sound effects** synthesized with Web Audio (swipe, hits, block, dash, charge, eating, splash, knockout, win fanfare), quieter with distance; M mutes
- **Music:** a placeholder warm jazzy loop generated in code until Chris's arrangement exists
- **Art pass:** shaded bears with shadows, sockeye salmon, leafy bushes, textured grass and pebbly banks, a river with depth and flowing ripples, waterfall foam, trees on the map edges

**Why:** Make the prototype feel like a game when showing it to others. All art and audio are generated in code so there are no asset files to manage yet.

**Fix along the way:** The name box couldn't be typed in because its Enter handler returned `false`, which cancels every keystroke.

**Commit:** `8740b5d` "Add stamina, charge, fish stealing, start screen, audio and art pass"

---

## 2026-11-01: Smarter NPC bears

**Type:** Feature

**What:** Each NPC got a personality (aggression, caution, reaction skill and delay, mistake rate, preferred targets, favourite spot):
- Chunk: bully, goes after smaller bears
- 747: heavyweight, camps the falls
- Otis: patient fisher, avoids fights
- Grazer: scrapper, goes after bigger bears
- Holly: opportunist, targets bears that are eating

They also hold grudges against whoever hit them, retreat to rest when hurt, wander between meals, react after a delay, and sometimes miss.

**Why:** NPCs all behaved the same and felt robotic. Personalities make each bear recognizable and fights less predictable.

---

## 2026-11-01: Wildlife and hunting

**Type:** Feature

**What:** Added roaming animals: deer herds, foxes that steal loose salmon, gulls around the fishing spots, an eagle that swoops for salmon, and squirrels. They all flee from bears. Then made them huntable: swipes and charges hurt them, and when caught they drop meat (deer 45 lb, fox 12, eagle 10, gull 4, squirrel 3). They respawn after 45 seconds.

**Why:** Make the map feel alive and add a second way to gain weight besides fighting at the river.

**Commit:** `0950ad2` "Add NPC personalities, roaming wildlife and hunting"

---

## 2026-11-01: Repository

**Type:** Setup

**What:** Connected the local repo to GitHub at `SZBro/Project_For_Someone_Else` (`origin`) and created a `main` branch.

**Why:** So Chris can clone and run the project.

---

## 2026-11-01: Pause Menu

**Type:** Feature

**What:** Added a new pause menu that includes sliders to adjust the volumes of the music and the sound effects.

**Why:** Gave users more control over their gaming experience.

---

## 2026-11-08: Lobbies and playing with friends

**Type:** Feature

**What:** Added online play where one player's browser hosts the game:
- Host a lobby, share a 4-letter code or invite link, and see who joined; the host picks a round length and starts
- The host's browser runs the real game; guests send their controls and draw what the host reports, with their own bear moving immediately so controls feel responsive
- NPC bears fill empty spots; friends can join mid-round, and a friend who drops out leaves an NPC behind
- Esc opens a settings menu online (with Leave game), since one player can't pause everyone
- The game keeps running when an online player's tab is hidden
- GitHub Pages workflow and relative build paths, so the site can go live

**Why:** The goal is to play with friends, not strangers. A dedicated server costs money and means moving the game rules out of Phaser. Hosting in a browser reuses the existing game code and needs no server of our own. The trade-offs: the round ends if the host leaves, and the host has no lag while everyone else has a little.

---

## Still open

- Whether strict networks need a relay service, if friends can't connect
- Hands-on testing online between different computers and networks
- Round length: solo is 24 minutes; online lobbies choose 5, 15 or 24
- Art direction (cozy hand-drawn or paper-cutout) and who makes the art
- Whether Fat Bear Week or Katmai names and branding can be used
- Combat and hunting have had scripted tests but little hands-on playtesting
