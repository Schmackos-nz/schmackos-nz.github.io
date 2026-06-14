/* ============================================================
   STORMFALL — peer-to-peer transport (WebRTC via PeerJS)
   Host-authoritative. Host runs the sim; clients send input and
   render host snapshots. Signaling uses PeerJS's free broker, so
   there is no server to run — the invite code IS the peer id.
   ============================================================ */
'use strict';

const Net = {
  peer:null, isHost:false, isClient:false, ready:false, code:null,
  conns:{},          // host: id -> DataConnection
  hostConn:null,     // client: connection to host
  onData:null, onConn:null, onClose:null,

  available(){ return typeof Peer !== 'undefined'; },
  PREFIX:'stormfall2-arena-',

  startHost(code, onOpen, onErr){
    if (!this.available()){ onErr && onErr('no-peerjs'); return; }
    this.cleanup(); this.isHost=true; this.isClient=false; this.code=code;
    this.peer = new Peer(this.PREFIX+code, { debug:0 });
    this.peer.on('open', () => { this.ready=true; onOpen && onOpen(); });
    this.peer.on('connection', c => {
      c.on('open', () => { this.conns[c.peer]=c; this.onConn && this.onConn(c.peer); });
      c.on('data', d => this.onData && this.onData(c.peer, d));
      c.on('close', () => { delete this.conns[c.peer]; this.onClose && this.onClose(c.peer); });
      c.on('error', () => {});
    });
    this.peer.on('error', e => { onErr && onErr((e&&e.type)||'error'); });
  },

  startClient(code, onOpen, onErr){
    if (!this.available()){ onErr && onErr('no-peerjs'); return; }
    this.cleanup(); this.isHost=false; this.isClient=true; this.code=code;
    this.peer = new Peer({ debug:0 });
    this.peer.on('open', () => {
      const c = this.peer.connect(this.PREFIX+code, { reliable:true });
      if (!c){ onErr && onErr('connect-failed'); return; }
      c.on('open', () => { this.hostConn=c; this.ready=true; onOpen && onOpen(); });
      c.on('data', d => this.onData && this.onData('host', d));
      c.on('close', () => { this.onClose && this.onClose('host'); });
      c.on('error', () => {});
    });
    this.peer.on('error', e => { onErr && onErr((e&&e.type)||'error'); });
  },

  broadcast(msg){ for (const id in this.conns){ try{ this.conns[id].send(msg); }catch(e){} } },
  send(id, msg){ const c=this.conns[id]; if (c){ try{ c.send(msg); }catch(e){} } },
  toHost(msg){ if (this.hostConn){ try{ this.hostConn.send(msg); }catch(e){} } },
  count(){ return Object.keys(this.conns).length; },

  cleanup(){
    try { if (this.peer) this.peer.destroy(); } catch(e){}
    this.peer=null; this.conns={}; this.hostConn=null;
    this.isHost=this.isClient=this.ready=false;
  }
};
