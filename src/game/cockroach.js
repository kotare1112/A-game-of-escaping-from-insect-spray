import * as THREE from 'three';
import { CONFIG } from './config.js';

const C = CONFIG.cockroach;
const LEG_NAMES = ['Leg_L1', 'Leg_L2', 'Leg_L3', 'Leg_R1', 'Leg_R2', 'Leg_R3'];
// 三脚歩行：L1・R2・L3 と R1・L2・R3 が交互
const LEG_PHASE = { Leg_L1: 0, Leg_R2: 0, Leg_L3: 0, Leg_R1: Math.PI, Leg_L2: Math.PI, Leg_R3: Math.PI };

function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class Cockroach {
  constructor(gltf) {
    this.group = new THREE.Group(); // ワールド位置・向き
    this.flip = new THREE.Group(); // 裏返し用
    this.model = gltf.scene.getObjectByName('Cockroach') || gltf.scene;
    if (!gltf.scene.getObjectByName('Cockroach')) console.warn('Cockroach ノードが見つかりません');
    this.group.add(this.flip);
    this.flip.add(this.model);
    this.group.scale.setScalar(C.scale);
    this.model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    this.legs = [];
    for (const name of LEG_NAMES) {
      const o = this.model.getObjectByName(name);
      if (!o) {
        console.warn(`${name} が見つかりません`);
        continue;
      }
      this.legs.push({
        obj: o,
        base: o.rotation.clone(),
        phase: LEG_PHASE[name],
        side: o.position.x >= 0 ? 1 : -1,
        rnd: Math.random() * 6.28,
      });
    }
    this.antennae = [];
    for (const name of ['Antenna_L', 'Antenna_R']) {
      const o = this.model.getObjectByName(name);
      if (!o) {
        console.warn(`${name} が見つかりません`);
        continue;
      }
      this.antennae.push({ obj: o, base: o.rotation.clone(), rnd: Math.random() * 6.28 });
    }
    this.reset();
  }

  reset() {
    this.group.position.set(0, 0, 0);
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.walkPhase = 0;
    this.time = 0;
    this.dead = false;
    this.flipT = 0;
    this.stunT = 0;
    this.group.rotation.set(0, 0, 0);
    this.flip.rotation.set(0, 0, 0);
    this.flip.position.set(0, 0, 0);
  }

  get position() {
    return this.group.position;
  }

  get speed() {
    return this.velocity.length();
  }

  // 障害物に正面衝突したとき：速度を落とし、しばらく最高速度を下げる
  stun(keep) {
    this.velocity.multiplyScalar(keep);
    this.stunT = 1;
  }

  die() {
    this.dead = true;
  }

  update(dt, input) {
    this.time += dt;
    if (!this.dead) this._move(dt, input);
    else this.velocity.set(0, 0, 0);
    this._animate(dt);
  }

  _move(dt, input) {
    this.stunT = Math.max(0, this.stunT - dt / C.stunDuration);
    const top = C.maxSpeed * (1 - C.stunSlow * this.stunT);
    const tx = input.x * top;
    const tz = -input.y * top; // 画面の上 = 前方 = -Z
    const k = Math.min(1, C.accelRate * dt);
    this.velocity.x += (tx - this.velocity.x) * k;
    this.velocity.z += (tz - this.velocity.z) * k;

    const p = this.group.position;
    p.x += this.velocity.x * dt;
    p.z += this.velocity.z * dt;
    if (p.x > C.wallX) { p.x = C.wallX; this.velocity.x = Math.min(0, this.velocity.x); }
    if (p.x < -C.wallX) { p.x = -C.wallX; this.velocity.x = Math.max(0, this.velocity.x); }
    if (p.z > 0) { p.z = 0; this.velocity.z = Math.min(0, this.velocity.z); }

    if (this.speed > 0.05) {
      const target = Math.atan2(-this.velocity.x, -this.velocity.z);
      this.yaw += angleDiff(this.yaw, target) * Math.min(1, C.turnRate * dt);
    }
    this.group.rotation.y = this.yaw;
  }

  _animate(dt) {
    const speed = this.speed;
    this.walkPhase += speed * C.legSpeedPerMps * dt;

    // 死亡時は裏返る
    if (this.dead) {
      this.flipT = Math.min(1, this.flipT + dt / C.flipDuration);
      const e = this.flipT * this.flipT * (3 - 2 * this.flipT);
      this.flip.rotation.z = Math.PI * e;
      this.flip.position.y = 0.016 * Math.sin(Math.PI * this.flipT) + (this.flipT >= 1 ? 0.016 : 0);
    }

    for (const leg of this.legs) {
      const o = leg.obj;
      o.rotation.copy(leg.base);
      if (this.dead) {
        const s = Math.sin(this.time * C.deathTwitchSpeed + leg.rnd * 3);
        o.rotation.y += s * C.deathTwitchAngle;
        o.rotation.z += leg.side * Math.max(0, Math.sin(this.time * C.deathTwitchSpeed * 0.7 + leg.rnd)) * C.deathTwitchAngle;
      } else if (speed > 0.03) {
        const amp = Math.min(1, speed / C.maxSpeed);
        const ph = this.walkPhase + leg.phase;
        o.rotation.y += Math.sin(ph) * C.legSwingAngle * amp;
        o.rotation.z += leg.side * Math.max(0, Math.cos(ph)) * C.legLiftAngle * amp;
      }
    }

    for (const a of this.antennae) {
      const o = a.obj;
      o.rotation.copy(a.base);
      o.rotation.y += Math.sin(this.time * C.antennaSpeed + a.rnd) * C.antennaSwing;
      o.rotation.x += Math.sin(this.time * C.antennaSpeed * 0.7 + a.rnd * 2) * C.antennaSwing * 0.4;
    }
  }
}
