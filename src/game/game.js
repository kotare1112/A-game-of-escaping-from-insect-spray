import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';
import { Input } from './input.js';
import { Room } from './room.js';
import { Cockroach } from './cockroach.js';
import { HumanGroup } from './humans.js';
import { SpraySystem } from './spray.js';
import { Hud } from './hud.js';
import { Obstacles } from './obstacles.js';
import { SprayAudio } from './audio.js';
import { SpeedStreaks } from './speedfx.js';
import { BoostItems, BoostTrail } from './boost.js';

export class Game {
  constructor(container) {
    this.container = container;
    this.state = 'loading'; // loading | title | playing | dying | gameover
    this.input = new Input();
    this.hud = new Hud();
    this.clock = new THREE.Clock();
    this.time = 0;
    this.distance = 0;
    this.hitTimer = 0;
    this.missTime = 0;
    this.deathTimer = 0;
    this.best = this._loadBest();
    this.audio = new SprayAudio();
    this.hud.setMuted(this.audio.muted);
    this.hud.muteBtn.addEventListener('click', () => {
      this.hud.setMuted(this.audio.toggleMute());
      this.hud.muteBtn.blur();
    });
    this.fovCur = CONFIG.camera.fov;
    this.roll = 0;
    this.shake = 0; // 衝突によるカメラの揺れ
    this.nextMilestone = CONFIG.speedFx.milestoneStep;

    this._setupRenderer();
    this._setupLights();
    this.hud.setBest(this.best);

    this.input.onStart = () => {
      if (this.state === 'title' || this.state === 'gameover') {
        this.start();
        return true;
      }
      return false;
    };
    this.hud.startBtn.addEventListener('click', () => this.start());
    this.hud.retryBtn.addEventListener('click', () => this.start());
    window.addEventListener('resize', () => this._resize());
    // 長押しメニュー・ピンチズームを防ぐ
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
      window.addEventListener(ev, (e) => e.preventDefault());
    }
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }

  _loadBest() {
    try {
      const v = parseFloat(localStorage.getItem(CONFIG.storageKey));
      return Number.isFinite(v) ? v : 0;
    } catch {
      return 0;
    }
  }

  _saveBest(v) {
    try {
      localStorage.setItem(CONFIG.storageKey, String(v));
    } catch {
      /* 保存できなくても続行 */
    }
  }

  _setupRenderer() {
    const C = CONFIG.camera;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CONFIG.room.fogColor);
    this.scene.fog = new THREE.Fog(CONFIG.room.fogColor, CONFIG.room.fogNear, CONFIG.room.fogFar);
    this.camera = new THREE.PerspectiveCamera(C.fov, 1, C.near, C.far);
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
  }

  _setupLights() {
    const L = CONFIG.light;
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6a5a4a, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(L.shadowMapSize, L.shadowMapSize);
    const r = L.shadowRange;
    Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 0.5, far: 25 });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun, sun.target);
    this.sun = sun;
  }

  async load() {
    const loader = new GLTFLoader();
    const load = (url) => loader.loadAsync(url);
    const [roachGltf, ...humanGltfs] = await Promise.all([
      load(CONFIG.models.cockroach),
      ...CONFIG.models.humans.map(load),
    ]);

    this.room = new Room(this.scene);
    this.obstacles = new Obstacles(this.scene);
    this.boost = new BoostItems(this.scene);
    this.trail = new BoostTrail(this.scene);
    this.obstacles.keepClear = (x, z) => this.boost.isNear(x, z);
    this.room.onPlace = (i, z) => {
      this.obstacles.place(i, z);
      this.boost.place(i, z, this.obstacles);
    };
    this.streaks = new SpeedStreaks(this.scene);
    this.cockroach = new Cockroach(roachGltf);
    this.scene.add(this.cockroach.group);
    this.humans = new HumanGroup(humanGltfs);
    this.humans.addTo(this.scene);
    this.spray = new SpraySystem(this.scene, this.humans.humans);

    this._resize();
    this._resetWorld();
    this._updateCamera(1, true);
    this.state = 'title';
    this.hud.showOverlay('title');
    this.renderer.setAnimationLoop(() => this._frame());
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, CONFIG.camera.maxPixelRatio);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _resetWorld() {
    this.obstacles.reset();
    this.boost.reset(); // room.reset より先に（置き直しで最初の位置を使う）
    this.trail.reset();
    this.room.reset();
    this.streaks.reset();
    this.shake = 0;
    this.roll = 0;
    this.fovCur = CONFIG.camera.fov;
    this.nextMilestone = CONFIG.speedFx.milestoneStep;
    this.cockroach.reset();
    this.humans.reset(0);
    this.spray.reset();
    this.distance = 0;
    this.hitTimer = 0;
    this.missTime = 0;
    this.deathTimer = 0;
    this.hud.setDistance(0);
    this.hud.setHit(0, 0);
  }

  start() {
    if (this.state !== 'title' && this.state !== 'gameover') return;
    this.audio.unlock(this.humans.humans.length);
    this._resetWorld();
    this._updateCamera(1, true);
    this.state = 'playing';
    this.hud.showOverlay(null);
    this.hud.setPlaying(true);
  }

  _gameOver() {
    this.state = 'dying';
    this.deathTimer = 0;
    this.cockroach.die();
    this.hud.setPlaying(false);
  }

  _showGameOver() {
    const isNew = this.distance > this.best;
    if (isNew) {
      this.best = this.distance;
      this._saveBest(this.best);
    }
    this.audio.silence();
    this.hud.setBest(this.best);
    this.hud.showGameOver(this.distance, this.best, isNew);
    this.state = 'gameover';
  }

  _updateCamera(dt, snap = false) {
    const C = CONFIG.camera;
    const p = this.cockroach.position;
    const hy = p.y * C.heightFollow; // 高さの変化には少しだけ追従
    const targetPos = new THREE.Vector3(p.x, C.height + hy, p.z + C.back);
    const targetLook = new THREE.Vector3(p.x, hy, p.z - C.lookAhead);
    const k = snap ? 1 : 1 - Math.exp(-C.followRate * dt);
    if (snap) {
      this.camPos.copy(targetPos);
      this.camLook.copy(targetLook);
    } else {
      this.camPos.lerp(targetPos, k);
      this.camLook.lerp(targetLook, k);
    }

    // 速度演出：FOV とロール
    const roach = this.cockroach;
    const ratio = Math.min(1, roach.speed / CONFIG.cockroach.maxSpeed);
    const fk = snap ? 1 : 1 - Math.exp(-C.fovRate * dt);
    const fovTarget = C.fov + (C.fovMax - C.fov) * ratio + CONFIG.boost.fovBonus * roach.boostLevel;
    this.fovCur += (fovTarget - this.fovCur) * fk;
    if (Math.abs(this.camera.fov - this.fovCur) > 0.01) {
      this.camera.fov = this.fovCur;
      this.camera.updateProjectionMatrix();
    }
    const rollTarget = -(roach.velocity.x / CONFIG.cockroach.maxSpeed) * C.rollMaxDeg * (Math.PI / 180);
    this.roll += (rollTarget - this.roll) * (snap ? 1 : 1 - Math.exp(-C.rollRate * dt));

    // 揺れ：衝突（減衰）と、人間が迫ったときの足音
    let sx = 0;
    let sy = 0;
    if (!snap && this.state === 'playing') {
      this.shake = Math.max(0, this.shake - this.shake * C.shakeDecay * dt - 0.001 * dt);
      let step = 0;
      for (const h of this.humans.humans) {
        const behind = h.position.z - p.z; // ゴキブリの後方距離
        if (behind < C.stepShakeDistance && Math.abs(h.position.x - p.x) < 0.8) {
          const near = 1 - Math.max(0, behind) / C.stepShakeDistance;
          step = Math.max(step, near * Math.abs(Math.sin(h.walkPhase)));
        }
      }
      sy = step * C.stepShake + this.shake * Math.sin(this.time * 70);
      sx = this.shake * Math.cos(this.time * 53);
    } else {
      this.shake = 0;
    }

    this.camera.position.set(this.camPos.x + sx, this.camPos.y + sy, this.camPos.z);
    this.camera.lookAt(this.camLook);
    this.camera.rotateZ(this.roll);

    const o = CONFIG.light.offset;
    this.sun.position.set(p.x + o[0], o[1], p.z + o[2]);
    this.sun.target.position.set(p.x, 0, p.z);
  }

  _frame() {
    const dt = Math.min(this.clock.getDelta(), CONFIG.maxDelta);
    this.time += dt;
    const playing = this.state === 'playing';
    const dying = this.state === 'dying';
    const roach = this.cockroach;

    if (playing || dying) {
      const jump = playing
        ? { pressed: this.input.jumpPressed, held: this.input.jumpHeld }
        : { pressed: false, held: false };
      roach.update(dt, playing ? this.input.getVector() : { x: 0, y: 0 }, jump);
      const OB = CONFIG.obstacles;
      const impact = this.obstacles.resolve(roach.position, roach.velocity, OB.roachRadius);
      if (playing && impact > OB.impactMin) {
        roach.stun(OB.impactKeepVelocity);
        this.shake = OB.impactShake;
      }
      this.humans.update(dt, roach.position, this.spray.sprayingFlags, this.time, this.camPos);
      const hit = this.spray.update(dt, roach.position, this.humans.ramp, roach.velocity);
      this.streaks.update(roach.position, Math.min(1, roach.speed / CONFIG.cockroach.maxSpeed), roach.boostLevel);
      if (this.boost.update(dt, this.time, roach.position, roach.y, playing)) {
        roach.activateBoost();
        this.audio.playChime();
        this.hud.showPopup('スピードアップ！', true);
      }
      this.trail.update(this.time, roach.position, roach.yaw, roach.boostLevel, roach.speed / CONFIG.cockroach.maxSpeed);
      this.audio.update(
        this.spray.sprayingFlags,
        this.humans.humans.map((h) => Math.hypot(h.position.x - roach.position.x, h.position.z - roach.position.z)),
      );
      this.room.update(roach.position.z);

      if (playing) {
        this.distance = Math.max(this.distance, -roach.position.z);
        this.hud.setDistance(this.distance);
        if (this.distance >= this.nextMilestone) {
          this.hud.showMilestone(this.nextMilestone);
          this.nextMilestone += CONFIG.speedFx.milestoneStep;
        }
        // 霧の中を走ると濃さが細かく途切れるので、ごく短い途切れ（hitGrace 秒未満）は当たり続けている扱いにする
        if (hit) {
          this.hitTimer += dt;
          this.missTime = 0;
        } else {
          this.missTime += dt;
          if (this.missTime >= CONFIG.spray.hitGrace) this.hitTimer = 0;
        }
        this.hud.setHit(this.hitTimer, this.time);
        if (this.hitTimer >= CONFIG.spray.hitTimeLimit) this._gameOver();
      } else {
        this.deathTimer += dt;
        if (this.deathTimer >= CONFIG.gameOverDelay) this._showGameOver();
      }
    } else {
      // タイトル・ゲームオーバー中も触角や霧を動かす
      roach.update(dt, { x: 0, y: 0 });
      this.spray.idle(dt);
      this.streaks.update(roach.position, 0);
      this.boost.update(dt, this.time, roach.position, roach.y, false);
      this.trail.update(this.time, roach.position, roach.yaw, 0, 0);
    }

    this.hud.setFly(roach.flyRatio, !roach.onGround || roach.flyRatio < 1, roach.flyLocked);
    this.hud.setBoost(roach.boostRatio);
    this.input.endFrame();
    this._updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
