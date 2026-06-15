// WebRTC peer-to-peer transport via PeerJS (ported from legacy net.js)
import Peer, { DataConnection } from "peerjs";

class NetTransport {
  peer: Peer | null = null;
  isHost = false;
  isClient = false;
  ready = false;
  code: string | null = null;
  conns: Record<string, DataConnection> = {};
  hostConn: DataConnection | null = null;
  onData: ((fromId: string, msg: any) => void) | null = null;
  onConn: ((id: string) => void) | null = null;
  onClose: ((id: string) => void) | null = null;
  readonly PREFIX = "stormfall2-arena-";

  available() { return typeof Peer !== "undefined"; }

  startHost(code: string, onOpen?: () => void, onErr?: (e: string) => void) {
    if (!this.available()) { onErr?.("no-peerjs"); return; }
    this.cleanup(); this.isHost = true; this.isClient = false; this.code = code;
    this.peer = new Peer(this.PREFIX + code, { debug: 0 });
    this.peer.on("open", () => { this.ready = true; onOpen?.(); });
    this.peer.on("connection", (c) => {
      c.on("open", () => { this.conns[c.peer] = c; this.onConn?.(c.peer); });
      c.on("data", (d) => this.onData?.(c.peer, d));
      c.on("close", () => { delete this.conns[c.peer]; this.onClose?.(c.peer); });
      c.on("error", () => {});
    });
    this.peer.on("error", (e: any) => { onErr?.((e && e.type) || "error"); });
  }

  startClient(code: string, onOpen?: () => void, onErr?: (e: string) => void) {
    if (!this.available()) { onErr?.("no-peerjs"); return; }
    this.cleanup(); this.isHost = false; this.isClient = true; this.code = code;
    this.peer = new Peer({ debug: 0 });
    this.peer.on("open", () => {
      const c = this.peer!.connect(this.PREFIX + code, { reliable: true });
      if (!c) { onErr?.("connect-failed"); return; }
      c.on("open", () => { this.hostConn = c; this.ready = true; onOpen?.(); });
      c.on("data", (d) => this.onData?.("host", d));
      c.on("close", () => { this.onClose?.("host"); });
      c.on("error", () => {});
    });
    this.peer.on("error", (e: any) => { onErr?.((e && e.type) || "error"); });
  }

  broadcast(msg: any) { for (const id in this.conns) { try { this.conns[id].send(msg); } catch (e) {} } }
  send(id: string, msg: any) { const c = this.conns[id]; if (c) { try { c.send(msg); } catch (e) {} } }
  toHost(msg: any) { if (this.hostConn) { try { this.hostConn.send(msg); } catch (e) {} } }
  count() { return Object.keys(this.conns).length; }

  cleanup() {
    try { this.peer?.destroy(); } catch (e) {}
    this.peer = null; this.conns = {}; this.hostConn = null;
    this.isHost = this.isClient = this.ready = false;
  }
}

export const Net = new NetTransport();
