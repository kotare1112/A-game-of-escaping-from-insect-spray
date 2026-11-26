import * as THREE from 'three';
import { CONFIG } from './config.js';

const S = CONFIG.spray;
const H = CONFIG.humans;
const rand = (a, b) => a + Math.random() * (b - a);
const DEG = Math.PI / 180;

// 柔らかい粒（中心が濃く、縁へ向けて消える放射グラデーション）
function makePuffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  grad.addColorStop(0.65, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 床の湿った跡（縁がぼやけた暗い円）
function makeDecalTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(20,24,30,0.9)');
  grad.addColorStop(0.6, 'rgba(20,24,30,0.7)');
  grad.addColorStop(0.9, 'rgba(20,24,30,0.2)');
  grad.addColorStop(1, 'rgba(20,24,30,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const JET = 0;
const MIST = 1;

// 粒（ジェット＋霧）のプール。InstancedMesh でビルボード表示する
class ParticlePool {
  constructor(scene, puffTex) {
    const n = S.particleMax;
    this.n = n;
    this.next = 0;
    this.kind = new Uint8Array(n); // 0: ジェット, 1: 霧
    this.alive = new Uint8Array(n);
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.pz = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.vz = new Float32Array(n);
    this.age = new Float32Array(n);
    this.life = new Float32Array(n);
    this.drag = new Float32Array(n);
    this.phase = new Float32Array(n);
    this.density = new Float32Array(n); // 現在の濃さ（0〜1）。当たり判定に使う

    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    geo.setAttribute('uv', quad.attributes.uv);
    this.iOffset = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.iSize = new THREE.InstancedBufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage);
    this.iAlpha = new THREE.InstancedBufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage);
    this.iColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    geo.setAttribute('iOffset', this.iOffset);
    geo.setAttribute('iSize', this.iSize);
    geo.setAttribute('iAlpha', this.iAlpha);
    geo.setAttribute('iColor', this.iColor);
    geo.instanceCount = n;

    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: puffTex } },
      transparent: true,
      depthWrite: false,
      vertexShader: `
        attribute vec3 iOffset; attribute float iSize; attribute float iAlpha; attribute vec3 iColor;
        varying vec2 vUv; varying float vAlpha; varying vec3 vColor; varying float vWy;
        void main() {
          vUv = uv; vAlpha = iAlpha; vColor = iColor;
          // 頂点のワールド高さ（床へ近づくほど消すため）
          vWy = iOffset.y + iSize * (position.x * viewMatrix[1][0] + position.y * viewMatrix[1][1]);
          vec4 mv = viewMatrix * vec4(iOffset, 1.0);
          mv.xy += position.xy * iSize;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D uMap;
        varying vec2 vUv; varying float vAlpha; varying vec3 vColor; varying float vWy;
        void main() {
          float a = texture2D(uMap, vUv).a * vAlpha * smoothstep(0.0, 0.05, vWy);
          if (a < 0.003) discard;
          gl_FragColor = vec4(vColor, a);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
    this.clear();
  }

  _slot() {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    return i;
  }

  _color(i) {
    // 白〜ごく薄い黄緑
    const t = Math.random();
    const a = this.iColor.array;
    a[i * 3] = 0.98 - 0.08 * t;
    a[i * 3 + 1] = 1.0 - 0.02 * t;
    a[i * 3 + 2] = 0.97 - 0.12 * t;
  }

  // ノズルから狙い点へ向けてジェットの粒を 1 つ出す
  // lead: 今フレームのうちの経過秒数（1 フレームぶんの粒が同じ場所に固まらないようにずらす）
  emitJet(from, to, lead = 0) {
    const i = this._slot();
    this.kind[i] = JET;
    this.alive[i] = 1;
    this.age[i] = 0;
    this.life[i] = rand(S.jetLifeMin, S.jetLifeMax);
    this.drag[i] = S.jetDrag * rand(0.9, 1.1);
    this.px[i] = from.x;
    this.py[i] = from.y;
    this.pz[i] = from.z;

    let dx = to.x - from.x;
    let dy = to.y - from.y;
    let dz = to.z - from.z;
    const dist = Math.hypot(dx, dy, dz) || 1;
    dx /= dist;
    dy /= dist;
    dz /= dist;
    // 狙い点の近くまで届く初速（空気抵抗で減速するぶんを見込む）
    const reach = 1 - Math.exp(-this.drag[i] * this.life[i]);
    const v0 = THREE.MathUtils.clamp((dist * this.drag[i]) / reach, S.jetSpeedMin, S.jetSpeedMax);

    // 円錐状に散らす：中心線に垂直な 2 軸 u, w
    let ux = dy * 0 - dz * 1; // dir × (0,1,0) の x 成分 = -dz
    let uz = dx; // dir × (0,1,0) の z 成分 = dx
    const ul = Math.hypot(ux, uz) || 1;
    ux /= ul;
    uz /= ul;
    // w = dir × u
    const wx = dy * uz;
    const wy = dz * ux - dx * uz;
    const wz = -dy * ux;
    const ang = rand(S.jetConeMinDeg, S.jetConeMaxDeg) * DEG * Math.sqrt(Math.random());
    const az = Math.random() * Math.PI * 2;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const cz = Math.cos(az);
    const sz = Math.sin(az);
    this.vx[i] = (dx * ca + (ux * cz + wx * sz) * sa) * v0;
    this.vy[i] = (dy * ca + (wy * sz) * sa) * v0;
    this.vz[i] = (dz * ca + (uz * cz + wz * sz) * sa) * v0;
    // 発生後 lead 秒ぶんだけ先へ進めておく
    const damp = Math.exp(-this.drag[i] * lead);
    this.px[i] += this.vx[i] * lead * (1 + damp) * 0.5;
    this.py[i] += this.vy[i] * lead * (1 + damp) * 0.5;
    this.pz[i] += this.vz[i] * lead * (1 + damp) * 0.5;
    this.age[i] = lead;
    this._color(i);
    this.iSize.array[i] = 0;
    this.iAlpha.array[i] = 0;
  }

  emitMist(x, y, z) {
    const i = this._slot();
    this.kind[i] = MIST;
    this.alive[i] = 1;
    this.age[i] = 0;
    this.life[i] = rand(S.mistLifeMin, S.mistLifeMax);
    this.drag[i] = 0.8;
    this.px[i] = x + rand(-0.04, 0.04);
    this.py[i] = THREE.MathUtils.clamp(y, 0.03, 0.09) + rand(0, 0.04);
    this.pz[i] = z + rand(-0.04, 0.04);
    const a = Math.random() * Math.PI * 2;
    const sp = rand(0.3, 1) * S.mistDrift;
    this.vx[i] = Math.cos(a) * sp;
    this.vy[i] = -S.mistSink * rand(0.5, 1.2);
    this.vz[i] = Math.sin(a) * sp;
    this.phase[i] = Math.random() * 6.28;
    this._color(i);
    this.iSize.array[i] = 0;
    this.iAlpha.array[i] = 0;
  }

  update(dt) {
    const off = this.iOffset.array;
    const size = this.iSize.array;
    const alpha = this.iAlpha.array;
    for (let i = 0; i < this.n; i++) {
      if (!this.alive[i]) continue;
      this.age[i] += dt;
      const age = this.age[i];
      const t = age / this.life[i];
      const damp = Math.exp(-this.drag[i] * dt);
      this.vx[i] *= damp;
      this.vz[i] *= damp;

      if (this.kind[i] === JET) {
        this.vy[i] *= damp;
        this.px[i] += this.vx[i] * dt;
        this.py[i] += this.vy[i] * dt;
        this.pz[i] += this.vz[i] * dt;
        if (t >= 1 || this.py[i] <= S.jetFloorKill) {
          // ジェットの先端：床付近で霧に置き換える
          if (Math.random() < S.mistChance) this.emitMist(this.px[i], this.py[i], this.pz[i]);
          this.alive[i] = 0;
          this.density[i] = 0;
          size[i] = 0;
          alpha[i] = 0;
          continue;
        }
        // ノズル付近は細く濃く、先へ行くほど大きく薄く
        size[i] = S.jetSizeStart + (S.jetSizeEnd - S.jetSizeStart) * Math.pow(t, 0.8);
        const a = Math.min(1, age * 40) * Math.pow(1 - t, 1.3);
        alpha[i] = S.jetAlpha * a;
        this.density[i] = 0.6 * a;
      } else {
        // ふわっと膨らみながら漂い、ゆっくり沈んで消える
        const sway = Math.sin(age * 1.3 + this.phase[i]) * 0.04;
        this.px[i] += (this.vx[i] + sway) * dt;
        this.py[i] = Math.max(0.02, this.py[i] + this.vy[i] * dt);
        this.pz[i] += (this.vz[i] + Math.cos(age * 1.1 + this.phase[i]) * 0.04) * dt;
        if (t >= 1) {
          this.alive[i] = 0;
          this.density[i] = 0;
          size[i] = 0;
          alpha[i] = 0;
          continue;
        }
        const grow = 1 - Math.exp(-age * 2.2);
        size[i] = S.mistSizeStart + (S.mistSizeEnd - S.mistSizeStart) * grow;
        const a = Math.min(1, age / 0.25) * Math.pow(1 - t, 1.5);
        alpha[i] = S.mistAlpha * a;
        this.density[i] = a;
      }
      off[i * 3] = this.px[i];
      off[i * 3 + 1] = this.py[i];
      off[i * 3 + 2] = this.pz[i];
    }
    this.iOffset.needsUpdate = true;
    this.iSize.needsUpdate = true;
    this.iAlpha.needsUpdate = true;
    this.iColor.needsUpdate = true;
  }

  // 床付近の粒の濃さの合計：高さ hitMaxHeight 以下、(x, z) から hitRadius 以内
  densityAt(x, z) {
    const r2 = S.hitRadius * S.hitRadius;
    let sum = 0;
    for (let i = 0; i < this.n; i++) {
      if (!this.alive[i] || this.py[i] > S.hitMaxHeight) continue;
      const dx = this.px[i] - x;
      const dz = this.pz[i] - z;
      if (dx * dx + dz * dz <= r2) sum += this.density[i];
    }
    return sum;
  }

  clear() {
    this.alive.fill(0);
    this.density.fill(0);
    this.iSize.array.fill(0);
    this.iAlpha.array.fill(0);
    this.iSize.needsUpdate = true;
    this.iAlpha.needsUpdate = true;
  }
}

// 床の湿った跡（プール）
class Decals {
  constructor(scene, tex) {
    this.items = [];
    this.next = 0;
    const geo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < S.decalMax; i++) {
      const m = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          map: tex, transparent: true, depthWrite: false, opacity: 0,
          polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.004 + i * 0.00005;
      m.visible = false;
      scene.add(m);
      this.items.push({ mesh: m, age: 1e9 });
    }
  }

  spawn(x, z) {
    const d = this.items[this.next];
    this.next = (this.next + 1) % this.items.length;
    d.age = 0;
    d.mesh.position.x = x;
    d.mesh.position.z = z;
    d.mesh.scale.setScalar(rand(0.24, 0.4));
    d.mesh.rotation.z = Math.random() * 6.28;
    d.mesh.visible = true;
  }

  update(dt) {
    for (const d of this.items) {
      if (!d.mesh.visible) continue;
      d.age += dt;
      const t = d.age / S.decalLife;
      if (t >= 1) {
        d.mesh.visible = false;
        continue;
      }
      d.mesh.material.opacity = S.decalAlpha * Math.min(1, d.age * 8) * (1 - t);
    }
  }

  clear() {
    for (const d of this.items) {
      d.mesh.visible = false;
      d.age = 1e9;
    }
  }
}

// 人 1 人ぶんのスプレー状態（噴射／休みのタイマー、狙い点、粒と跡の発生）
class Sprayer {
  constructor(human) {
    this.human = human;
    this.aim = new THREE.Vector2();
    this.reset();
  }

  reset() {
    const p = this.human.position;
    this.aim.set(p.x, p.z - 1);
    this.spraying = false;
    this.grace = rand(S.startGraceMin, S.startGraceMax); // 開始直後はすぐ噴射しない
    this.burst = 0; // 連続して噴射している時間
    this.pause = 0; // 持ち直しの休みの残り時間
    this.emitAcc = 0;
    this.decalAcc = 0;
    this.human.armAim = 0;
  }

  update(dt, roachPos, aimSpeed, sys) {
    const hp = this.human.position;
    // ゴキブリが射程内に入ったらすぐ噴射し、射程内にいる間は噴射を続ける。
    // 長く噴射したら一瞬だけ休む（缶の持ち直し）。射程外に出たら止める。
    this.grace = Math.max(0, this.grace - dt);
    this.pause = Math.max(0, this.pause - dt);
    const inRange = Math.hypot(roachPos.x - hp.x, roachPos.z - hp.z) <= S.triggerRange;
    const want = inRange && this.grace <= 0 && this.pause <= 0;
    if (want && !this.spraying) {
      this.spraying = true;
      this.burst = 0;
      this.emitAcc = 0;
      // 狙い点はゴキブリの少し手前（人間側）から追い始める
      const bx = hp.x - roachPos.x;
      const bz = hp.z - roachPos.z;
      const bd = Math.hypot(bx, bz) || 1;
      this.aim.set(roachPos.x + (bx / bd) * S.aimStartBehind, roachPos.z + (bz / bd) * S.aimStartBehind);
    } else if (!want && this.spraying) {
      this.spraying = false;
    }
    if (this.spraying) {
      this.burst += dt;
      if (this.burst >= S.maxBurstTime) {
        this.spraying = false;
        this.pause = S.burstPauseTime;
      }
    }

    if (!this.spraying) {
      this.human.armAim = 0;
      return;
    }

    // 狙い点はゴキブリへ一定速度で追従（瞬時には合わない）
    const dx = roachPos.x - this.aim.x;
    const dz = roachPos.z - this.aim.y;
    const d = Math.hypot(dx, dz);
    const step = Math.min(d, aimSpeed * dt);
    if (d > 1e-5) {
      this.aim.x += (dx / d) * step;
      this.aim.y += (dz / d) * step;
    }
    // 足元から水平 aimMaxRange 以内に制限
    const ax = this.aim.x - hp.x;
    const az = this.aim.y - hp.z;
    const ad = Math.hypot(ax, az);
    if (ad > S.aimMaxRange) {
      this.aim.x = hp.x + (ax / ad) * S.aimMaxRange;
      this.aim.y = hp.z + (az / ad) * S.aimMaxRange;
    }

    // 右腕を狙い点の方へ（モデルのポーズが指す位置からのピッチ差だけ回す）
    const reach = Math.hypot(this.aim.x - hp.x, this.aim.y - hp.z);
    const delta = Math.atan2(reach, H.armAimShoulderHeight) - Math.atan2(H.armAimBaseReach, H.armAimShoulderHeight);
    this.human.armAim = THREE.MathUtils.clamp(delta, -H.armAimMax, H.armAimMax);

    // ジェット
    this.emitAcc += S.jetRate * dt;
    if (this.emitAcc >= 1) {
      const from = this.human.getNozzlePosition(sys.v1);
      sys.v2.set(this.aim.x, 0.02, this.aim.y);
      while (this.emitAcc >= 1) {
        this.emitAcc -= 1;
        sys.particles.emitJet(from, sys.v2, Math.random() * dt);
      }
    }

    // 床の跡
    this.decalAcc += dt;
    if (this.decalAcc >= S.decalInterval) {
      this.decalAcc = 0;
      sys.decals.spawn(this.aim.x + rand(-0.12, 0.12), this.aim.y + rand(-0.12, 0.12));
    }
  }
}

export class SpraySystem {
  constructor(scene, humans) {
    this.particles = new ParticlePool(scene, makePuffTexture());
    this.decals = new Decals(scene, makeDecalTexture());
    this.sprayers = humans.map((h) => new Sprayer(h));
    this.v1 = new THREE.Vector3();
    this.v2 = new THREE.Vector3();
    this.density = 0; // 直近のゴキブリ位置の濃さ（デバッグ・調整用）
  }

  reset() {
    this.particles.clear();
    this.decals.clear();
    this.sprayers.forEach((s) => s.reset());
    this.density = 0;
  }

  get sprayingFlags() {
    return this.sprayers.map((s) => s.spraying);
  }

  // 人間の位置更新後に呼ぶ。ramp: 0〜1（人間の速度の上がり具合）。戻り値：ゴキブリが被弾中か
  update(dt, roachPos, ramp) {
    const aimSpeed = S.aimSpeedStart + (S.aimSpeedEnd - S.aimSpeedStart) * ramp;
    for (const s of this.sprayers) s.update(dt, roachPos, aimSpeed, this);
    this.particles.update(dt);
    this.decals.update(dt);
    this.density = this.particles.densityAt(roachPos.x, roachPos.z);
    return this.density > S.hitThreshold;
  }

  // 噴射停止中の見た目の更新だけ行う（タイトル・ゲームオーバー）
  idle(dt) {
    this.particles.update(dt);
    this.decals.update(dt);
  }
}
