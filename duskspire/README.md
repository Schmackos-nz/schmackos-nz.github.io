# Duskspire

A browser-based deckbuilding roguelike. No build step, no dependencies —
open `index.html` in a browser and play.

All sprite art is generated at runtime from pixel grids (`js/sprites.js`);
there are no image assets.

## The run

Pick a class, climb a branching 15-floor map (fights, elites, campfires,
shops, treasure), build your deck from post-combat rewards, and kill the
Gravelord at the top. Die and you start over.

## Classes

| Class | HP | Identity | Starter relic |
|---|---|---|---|
| The Knight | 80 | Strength, heavy hits, retaliation | Bloodied Standard — heal 6 after combat |
| The Huntress | 70 | Poison, multi-hits, card flow | Serpent Charm — 3 Poison to a random enemy at combat start |
| The Arcanist | 65 | Big spells, energy tricks, AoE | Crystal Focus — +1 Energy on turn 1 |

Each class has ~12 unique cards; all classes also share a generic card pool.
Cards can be upgraded at campfires.

## Mechanics

- 3 Energy per turn, draw 5, unspent Block is lost at the start of your turn.
- Statuses: Strength, Weak (-25% damage dealt), Vulnerable (+50% damage
  taken), Poison (damage over time), Thorns (retaliation).
- Enemies telegraph their intent each turn.

## Tests

- `node tests/smoke.js` — data integrity: sprites, cards, enemies, relics, map connectivity.
- `node tests/sim.js` — 720 headless random-play combats through the real engine.
