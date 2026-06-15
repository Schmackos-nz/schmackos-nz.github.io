import { useEffect, useMemo, useReducer, useState } from "react";
import { HUNTERS, HUNTER_IDS, BOT_NAMES, abilityDesc, DASH_DESC } from "../engine/data";
import { SQUAD_SIZE } from "../engine/constants";
import { Sfx } from "../engine/Sfx";
import { Session } from "../engine/Session";
import type { MatchConfig } from "./App";

type Props = { config: MatchConfig; setConfig: (c: MatchConfig) => void; onPlay: () => void };

function makeCode() { let s = ""; const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)]; return s; }

export default function Menu({ config, setConfig, onPlay }: Props) {
  const { hunter, squadSize, difficulty } = config;
  const [joinValue, setJoinValue] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy Invite Link");
  const [, force] = useReducer((x) => x + 1, 0); // re-render on Session changes

  const crown = localStorage.getItem("stormfall_crown") === "1";
  const wins = +(localStorage.getItem("stormfall_wins") || 0);
  const net = Session.role !== "solo";

  useEffect(() => {
    Session.onChange = () => force();
    Session.setHunter(config.hunter);
    const pc = new URLSearchParams(location.search).get("party");
    if (pc) { const code = pc.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6); Session.join(code); setConfig({ ...config, squadSize: 3 }); }
    return () => { Session.onChange = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const h = HUNTERS[hunter];
  const set = (p: Partial<MatchConfig>) => setConfig({ ...config, ...p });
  const pickHunter = (id: string) => { Sfx.click(); set({ hunter: id }); Session.setHunter(id); };

  const glossary = useMemo(() => {
    const sub = (prefix: string, d: any) => ({ emoji: d.emoji, name: prefix + d.name, key: d.key, cd: d.cd, desc: abilityDesc(d), ult: false });
    if (h.forms) return [
      { emoji: "💨", name: "Dash", key: "SPACE", cd: 3, desc: DASH_DESC, ult: false },
      { emoji: "🔁", name: "Form Swap (Ultimate)", key: "R", cd: h.r.cd, desc: "Toggle between Holy and Shadow forms (changes your LMB/Q/E).", ult: true },
      sub("☀️ ", h.forms.holy.basic), sub("☀️ ", h.forms.holy.q), sub("☀️ ", h.forms.holy.e),
      sub("🌑 ", h.forms.shadow.basic), sub("🌑 ", h.forms.shadow.q), sub("🌑 ", h.forms.shadow.e),
    ];
    return [
      { emoji: h.basic.emoji, name: h.basic.name, key: h.basic.key, cd: h.basic.cd, desc: abilityDesc(h.basic), ult: false },
      { emoji: "💨", name: "Dash", key: "SPACE", cd: 3, desc: DASH_DESC, ult: false },
      { emoji: h.q.emoji, name: h.q.name, key: h.q.key, cd: h.q.cd, desc: abilityDesc(h.q), ult: false },
      { emoji: h.e.emoji, name: h.e.name, key: h.e.key, cd: h.e.cd, desc: abilityDesc(h.e), ult: false },
      { emoji: h.r.emoji, name: h.r.name, key: h.r.key, cd: h.r.cd, desc: abilityDesc(h.r), ult: true },
    ];
  }, [hunter]);

  const diffHint = { easy: "Easy — enemies aim poorly and rarely upgrade gear.", normal: "Normal — balanced enemies.", hard: "Hard — enemies aim sharper and constantly grab loot." }[difficulty];
  const slots = net ? SQUAD_SIZE : squadSize;
  const isClient = Session.role === "client";

  return (
    <div id="menu" className="screen">
      <div className="bg-grid" />
      <div className="menu-inner">
        <h1 className="title">Storm<span>FALL</span> 4.Four</h1>
        <p className="tagline">Drop in. Squad up. Last team standing wins the crown.</p>

        {crown && <div className="crown-banner"><span className="crown-ico">👑</span><span>Reigning Champion — {wins} crown win{wins !== 1 ? "s" : ""}. You carry 👑 into this match.</span></div>}

        <div className="lobby-grid">
          <div className="panel">
            <h2>Choose Hunter</h2>
            <div className="hunter-list">
              {HUNTER_IDS.map((id) => { const hh = HUNTERS[id]; return (
                <button key={id} className={"hunter-card" + (id === hunter ? " active" : "")} onClick={() => pickHunter(id)}>
                  <span className="hunter-emoji" style={{ background: hh.color + "22", color: hh.color }}>{hh.emoji}</span>
                  <span><b>{hh.name}</b><small>{hh.role}</small></span>
                </button>
              ); })}
            </div>
            <div className="hunter-desc">{h.desc}</div>
          </div>

          <div className="panel">
            <h2>Squad</h2>
            <div className="squad-size">
              {[1, 2, 3].map((n) => <button key={n} className={"size-btn" + (squadSize === n ? " active" : "")} onClick={() => { Sfx.click(); set({ squadSize: n }); }}>{["Solo", "Duo", "Trio"][n - 1]}</button>)}
            </div>
            <h2 style={{ marginTop: 14 }}>AI Difficulty</h2>
            <div className="squad-size">
              {(["easy", "normal", "hard"] as const).map((d) => <button key={d} className={"diff-btn" + (difficulty === d ? " active" : "")} data-diff={d} onClick={() => { Sfx.click(); set({ difficulty: d }); }}>{d[0].toUpperCase() + d.slice(1)}</button>)}
            </div>
            <p className="hint" style={{ marginTop: 6 }}>{diffHint}</p>

            <div className="party-box">
              <div className="party-row"><span>Party Code</span><span className="party-code">{Session.code || "——————"}</span></div>
              <div className="party-actions">
                <button onClick={() => { Sfx.click(); Session.host(makeCode()); }}>Create Party</button>
                <button onClick={() => {
                  Sfx.click(); if (!Session.code) Session.host(makeCode());
                  navigator.clipboard?.writeText(Session.inviteLink()).then(() => { setCopyLabel("Link Copied!"); setTimeout(() => setCopyLabel("Copy Invite Link"), 1400); }, () => {});
                }}>{copyLabel}</button>
              </div>
              {Session.code && <input className="invite-link" readOnly value={Session.inviteLink()} />}
              <div className="join-row">
                <input maxLength={6} placeholder="ENTER CODE" value={joinValue} onChange={(e) => setJoinValue(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} />
                <button onClick={() => { Sfx.click(); if (joinValue.length === 6) { Session.join(joinValue); set({ squadSize: 3 }); } }}>Join</button>
              </div>
              <div className="party-slots">
                {Array.from({ length: slots }).map((_, i) => {
                  if (net) { const m = Session.roster[i]; if (m) { const isMe = (Session.role === "host" && m.id === "host") || m.name === Session.handle; return <div key={i} className="slot you"><span className="dot" /> {m.host ? "⭐ " : ""}{m.name}{isMe ? " (you)" : ""} — {HUNTERS[m.hunter].name}</div>; } return <div key={i} className="slot bot"><span className="dot" /> Open slot — invite a friend (AI until filled)</div>; }
                  return i === 0 ? <div key={i} className="slot you"><span className="dot" /> You — {h.name}</div> : <div key={i} className="slot bot"><span className="dot" /> {Session.code ? "Open slot — invite a friend" : `${BOT_NAMES[i]} (AI fill)`}</div>;
                })}
              </div>
              <p className="hint">{Session.code ? "Send the invite link to friends; opening it drops them into this party. Open slots fill with AI." : "Create a party, then Copy Invite Link to play with friends. Empty slots are filled by AI hunters."}{Session.status && <><br /><span style={{ color: "var(--accent)" }}>{Session.status}</span></>}</p>
            </div>
          </div>
        </div>

        <div className="panel glossary-panel">
          <h2>{h.emoji} {h.name} — Ability Glossary</h2>
          <div className="glossary-list">
            {glossary.map((g, i) => (
              <div key={i} className={"gl-row" + (g.ult ? " ult" : "")}>
                <span className="gl-emoji">{g.emoji}</span>
                <span className="gl-body"><b>{g.name}</b><span className="gl-key">{g.key}</span>{g.ult && <span className="gl-key">ULT</span>}
                  <div className="gl-desc" dangerouslySetInnerHTML={{ __html: g.desc + (g.cd ? ` <i>· ${g.cd}s cooldown</i>` : "") }} /></span>
              </div>
            ))}
          </div>
        </div>

        <button className="play-btn" disabled={isClient} style={isClient ? { opacity: 0.6 } : undefined} onClick={() => { if (!isClient) { Sfx.click(); onPlay(); } }}>{isClient ? "WAITING FOR HOST…" : "FIND MATCH ▸"}</button>
        <p className="controls-hint">WASD move · Mouse aim · <b>LMB</b> attack · <b>Q/E</b> abilities · <b>R</b> ultimate · <b>Space</b> dash · <b>V</b> ping · <b>F</b> equip · auto-revive teammates · <b>Enter</b> chat</p>
      </div>
    </div>
  );
}
