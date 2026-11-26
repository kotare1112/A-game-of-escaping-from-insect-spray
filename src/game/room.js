import * as THREE from 'three';
import { CONFIG } from './config.js';

const R = CONFIG.room;
const HALF_W = R.width / 2;

// 木目のフローリングを手続き生成する（板は z 方向に伸びる）
function makeFloorTexture() {
  const w = 384;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const plankW = 32;
  for (let i = 0; i < w / plankW; i++) {
    let y = -Math.random() * 200;
    while (y < h) {
      const len = 160 + Math.random() * 200;
      const base = 120 + Math.random() * 40;
      g.fillStyle = `rgb(${base + 30},${base - 10},${base - 55})`;
      g.fillRect(i * plankW, y, plankW, len);
      // 木目の筋
      for (let k = 0; k < 7; k++) {
        const gx = i * plankW + 2 + Math.random() * (plankW - 4);
        g.strokeStyle = `rgba(60,30,10,${0.08 + Math.random() * 0.12})`;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(gx, y);
        g.lineTo(gx + (Math.random() - 0.5) * 4, y + len);
        g.stroke();
      }
      // 継ぎ目
      g.fillStyle = 'rgba(30,15,5,0.55)';
      g.fillRect(i * plankW, y, plankW, 1.5);
      y += len;
    }
    g.fillStyle = 'rgba(30,15,5,0.5)';
    g.fillRect(i * plankW, 0, 1.5, h);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class Room {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    const floorTex = makeFloorTexture();
    this.mats = {
      floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7 }),
      wall: new THREE.MeshStandardMaterial({ color: 0xcdbfa6, roughness: 0.95 }),
      baseboard: new THREE.MeshStandardMaterial({ color: 0xf0ebe0, roughness: 0.6 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x9fd0ee, emissive: 0x335577, roughness: 0.2 }),
      frame: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }),
      door: new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.7 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x7a5233, roughness: 0.8 }),
      sofa: [0x4d6a8a, 0x8a4d4d, 0x5f7a55].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })),
      pot: new THREE.MeshStandardMaterial({ color: 0xb5623b, roughness: 0.8 }),
      leaf: new THREE.MeshStandardMaterial({ color: 0x2f7a3a, roughness: 0.8 }),
    };

    this.onPlace = null; // セグメントを置き直したときのコールバック (index, zCenter)
    this.segments = [];
    for (let i = 0; i < R.segmentCount; i++) {
      const seg = this._createSegment();
      this.group.add(seg.group);
      this.segments.push(seg);
    }
    this.reset();
  }

  _box(parent, w, h, d, mat, x, y, z, shadow = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  _createSegment() {
    const L = R.segmentLength;
    const group = new THREE.Group();
    const mats = this.mats;

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(R.width, L), mats.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    group.add(floor);

    const sides = {};
    for (const s of [-1, 1]) {
      const side = new THREE.Group();
      // s=-1: 左壁、s=+1: 右壁。壁の内側面は |x| = HALF_W
      side.position.x = s * HALF_W;
      group.add(side);
      const inward = -s; // 部屋の内側へ向かう x 方向
      const wall = this._box(side, 0.1, R.wallHeight, L, mats.wall, s * 0.05, R.wallHeight / 2, 0);
      wall.castShadow = false;
      this._box(side, 0.03, 0.12, L, mats.baseboard, inward * 0.015, 0.06, 0, false);

      // 窓
      const win = new THREE.Group();
      this._box(win, 0.04, 1.0, 1.2, mats.frame, inward * 0.02, 1.4, 0, false);
      this._box(win, 0.045, 0.88, 1.08, mats.glass, inward * 0.025, 1.4, 0, false);
      this._box(win, 0.05, 0.88, 0.04, mats.frame, inward * 0.03, 1.4, 0, false);
      this._box(win, 0.05, 0.04, 1.08, mats.frame, inward * 0.03, 1.4, 0, false);
      // ドア
      const door = new THREE.Group();
      this._box(door, 0.04, 2.0, 0.95, mats.frame, inward * 0.02, 1.0, 0, false);
      this._box(door, 0.06, 1.95, 0.85, mats.door, inward * 0.03, 0.98, 0, false);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), mats.frame);
      knob.position.set(inward * 0.075, 1.0, 0.33);
      door.add(knob);

      // 家具（壁際のみ：奥行き 0.3 以内）
      const shelf = new THREE.Group();
      this._box(shelf, 0.3, 1.5, 1.0, mats.wood, inward * 0.15, 0.75, 0);
      for (let k = 1; k < 4; k++) this._box(shelf, 0.28, 0.03, 0.96, mats.baseboard, inward * 0.15, k * 0.37, 0, false);
      const sofa = new THREE.Group();
      sofa.userData.parts = [];
      const sofaBody = this._box(sofa, 0.3, 0.3, 1.3, mats.sofa[0], inward * 0.15, 0.2, 0);
      const sofaBack = this._box(sofa, 0.1, 0.5, 1.3, mats.sofa[0], inward * 0.05, 0.45, 0);
      sofa.userData.parts.push(sofaBody, sofaBack);
      const plant = new THREE.Group();
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.3, 12), mats.pot);
      pot.position.set(inward * 0.17, 0.15, 0);
      pot.castShadow = true;
      plant.add(pot);
      for (let k = 0; k < 3; k++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.14 - k * 0.025, 0.45, 8), mats.leaf);
        leaf.position.set(inward * 0.17, 0.5 + k * 0.28, 0);
        leaf.castShadow = true;
        plant.add(leaf);
      }
      const furniture = { shelf, sofa, plant };
      for (const f of [win, door, shelf, sofa, plant]) side.add(f);
      sides[s] = { win, door, ...furniture };
    }
    return { group, sides };
  }

  // セグメントの飾りをランダムに選び直す
  _randomize(seg) {
    for (const s of [-1, 1]) {
      const d = seg.sides[s];
      for (const k of ['win', 'door', 'shelf', 'sofa', 'plant']) d[k].visible = false;
      const r = Math.random();
      const hasDoor = r < R.doorChance;
      const hasWin = !hasDoor && Math.random() < R.windowChance;
      if (hasDoor) {
        d.door.visible = true;
        d.door.position.z = rand(-1.0, 1.0);
      } else if (hasWin) {
        d.win.visible = true;
        d.win.position.z = rand(-0.8, 0.8);
      }
      // 家具はドアと重ならないよう、ドアがある壁には置かない
      if (!hasDoor && Math.random() < R.furnitureChance) {
        const type = pick(['shelf', 'sofa', 'plant']);
        const f = d[type];
        f.visible = true;
        if (type === 'sofa') {
          const m = pick(this.mats.sofa);
          for (const p of f.userData.parts) p.material = m;
        }
        // 窓があっても壁際の家具なので重ねて置いてよい
        f.position.z = type === 'plant' ? rand(-1.6, 1.6) : rand(-0.8, 0.8);
      }
    }
  }

  reset() {
    this.segments.forEach((seg, i) => {
      seg.group.position.z = R.segmentStartZ - i * R.segmentLength;
      this._randomize(seg);
      if (this.onPlace) this.onPlace(i, seg.group.position.z);
    });
  }

  // 後ろに外れたセグメントを前へ付け替える
  update(playerZ) {
    const jump = R.segmentCount * R.segmentLength;
    this.segments.forEach((seg, i) => {
      if (seg.group.position.z > playerZ + R.recycleBehind) {
        seg.group.position.z -= jump;
        this._randomize(seg);
        if (this.onPlace) this.onPlace(i, seg.group.position.z);
      }
    });
  }
}
