// ---------- synthesized sound effects (no audio files) ----------
const Sfx = (() => {
  let ctx = null;
  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(f0, f1, dur, type, vol) {
    try {
      const a = ac(), t = a.currentTime;
      const o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(a.destination);
      o.start(t); o.stop(t + dur);
    } catch (e) {}
  }
  function noise(dur, vol, lp) {
    try {
      const a = ac(), t = a.currentTime;
      const n = Math.floor(a.sampleRate * dur);
      const buf = a.createBuffer(1, n, a.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = a.createBufferSource(); s.buffer = buf;
      const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
      const g = a.createGain(); g.gain.value = vol;
      s.connect(f); f.connect(g); g.connect(a.destination); s.start(t);
    } catch (e) {}
  }
  return {
    init: ac,
    swing()   { noise(0.12, 0.18, 1800); },
    hit()     { tone(160, 60, 0.15, 'square', 0.22); noise(0.08, 0.2, 900); },
    hurt()    { tone(220, 90, 0.25, 'sawtooth', 0.25); },
    chop()    { noise(0.1, 0.3, 1200); tone(120, 70, 0.1, 'triangle', 0.2); },
    pickup()  { tone(660, 990, 0.12, 'sine', 0.15); },
    eat()     { tone(330, 440, 0.18, 'sine', 0.12); },
    bow()     { tone(880, 220, 0.18, 'sawtooth', 0.1); noise(0.1, 0.12, 3000); },
    coin()    { tone(1200, 1600, 0.1, 'square', 0.08); tone(1600, 2100, 0.12, 'square', 0.06); },
    craft()   { tone(300, 500, 0.15, 'triangle', 0.15); tone(500, 700, 0.2, 'triangle', 0.12); },
    die()     { tone(300, 40, 1.2, 'sawtooth', 0.3); },
    extract() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, f, 0.35, 'sine', 0.18), i * 130)); },
    storm()   { tone(80, 35, 2.5, 'sawtooth', 0.25); noise(2, 0.15, 400); },
    troll()   { tone(90, 45, 0.8, 'sawtooth', 0.3); },
  };
})();
