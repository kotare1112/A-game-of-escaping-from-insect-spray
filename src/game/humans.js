import * as THREE from 'three';
import { CONFIG } from './config.js';

const H = CONFIG.humans;

function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
const rand = (a, b) => a + Math.random() * (b - a);

function findNode(root, name) {
  const o = root.getObjectByName(name);
  if (!o) console.warn(`${name} が見つかりません`);
  return o || null;
}

export class Human {
  constructor(gltf, index, offsetX) {
    this.index = index;
    this.offsetX = offsetX;
    this.group = new THREE.Group();
    this.model = gltf.scene.getObjectByName('Human') || gltf.scene;
    if (!gltf.scene.getObjectByName('Human')) console.warn('Human ノードが見つかりません');
    this.group.add(this.model);
    // 半透明にするため、マテリアルは人ごとに複製する（共有されていた場合の対策）
    const cloned = new Map();
    this.materials = [];
    const own = (m) => {
      if (!cloned.has(m)) {
        const c = m.clone();
        cloned.set(m, c);
        this.materials.push(c);
      }
      return cloned.get(m);
    };
    this.model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
      }
    });
    this.opacity = 1;
    this.armAim = 0; // 噴射時に腕を狙い点へ向ける追加回転の目標 (rad)
    this.armAimCur = 0;

    this.legL = this._part('Leg_L');
    this.legR = this._part('Leg_R');
    this.armL = this._part('Arm_L');
    this.armR = this._part('Arm_R');
    this.nozzle = findNode(this.model, 'Spray_Nozzle');

    this.followBack = rand(H.followBackMin, H.followBackMax);
    this.reset(0);
  }

  _part(name) {
    const o = findNode(this.model, name);
    return o ? { obj: o, base: o.rotation.clone() } : null;
  }

  // 初期配置。roachZ はゴキブリの z
  reset(roachZ) {
    const back = rand(H.startBackMin, H.startBackMax);
    this.group.position.set(this.offsetX * 1.1, 0, roachZ + back + (Math.random() - 0.5) * 0.4);
    this.yaw = 0;
    this.group.rotation.y = 0;
    this.velocity = new THREE.Vector3();
    this.walkPhase = Math.random() * 6.28;
    this.followBack = rand(H.followBackMin, H.followBackMax);
    this.model.position.y = 0;
    this.armAim = 0;
    this.armAimCur = 0;
    this.setOpacity(1);
  }

  setOpacity(v) {
    if (Math.abs(v - this.opacity) < 1e-3 && (v < 0.999) === (this.opacity < 0.999)) return;
    this.opacity = v;
    const transparent = v < 0.999;
    for (const m of this.materials) {
      if (m.transparent !== transparent) {
        m.transparent = transparent;
        m.needsUpdate = true;
      }
      m.opacity = v;
    }
  }

  get position() {
    return this.group.position;
  }

  // 噴射口のワールド位置を out に入れる
  getNozzlePosition(out) {
    this.group.updateMatrixWorld(true);
    if (this.nozzle) return this.nozzle.getWorldPosition(out);
    return out.set(0.2, 0.8, -0.5).applyMatrix4(this.group.matrixWorld);
  }

  update(dt, roachPos, maxSpeed, others, spraying, time, fadeTarget = 1) {
    const p = this.group.position;
    const tx = THREE.MathUtils.clamp(roachPos.x + this.offsetX, -H.wallX, H.wallX);
    const tz = roachPos.z + this.followBack;
    let dx = tx - p.x;
    let dz = tz - p.z;
    const dist = Math.hypot(dx, dz);
    let want = Math.min(maxSpeed, dist * H.followGain);
    const vx = dist > 1e-4 ? (dx / dist) * want : 0;
    const vz = dist > 1e-4 ? (dz / dist) * want : 0;
    const k = Math.min(1, 6 * dt);
    this.velocity.x += (vx - this.velocity.x) * k;
    this.velocity.z += (vz - this.velocity.z) * k;
    p.x += this.velocity.x * dt;
    p.z += this.velocity.z * dt;

    // 人同士の分離
    for (const o of others) {
      if (o === this) continue;
      const sx = p.x - o.position.x;
      const sz = p.z - o.position.z;
      const d = Math.hypot(sx, sz);
      if (d < H.minSeparation) {
        const push = (H.minSeparation - d) * 0.5;
        if (d > 1e-4) {
          p.x += (sx / d) * push;
          p.z += (sz / d) * push;
        } else {
          p.x += (Math.random() - 0.5) * 0.05;
        }
      }
    }
    p.x = THREE.MathUtils.clamp(p.x, -H.wallX, H.wallX);

    // ゴキブリの方へ体を向ける
    const fx = roachPos.x - p.x;
    const fz = roachPos.z - p.z;
    const target = Math.atan2(-fx, -fz);
    this.yaw += angleDiff(this.yaw, target) * Math.min(1, H.turnRate * dt);
    this.group.rotation.y = this.yaw;

    // 歩行アニメ
    const speed = this.velocity.length();
    this.walkPhase += speed * H.walkPhasePerMps * dt;
    const amp = Math.min(1, speed / H.startSpeed);
    const s = Math.sin(this.walkPhase) * amp;
    if (this.legL) this.legL.obj.rotation.x = this.legL.base.x + s * H.legSwingAngle;
    if (this.legR) this.legR.obj.rotation.x = this.legR.base.x - s * H.legSwingAngle;
    if (this.armL) this.armL.obj.rotation.x = this.armL.base.x - s * H.armSwingAngle;
    if (this.armR) {
      const w = spraying ? Math.sin(time * 18 + this.index) * H.sprayArmWobble : 0;
      this.armAimCur += (this.armAim - this.armAimCur) * Math.min(1, H.armAimRate * dt);
      this.armR.obj.rotation.x = this.armR.base.x + w + this.armAimCur;
    }
    this.model.position.y = Math.abs(Math.cos(this.walkPhase)) * H.bobHeight * amp;

    // 視界を遮るときは半透明へ滑らかに
    this.setOpacity(this.opacity + (fadeTarget - this.opacity) * Math.min(1, H.fadeRate * dt));
  }
}

export class HumanGroup {
  constructor(gltfs) {
    const offsets = H.lateralOffsets;
    this.humans = gltfs.map((g, i) => new Human(g, i, offsets[i % offsets.length]));
    this.elapsed = 0;
    this._resetSurge();
  }

  _resetSurge() {
    this.surgeIndex = -1;
    this.surgeLeft = 0;
    this.surgeWait = rand(H.surgeIntervalMin, H.surgeIntervalMax);
  }

  addTo(scene) {
    for (const h of this.humans) scene.add(h.group);
  }

  reset(roachZ) {
    this.elapsed = 0;
    this._resetSurge();
    this.humans.forEach((h, i) => {
      h.reset(roachZ);
      h.position.x = h.offsetX * 1.1;
    });
  }

  // 0〜1：速度上限が最大に達するまでの進み具合
  get ramp() {
    return Math.min(1, this.elapsed / H.speedRampTime);
  }

  get maxSpeed() {
    return H.startSpeed + (H.maxSpeed - H.startSpeed) * this.ramp;
  }

  // カメラ〜ゴキブリの線上にいて視界を遮る人は、半透明の目標を返す
  _fadeTarget(h, camPos, roachPos) {
    const dx = roachPos.x - camPos.x;
    const dz = roachPos.z - camPos.z;
    const len2 = dx * dx + dz * dz;
    if (len2 < 1e-6) return 1;
    const t = ((h.position.x - camPos.x) * dx + (h.position.z - camPos.z) * dz) / len2;
    if (t <= 0 || t >= 1) return 1;
    const lat = Math.hypot(camPos.x + dx * t - h.position.x, camPos.z + dz * t - h.position.z);
    const rayY = camPos.y + (0.05 - camPos.y) * t; // その位置での視線の高さ
    return lat < H.fadeWidth && rayY < 1.75 ? H.fadeOpacity : 1;
  }

  update(dt, roachPos, sprayingFlags, time, camPos) {
    this.elapsed += dt;
    const ms = this.maxSpeed;

    // 突進：一定間隔でランダムな 1 人が短時間だけ速度上限が上がる（同時に 1 人まで）
    if (this.surgeLeft > 0) {
      this.surgeLeft -= dt;
      if (this.surgeLeft <= 0) this.surgeIndex = -1;
    } else {
      this.surgeWait -= dt;
      if (this.surgeWait <= 0) {
        this.surgeIndex = Math.floor(Math.random() * this.humans.length);
        this.surgeLeft = H.surgeDuration;
        this.surgeWait = rand(H.surgeIntervalMin, H.surgeIntervalMax);
      }
    }

    this.humans.forEach((h, i) => {
      const speedLimit = i === this.surgeIndex ? ms * H.surgeSpeedMul : ms;
      const fade = camPos ? this._fadeTarget(h, camPos, roachPos) : 1;
      h.update(dt, roachPos, speedLimit, this.humans, sprayingFlags[i], time, fade);
    });
  }
}
