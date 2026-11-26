import * as THREE from 'three';
import { CONFIG } from './config.js';

const C = CONFIG.cockroach;
const B = CONFIG.boost;
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

    // 前翅（付け根が原点）
    this.wings = [];
    for (const name of ['Wing_L', 'Wing_R']) {
      const o = this.model.getObjectByName(name);
      if (!o) {
        console.warn(`${name} が見つかりません`);
        continue;
      }
      o.rotation.order = 'YZX';
      this.wings.push({ obj: o, side: name === 'Wing_L' ? -1 : 1 });
    }

    // 後翅：前翅の下に付ける薄い半透明の膜。飛行中だけ表示して羽ばたかせる
    const hwGeo = new THREE.CircleGeometry(1, 20);
    hwGeo.rotateX(-Math.PI / 2);
    const hwMat = new THREE.MeshBasicMaterial({
      color: C.hindWingColor,
      transparent: true,
      opacity: C.hindWingOpacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.hindWings = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.rotation.order = 'YZX';
      pivot.position.set(side * 0.002, 0.0105, -0.0115);
      const m = new THREE.Mesh(hwGeo, hwMat);
      m.scale.set(C.hindWingWidth / 2, 1, C.hindWingLength / 2);
      m.position.set((side * C.hindWingWidth) / 2, 0, C.hindWingLength / 2);
      pivot.add(m);
      pivot.visible = false;
      this.model.add(pivot);
      this.hindWings.push({ pivot, side });
    }

    // 空中で高さが分かる丸い影（床に置く。高さに応じて薄く・小さく）
    const shGeo = new THREE.CircleGeometry(1, 20);
    shGeo.rotateX(-Math.PI / 2);
    this.blob = new THREE.Mesh(
      shGeo,
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    this.blob.visible = false;
    this.group.add(this.blob);

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
    this.boostT = 0; // スピードアップの残り時間 (秒)
    this.boostLevel = 0; // 効果の強さ 0〜1（終わりの fadeOut 秒で 1→0）
    // ジャンプ・飛行
    this.y = 0;
    this.vy = 0;
    this.onGround = true;
    this.flying = false;
    this.flyGauge = C.flyMaxTime; // 残り飛行時間 (秒)
    this.flyLocked = false; // ゲージが空になって、回復待ち
    this.holdTime = 0;
    this.tuck = 0;
    this.wingOpen = 0;
    this.wingJump = 0;
    this.flapPhase = 0;
    this.landT = 99;
    this.landKick = 0;
    this.model.scale.set(1, 1, 1);
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

  // 空中で何かに当たったとき：飛行を終わらせて落とす（飛行ゲージは空になり、地上で一定まで回復するまで飛べない）
  knockDown() {
    if (this.onGround || this.dead) return;
    this.flying = false;
    this.flyGauge = 0;
    this.flyLocked = true;
    this.vy = Math.min(this.vy, -C.knockDownSpeed);
  }

  // スピードアップ開始（効果中の再取得は残り時間をリセット）
  activateBoost() {
    this.boostT = B.duration;
    this.boostLevel = 1;
  }

  // 効果の残り割合 0〜1
  get boostRatio() {
    return this.boostT / B.duration;
  }

  die() {
    this.dead = true;
    this.flying = false;
  }

  // 飛行ゲージの割合 0〜1
  get flyRatio() {
    return this.flyGauge / C.flyMaxTime;
  }

  // jump: { pressed: 押した瞬間, held: 押し続け中 }
  update(dt, input, jump = { pressed: false, held: false }) {
    this.time += dt;
    this.boostT = Math.max(0, this.boostT - dt);
    const bk = Math.min(1, this.boostT / B.fadeOut);
    this.boostLevel = bk * bk * (3 - 2 * bk);
    if (!this.dead) this._move(dt, input);
    else this.velocity.set(0, 0, 0);
    this._vertical(dt, jump);
    this._animate(dt);
  }

  _vertical(dt, jump) {
    const held = !this.dead && jump.held;
    this.holdTime = held ? this.holdTime + dt : 0;

    if (!this.dead && this.onGround && jump.pressed) {
      this.vy = Math.sqrt(2 * C.gravity * C.jumpHeight);
      this.onGround = false;
      this.holdTime = 0;
    }

    // 飛行：空中でボタンを押し続けていて、ゲージが残っている間
    this.flying =
      !this.dead && !this.onGround && held && this.holdTime >= C.flyHoldDelay && this.flyGauge > 0 && !this.flyLocked;

    if (this.flying) {
      this.flyGauge = Math.max(0, this.flyGauge - dt);
      if (this.flyGauge <= 0) {
        this.flyLocked = true;
        this.flying = false;
      }
    }

    if (this.flying) {
      const target = C.flyHeight + Math.sin(this.time * C.flyBobSpeed) * C.flyBobAmount;
      this.vy = THREE.MathUtils.clamp((target - this.y) * C.flyRiseGain, -C.flyRiseSpeed, C.flyRiseSpeed);
      this.y += this.vy * dt;
    } else if (!this.onGround) {
      this.vy -= C.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        if (this.vy < -0.3) {
          this.landKick = Math.min(1, -this.vy / 2);
          this.landT = 0;
        }
        this.y = 0;
        this.vy = 0;
        this.onGround = true;
      }
    }

    // 地上にいる間にゲージが回復する
    if (this.onGround && this.flyGauge < C.flyMaxTime) {
      this.flyGauge = Math.min(C.flyMaxTime, this.flyGauge + (dt * C.flyMaxTime) / C.flyRechargeTime);
      if (this.flyLocked && this.flyGauge >= C.flyMaxTime * C.flyResumeRatio) this.flyLocked = false;
    }
    this.group.position.y = this.y;
  }

  _move(dt, input) {
    this.stunT = Math.max(0, this.stunT - dt / C.stunDuration);
    const top = C.maxSpeed * (1 - C.stunSlow * this.stunT) * (this.flying ? C.flySpeedMul : 1) * (1 + (B.speedMul - 1) * this.boostLevel);
    const tx = input.x * top;
    const tz = -input.y * top; // 画面の上 = 前方 = -Z
    const k = Math.min(1, C.accelRate * (1 + (B.accelMul - 1) * this.boostLevel) * dt);
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

  // 前翅は付け根まわりに開いて持ち上げる。後翅は飛行中だけ表示して羽ばたく
  _animateWings(dt) {
    const open = this.wingOpen;
    for (const w of this.wings) {
      w.obj.rotation.set(
        -(open * C.wingOpenLift + (this.wingJump - open) * C.wingJumpLift), // 後ろ端を持ち上げる
        w.side * open * C.wingOpenYaw, // 外側へ開く
        w.side * open * C.wingOpenRoll, // 外側を持ち上げる
      );
    }
    // 位相の進みは 1 フレームあたりに上限を付ける（高速すぎて画面のフレームレートで破綻するのを防ぐ）
    this.flapPhase += Math.min(Math.PI * 2 * C.hindWingFlapHz * dt, C.hindWingFlapMaxStep);
    const flap = Math.sin(this.flapPhase);
    for (const hw of this.hindWings) {
      hw.pivot.visible = open > 0.05;
      hw.pivot.rotation.set(0, hw.side * C.hindWingSpread * open, hw.side * (0.15 + flap * C.hindWingFlapAngle) * open);
    }
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

    // 空中は脚を体に引き寄せる
    const airborne = !this.onGround && !this.dead;
    this.tuck += ((airborne ? 1 : 0) - this.tuck) * Math.min(1, C.tuckRate * dt);
    const wk = Math.min(1, C.wingRate * dt);
    this.wingOpen += ((this.flying ? 1 : 0) - this.wingOpen) * wk;
    this.wingJump += ((airborne ? 1 : 0) - this.wingJump) * wk;
    this._animateWings(dt);

    // 着地の弾み
    this.landT += dt;
    const squash = C.landBounce * this.landKick * Math.exp(-C.landBounceDecay * this.landT) * Math.cos(this.landT * 20);
    this.model.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);

    for (const leg of this.legs) {
      const o = leg.obj;
      o.rotation.copy(leg.base);
      if (this.dead) {
        const s = Math.sin(this.time * C.deathTwitchSpeed + leg.rnd * 3);
        o.rotation.y += s * C.deathTwitchAngle;
        o.rotation.z += leg.side * Math.max(0, Math.sin(this.time * C.deathTwitchSpeed * 0.7 + leg.rnd)) * C.deathTwitchAngle;
      } else if (speed > 0.03 && this.onGround) {
        const amp = Math.min(1, speed / C.maxSpeed);
        const ph = this.walkPhase + leg.phase;
        o.rotation.y += Math.sin(ph) * C.legSwingAngle * amp;
        o.rotation.z += leg.side * Math.max(0, Math.cos(ph)) * C.legLiftAngle * amp;
      }
      if (this.tuck > 0.001) {
        o.rotation.z += leg.side * this.tuck * C.tuckLegLift;
        o.rotation.y += this.tuck * C.tuckLegSwing * (leg.phase === 0 ? 1 : -1);
      }
    }

    // 丸い影
    const h = this.y;
    const sh = THREE.MathUtils.clamp(h / 0.04, 0, 1);
    this.blob.visible = sh > 0.01;
    if (this.blob.visible) {
      this.blob.position.y = -h / C.scale + 0.0015;
      const r = C.shadowRadius * (1 - 0.3 * Math.min(1, h / 0.5));
      this.blob.scale.set(r, 1, r);
      this.blob.material.opacity = C.shadowOpacity * sh * (1 - 0.5 * Math.min(1, h / 0.5));
    }

    for (const a of this.antennae) {
      const o = a.obj;
      o.rotation.copy(a.base);
      o.rotation.y += Math.sin(this.time * C.antennaSpeed + a.rnd) * C.antennaSwing;
      o.rotation.x += Math.sin(this.time * C.antennaSpeed * 0.7 + a.rnd * 2) * C.antennaSwing * 0.4;
    }
  }
}
