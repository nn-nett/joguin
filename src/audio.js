// Áudio sintetizado (WebAudio). Tudo é no-op até unlock() e fora do browser. Nunca lança.
const THROTTLE = { fire: 0.06, clash: 0.05, towerHit: 0.07 };
const MUSIC_GAIN = 0.08;
const BPM = 120;
const STEP = 60 / BPM / 2; // colcheia
const LOOKAHEAD = 0.35;
const TICK_MS = 100;

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
// 8 compassos: C Am F G C Am F G  (raiz MIDI, menor?)
const PROG = [[48, 0], [45, 1], [41, 0], [43, 0], [48, 0], [45, 1], [41, 0], [43, 0]];
const ARP = [0, 1, 2, 3, 2, 1, 2, 1];
const REST = [0, 0, 0, 0, 0, 0, 0, 1]; // alguns vazios para respirar

export function createAudio() {
  let ctx = null, master = null, musicGain = null, noiseBuf = null;
  let muted = false, wantMusic = false, timer = null;
  let nextTime = 0, stepIdx = 0;
  const last = {};

  function tone(f0, f1, dur, type, vol, delay = 0, dest = master) {
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, freq, vol, delay = 0) {
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random() * 0.5, dur + 0.02);
  }

  const bark = (pitch, vol, delay = 0) => {
    tone(pitch, pitch * 0.5, 0.12, 'square', vol, delay);
    tone(pitch * 1.5, pitch * 0.7, 0.09, 'sawtooth', vol * 0.5, delay);
  };
  const meow = (pitch, vol, delay = 0) => {
    tone(pitch, pitch * 1.6, 0.18, 'sine', vol, delay);
    tone(pitch * 1.6, pitch * 0.9, 0.2, 'sine', vol * 0.8, delay + 0.16);
  };
  const arp = (notes, type, vol, gap) => notes.forEach((m, i) => tone(mtof(m), mtof(m), 0.22, type, vol, i * gap));

  const SOUNDS = {
    fire: () => { noise(0.05, 1800, 0.18); tone(520, 260, 0.06, 'square', 0.08); },
    gate: () => arp([72, 76, 79], 'triangle', 0.18, 0.06),
    gateBad: () => tone(300, 110, 0.25, 'sawtooth', 0.18),
    clash: () => { noise(0.07, 1200, 0.2); tone(700 + Math.random() * 300, 400, 0.05, 'sine', 0.08); },
    towerHit: () => { noise(0.1, 500, 0.3); tone(140, 70, 0.12, 'square', 0.12); },
    baseHit: () => { meow(500, 0.2); noise(0.15, 300, 0.25); },
    super: () => { bark(180, 0.3); bark(150, 0.3, 0.16); noise(0.3, 400, 0.2, 0.3); },
    superReady: () => arp([67, 72, 76, 79, 84], 'square', 0.12, 0.07),
    wave: () => { meow(420, 0.18); meow(520, 0.16, 0.25); },
    win: () => arp([60, 64, 67, 72, 67, 72, 76, 79], 'triangle', 0.22, 0.12),
    lose: () => arp([67, 64, 60, 55], 'sawtooth', 0.15, 0.2),
    click: () => tone(800, 600, 0.05, 'square', 0.1),
    coin: () => { tone(988, 988, 0.08, 'square', 0.1); tone(1319, 1319, 0.18, 'square', 0.1, 0.07); },
    buy: () => arp([72, 76, 79, 84], 'triangle', 0.18, 0.06),
  };

  function scheduleStep(t) {
    const bar = Math.floor(stepIdx / 8) % 8;
    const beat = stepIdx % 8;
    const [root, minor] = PROG[bar];
    if (beat % 2 === 0) {
      tone(mtof(root - 12 + (beat === 4 ? 7 : 0)), mtof(root - 12 + (beat === 4 ? 7 : 0)), STEP * 1.8, 'triangle', 0.9, t - ctx.currentTime, musicGain);
    }
    if (!REST[beat] || bar % 2 === 0) {
      const iv = [0, minor ? 3 : 4, 7, 12][ARP[beat] % 4];
      const m = root + 12 + iv;
      tone(mtof(m), mtof(m), STEP * 0.9, 'triangle', 0.6, t - ctx.currentTime, musicGain);
    }
  }

  function pump() {
    if (!ctx) return;
    try {
      if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
      while (nextTime < ctx.currentTime + LOOKAHEAD) {
        scheduleStep(nextTime);
        nextTime += STEP;
        stepIdx = (stepIdx + 1) % 64;
      }
    } catch (e) { /* ignora */ }
  }

  function runMusic() {
    if (!ctx || timer !== null) return;
    nextTime = ctx.currentTime + 0.05;
    stepIdx = 0;
    pump();
    timer = setInterval(pump, TICK_MS);
  }

  return {
    unlock() {
      try {
        if (!ctx) {
          const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
          if (!AC) return;
          ctx = new AC();
          master = ctx.createGain();
          master.gain.value = muted ? 0 : 1;
          master.connect(ctx.destination);
          musicGain = ctx.createGain();
          musicGain.gain.value = MUSIC_GAIN;
          musicGain.connect(master);
          const n = Math.floor(ctx.sampleRate * 0.6);
          noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
          const d = noiseBuf.getChannelData(0);
          for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        }
        if (ctx.state === 'suspended' && ctx.resume) {
          const p = ctx.resume();
          if (p && p.catch) p.catch(() => {});
        }
        if (wantMusic) runMusic();
      } catch (e) { /* sem áudio */ }
    },
    setMuted(b) {
      muted = !!b;
      try {
        if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02);
      } catch (e) { /* ignora */ }
    },
    isMuted: () => muted,
    play(name, opts) {
      try {
        if (!ctx || muted) return;
        const fn = SOUNDS[name];
        if (!fn) return;
        const th = THROTTLE[name];
        if (th) {
          const now = ctx.currentTime;
          if (last[name] !== undefined && now - last[name] < th) return;
          last[name] = now;
        }
        fn(opts);
      } catch (e) { /* ignora */ }
    },
    startMusic() {
      wantMusic = true;
      try { runMusic(); } catch (e) { /* ignora */ }
    },
    stopMusic() {
      wantMusic = false;
      if (timer !== null) { clearInterval(timer); timer = null; }
    },
  };
}
