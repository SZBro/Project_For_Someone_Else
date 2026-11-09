// Sound effects are synthesized with Web Audio; background music is loaded from public/audio.

const SETTINGS_KEY = 'fatbear-audio';

class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.noise = null;
    this.menuMusicElement = null;
    this.gameMusicElement = null;
    this.menuMusicGain = null;
    this.gameMusicGain = null;
    this.musicMode = 'menu';
    this.musicFadeTimer = null;
    const saved = loadSettings();
    this.soundOn = saved.soundOn ?? true;
    this.musicOn = saved.musicOn ?? true;
    this.soundVolume = normalizeVolume(saved.soundVolume ?? 0.6);
    this.musicVolume = normalizeVolume(saved.musicVolume ?? 0.3);
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
      this.menuMusicGain = this.ctx.createGain();
      this.menuMusicGain.gain.value = 0;
      this.menuMusicGain.connect(this.musicBus);
      this.gameMusicGain = this.ctx.createGain();
      this.gameMusicGain.gain.value = 0;
      this.gameMusicGain.connect(this.musicBus);
      this.menuMusicElement = this.createMusicElement('menu.mp3', this.menuMusicGain);
      this.gameMusicElement = this.createMusicElement('background.mp3', this.gameMusicGain);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.applyVolumes();
    if (this.musicOn) this.playCurrentMusic();
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
      if (on) this.playCurrentMusic();
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
    this.musicBus.gain.value = this.musicOn ? 0.5 * this.musicVolume : 0;
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

  createMusicElement(filename, gain) {
    const element = new window.Audio(`${import.meta.env.BASE_URL}audio/${filename}`);
    element.loop = true;
    element.addEventListener('error', () => {
      console.error(`Failed to load ${filename}:`, element.error);
    });
    this.ctx.createMediaElementSource(element).connect(gain);
    return element;
  }

  startMenuMusic() {
    this.switchMusic('menu');
  }

  startMusic() {
    this.switchMusic('game');
  }

  switchMusic(mode) {
    this.musicMode = mode;
    if (!this.ctx || !this.musicOn) return;
    this.playCurrentMusic();
  }

  playCurrentMusic() {
    const targetElement = this.musicMode === 'menu' ? this.menuMusicElement : this.gameMusicElement;
    const previousElement = this.musicMode === 'menu' ? this.gameMusicElement : this.menuMusicElement;
    const targetGain = this.musicMode === 'menu' ? this.menuMusicGain : this.gameMusicGain;
    const previousGain = this.musicMode === 'menu' ? this.gameMusicGain : this.menuMusicGain;
    const now = this.ctx.currentTime;
    const fadeDuration = 1;

    clearTimeout(this.musicFadeTimer);
    [targetGain, previousGain].forEach((gain) => {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
    });
    targetGain.gain.linearRampToValueAtTime(this.musicMode === 'menu' ? 0.2 : 1, now + fadeDuration);
    previousGain.gain.linearRampToValueAtTime(0, now + fadeDuration);

    targetElement.play().catch((error) => {
      if (error.name !== 'AbortError') {
        console.error(`Unable to play ${this.musicMode} music:`, error);
      }
    });
    this.musicFadeTimer = setTimeout(() => {
      if (this.musicMode === 'menu') this.gameMusicElement.pause();
      else this.menuMusicElement.pause();
    }, fadeDuration * 1000);
  }

  stopMusic() {
    clearTimeout(this.musicFadeTimer);
    this.menuMusicElement?.pause();
    this.gameMusicElement?.pause();
  }
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
