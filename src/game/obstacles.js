import * as THREE from 'three';
import { CONFIG } from './config.js';

const O = CONFIG.obstacles;
const R = CONFIG.room;
const rand = (a, b) => a + Math.random() * (b - a);

// 当たり判定の形はローカル座標で定義する。
// { c: [x, z, r] } 円、{ b: [x, z, 半幅, 半奥行] } 箱（障害物の向きに合わせて回る）
// 見た目は小物ごとにプリミティブの組み合わせで作る。

const mat = (color, rough = 0.7) => new THREE.MeshStandardMaterial({ color, roughness: rough });
const MATS = {
  slipperSole: mat(0xe8dcc0, 0.9),
  slipperTop: [0xd45a6a, 0x4a7ab5, 0x5a9a5a].map((c) => mat(c, 0.95)),
  book: [0x8a2f2f, 0x2f4f8a, 0x2f7a4f, 0xc9a23a, 0x5a3a7a].map((c) => mat(c, 0.8)),
  page: mat(0xf2ead8, 0.9),
  mug: [0xf2f2ee, 0x3a8fb5, 0xd9a13a].map((c) => mat(c, 0.35)),
  coffee: mat(0x3a2414, 0.4),
  block: [0xe04a3a, 0x3a7ae0, 0xf0c63a, 0x4ab04a].map((c) => mat(c, 0.6)),
  tissue: mat(0xf7f7f2, 1.0),
  cord: mat(0x222226, 0.5),
  plug: mat(0x555560, 0.5),
};

function mesh(geo, material, x, y, z) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// 種類ごとの作り方。build() は新しい Group を返し、shapes はローカルの当たり判定
const TYPES = {
  slipper: {
    height: 0.07, // ローカルの高さ（空中のゴキブリがこれより上なら当たらない。実際は scale 倍）
    shapes: [{ b: [0, 0, 0.06, 0.14] }],
    build() {
      const g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(0.11, 0.02, 0.28), MATS.slipperSole, 0, 0.01, 0));
      const top = mesh(new THREE.BoxGeometry(0.1, 0.035, 0.18), MATS.slipperTop[0], 0, 0.037, 0.04);
      g.add(top);
      g.userData.tint = top;
      g.userData.tints = MATS.slipperTop;
      return g;
    },
  },
  book: {
    height: 0.105, // ローカルの高さ（空中のゴキブリがこれより上なら当たらない。実際は scale 倍）
    shapes: [{ b: [0, 0, 0.11, 0.15] }],
    build() {
      const g = new THREE.Group();
      g.userData.tints = MATS.book;
      g.userData.tintMeshes = [];
      let y = 0;
      for (let i = 0; i < 3; i++) {
        const h = 0.03 + (i % 2) * 0.015;
        const w = 0.2 - i * 0.012;
        const cover = mesh(new THREE.BoxGeometry(w, h, 0.28 - i * 0.015), MATS.book[i], rand(-0.01, 0.01), y + h / 2, rand(-0.01, 0.01));
        cover.rotation.y = rand(-0.12, 0.12);
        g.add(cover);
        g.userData.tintMeshes.push(cover);
        const pages = mesh(new THREE.BoxGeometry(w - 0.01, h * 0.7, 0.27 - i * 0.015), MATS.page, cover.position.x + 0.006, cover.position.y, cover.position.z);
        pages.rotation.y = cover.rotation.y;
        pages.castShadow = false;
        g.add(pages);
        y += h;
      }
      return g;
    },
  },
  mug: {
    height: 0.09, // ローカルの高さ（空中のゴキブリがこれより上なら当たらない。実際は scale 倍）
    shapes: [{ c: [0, 0, 0.05] }],
    build() {
      const g = new THREE.Group();
      const body = mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.09, 16), MATS.mug[0], 0, 0.045, 0);
      g.add(body);
      g.userData.tint = body;
      g.userData.tints = MATS.mug;
      const coffee = mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.004, 16), MATS.coffee, 0, 0.086, 0);
      coffee.castShadow = false;
      g.add(coffee);
      const handle = mesh(new THREE.TorusGeometry(0.025, 0.007, 8, 12), MATS.mug[0], 0.05, 0.045, 0);
      g.add(handle);
      g.userData.tintExtra = handle;
      return g;
    },
  },
  blocks: {
    height: 0.11, // ローカルの高さ（空中のゴキブリがこれより上なら当たらない。実際は scale 倍）
    shapes: [{ b: [-0.04, 0.02, 0.03, 0.03] }, { b: [0.05, -0.03, 0.03, 0.03] }],
    build() {
      const g = new THREE.Group();
      const a = mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), MATS.block[0], -0.04, 0.03, 0.02);
      const b = mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), MATS.block[1], 0.05, 0.03, -0.03);
      const c = mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), MATS.block[2], 0.0, 0.085, 0.0);
      c.rotation.y = 0.5;
      g.add(a, b, c);
      return g;
    },
  },
  tissue: {
    height: 0.07, // ローカルの高さ（空中のゴキブリがこれより上なら当たらない。実際は scale 倍）
    shapes: [{ c: [0, 0, 0.045] }],
    build() {
      const g = new THREE.Group();
      const m = mesh(new THREE.IcosahedronGeometry(0.04, 1), MATS.tissue, 0, 0.03, 0);
      m.scale.set(1, 0.85, 1.1);
      g.add(m);
      const n = mesh(new THREE.IcosahedronGeometry(0.025, 0), MATS.tissue, 0.03, 0.02, 0.025);
      g.add(n);
      return g;
    },
  },
  cord: {
    height: 0.03, // ローカルの高さ（空中のゴキブリがこれより上なら当たらない。実際は scale 倍）
    shapes: [{ c: [0, -0.2, 0.035] }, { c: [0.03, -0.08, 0.035] }, { c: [-0.03, 0.06, 0.035] }, { c: [0, 0.2, 0.035] }],
    build() {
      const g = new THREE.Group();
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.015, -0.25),
        new THREE.Vector3(0.04, 0.015, -0.1),
        new THREE.Vector3(-0.04, 0.015, 0.05),
        new THREE.Vector3(0, 0.015, 0.25),
      ]);
      g.add(mesh(new THREE.TubeGeometry(curve, 16, 0.014, 6, false), MATS.cord, 0, 0, 0));
      g.add(mesh(new THREE.BoxGeometry(0.04, 0.025, 0.05), MATS.plug, 0, 0.0125, -0.27));
      return g;
    },
  },
};
const TYPE_NAMES = Object.keys(TYPES);

export class Obstacles {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    // 種類ごとのプール（最初に作って使い回す）
    this.pool = {};
    for (const name of TYPE_NAMES) {
      this.pool[name] = [];
      for (let i = 0; i < O.perTypePool; i++) {
        const g = TYPES[name].build();
        g.visible = false;
        g.scale.setScalar(O.scale);
        this.group.add(g);
        this.pool[name].push({ type: name, group: g, shapes: [], segment: -1, active: false });
      }
    }
    this.active = [];
  }

  reset() {
    for (const ob of this.active) this._release(ob);
    this.active.length = 0;
  }

  _release(ob) {
    ob.active = false;
    ob.group.visible = false;
  }

  // セグメント（番号 segment）を zCenter に置き直すときに呼ぶ
  place(segment, zCenter) {
    // 前に置いていたぶんを返す
    this.active = this.active.filter((ob) => {
      if (ob.segment !== segment) return true;
      this._release(ob);
      return false;
    });

    const dist = -zCenter;
    const t = THREE.MathUtils.clamp(dist / O.densityDistance, 0, 1);
    const per = O.perSegmentStart + (O.perSegmentEnd - O.perSegmentStart) * t;
    const n = Math.floor(per) + (Math.random() < per - Math.floor(per) ? 1 : 0);
    const half = R.segmentLength / 2 - 0.3;

    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 12; tries++) {
        const x = rand(-O.corridorX, O.corridorX);
        const z = zCenter + rand(-half, half);
        if (-z < O.safeStartDistance) continue;
        if (this.active.some((o) => Math.hypot(o.x - x, o.z - z) < O.minGap)) continue;
        if (this._spawn(segment, x, z)) break;
      }
    }
  }

  _spawn(segment, x, z) {
    // ランダムな種類から取り、空なら他の種類から取る
    const start = Math.floor(Math.random() * TYPE_NAMES.length);
    let ob = null;
    for (let k = 0; k < TYPE_NAMES.length && !ob; k++) {
      ob = this.pool[TYPE_NAMES[(start + k) % TYPE_NAMES.length]].find((o) => !o.active) || null;
    }
    if (!ob) return false;

    const yaw = ob.type === 'tissue' || ob.type === 'mug' ? rand(0, Math.PI * 2) : rand(-0.5, 0.5) + (Math.random() < 0.5 ? 0 : Math.PI);
    ob.active = true;
    ob.segment = segment;
    ob.x = x;
    ob.z = z;
    ob.yaw = yaw;
    ob.height = TYPES[ob.type].height * O.scale;
    ob.group.position.set(x, 0, z);
    ob.group.rotation.y = yaw;
    ob.group.visible = true;
    this._tint(ob);

    // ローカルの形をワールドへ
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const sc = O.scale;
    ob.shapes = TYPES[ob.type].shapes.map((sh) => {
      if (sh.c) {
        const [lx, lz, r] = sh.c;
        return { kind: 'c', x: x + (lx * c + lz * s) * sc, z: z + (-lx * s + lz * c) * sc, r: r * sc };
      }
      const [lx, lz, hw, hd] = sh.b;
      return {
        kind: 'b', x: x + (lx * c + lz * s) * sc, z: z + (-lx * s + lz * c) * sc,
        hw: hw * sc, hd: hd * sc, c, s,
      };
    });
    this.active.push(ob);
    return true;
  }

  // 使い回すときに色だけ変える
  _tint(ob) {
    const ud = ob.group.userData;
    if (ud.tint && ud.tints) {
      const m = ud.tints[Math.floor(Math.random() * ud.tints.length)];
      ud.tint.material = m;
      if (ud.tintExtra) ud.tintExtra.material = m;
    }
    if (ud.tintMeshes) {
      const offset = Math.floor(Math.random() * ud.tints.length);
      ud.tintMeshes.forEach((mesh, i) => { mesh.material = ud.tints[(offset + i) % ud.tints.length]; });
    }
  }

  // ゴキブリ（円）を押し出して、壁沿いに滑らせる。戻り値：ぶつかった速さ (m/s、0 なら衝突なし)
  resolve(pos, vel, radius) {
    let impact = 0;
    for (const ob of this.active) {
      if (pos.y > ob.height) continue; // 空中で障害物より高い位置なら当たらない
      if (Math.hypot(ob.x - pos.x, ob.z - pos.z) > 0.9 * O.scale) continue;
      for (const sh of ob.shapes) {
        let nx;
        let nz;
        let pen;
        if (sh.kind === 'c') {
          const dx = pos.x - sh.x;
          const dz = pos.z - sh.z;
          const d = Math.hypot(dx, dz);
          if (d >= sh.r + radius) continue;
          if (d > 1e-5) {
            nx = dx / d;
            nz = dz / d;
          } else {
            nx = 0;
            nz = 1;
          }
          pen = sh.r + radius - d;
        } else {
          const dx = pos.x - sh.x;
          const dz = pos.z - sh.z;
          const lx = dx * sh.c - dz * sh.s;
          const lz = dx * sh.s + dz * sh.c;
          const cx = THREE.MathUtils.clamp(lx, -sh.hw, sh.hw);
          const cz = THREE.MathUtils.clamp(lz, -sh.hd, sh.hd);
          let ex = lx - cx;
          let ez = lz - cz;
          const d = Math.hypot(ex, ez);
          if (d >= radius) continue;
          if (d > 1e-5) {
            ex /= d;
            ez /= d;
            pen = radius - d;
          } else {
            // 中心が箱の内側：一番近い辺から外へ
            const px = sh.hw - Math.abs(lx);
            const pz = sh.hd - Math.abs(lz);
            if (px < pz) {
              ex = Math.sign(lx) || 1;
              ez = 0;
              pen = px + radius;
            } else {
              ex = 0;
              ez = Math.sign(lz) || 1;
              pen = pz + radius;
            }
          }
          nx = ex * sh.c + ez * sh.s;
          nz = -ex * sh.s + ez * sh.c;
        }
        pos.x += nx * pen;
        pos.z += nz * pen;
        const vn = vel.x * nx + vel.z * nz;
        if (vn < 0) {
          impact = Math.max(impact, -vn);
          vel.x -= vn * nx;
          vel.z -= vn * nz;
        }
      }
    }
    return impact;
  }
}
