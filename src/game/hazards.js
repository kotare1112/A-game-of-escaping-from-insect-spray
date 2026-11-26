import * as THREE from 'three';
import { CONFIG } from './config.js';

const H = CONFIG.hazards;
const R = CONFIG.room;
const RADIUS = CONFIG.obstacles.roachRadius;
const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

// 動く障害物（床：お掃除ロボット・ボール）と空中の障害物（クモ・ハチ・紙飛行機）。
// 見た目はプリミティブの組み合わせ。単位はメートルで、倍率はかけない。
// 当たり判定：床のものは「円＋高さ」、空中のものは 3D の球。

const mat = (color, rough = 0.6) => new THREE.MeshStandardMaterial({ color, roughness: rough });
const MATS = {
  robotBody: mat(0xe4e6ea, 0.4),
  robotTop: mat(0x24262d, 0.25),
  robotBumper: new THREE.MeshStandardMaterial({ color: 0x3b3e47, roughness: 0.7, side: THREE.DoubleSide }),
  robotSkirt: mat(0x15161a, 0.9),
  robotButton: mat(0x3fa9f5, 0.3),
  robotLed: new THREE.MeshBasicMaterial({ color: 0x5dff7a }),
  brush: mat(0xe8742a, 0.9),
  ball: H.ball.colors.map((c) => mat(c, 0.35)),
  spider: mat(0x2a1f1a, 0.7),
  spiderEye: new THREE.MeshBasicMaterial({ color: 0xd8403a }),
  string: new THREE.MeshBasicMaterial({ color: 0xd2d2d8 }),
  beeYellow: mat(0xf5c518, 0.5),
  beeBlack: mat(0x1a1a1a, 0.6),
  paper: new THREE.MeshStandardMaterial({ color: 0xf6f6f2, roughness: 0.9, side: THREE.DoubleSide, flatShading: true }),
  paperKeel: new THREE.MeshStandardMaterial({ color: 0xd2d6dc, roughness: 0.9, side: THREE.DoubleSide, flatShading: true }),
};
const WING_MAT = new THREE.MeshBasicMaterial({
  color: 0xe8f4ff,
  transparent: true,
  opacity: 0.55,
  side: THREE.DoubleSide,
  depthWrite: false,
});

function mesh(geo, material, x = 0, y = 0, z = 0, shadow = false) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  return m;
}

function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// 床に置く丸い影の形（空中のものが落とす）
const SHADOW_GEO = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);

// ---- 種類ごとの定義 ----
// build(): { group, parts }。spawn(h, x, z): 出現時の初期化。step(h, dt, t, roachPos): 毎フレームの動き
const TYPES = {
  // お掃除ロボット：円盤。x 方向に往復し、通路の端で折り返す
  robot: {
    cfg: H.robot,
    air: false,
    build() {
      const c = H.robot;
      const r = c.radius;
      const g = new THREE.Group();
      g.add(mesh(new THREE.CylinderGeometry(r * 0.95, r * 0.95, 0.012, 32), MATS.robotSkirt, 0, 0.008, 0));
      g.add(mesh(new THREE.CylinderGeometry(r, r, c.height - 0.014, 32), MATS.robotBody, 0, 0.014 + (c.height - 0.014) / 2, 0, true));
      g.add(mesh(new THREE.CylinderGeometry(r * 0.82, r * 0.82, 0.004, 32), MATS.robotTop, 0, c.height + 0.001, 0));
      // 上面のボタンとランプ
      g.add(mesh(new THREE.CylinderGeometry(r * 0.24, r * 0.24, 0.008, 20), MATS.robotButton, 0, c.height + 0.005, -r * 0.05));
      g.add(mesh(new THREE.CylinderGeometry(r * 0.07, r * 0.07, 0.006, 12), MATS.robotLed, r * 0.4, c.height + 0.004, r * 0.3));
      // 前面のバンパー（進行方向 = ローカル +z。手前側 120 度の帯）
      const bumper = mesh(
        new THREE.CylinderGeometry(r * 1.05, r * 1.05, c.height * 0.55, 20, 1, true, -Math.PI / 3, (Math.PI * 2) / 3),
        MATS.robotBumper,
        0,
        c.height * 0.45,
        0,
        true,
      );
      g.add(bumper);
      // 下のブラシ（前の両脇。ボディの縁からはみ出して回る）
      const brushes = [];
      for (const s of [-1, 1]) {
        const b = new THREE.Group();
        b.position.set(s * r * 0.62, 0.012, r * 0.78);
        b.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 8), MATS.brush));
        for (let k = 0; k < 3; k++) {
          const arm = new THREE.Group();
          arm.rotation.y = (k / 3) * TAU;
          arm.add(mesh(new THREE.BoxGeometry(0.05, 0.004, 0.008), MATS.brush, 0.027, 0, 0));
          b.add(arm);
        }
        g.add(b);
        brushes.push({ obj: b, dir: s });
      }
      return { group: g, parts: { brushes } };
    },
    spawn(h, x, z) {
      const c = H.robot;
      h.r = c.radius;
      h.top = c.height;
      h.dir = Math.random() < 0.5 ? -1 : 1;
      h.speed = rand(c.speedMin, c.speedMax);
      h.snake = rand(0, TAU);
      h.yaw = h.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    },
    step(h, dt, t) {
      const c = H.robot;
      h.x += h.dir * h.speed * dt;
      if (h.x > H.edgeX) { h.x = H.edgeX; h.dir = -1; }
      if (h.x < -H.edgeX) { h.x = -H.edgeX; h.dir = 1; }
      h.z = h.z0 + c.snakeAmp * Math.sin(c.snakeFreq * t + h.snake);
      h.vx = h.dir * h.speed;
      h.vz = c.snakeAmp * c.snakeFreq * Math.cos(c.snakeFreq * t + h.snake);
      h.yaw += angleDiff(h.yaw, Math.atan2(h.vx, h.vz)) * Math.min(1, c.turnRate * dt);
      h.group.position.set(h.x, 0, h.z);
      h.group.rotation.y = h.yaw;
      for (const b of h.parts.brushes) b.obj.rotation.y += b.dir * c.brushSpin * dt;
    },
  },

  // 転がるボール：ゴキブリのほうへ（+z）転がる。通路の端で跳ね返る
  ball: {
    cfg: H.ball,
    air: false,
    build() {
      const r = H.ball.radius;
      const g = new THREE.Group();
      const spin = new THREE.Group(); // 転がり回転はこの中だけ回す
      spin.add(mesh(new THREE.SphereGeometry(r, 24, 16), MATS.ball[0], 0, 0, 0, true));
      // 半球（別の色）と帯（白）で、回転が見えるようにする
      spin.add(mesh(new THREE.SphereGeometry(r * 1.004, 24, 16, 0, Math.PI), MATS.ball[1]));
      spin.add(mesh(new THREE.SphereGeometry(r * 1.008, 24, 8, 0, TAU, Math.PI * 0.4, Math.PI * 0.2), MATS.ball[2]));
      g.add(spin);
      return { group: g, parts: { spin } };
    },
    spawn(h, x, z) {
      const c = H.ball;
      h.r = c.radius;
      h.top = c.hitHeight;
      h.vx = rand(-c.driftX, c.driftX);
      h.vz = rand(c.speedMin, c.speedMax);
      h.parts.spin.quaternion.setFromEuler(new THREE.Euler(rand(0, TAU), rand(0, TAU), rand(0, TAU)));
    },
    step(h, dt, t, roachPos) {
      const c = H.ball;
      h.x += h.vx * dt;
      h.z += h.vz * dt;
      if (h.x > H.edgeX) { h.x = H.edgeX; h.vx = -Math.abs(h.vx); }
      if (h.x < -H.edgeX) { h.x = -H.edgeX; h.vx = Math.abs(h.vx); }
      h.group.position.set(h.x, c.radius, h.z);
      // 転がり：進行方向 d = (vx, 0, vz) のとき、軸は (vz, 0, -vx)、角度は 距離 / 半径
      const sp = Math.hypot(h.vx, h.vz);
      if (sp > 1e-5) {
        h.axis.set(h.vz / sp, 0, -h.vx / sp);
        h.q.setFromAxisAngle(h.axis, (sp * dt) / c.radius);
        h.parts.spin.quaternion.premultiply(h.q);
      }
      // ずっと後ろへ行ったら消す
      if (h.z > roachPos.z + R.recycleBehind) {
        h.hidden = true;
        h.group.visible = false;
      }
    },
  },

  // クモ：天井から糸でぶら下がって上下する
  spider: {
    cfg: H.spider,
    air: true,
    build() {
      const g = new THREE.Group(); // 糸の付け根（天井）
      const string = mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 1, 4), MATS.string);
      g.add(string);
      const body = new THREE.Group();
      const abdomen = mesh(new THREE.SphereGeometry(0.05, 14, 10), MATS.spider);
      abdomen.scale.set(1, 0.85, 1.25);
      abdomen.position.z = -0.045;
      body.add(abdomen);
      body.add(mesh(new THREE.SphereGeometry(0.032, 12, 8), MATS.spider, 0, 0.004, 0.04));
      for (const s of [-1, 1]) body.add(mesh(new THREE.SphereGeometry(0.008, 6, 6), MATS.spiderEye, s * 0.014, 0.014, 0.068));
      // 脚 8 本（左右 4 本ずつ。付け根から外へ上がり、途中で折れて下へ）
      const legs = [];
      const fan = [-0.65, -0.22, 0.22, 0.65];
      for (const side of [-1, 1]) {
        fan.forEach((a, i) => {
          const pivot = new THREE.Group();
          pivot.position.set(0, 0, 0.0);
          pivot.rotation.y = side > 0 ? a : Math.PI + a;
          const upper = new THREE.Group();
          upper.add(mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.1, 5).rotateZ(-Math.PI / 2), MATS.spider, 0.05, 0, 0));
          const lower = new THREE.Group();
          lower.position.x = 0.1;
          lower.add(mesh(new THREE.CylinderGeometry(0.0035, 0.002, 0.13, 5).rotateZ(-Math.PI / 2), MATS.spider, 0.065, 0, 0));
          upper.add(lower);
          pivot.add(upper);
          body.add(pivot);
          legs.push({ upper, lower, ph: i * 1.3 + (side > 0 ? 0 : 0.7) });
        });
      }
      g.add(body);
      return { group: g, parts: { string, body, legs } };
    },
    spawn(h, x, z) {
      const c = H.spider;
      h.r = c.hitRadius;
      h.period = rand(c.periodMin, c.periodMax);
      h.ph = rand(0, TAU);
      h.swayPh = rand(0, TAU);
      h.px = x;
      h.y = (c.minY + c.maxY) / 2;
    },
    step(h, dt, t) {
      const c = H.spider;
      const mid = (c.minY + c.maxY) / 2;
      const amp = (c.maxY - c.minY) / 2;
      const y = mid + amp * Math.sin((TAU * t) / h.period + h.ph);
      const th = c.swing * Math.sin(c.swingSpeed * t + h.swayPh);
      const len = (R.wallHeight - y) / Math.cos(th);
      h.group.position.set(h.px, R.wallHeight, h.z);
      h.group.rotation.z = th;
      const p = h.parts;
      p.string.scale.y = len;
      p.string.position.y = -len / 2;
      p.body.position.y = -len;
      p.body.rotation.y = 0.6 * Math.sin(0.7 * t + h.swayPh);
      for (const l of p.legs) {
        const w = Math.sin(c.legWiggleSpeed * t + l.ph) * c.legWiggle;
        l.upper.rotation.z = 0.8 + w;
        l.lower.rotation.z = -1.8 - w * 1.5;
      }
      const nx = h.px + len * Math.sin(th);
      h.vx = (nx - h.x) / Math.max(dt, 1e-4);
      h.vz = 0;
      h.x = nx;
      h.y = y;
    },
  },

  // ハチ：縞の胴体と羽ばたく羽。8 の字に飛ぶ
  bee: {
    cfg: H.bee,
    air: true,
    build() {
      const g = new THREE.Group();
      const body = new THREE.Group(); // 向き（ローカル +z が前）
      const a = 0.042;
      const c = 0.075;
      const abdomen = mesh(new THREE.SphereGeometry(1, 14, 10), MATS.beeYellow);
      abdomen.scale.set(a, a, c);
      body.add(abdomen);
      for (const z of [-0.045, -0.012, 0.022]) {
        const cross = a * Math.sqrt(1 - (z / c) ** 2) + 0.002;
        const ring = mesh(new THREE.TorusGeometry(cross, 0.0085, 6, 16), MATS.beeBlack, 0, 0, z);
        body.add(ring);
      }
      body.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), MATS.beeBlack, 0, 0, 0.082));
      body.add(mesh(new THREE.ConeGeometry(0.01, 0.04, 6).rotateX(-Math.PI / 2), MATS.beeBlack, 0, 0, -0.095));
      // 羽（付け根が原点）
      const wings = [];
      for (const s of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(s * 0.012, a * 0.9, 0.01);
        const w = mesh(new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), WING_MAT, s * 0.05, 0, -0.005);
        w.scale.set(0.055, 1, 0.032);
        pivot.add(w);
        body.add(pivot);
        wings.push({ pivot, side: s });
      }
      g.add(body);
      return { group: g, parts: { body, wings } };
    },
    spawn(h, x, z) {
      const c = H.bee;
      h.r = c.hitRadius;
      h.period = rand(c.periodMin, c.periodMax);
      h.ph = rand(0, TAU);
      h.cx = THREE.MathUtils.clamp(x, -H.edgeX + c.rangeX, H.edgeX - c.rangeX);
      h.flap = rand(0, TAU);
      h.x = h.cx;
      h.y = (c.minY + c.maxY) / 2;
    },
    step(h, dt, t) {
      const c = H.bee;
      const w = TAU / h.period;
      const ph = w * t + h.ph;
      const x = h.cx + c.rangeX * Math.sin(ph);
      const z = h.z0 + c.rangeZ * Math.sin(2 * ph);
      const mid = (c.minY + c.maxY) / 2;
      const amp = (c.maxY - c.minY) / 2;
      const y = mid + amp * Math.sin(1.5 * ph + 1.0);
      const vx = c.rangeX * w * Math.cos(ph);
      const vz = 2 * c.rangeZ * w * Math.cos(2 * ph);
      const vy = 1.5 * amp * w * Math.cos(1.5 * ph + 1.0);
      h.x = x; h.y = y; h.z = z; h.vx = vx; h.vz = vz;
      h.group.position.set(x, y, z);
      const body = h.parts.body;
      body.rotation.y = Math.atan2(vx, vz);
      body.rotation.x = -THREE.MathUtils.clamp(vy * 0.6, -0.4, 0.4);
      h.flap += Math.min(c.flapSpeed * dt, c.flapMaxStep);
      const f = Math.sin(h.flap) * c.flapAngle;
      for (const wg of h.parts.wings) wg.pivot.rotation.z = wg.side * (0.15 + f);
    },
  },

  // 紙飛行機：通路を横切り、端まで行ったら反対側から再登場する
  plane: {
    cfg: H.plane,
    air: true,
    build() {
      const s = H.plane.size;
      const N = [0, 0, 0.13];
      const L = [-0.11, 0.03, -0.1];
      const Rr = [0.11, 0.03, -0.1];
      const C = [0, 0, -0.1];
      const K = [0, -0.035, -0.1];
      const make = (tris, material) => {
        const pos = new Float32Array(tris.flat().flat().map((v) => v * s));
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.computeVertexNormals();
        return mesh(geo, material, 0, 0, 0, true);
      };
      const g = new THREE.Group();
      const body = new THREE.Group();
      body.add(make([[N, C, L], [N, Rr, C]], MATS.paper));
      body.add(make([[N, K, C]], MATS.paperKeel));
      g.add(body);
      g.rotation.order = 'YXZ';
      return { group: g, parts: { body } };
    },
    spawn(h, x, z) {
      const c = H.plane;
      h.r = c.hitRadius;
      h.dir = Math.random() < 0.5 ? -1 : 1;
      h.speed = rand(c.speedMin, c.speedMax);
      h.x = rand(-c.wrapX, c.wrapX);
      h.bob = rand(0, TAU);
      h.y = (c.minY + c.maxY) / 2;
    },
    step(h, dt, t) {
      const c = H.plane;
      h.x += h.dir * h.speed * dt;
      if (h.x > c.wrapX) h.x = -c.wrapX;
      if (h.x < -c.wrapX) h.x = c.wrapX;
      const mid = (c.minY + c.maxY) / 2;
      const amp = (c.maxY - c.minY) / 2;
      const b = c.bobSpeed * t + h.bob;
      h.y = mid + amp * Math.sin(b);
      h.z = h.z0;
      h.vx = h.dir * h.speed;
      h.vz = 0;
      h.group.position.set(h.x, h.y, h.z);
      h.group.rotation.y = h.dir > 0 ? Math.PI / 2 : -Math.PI / 2; // 進行方向（ローカル +z）を向く
      h.group.rotation.x = -Math.cos(b) * 0.12; // 上昇中は機首を上げる
      h.group.rotation.z = Math.sin(b * 0.7) * 0.2;
    },
  },
};
const TYPE_NAMES = Object.keys(TYPES);

export class Hazards {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.pool = {};
    for (const name of TYPE_NAMES) {
      const def = TYPES[name];
      this.pool[name] = [];
      for (let i = 0; i < H.poolSize; i++) {
        const { group, parts } = def.build();
        group.visible = false;
        this.group.add(group);
        const h = {
          type: name, def, group, parts, air: def.air,
          active: false, hidden: false, segment: -1,
          x: 0, y: 0, z: 0, z0: 0, x0: 0, vx: 0, vz: 0, r: 0.1, top: 0, cool: 0,
          axis: new THREE.Vector3(), q: new THREE.Quaternion(), blob: null,
        };
        if (def.air) {
          // 床に落とす丸い影（高さが分かりやすい）
          h.blob = new THREE.Mesh(
            SHADOW_GEO,
            new THREE.MeshBasicMaterial({
              color: 0x000000, transparent: true, opacity: 0, depthWrite: false,
              polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
            }),
          );
          h.blob.visible = false;
          this.group.add(h.blob);
        }
        this.pool[name].push(h);
      }
    }
    this.active = [];
    this.result = { hit: false, air: false }; // update の戻り値（使い回す）
  }

  reset() {
    for (const h of this.active) this._release(h);
    this.active.length = 0;
  }

  _release(h) {
    h.active = false;
    h.group.visible = false;
    if (h.blob) h.blob.visible = false;
  }

  // セグメント（番号 segment）を zCenter に置き直すときに呼ぶ。obstacles は先に置き終えていること
  place(segment, zCenter, obstacles) {
    this.active = this.active.filter((h) => {
      if (h.segment !== segment) return true;
      this._release(h);
      return false;
    });

    const dist = -zCenter;
    if (dist < H.safeStartDistance) return;
    const t = THREE.MathUtils.clamp((dist - H.safeStartDistance) / (H.densityDistance - H.safeStartDistance), 0, 1);
    const per = H.perSegmentEnd * t;
    const n = Math.floor(per) + (Math.random() < per - Math.floor(per) ? 1 : 0);
    const half = R.segmentLength / 2 - 0.3;

    for (let i = 0; i < n; i++) {
      // 出現開始距離を過ぎた種類を、順番をランダムにして確率で選ぶ
      const kinds = TYPE_NAMES.filter((k) => dist >= TYPES[k].cfg.minDistance);
      for (let a = kinds.length - 1; a > 0; a--) {
        const b = Math.floor(Math.random() * (a + 1));
        [kinds[a], kinds[b]] = [kinds[b], kinds[a]];
      }
      for (const kind of kinds) {
        if (Math.random() >= TYPES[kind].cfg.chance) continue;
        const h = this.pool[kind].find((o) => !o.active);
        if (!h) continue;
        let done = false;
        for (let tries = 0; tries < 10 && !done; tries++) {
          const x = rand(-H.edgeX + 0.1, H.edgeX - 0.1);
          const z = zCenter + rand(-half, half);
          if (this.active.some((o) => Math.hypot(o.x0 - x, o.z0 - z) < H.minGap)) continue;
          // 床を動くものは、静的障害物と重ならない位置から
          if (!h.air && obstacles && obstacles.clearance(x, z) < H.obstacleClear) continue;
          this._spawn(h, segment, x, z);
          done = true;
        }
        if (done) break;
      }
    }
  }

  _spawn(h, segment, x, z) {
    h.active = true;
    h.hidden = false;
    h.segment = segment;
    h.x = x; h.z = z; h.x0 = x; h.z0 = z;
    h.vx = 0; h.vz = 0;
    h.cool = 0;
    h.group.visible = true;
    h.def.spawn(h, x, z);
    h.def.step(h, 0.0001, 0, { z: 1e9 }); // 置いた直後の見た目を作る（時刻 0 の姿勢）
    this.active.push(h);
  }

  _shadow(h) {
    const k = Math.min(1, h.y / H.shadowFadeHeight);
    h.blob.visible = true;
    h.blob.position.set(h.x, 0.002, h.z);
    const r = h.r * (1 - 0.35 * k);
    h.blob.scale.set(r, 1, r);
    h.blob.material.opacity = H.shadowOpacity * (1 - 0.6 * k);
  }

  // ゴキブリ pos（足元の位置）・高さ y との当たり。押し出して、重なっていれば true
  _collide(h, pos, vel, y) {
    const rs = h.r + RADIUS;
    let reach = rs; // 水平方向にぶつかる距離
    if (h.air) {
      const dy = y + H.roachBodyY - h.y;
      if (Math.abs(dy) >= rs) return false;
      reach = Math.sqrt(rs * rs - dy * dy);
    } else if (y >= h.top) {
      return false; // 高さより上の空中なら当たらない
    }
    const dx = pos.x - h.x;
    const dz = pos.z - h.z;
    const d = Math.hypot(dx, dz);
    if (d >= reach) return false;
    let nx;
    let nz;
    if (d > 1e-5) {
      nx = dx / d;
      nz = dz / d;
    } else {
      const m = Math.hypot(h.vx, h.vz) || 1;
      nx = h.vx / m || 0;
      nz = h.vx === 0 && h.vz === 0 ? 1 : h.vz / m;
    }
    const pen = reach - d;
    pos.x += nx * pen;
    pos.z += nz * pen;
    // 相手に対する近づく速さを消す（相手の動きについていく形になる）
    const rel = (vel.x - h.vx) * nx + (vel.z - h.vz) * nz;
    if (rel < 0) {
      vel.x -= rel * nx;
      vel.z -= rel * nz;
    }
    return true;
  }

  // 全員を動かし、collide のときはゴキブリとの当たりも見る。
  // 戻り値 { hit: 新たに衝突扱いになったか, air: それが空中のものか }（毎回同じオブジェクト）
  update(dt, time, roach, collide) {
    const res = this.result;
    res.hit = false;
    res.air = false;
    for (const h of this.active) {
      h.def.step(h, dt, time, roach.position);
      if (h.hidden) continue;
      if (h.blob) this._shadow(h);
      h.cool = Math.max(0, h.cool - dt);
      if (collide && this._collide(h, roach.position, roach.velocity, roach.y) && h.cool <= 0) {
        h.cool = H.hitCooldown;
        res.hit = true;
        if (h.air) res.air = true;
      }
    }
    return res;
  }
}
