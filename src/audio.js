// Placeholder sound effects and music, synthesized with Web Audio so no audio files are needed.

const SETTINGS_KEY = 'fatbear-audio';

class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.noise = null;
    this.musicTimer = null;
    const saved = loadSettings();
    this.soundOn = saved.soundOn ?? true;
    this.musicOn = saved.musicOn ?? true;
    this.soundVolume = normalizeVolume(saved.soundVolume);
    this.musicVolume = normalizeVolume(saved.musicVolume);
    this.muted = false;
  }

  // Browsers only allow audio after a user gesture, so call this from a click.
  unlock() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.noise = makeNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.applyVolumes();
    if (this.musicOn) this.startMusic();
  }

  setSound(on) {
    this.soundOn = on;
    saveSettings(this);
    this.applyVolumes();
  }

  setSoundVolume(volume) {
    this.soundVolume = normalizeVolume(volume);
    saveSettings(this);
    this.applyVolumes();
  }

  setMusic(on) {
    this.musicOn = on;
    saveSettings(this);
    if (this.ctx) {
      if (on) this.startMusic();
      else this.stopMusic();
    }
    this.applyVolumes();
  }

  setMusicVolume(volume) {
    this.musicVolume = normalizeVolume(volume);
    saveSettings(this);
    this.applyVolumes();
  }

  toggleMute() {
    this.muted = !this.muted;
    this.applyVolumes();
    return this.muted;
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.muted ? 0 : 1;
    this.sfxBus.gain.value = this.soundOn ? 0.5 * this.soundVolume : 0;
    this.musicBus.gain.value = this.musicOn ? 0.16 * this.musicVolume : 0;
  }

  get ready() {
    return this.ctx && this.soundOn && !this.muted;
  }

  // ---- Sound effects. vol (0..1) lets far-away sounds play quieter. ----

  swipe(vol = 1) {
    this.noiseSweep({ from: 1800, to: 500, dur: 0.14, gain: 0.5 * vol, type: 'bandpass' });
  }

  hit(vol = 1) {
    this.tone({ type: 'sine', from: 140, to: 50, dur: 0.18, gain: 0.9 * vol });
    this.noiseSweep({ from: 900, to: 200, dur: 0.1, gain: 0.5 * vol, type: 'lowpass' });
  }

  heavyHit(vol = 1) {
    this.tone({ type: 'sine', from: 110, to: 35, dur: 0.32, gain: 1 * vol });
    this.noiseSweep({ from: 600, to: 120, dur: 0.22, gain: 0.7 * vol, type: 'lowpass' });
  }

  block(vol = 1) {
    this.tone({ type: 'triangle', from: 900, to: 700, dur: 0.08, gain: 0.35 * vol });
    this.tone({ type: 'square', from: 1400, to: 1200, dur: 0.04, gain: 0.08 * vol });
  }

  guardBreak(vol = 1) {
    this.tone({ type: 'square', from: 500, to: 120, dur: 0.3, gain: 0.18 * vol });
  }

  dash(vol = 1) {
    this.noiseSweep({ from: 400, to: 2400, dur: 0.16, gain: 0.35 * vol, type: 'bandpass' });
  }

  chargeUp(vol = 1) {
    // Low growl rising in pitch.
    this.tone({ type: 'sawtooth', from: 70, to: 140, dur: 0.45, gain: 0.12 * vol, filter: 500 });
  }

  eat(vol = 1) {
    [0, 0.09].forEach((t) => this.noiseSweep({ from: 1200, to: 400, dur: 0.05, gain: 0.3 * vol, type: 'lowpass', delay: t }));
  }

  gulp() {
    this.tone({ type: 'sine', from: 300, to: 600, dur: 0.12, gain: 0.35 });
  }

  splash() {
    this.noiseSweep({ from: 3000, to: 600, dur: 0.6, gain: 0.35, type: 'lowpass' });
  }

  parry(vol = 1) {
    this.tone({ type: 'triangle', from: 1500, to: 1900, dur: 0.14, gain: 0.45 * vol });
    this.tone({ type: 'sine', from: 750, to: 950, dur: 0.2, gain: 0.3 * vol });
  }

  knockout(vol = 1) {
    [0, 0.12, 0.24].forEach((t, i) => this.tone({ type: 'triangle', from: 440 / (i + 1), to: 330 / (i + 1), dur: 0.14, gain: 0.3 * vol, delay: t }));
  }

  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone({ type: 'triangle', from: f, to: f, dur: 0.22, gain: 0.3, delay: i * 0.12 }));
  }

  tone({ type, from, to, dur, gain, delay = 0, filter }) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    let node = osc;
    if (filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      osc.connect(f);
      node = f;
    }
    node.connect(g).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noiseSweep({ from, to, dur, gain, type, delay = 0 }) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // ---- Music: a slow, warm chord loop with a soft wandering melody. ----

  startMusic() {
    if (this.musicTimer || !this.ctx) return;
    const beat = 60 / 72; // 72 bpm
    // Generic circle-of-fifths jazz progression, 2 bars per chord (MIDI notes).
    const chords = [
      [57, 60, 64, 67], // Am7
      [50, 57, 60, 65], // Dm7
      [55, 59, 62, 65], // G7
      [48, 55, 59, 64], // Cmaj7
      [53, 57, 60, 64], // Fmaj7
      [47, 53, 57, 62], // Bm7b5
      [52, 56, 59, 62], // E7
      [57, 60, 64, 67], // Am7
    ];
    const scale = [57, 60, 62, 64, 67, 69, 72, 74, 76]; // A minor pentatonic-ish
    let step = 0;
    let next = this.ctx.currentTime + 0.1;
    let lastNote = 4;

    const schedule = () => {
      while (next < this.ctx.currentTime + 0.5) {
        const chord = chords[Math.floor(step / 8) % chords.length];
        if (step % 8 === 0) chord.forEach((n) => this.pad(midi(n), next, beat * 7.5));
        if (step % 2 === 0) this.pluck(midi(chord[0] - 12), next, beat * 1.5, 0.5);
        // Melody: wander a step or two along the scale, with rests.
        if (Math.random() < 0.45) {
          lastNote = Math.max(0, Math.min(scale.length - 1, lastNote + Math.round((Math.random() - 0.5) * 3)));
          this.pluck(midi(scale[lastNote] + 12), next + (Math.random() < 0.3 ? beat / 2 : 0), beat * 1.2, 0.35);
        }
        step++;
        next += beat;
      }
    };
    schedule();
    this.musicTimer = setInterval(schedule, 200);
  }

  stopMusic() {
    clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  pad(freq, t, dur) {
    const osc = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    f.type = 'lowpass';
    f.frequency.value = 900;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.8);
    g.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(f).connect(g).connect(this.musicBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  pluck(freq, t, dur, level) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.musicBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}

function midi(n) {
  return 440 * Math.pow(2, (n - 69) / 12);
}

function makeNoiseBuffer(ctx) {
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// Storage can be unavailable (private windows, blocked site data); audio works either way.
function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveSettings(a) {
  try {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        soundOn: a.soundOn,
        musicOn: a.musicOn,
        soundVolume: a.soundVolume,
        musicVolume: a.musicVolume,
      }),
    );
  } catch {
    // ignore
  }
}

function normalizeVolume(value) {
  const volume = Number(value);
  return Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
}

export const audio = new Audio();
