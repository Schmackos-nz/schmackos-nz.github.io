// Lobby/party networking. Owns Net.onData while in the menu, syncs the roster,
// and hands match messages off to the active Game once a match starts.
import { Net } from "./Net";
import { HUNTERS, BOT_NAMES } from "./data";
import { SQUAD_SIZE, randi } from "./constants";

export type Member = { id: string; name: string; hunter: string; host: boolean };
export type Role = "solo" | "host" | "client";

class SessionMgr {
  role: Role = "solo";
  roster: Member[] = [];
  code: string | null = null;
  status = "";
  hunter = "vanguard";
  handle = BOT_NAMES[randi(0, BOT_NAMES.length - 1)] + randi(10, 99);
  joinedViaLink = false;
  onChange: (() => void) | null = null; // menu re-render
  onStart: (() => void) | null = null;  // client received 'start'
  private game: any = null;
  private buffer: Array<[string, any]> = [];

  available() { return Net.available(); }
  private notify() { this.onChange?.(); }
  private wire() {
    Net.onData = (id, msg) => { try { this.data(id, msg); } catch (e) { console.error("session data", e); } };
    Net.onConn = () => {};
    Net.onClose = (id) => { try { this.close(id); } catch (e) {} };
  }

  setHunter(h: string) {
    this.hunter = h;
    if (this.role === "client" && Net.ready) Net.toHost({ t: "hello", name: this.handle, hunter: h });
    else if (this.role === "host") { if (this.roster[0]) this.roster[0].hunter = h; this.broadcastRoster(); }
  }
  host(code: string) {
    if (!Net.available()) { this.status = "Offline — networking unavailable; squad will be AI."; this.notify(); return; }
    this.role = "host"; this.code = code; this.roster = [{ id: "host", name: this.handle, hunter: this.hunter, host: true }];
    this.status = "Starting party…"; this.wire(); this.notify();
    Net.startHost(code,
      () => { this.status = "Party live — send the invite link to friends."; this.notify(); },
      (err) => { this.status = err === "unavailable-id" ? "Code already in use — create a new party." : "Could not start party (offline?). Squad will be AI."; this.role = "solo"; this.roster = []; this.notify(); });
  }
  join(code: string) {
    if (!Net.available()) { this.status = "Offline — playing solo vs AI."; this.role = "solo"; this.notify(); return; }
    this.role = "client"; this.code = code; this.joinedViaLink = true; this.status = "Connecting to host…"; this.wire(); this.notify();
    Net.startClient(code,
      () => { Net.toHost({ t: "hello", name: this.handle, hunter: this.hunter }); this.status = "Connected — waiting for host to start."; this.notify(); },
      () => { this.status = "Could not reach host (offline or wrong code). Playing solo vs AI."; this.role = "solo"; this.notify(); });
  }
  leave() { Net.cleanup(); this.role = "solo"; this.roster = []; this.status = ""; this.code = null; this.game = null; this.buffer = []; this.joinedViaLink = false; this.notify(); }
  broadcastRoster() { if (this.role === "host") { Net.broadcast({ t: "roster", members: this.roster }); this.notify(); } }
  startHostMatch() { Net.broadcast({ t: "start" }); }
  setGame(g: any) { this.game = g; const buf = this.buffer; this.buffer = []; for (const [id, msg] of buf) g.handleNet(id, msg); }
  clearGame() { this.game = null; }
  inviteLink() { const base = location.href.replace(/[?#].*$/, ""); return base + "?party=" + (this.code || ""); }

  private data(fromId: string, msg: any) {
    if (this.role === "host") {
      if (msg.t === "hello") {
        let m = this.roster.find((x) => x.id === fromId);
        if (!m) { if (this.roster.length >= SQUAD_SIZE) { Net.send(fromId, { t: "full" }); return; } m = { id: fromId, name: msg.name || "Hunter", hunter: HUNTERS[msg.hunter] ? msg.hunter : "sable", host: false }; this.roster.push(m); }
        else { if (msg.name) m.name = msg.name; if (HUNTERS[msg.hunter]) m.hunter = msg.hunter; }
        this.broadcastRoster();
      } else if (this.game) this.game.handleNet(fromId, msg);
      else this.buffer.push([fromId, msg]);
    } else {
      switch (msg.t) {
        case "roster": this.roster = msg.members || []; this.notify(); break;
        case "full": this.status = "Party is full (max " + SQUAD_SIZE + " players)."; this.role = "solo"; Net.cleanup(); this.notify(); break;
        case "start": this.onStart?.(); break;
        default: if (this.game) this.game.handleNet("host", msg); else this.buffer.push(["host", msg]);
      }
    }
  }
  private close(id: string) {
    if (this.role === "host") { this.roster = this.roster.filter((x) => x.id !== id); this.broadcastRoster(); if (this.game) this.game.handleClose(id); }
    else if (this.game) this.game.handleClose("host");
  }
}

export const Session = new SessionMgr();
