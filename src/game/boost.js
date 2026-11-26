import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CONFIG } from './config.js';

const B = CONFIG.boost;
const R = CONFIG.room;
const rand = (a, b) => a + Math.random() * (b - a);

// ぼんやり光る丸いテクスチャ（キラキラ・光の輪郭用）
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,240,170,0.8)');
  grad.addColorStop(1, 'rgba(255,210,63,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 光る角砂糖。部屋セグメントの再利用に合わせて置き直す（プール化）。取ると消えて弾ける
export class BoostItems {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.glow = glowTexture();
    const size = B.cubeSize * B.scale;
    const cubeGeo = new RoundedBoxGeometry(size, size, size, 3, size * 0.18);
    const cubeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xfff0b0, emissiveIntensity: 0.6, roughness: 0.45,
    });
    const ringGeo = new THREE.RingGeometry(B.ringRadius - B.ringWidth, B.ringRadius, 40);
    ringGeo.rotateX(-Math.PI / 2);
    const addMat = (opacity) =>
      new THREE.MeshBasicMaterial({
        color: B.ringColor, transparent: true, opacity, blending: THREE.AdditiveBlending,
        depthWrite: false, fog: false, side: THREE.DoubleSide,
      });
    const spriteMat = (map) =>
      new THREE.SpriteMaterial({
        map, color: B.ringColor, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      });

    this.items = [];
    for (let i = 0; i < B.poolSize; i++) {
      const g = new THREE.Group();
      const cube = new THREE.Mesh(cubeGeo, cubeMat);
      cube.castShadow = true;
      const ring = new THREE.Mesh(ringGeo, addMat(B.ringOpacity));
      ring.position.y = 0.006;
      ring.renderOrder = 1;
      const halo = new THREE.Sprite(spriteMat(this.glow));
      halo.scale.setScalar(size * 3.2);
      halo.material.opacity = 0.5;
      const sparkles = [];
      for (let k = 0; k < B.sparkleCount; k++) {
        const sp = new THREE.Sprite(spriteMat(this.glow));
        sp.material.color.set(0xffffff);
        sparkles.push({ sp, a: (k / B.sparkleCount) * Math.PI * 2, ph: rand(0, 6.28), r: rand(0.7, 1.1) });
        g.add(sp);
      }
      g.add(cube, ring, halo);
      g.visible = false;
      this.group.add(g);
      this.items.push({ group: g, cube, ring, halo, sparkles, active: false, segment: -1, x: 0, z: 0, phase: 0 });
    }

    // 取得時に弾ける粒（プール）
    this.bursts = [];
    for (let i = 0; i < B.burstCount; i++) {
      const sp = new THREE.Sprite(spriteMat(this.glow));
      sp.visible = false;
      this.group.add(sp);
      this.bursts.push({ sp, life: 0, vx: 0, vy: 0, vz: 0 });
    }
    this.nextZ = 0;
    this.reset();
  }

  reset() {
    for (const it of this.items) this._release(it);
    for (const b of this.bursts) {
      b.life = 0;
      b.sp.visible = false;
    }
    // 最初のアイテムの位置（スタートから minDistance 以上先）
    this.nextZ = -(B.minDistance + 1 + rand(0, B.intervalMax - B.minDistance));
  }

  _release(it) {
    it.active = false;
    it.group.visible = false;
  }

  // 障害物を置くとき用：アイテムに近すぎる位置なら true
  isNear(x, z) {
    return this.items.some((it) => it.active && Math.hypot(it.x - x, it.z - z) < B.obstacleKeepRadius);
  }

  // セグメント（番号 segment）を zCenter に置き直すときに呼ぶ。obstacles は先に置き終えていること
  place(segment, zCenter, obstacles) {
    for (const it of this.items) if (it.active && it.segment === segment) this._release(it);

    const half = R.segmentLength / 2;
    while (this.nextZ > zCenter + half) this.nextZ -= rand(B.intervalMin, B.intervalMax); // 通り過ぎた分は飛ばす
    if (this.nextZ < zCenter - half) return; // このセグメントには置かない
    const target = this.nextZ;
    this.nextZ -= rand(B.intervalMin, B.intervalMax);
    const it = this.items.find((o) => !o.active);
    if (!it) return;

    const margin = 0.8; // セグメントの端は隣の障害物と近いので避ける
    const z = THREE.MathUtils.clamp(target, zCenter - half + margin, zCenter + half - margin);
    if (-z < B.minDistance) return;
    for (let tries = 0; tries < 12; tries++) {
      const x = rand(-B.corridorX, B.corridorX);
      if (obstacles.clearance(x, z) < B.obstacleClear) continue;
      it.active = true;
      it.segment = segment;
      it.x = x;
      it.z = z;
      it.phase = rand(0, 6.28);
      it.group.position.set(x, 0, z);
      it.group.visible = true;
      return;
    }
  }

  update(dt, time, roachPos, roachY, canCollect) {
    let collected = false;
    for (const it of this.items) {
      if (!it.active) continue;
      const t = time + it.phase;
      it.cube.position.y = B.floatHeight + Math.sin(t * B.bobSpeed) * B.bobAmount;
      it.cube.rotation.set(0.35, t * B.spinSpeed, 0.2);
      const pulse = 0.5 + 0.5 * Math.sin(t * B.ringPulseSpeed);
      it.ring.material.opacity = B.ringOpacity * (0.45 + 0.55 * pulse);
      it.ring.scale.setScalar(0.92 + 0.12 * pulse);
      it.halo.position.y = it.cube.position.y;
      it.halo.material.opacity = 0.35 + 0.25 * pulse;
      for (const s of it.sparkles) {
        const a = s.a + t * 0.8;
        const tw = Math.max(0, Math.sin(t * 3 + s.ph));
        s.sp.position.set(Math.cos(a) * B.ringRadius * s.r, it.cube.position.y + Math.sin(t * 1.7 + s.ph) * 0.07, Math.sin(a) * B.ringRadius * s.r);
        s.sp.scale.setScalar(B.sparkleSize * (0.3 + tw));
        s.sp.material.opacity = tw;
      }
      if (canCollect && roachY <= B.pickupMaxY && Math.hypot(it.x - roachPos.x, it.z - roachPos.z) <= B.pickupRadius) {
        collected = true;
        this._burst(it);
        this._release(it);
      }
    }
    for (const b of this.bursts) {
      if (b.life <= 0) continue;
      b.life -= dt;
      if (b.life <= 0) {
        b.sp.visible = false;
        continue;
      }
      const k = b.life / B.burstLife;
      b.sp.position.x += b.vx * dt;
      b.sp.position.y += b.vy * dt;
      b.sp.position.z += b.vz * dt;
      b.sp.scale.setScalar(B.burstSize * (0.4 + k));
      b.sp.material.opacity = k;
    }
    return collected;
  }

  _burst(it) {
    const y = B.floatHeight;
    for (const b of this.bursts) {
      const a = rand(0, Math.PI * 2);
      const up = rand(0.2, 1);
      b.life = B.burstLife * rand(0.7, 1);
      b.sp.position.set(it.x, y, it.z);
      b.vx = Math.cos(a) * B.burstSpeed * (1 - up * 0.5);
      b.vz = Math.sin(a) * B.burstSpeed * (1 - up * 0.5);
      b.vy = up * B.burstSpeed;
      b.sp.visible = true;
    }
  }
}

// 効果中にゴキブリの後ろへ残る半透明の黄色い残像（楕円体の影を時間差で数個）
export class BoostTrail {
  constructor(scene) {
    this.samples = []; // { t, x, y, z, yaw }
    this.ghosts = [];
    const geo = new THREE.SphereGeometry(1, 12, 8);
    const [sx, sy, sz] = B.trailSize;
    for (let i = 0; i < B.trailCount; i++) {
      const m = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ color: B.trailColor, transparent: true, opacity: 0, depthWrite: false, fog: false }),
      );
      m.scale.set(sx, sy, sz);
      m.visible = false;
      scene.add(m);
      this.ghosts.push(m);
    }
  }

  reset() {
    this.samples.length = 0;
    for (const g of this.ghosts) g.visible = false;
  }

  // level: 効果の強さ 0〜1、speedRatio: 今の速さ / 最高速度（止まっているときは出さない）
  update(time, pos, yaw, level, speedRatio) {
    const maxDelay = B.trailInterval * B.trailCount;
    this.samples.push({ t: time, x: pos.x, y: pos.y, z: pos.z, yaw });
    while (this.samples.length > 2 && this.samples[1].t < time - maxDelay - 0.1) this.samples.shift();

    const vis = level * Math.min(1, speedRatio * 1.5);
    this.ghosts.forEach((g, i) => {
      g.visible = vis > 0.02;
      if (!g.visible) return;
      const at = time - (i + 1) * B.trailInterval;
      let s = this.samples[0];
      for (let k = this.samples.length - 1; k >= 0; k--) {
        if (this.samples[k].t <= at) {
          s = this.samples[k];
          break;
        }
      }
      g.position.set(s.x, s.y + B.trailSize[1], s.z);
      g.rotation.y = s.yaw;
      g.material.opacity = B.trailOpacity * (1 - i / B.trailCount) * vis;
    });
  }
}
