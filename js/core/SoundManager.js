const MUTE_STORAGE_KEY = 'castlevania_manor_muted_v1';

export class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isMuted = this.loadMuteState();
    this.isMusicPlaying = false;
    this.musicInterval = null;
    this.stepIndex = 0;

    this.melodyNotes = [
      293.66, 0, 349.23, 440.00, 293.66, 0, 466.16, 440.00,
      392.00, 349.23, 329.63, 293.66, 277.18, 0, 329.63, 0,
      293.66, 0, 349.23, 440.00, 587.33, 0, 523.25, 466.16,
      440.00, 392.00, 349.23, 329.63, 293.66, 0, 293.66, 0
    ];

    this.bassNotes = [
      146.83, 146.83, 146.83, 146.83, 146.83, 146.83, 233.08, 220.00,
      196.00, 196.00, 174.61, 174.61, 164.81, 164.81, 138.59, 164.81,
      146.83, 146.83, 146.83, 146.83, 196.00, 196.00, 174.61, 174.61,
      220.00, 220.00, 138.59, 138.59, 146.83, 110.00, 146.83, 0
    ];
  }

  loadMuteState() {
    try {
      return localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  saveMuteState() {
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, String(this.isMuted));
    } catch {
      // Ignore storage errors
    }
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : 0.35;
      this.masterGain.connect(this.ctx.destination);
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.init();
    this.isMuted = !this.isMuted;
    this.saveMuteState();

    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        this.isMuted ? 0 : 0.35,
        this.ctx.currentTime
      );
    }
    return this.isMuted;
  }

  playTone(freq, type, duration, startTimeOffset = 0, volume = 0.3, slideEndFreq = null) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime + startTimeOffset;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    if (slideEndFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideEndFreq), now + duration);
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  playJump() {
    this.playTone(150, 'square', 0.14, 0, 0.22, 520);
  }

  playSwing() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    this.playTone(340, 'sawtooth', 0.09, 0, 0.25, 85);

    const bufferSize = Math.floor(this.ctx.sampleRate * 0.08);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start();
  }

  playHitObject(isPogoBounce = false) {
    this.playTone(190, 'square', 0.07, 0, 0.35, 95);
    this.playTone(580, 'triangle', 0.08, 0.02, 0.3, 320);

    if (isPogoBounce) {
      this.playTone(880, 'square', 0.11, 0.04, 0.25, 1174.66);
    }
  }

  playShieldClang() {
    // Звонкий рикошет меча от непробиваемого щита Босса
    this.playTone(920, 'square', 0.08, 0, 0.28, 1480);
    this.playTone(620, 'triangle', 0.1, 0.03, 0.25, 420);
  }

  playBossShockwave() {
    // Глубокий грохот взрывной волны или огненных колонн Босса
    this.playTone(140, 'sawtooth', 0.28, 0, 0.35, 38);
  }

  playPlayerHurt() {
    this.playTone(240, 'sawtooth', 0.16, 0, 0.32, 90);
  }

  playPickup() {
    const notes = [293.66, 349.23, 440.00, 587.33];
    notes.forEach((freq, idx) => {
      this.playTone(freq, 'square', 0.11, idx * 0.075, 0.28);
    });
  }

  playDeath() {
    const deathNotes = [392.00, 369.99, 349.23, 311.13, 261.63, 196.00];
    deathNotes.forEach((freq, idx) => {
      const duration = idx === deathNotes.length - 1 ? 0.35 : 0.11;
      this.playTone(freq, 'sawtooth', duration, idx * 0.1, 0.3, freq * 0.92);
    });
  }

  playVictory() {
    const fanfare = [293.66, 349.23, 440.00, 587.33, 523.25, 587.33, 783.99];
    fanfare.forEach((freq, idx) => {
      const dur = idx === fanfare.length - 1 ? 0.45 : 0.12;
      this.playTone(freq, 'square', dur, idx * 0.11, 0.3);
    });
  }

  startMusic() {
    this.init();
    if (this.isMusicPlaying) return;
    this.isMusicPlaying = true;

    const stepDurationMs = 150;

    this.musicInterval = setInterval(() => {
      if (!this.isMusicPlaying || this.isMuted || !this.ctx || this.ctx.state !== 'running') {
        return;
      }

      const idx = this.stepIndex % this.melodyNotes.length;
      const melodyFreq = this.melodyNotes[idx];
      const bassFreq = this.bassNotes[idx];

      if (melodyFreq > 0) {
        this.playTone(melodyFreq, 'square', 0.12, 0, 0.11);
      }
      if (bassFreq > 0) {
        this.playTone(bassFreq, 'triangle', 0.13, 0, 0.18);
      }

      this.stepIndex++;
    }, stepDurationMs);
  }

  stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicInterval !== null) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}