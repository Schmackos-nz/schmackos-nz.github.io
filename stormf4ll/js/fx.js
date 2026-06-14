/* ============================================================
   STORMFALL — sound + ambient FX  (Web Audio, all synthesized)
   ============================================================ */
'use strict';

const Sfx = {
  ctx:null, master:null, amb:null, muted:false,
  _ck(){
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    return true;
  },
  // --- primitives ---
  tone(freq, dur, { type='sine', vol=0.3, to=null, t0=0, atk=0.005 }={}){
    if (!this._ck() || this.muted || vol<=0.0008) return;
    const c=this.ctx, o=c.createOscillator(), g=c.createGain();
    o.type=type; const s=c.currentTime+t0;
    o.frequency.setValueAtTime(freq,s);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20,to), s+dur);
    g.gain.setValueAtTime(0.0001,s);
    g.gain.exponentialRampToValueAtTime(vol, s+atk);
    g.gain.exponentialRampToValueAtTime(0.0001, s+dur);
    o.connect(g).connect(this.master); o.start(s); o.stop(s+dur+0.03);
  },
  burst(dur, vol, freq=1200, q=1, t0=0){
    if (!this._ck() || this.muted || vol<=0.0008) return;
    const c=this.ctx, n=c.createBufferSource();
    const buf=c.createBuffer(1, Math.max(1,c.sampleRate*dur), c.sampleRate);
    const d=buf.getChannelData(0);
    for (let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    n.buffer=buf;
    const f=c.createBiquadFilter(); f.type='bandpass'; f.frequency.value=freq; f.Q.value=q;
    const g=c.createGain(); const s=c.currentTime+t0;
    g.gain.setValueAtTime(vol,s);
    g.gain.exponentialRampToValueAtTime(0.0001, s+dur);
    n.connect(f).connect(g).connect(this.master); n.start(s); n.stop(s+dur+0.02);
  },
  // --- events (v = 0..1 distance volume) ---
  shoot(v=1){ this.tone(680,0.08,{type:'square',vol:0.10*v,to:300}); },
  cast(v=1){ this.tone(200,0.22,{type:'sawtooth',vol:0.16*v,to:620}); },
  hit(v=1){ this.burst(0.07,0.16*v,1000,1.2); },
  explode(v=1){ this.burst(0.32,0.28*v,220,0.6); this.tone(110,0.32,{vol:0.18*v,to:45}); },
  pickup(v=1){ this.tone(523,0.08,{vol:0.16*v}); this.tone(784,0.12,{vol:0.16*v,t0:0.07}); },
  ping(v=1){ this.tone(950,0.10,{vol:0.22*v}); this.tone(1380,0.10,{vol:0.18*v,t0:0.05}); },
  dash(v=1){ this.burst(0.16,0.10*v,600,0.8); },
  down(v=1){ this.tone(320,0.42,{type:'sawtooth',vol:0.22*v,to:70}); },
  kill(v=1){ [523,659,784].forEach((f,i)=>this.tone(f,0.14,{type:'triangle',vol:0.16*v,t0:i*0.05})); },
  revive(v=1){ this.tone(440,0.3,{vol:0.16*v,to:880,type:'triangle'}); },
  zone(){ this.burst(0.8,0.20,140,0.5); this.tone(180,0.6,{type:'sawtooth',vol:0.10,to:90}); },
  victory(){ [523,659,784,1046,1318].forEach((f,i)=>this.tone(f,0.3,{type:'triangle',vol:0.22,t0:i*0.12})); },
  defeat(){ [440,349,294,196].forEach((f,i)=>this.tone(f,0.4,{type:'sawtooth',vol:0.18,t0:i*0.16})); },
  click(){ this.tone(520,0.05,{type:'square',vol:0.12}); },

  // --- ambient wind/pad loop ---
  ambientStart(){
    if (!this._ck() || this.amb) return;
    const c=this.ctx;
    // wind: looping filtered noise
    const buf=c.createBuffer(1, c.sampleRate*2, c.sampleRate);
    const d=buf.getChannelData(0);
    for (let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    const n=c.createBufferSource(); n.buffer=buf; n.loop=true;
    const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=420; f.Q.value=0.7;
    const g=c.createGain(); g.gain.value=0.05;
    // slow LFO swell on the wind
    const lfo=c.createOscillator(), lg=c.createGain();
    lfo.frequency.value=0.08; lg.gain.value=0.03;
    lfo.connect(lg).connect(g.gain); lfo.start();
    n.connect(f).connect(g).connect(this.master); n.start();
    // low drone pad
    const o1=c.createOscillator(), o2=c.createOscillator(), pg=c.createGain();
    o1.type='sine'; o2.type='sine'; o1.frequency.value=55; o2.frequency.value=82.4;
    pg.gain.value=0.025; o1.connect(pg); o2.connect(pg); pg.connect(this.master);
    o1.start(); o2.start();
    this.amb={ n, g, lfo, o1, o2, pg };
  },
  ambientStop(){
    if (!this.amb) return;
    const a=this.amb, t=this.ctx.currentTime;
    a.g.gain.exponentialRampToValueAtTime(0.0001, t+0.5);
    a.pg.gain.exponentialRampToValueAtTime(0.0001, t+0.5);
    setTimeout(()=>{ try{a.n.stop();a.lfo.stop();a.o1.stop();a.o2.stop();}catch(e){} }, 600);
    this.amb=null;
  },
  // crank the wind as the storm tightens
  ambientIntensity(x){
    if (!this.amb) return;
    this.amb.g.gain.value = 0.05 + x*0.06;
  }
};
