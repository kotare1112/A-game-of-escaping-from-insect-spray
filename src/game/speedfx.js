import * as THREE from 'three';
import { CONFIG } from './config.js';

const F = CONFIG.speedFx;
const rand = (a, b) => a + Math.random() * (b - a);

// 速く走っているときに床すれすれを後ろへ流れる細い筋（ゴキブリ周辺のみ）
export class SpeedStreaks {
  constructor(scene) {
    const n = F.streakCount;
    this.n = n;
    this.pos = new Float32Array(n * 6);
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.z = new Float32Array(n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.LineBasicMaterial({
      color: 0xfff1cf, transparent: true, opacity: 0, depthWrite: false, fog: false,
    });
    this.lines = new THREE.LineSegments(geo, this.mat);
    this.lines.frustumCulled = false;
    scene.add(this.lines);
    this.ready = false;
  }

  _respawn(i, roachPos, ahead) {
    this.x[i] = roachPos.x + rand(-F.streakRadiusX, F.streakRadiusX);
    this.y[i] = rand(0.008, 0.1);
    this.z[i] = roachPos.z - (ahead ? rand(F.streakAheadMin, F.streakAheadMax) : rand(-F.streakBehind, F.streakAheadMax));
  }

  // speedRatio: 0〜1（最高速度に対する今の速さ）
  update(roachPos, speedRatio) {
    if (!this.ready) {
      for (let i = 0; i < this.n; i++) this._respawn(i, roachPos, false);
      this.ready = true;
    }
    const k = THREE.MathUtils.clamp((speedRatio - 0.25) / 0.75, 0, 1);
    this.mat.opacity = F.streakOpacity * k;
    this.lines.visible = k > 0.01;
    if (!this.lines.visible) return;
    const len = F.streakLenMin + (F.streakLenMax - F.streakLenMin) * k;
    for (let i = 0; i < this.n; i++) {
      // 後ろへ流れた・横へ外れた筋は前へ出し直す
      if (this.z[i] > roachPos.z + F.streakBehind || Math.abs(this.x[i] - roachPos.x) > F.streakRadiusX * 1.3) {
        this._respawn(i, roachPos, true);
      }
      const o = i * 6;
      this.pos[o] = this.x[i];
      this.pos[o + 1] = this.y[i];
      this.pos[o + 2] = this.z[i];
      this.pos[o + 3] = this.x[i];
      this.pos[o + 4] = this.y[i];
      this.pos[o + 5] = this.z[i] + len;
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
  }

  reset() {
    this.ready = false;
  }
}
