import { CONFIG } from './config.js';

const S = CONFIG.spray;
const MUTE_KEY = 'insect-spray-muted';

// スプレーの「シューッ」音（Web Audio）。ホワイトノイズをフィルターに通し、噴射中の人ごとに鳴らす。
export class SprayAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.voices = [];
    this.muted = this._loadMuted();
  }

  _loadMuted() {
    try {
      return localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      return false;
    }
  }

  _saveMuted() {
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      /* 保存できなくても続行 */
    }
  }

  // 最初のユーザー操作（スタート）で呼ぶ。AudioContext の開始・再開
  unlock(voiceCount) {
    try {
      if (!this.ctx) this._create(voiceCount);
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {
      console.warn('音を開始できませんでした', e);
      this.ctx = null;
    }
  }

  _create(voiceCount) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(ctx.destination);

    // 2 秒ぶんのホワイトノイズを繰り返す
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    for (let i = 0; i < voiceCount; i++) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1800 + i * 150;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 5200 + i * 300;
      bp.Q.value = 0.5;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(hp).connect(bp).connect(gain).connect(this.master);
      src.start(0, Math.random() * 2); // 人ごとに再生位置をずらす
      this.voices.push({ gain, on: false });
    }
  }

  // flags: 人ごとの噴射中フラグ、distances: ゴキブリからの距離
  update(flags, distances) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.voices.forEach((v, i) => {
      const spraying = !!flags[i];
      const near = Math.max(0, 1 - distances[i] / S.soundMaxDistance);
      const target = spraying ? S.soundVolume * near * near : 0;
      if (spraying || v.on) {
        // 噴射の開始・終了は短いフェード、距離による変化は滑らかに
        v.gain.gain.setTargetAtTime(target, now, spraying ? 0.03 : 0.06);
        v.on = spraying;
      }
    });
  }

  // アイテム取得の「キラーン」（サイン波の上昇音）。ミュート中は鳴らさない
  playChime() {
    if (!this.ctx || this.muted) return;
    const B = CONFIG.boost;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    for (const mul of [1, 1.5]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(B.chimeFreq * mul, now);
      osc.frequency.exponentialRampToValueAtTime(B.chimeFreq * mul * 2, now + B.chimeTime);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(B.chimeVolume * (mul === 1 ? 1 : 0.5), now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + B.chimeTime + 0.15);
      osc.connect(g).connect(this.master);
      osc.start(now);
      osc.stop(now + B.chimeTime + 0.2);
    }
  }

  silence() {
    this.update([], []);
  }

  toggleMute() {
    this.muted = !this.muted;
    this._saveMuted();
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.02);
    return this.muted;
  }
}
