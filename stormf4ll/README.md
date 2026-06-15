# StormFALL — Arena Royale

A top-down **MOBA battle-royale** (Supervive-like) in the browser. Drop in, squad up,
last team standing wins the crown. Built with **React + TypeScript + Vite**; the game
engine is a Canvas 2D simulation.

## Develop / run

```bash
npm install
npm run dev      # local dev server (Vite)
npm run build    # type-check + production bundle into dist/
npm run preview  # preview the production build
```

`npm run build` outputs a static bundle, so it can be hosted anywhere.

## Features
- **6 hunters** — Vanguard, Sable, Ember, Lumen, Warlock, and the form-shifting Priest —
  each with a basic attack, two abilities, an ultimate and a dash.
- **Solo / Duo / Trio** with AI fill, plus **real peer-to-peer multiplayer** via invite
  links (WebRTC / PeerJS — no server to run).
- **Deploy phase** — pick your drop on a full-screen map, then land with a grace period.
- **Fog of war** — only see what your squad can see.
- **PvE loot ecosystem** — creeps, packs, mini-bosses, and a centre **Storm Titan** boss
  that drops shield-piercing Tier-4 gear.
- **Equippable gear** that upgrades in tiers, a shrinking storm with **overtime**,
  downed + auto-revive, pings, team chat, and a Fortnite-style carry-over **crown**.
- **AI difficulty** (Easy / Normal / Hard) and **mobile** twin-stick touch support.

## Controls
WASD move · mouse aim · **LMB** attack · **Q/E** abilities · **R** ultimate ·
**Space** dash · **V** ping · **F** equip (auto-revive teammates) · **Enter** team chat.

## Structure
```
src/
  main.tsx, styles.css
  ui/        React: App, Menu, GameView, Hud
  engine/    OO TypeScript modules:
    constants.ts   math + world constants
    data.ts        hunters / gear / creeps + ability resolution
    Sfx.ts         synthesized audio
    Net.ts         WebRTC transport (PeerJS)
    Session.ts     lobby / party networking + match handoff
    Terrain.ts     procedural terrain + pixel sprites
    entities.ts    Hunter / Creep classes
    Game.ts        simulation + render orchestrator (owns match state, loop, netcode)
legacy/      the original single-file build (pre-React), kept for reference
```

See `CLAUDE.md` for architecture notes and `PATCHNOTES.md` for the changelog.

🤖 Built with [Claude Code](https://claude.com/claude-code)
