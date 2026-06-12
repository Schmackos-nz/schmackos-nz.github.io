# VALGRAVE

A 3D browser extraction-survival game — **Valheim** meets **Escape from Tarkov**.
Three.js, no build step: just open `index.html` (needs internet for the Three.js CDN).

## The loop

1. **Hideout** — equip a loadout (weapon / bow / armor), pack food & arrows, craft
   gear at your campfire → workbench → forge, trade coins with the wandering trader.
2. **Raid** — deploy onto a procedurally generated island. Chop trees, mine stone
   and iron, pick berries, hunt boar and deer, loot ruin chests guarded by draugr
   and skeleton archers. A troll guards the best loot.
3. **Extract** — reach one of three green extraction runes and channel for 5 seconds
   before the 9-minute timer ends and the storm rolls in (escalating damage).
4. **Or die** — everything you carried and wore is gone… but a gravestone holding
   it spawns somewhere in your *next* raid (⚰ on the compass). Valheim rules.

Progress (stash, stations, stats) persists in localStorage.

## Controls

| Key | Action |
|---|---|
| WASD / Shift / Space | Move / sprint / jump |
| Mouse | Look; LMB attack (hold & release to draw the bow) |
| 1 / 2 | Melee / bow |
| E (hold) | Chop, mine, pick, open chests, recover remains |
| F | Eat best food (heals over time) |
| Tab | Open bag |
| Esc | Pause |

## Tips

- Weight cap is 80 kg — overloaded means no sprint and half speed.
- Iron deposits only spawn on high ground.
- Skeleton arrows can be dodged; trolls knock you flying.
- Sell Ancient Relics at the hideout for 40 coins each.
