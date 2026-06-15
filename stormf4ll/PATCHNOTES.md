# STORMFALL — Patch Notes

A top-down MOBA battle-royale. Drop in, squad up, last team standing wins the crown.

---

## React + TypeScript rewrite  *(current)*

Under-the-hood overhaul — same game, new foundation.

- Rebuilt as a **React + TypeScript + Vite** app (`npm run dev` / `npm run build`). The
  one-file build is preserved under `legacy/` for reference.
- Engine decomposed into **object-oriented modules** (`src/engine/`): a `Game`
  orchestrator class, `Hunter`/`Creep` entities, and `constants`/`data`/`Sfx`/`Net`/
  `Session`/`Terrain` modules.
- The entire in-game **HUD is now React** (driven by engine state) instead of hand-managed
  DOM; the canvas simulation/render stays in the engine.
- Multiplayer lobby reworked around a `Session` layer that owns party networking and hands
  off to the match cleanly.
- No gameplay/balance changes — feature parity with 4.Four below.

---

## StormFALL 4.Four

**Inventory / loot UX**
- Ground items now show an indicator relative to your gear: a green **▲** if picking it up would **upgrade** an item you own, or an amber **⇄** if your bag is full and it's a new type.
- When your bag is **full** and you grab a new item, a **replace chooser** opens — press **1–4** (or tap a slot) to choose which item to swap out. **Walk away to cancel.**

**HUD**
- Added a **shield indicator** (value + bar) just above the action bar.

**Balance**
- **Vanguard — Bulwark** nerfed to **100 shield for 3s** (was 170 for 5s).
- **Vanguard — Skewer** now applies a **micro-stun** on hit, in addition to its damage.
- **Ember — Meteor Storm** now drops **3 meteors at 75 damage** each (was 6 at 65) — punchier, less spammy.

---

## StormFALL 4.Wees

**Team Chat**
- Talk to your squad! Press **Enter** to open chat, type, **Enter** to send, **Esc** to cancel (or tap the 💬 button on mobile).
- Messages are delivered to everyone on your team over the network and appear in a chat log in the bottom-left.

**Auto-revive**
- Just **stand on a downed teammate** to revive them — no key to hold. A floating **REVIVING…** cue with a progress bar shows above them, and a HUD prompt tracks the %.
- Reviving takes **priority over loot**, so you can pick up a teammate even when their dropped gear is lying on top of them.

**Overtime**
- If multiple teams are still alive when the storm reaches its final ring, the match enters **OVERTIME**: the safe zone collapses to nothing and storm damage spikes, forcing a finish.

**Enemy AI**
- AI now obeys its **own line of sight** — enemies only notice and chase hunters they can actually see (matching fog of war), instead of tracking you across the map.

**Map**
- Enemy squads now spawn **evenly scattered across the whole map** (jittered grid) instead of clustering in the centre — so wherever you drop isn't automatically on top of other squads.

**UI**
- Moved the kill feed down so it no longer covers the minimap.

**Balance**
- **Warlock — Affliction** buffed: now hits for **18** up front plus **8 over 4 seconds** (was 10 + 16).

---

## Storm FALL 4.Poo

**Fog of War**
- You now only see enemy hunters and creeps that are within your squad's line of sight. A dark fog blankets everything else and reveals around your living squadmates.
- The minimap obeys fog too — only allies and things you can actually see are shown.

**Deploy / Landing overhaul**
- Choosing your drop is now a **full-screen tactical map**. Players and AI are hidden; only **creep packs** are marked so you can drop near the loot you want.
- Click/tap anywhere to set your squad's landing zone. Map legend included.

**Loot is now a PvE ecosystem** (no more random gear scatter)
- **Little creeps** — drop a basic (Lv 1) piece.
- **Big packs** — basics plus one **Lv 2** piece from the pack alpha.
- **Mini-bosses** — drop 1–2 **maxed (Lv 3)** pieces.
- **Storm Titan (boss)** — awakens at the centre when **≤20 hunters remain**; drops **Tier-4 gear**: maxed stats **plus "true damage" that pierces shields**.
- Creeps roam, aggro and hit nearby hunters, and can be damaged by all weapons and abilities.

**Team & survivability**
- Teammates are now obvious: a bobbing **green chevron** over on-screen allies, **off-screen edge arrows** (with name + distance, red when downed), and bigger ringed minimap dots.
- **Passive healing** — regenerate 6% max HP per second after 5 seconds out of combat (any damage, including the storm, resets it).

**AI tuning**
- **Easy** enemies no longer hunt you down early — they farm creeps — but they **fight back when attacked**.
- All difficulties now farm creeps for gear; **Hard** enemies engage from farther and hoard loot.

**Fixes**
- You can no longer attack while **downed or eliminated**.

---

## STORMF4LL.1

- **Deploy phase** added: a 20s pre-game — pick a drop zone (first 15s, invulnerable), squads land at 15s, 5s grace, then the storm goes live.
- **AI Difficulty** toggle: Easy / Normal / Hard (default Normal). Easy = poor aim & weak gear; Hard = sharp aim & constant looting.
- **Mobile support**: twin-stick touch controls (left = move, right = aim/fire) with on-screen ability buttons.
- Larger projectile hitboxes so attacks are easier to land.
- Ability tooltips now work on hover during a match.

---

## STORMF4LL

- New hunter: **Priest** — a form-shifter. The ultimate swaps between:
  - **Holy** — Smite, group Heal, Power Word: Shield.
  - **Shadow** — Shadow Word: Pain (a faint 8s curse), **Mind Blast** (instantly detonates for 400% of the DoT), Shadowstep blink.

---

## Stormfall 3.0

- **Real peer-to-peer multiplayer** over WebRTC (PeerJS broker — no server needed).
- Create a party → share the **invite link**; friends drop into your lobby and play on your squad. Host runs the match; clients send input and render live snapshots.

---

## Stormfall 2.x

- New hunter: **Warlock** (damage-over-time caster).
- **Vanguard Cleave** now snares (−10% per hit, stacking to −50%) with a visible swing arc.
- Sprite/weapon alignment fixed.
- **Ability Glossary** on the menu for the selected hunter.
- Warlock DoT rebalanced (−70%).
- Working **invite links**; fixed a new-game freeze.

---

## Stormfall 2.0

- Synthesized **sound effects** and ambient audio.
- Procedural **terrain** (biomes, trees, rocks, water) and little **pixel-sprite** characters.
- **Equippable gear**: a handful of items that upgrade in tiers, each boosting damage or shield; gear drops on death.
- Map made 8× larger and the pace slowed for a more tactical feel.

---

## Stormfall 1.0

- The original: top-down MOBA battle-royale. 4 squads of 3 on a shrinking storm arena.
- Four hunters (Vanguard / Sable / Ember / Lumen), each with basic + Q/E/R + dash.
- Solo/Duo/Trio queue with AI fill, party invite codes, pings, downed + revive, and a Fortnite-style **crown** that carries into your next lobby.
