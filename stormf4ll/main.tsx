// Hunters, gear, creeps + ability resolution (ported from legacy game.js)

export const CREEP_TYPES: Record<string, any> = {
  little:   { hp: 55,   r: 15, dmg: 6,  speed: 60, aggro: 240, color: "#9bd36b", name: "Creep" },
  leader:   { hp: 140,  r: 21, dmg: 11, speed: 52, aggro: 300, color: "#6bd3a0", name: "Pack Alpha" },
  miniboss: { hp: 600,  r: 31, dmg: 18, speed: 46, aggro: 380, color: "#d36b9b", name: "Mini-Boss" },
  boss:     { hp: 3000, r: 54, dmg: 34, speed: 40, aggro: 700, color: "#ff5a5a", name: "Storm Titan" },
};
export const CREEP_IDS = Object.keys(CREEP_TYPES);

export const SHADOW_DOT = { dps: 5, dur: 8 };
export const SHADOW_BURST = Math.round(4 * SHADOW_DOT.dps * SHADOW_DOT.dur); // 160

export const HUNTERS: Record<string, any> = {
  vanguard: {
    name: "Vanguard", emoji: "🛡️", color: "#ff8a3d", role: "Bruiser", weapon: "sword",
    maxHp: 360, speed: 205, radius: 21,
    desc: "Front-line bruiser. A wide cleave, dashes into the fray, slams the ground and shrugs off hits with a barrier.",
    basic: { key: "LMB", name: "Cleave", emoji: "⚔️", cd: 0.48, kind: "cone", dmg: 32, range: 165, arc: 2.0, snare: true },
    q: { key: "Q", name: "Skewer", emoji: "➹", cd: 6, kind: "dash", dmg: 55, range: 300, hitRange: 95, arc: 1.6, stun: 0.6 },
    e: { key: "E", name: "Bulwark", emoji: "🛡️", cd: 9, kind: "shield", amount: 100, dur: 3 },
    r: { key: "R", name: "Seismic Slam", emoji: "💥", cd: 22, kind: "aoe", dmg: 120, radius: 240, delay: 0.45, self: true },
  },
  sable: {
    name: "Sable", emoji: "🏹", color: "#46e08a", role: "Marksman", weapon: "bow",
    maxHp: 240, speed: 225, radius: 18,
    desc: "Precision marksman. Rapid bolts, a spread volley, an evasive roll and a map-wide piercing railshot.",
    basic: { key: "LMB", name: "Bolt", emoji: "➶", cd: 0.36, kind: "proj", dmg: 20, speed: 780, range: 620, radius: 7 },
    q: { key: "Q", name: "Volley", emoji: "🎯", cd: 5.5, kind: "burst", dmg: 16, speed: 700, range: 560, radius: 6, count: 5, spread: 0.5 },
    e: { key: "E", name: "Evade", emoji: "💨", cd: 5, kind: "dash", dmg: 0, range: 330, hitRange: 0 },
    r: { key: "R", name: "Railshot", emoji: "⚡", cd: 20, kind: "proj", dmg: 170, speed: 1500, range: 2000, radius: 11, pierce: true },
  },
  ember: {
    name: "Ember", emoji: "🔥", color: "#ff5da2", role: "Mage", weapon: "staff",
    maxHp: 230, speed: 212, radius: 18,
    desc: "Area mage. Lobs heavy embers, blinks out of danger, drops bombs on a point and rains a meteor storm.",
    basic: { key: "LMB", name: "Ember", emoji: "🔥", cd: 0.6, kind: "proj", dmg: 30, speed: 580, range: 560, radius: 9 },
    q: { key: "Q", name: "Firebomb", emoji: "☄️", cd: 6, kind: "aoe", dmg: 70, radius: 150, delay: 0.5, atCursor: true },
    e: { key: "E", name: "Blink", emoji: "🌀", cd: 7, kind: "blink", range: 360 },
    r: { key: "R", name: "Meteor Storm", emoji: "🌠", cd: 24, kind: "storm", dmg: 75, radius: 130, count: 3, spread: 250 },
  },
  lumen: {
    name: "Lumen", emoji: "✨", color: "#34e3ff", role: "Support", weapon: "staff",
    maxHp: 250, speed: 218, radius: 18,
    desc: "Squad support. Heals allies, hastes the team, shields everyone and zaps from range.",
    basic: { key: "LMB", name: "Spark", emoji: "✦", cd: 0.5, kind: "proj", dmg: 18, speed: 720, range: 560, radius: 7 },
    q: { key: "Q", name: "Mend", emoji: "💚", cd: 7, kind: "heal", amount: 120, radius: 280 },
    e: { key: "E", name: "Tailwind", emoji: "🌬️", cd: 10, kind: "speed", mult: 1.6, dur: 4, radius: 280 },
    r: { key: "R", name: "Aegis", emoji: "🔆", cd: 22, kind: "shieldAura", amount: 150, dur: 6, radius: 340 },
  },
  warlock: {
    name: "Warlock", emoji: "💀", color: "#9b5de5", role: "Warlock", weapon: "staff",
    maxHp: 235, speed: 212, radius: 18,
    desc: "Damage-over-time caster. Afflicts foes with curses and plagues that rot their health over time, then slips away through shadow.",
    basic: { key: "LMB", name: "Affliction", emoji: "🟣", cd: 0.55, kind: "proj", dmg: 18, speed: 600, range: 580, radius: 8, dot: { dps: 2, dur: 4 } },
    q: { key: "Q", name: "Plague", emoji: "☣️", cd: 7, kind: "dotaoe", dmg: 14, radius: 175, delay: 0.4, atCursor: true, dot: { dps: 7, dur: 5 } },
    e: { key: "E", name: "Shadowstep", emoji: "🌑", cd: 7, kind: "blink", range: 350 },
    r: { key: "R", name: "Apocalypse", emoji: "☠️", cd: 24, kind: "dotaoe", dmg: 40, radius: 300, delay: 0.6, atCursor: true, dot: { dps: 13, dur: 6 } },
  },
  priest: {
    name: "Priest", emoji: "⛪", color: "#cdb4ff", role: "Cleric", weapon: "staff",
    maxHp: 250, speed: 218, radius: 18, defaultForm: "holy",
    holyColor: "#ffe08a", shadowColor: "#b15cff",
    desc: "Form-shifting cleric. The ultimate swaps between Holy (squad heals & shields) and Shadow (a faint 8s curse plus a Mind Blast that detonates it for 400%).",
    r: { key: "R", name: "Form Swap", emoji: "🔁", cd: 6, kind: "swap" },
    forms: {
      holy: {
        basic: { key: "LMB", name: "Smite", emoji: "✨", cd: 0.5, kind: "proj", dmg: 26, speed: 720, range: 560, radius: 8 },
        q: { key: "Q", name: "Heal", emoji: "💚", cd: 7, kind: "heal", amount: 130, radius: 280 },
        e: { key: "E", name: "Power Word: Shield", emoji: "🛡️", cd: 10, kind: "shieldAura", amount: 140, dur: 6, radius: 300 },
      },
      shadow: {
        basic: { key: "LMB", name: "Shadow Word: Pain", emoji: "🟣", cd: 0.5, kind: "proj", dmg: 6, speed: 620, range: 580, radius: 8, dot: { dps: SHADOW_DOT.dps, dur: SHADOW_DOT.dur } },
        q: { key: "Q", name: "Mind Blast", emoji: "💥", cd: 5, kind: "proj", dmg: SHADOW_BURST, speed: 1400, range: 720, radius: 9, descText: `Instantly blasts a foe for <b>${SHADOW_BURST}</b> — <b>400%</b> of your Shadow Word: Pain damage-over-time.` },
        e: { key: "E", name: "Shadowstep", emoji: "🌑", cd: 7, kind: "blink", range: 340 },
      },
    },
  },
};
export const HUNTER_IDS = Object.keys(HUNTERS);
export const BOT_NAMES = ["Vex", "Rook", "Nyx", "Kael", "Juno", "Bizz", "Orin", "Pax", "Wren", "Zia", "Tov", "Cyn", "Dax", "Echo", "Fenn", "Goro", "Hux", "Iri", "Lux", "Mira", "Nox", "Onyx", "Pyre", "Quill", "Raze", "Sol", "Thane", "ULL", "Vail", "Wisp"];

export const GEAR: Record<string, any> = {
  razor: { name: "Razor", emoji: "⚔️", color: "#ff5da2", kind: "Damage", levels: [{ dmg: 0.15 }, { dmg: 0.3 }, { dmg: 0.5, atk: 0.82 }], blurb: ["+15% damage", "+30% damage", "+50% damage & faster attacks"] },
  emberlens: { name: "Ember Lens", emoji: "🔮", color: "#ff8a3d", kind: "Damage", levels: [{ dmg: 0.1, abil: 0.15 }, { dmg: 0.2, abil: 0.3 }, { dmg: 0.35, abil: 0.55 }], blurb: ["+10% dmg, +15% ability power", "+20% dmg, +30% ability power", "+35% dmg, +55% ability power"] },
  fang: { name: "Vampiric Fang", emoji: "🩸", color: "#e8466a", kind: "Damage", levels: [{ dmg: 0.1 }, { dmg: 0.2, steal: 0.08 }, { dmg: 0.35, steal: 0.16 }], blurb: ["+10% damage", "+20% dmg, 8% lifesteal", "+35% dmg, 16% lifesteal"] },
  bulwark: { name: "Bulwark", emoji: "🛡️", color: "#34e3ff", kind: "Shield", levels: [{ sh: 80 }, { sh: 160 }, { sh: 260, regen: 14 }], blurb: ["+80 shield", "+160 shield", "+260 shield that regenerates"] },
  titan: { name: "Titan Plate", emoji: "🪨", color: "#b07dff", kind: "Shield", levels: [{ sh: 60 }, { sh: 130, dr: 0.08 }, { sh: 220, dr: 0.16 }], blurb: ["+60 shield", "+130 shield, 8% resist", "+220 shield, 16% resist"] },
};
export const GEAR_IDS = Object.keys(GEAR);

export const PALETTE = HUNTER_IDS.map((id) => HUNTERS[id].color).concat(["#ffffff"]);
export const palIdx = (c: string) => { const i = PALETTE.indexOf(c); return i < 0 ? PALETTE.length - 1 : i; };
export const hidIdx = (hid: string) => HUNTER_IDS.indexOf(hid);
export const gIdx = (id: string) => GEAR_IDS.indexOf(id);

export const DASH_DESC = "Burst of speed in your aim direction. Dodge danger or close gaps.";

export function abilityDesc(def: any): string {
  const d = def;
  if (d.descText) return d.descText;
  switch (d.kind) {
    case "swap": return "Transform between Holy and Shadow forms.";
    case "proj": return `Fires ${d.pierce ? "a piercing " : "a "}bolt for <b>${d.dmg}</b> damage.` + (d.dot ? ` Afflicts a faint DoT (<b>${d.dot.dps}</b>/s for ${d.dot.dur}s).` : "");
    case "burst": return `Looses ${d.count} bolts in a spread, <b>${d.dmg}</b> each.`;
    case "dotaoe": return `Curses an area: <b>${d.dmg}</b> on impact, then <b>${d.dot.dps}</b>/s for ${d.dot.dur}s to everyone caught.`;
    case "cone": return `Cleaves enemies in front for <b>${d.dmg}</b> damage.` + (d.snare ? ` Snares hits <b>−10%</b> move speed (stacks to −50%).` : "");
    case "dash": return (d.dmg > 0 ? `Dashes forward, striking for <b>${d.dmg}</b> damage.` : `Quick evasive dash in your aim direction.`) + (d.stun ? ` Briefly <b>stuns</b> the target.` : "");
    case "blink": return `Teleports instantly to your cursor.`;
    case "shield": return `Gain a <b>${d.amount}</b>-point shield for ${d.dur}s.`;
    case "aoe": return `Calls a blast ${d.atCursor ? "at your cursor" : "around you"} dealing <b>${d.dmg}</b> in an area.`;
    case "storm": return `Rains ${d.count} meteors, <b>${d.dmg}</b> damage each, over a wide area.`;
    case "heal": return `Heals your squad for <b>${d.amount}</b> HP nearby.`;
    case "speed": return `Hastes your squad (+${Math.round((d.mult - 1) * 100)}% move speed) for ${d.dur}s.`;
    case "shieldAura": return `Shields your whole squad for <b>${d.amount}</b> for ${d.dur}s.`;
  }
  return "";
}

export function abilityOf(ent: any, slot: string): any {
  const d = ent.def;
  if (!d.forms) return d[slot];
  if (slot === "r") {
    const toShadow = (ent.form || d.defaultForm) === "holy";
    return {
      key: "R", cd: d.r.cd, kind: "swap",
      name: toShadow ? "Enter Shadowform" : "Enter Holy Form",
      emoji: toShadow ? "🌑" : "☀️",
      descText: toShadow
        ? "Transform into a <b>Shadow Priest</b>: a faint 8s curse plus Mind Blast that detonates it for 400%."
        : "Transform into a <b>Holy Priest</b>: squad heals and Power Word: Shield.",
    };
  }
  return d.forms[ent.form || d.defaultForm][slot];
}

export function effColor(ent: any): string {
  const d = ent.def;
  if (d.forms) return ent.form === "shadow" ? d.shadowColor || "#b15cff" : d.holyColor || "#ffe08a";
  return d.color;
}
