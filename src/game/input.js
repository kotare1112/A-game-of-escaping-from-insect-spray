// キーボード＋タッチスティックの入力。値は画面基準（x: 右が+、y: 上が+）。

export class Input {
  constructor() {
    this.keys = new Set();
    this.stick = { x: 0, y: 0 };
    this.onStart = null; // Enter / Space 用のコールバック（ゲームを開始したら true を返す）
    this.jumpPressed = false; // ジャンプボタンを押した瞬間（endFrame() で戻す）
    this.spaceLock = false; // 開始に使った Space は、一度離すまでジャンプにしない
    this.touchJumps = new Set(); // ジャンプに使っている指の pointerId

    // 名前入力欄・登録フォームの操作中は、ゲームのキー入力として扱わない
    const inForm = (e) => !!(e.target && e.target.closest && e.target.closest('#rank-form'));

    window.addEventListener('keydown', (e) => {
      if (inForm(e)) return;
      const k = e.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
      if (!e.repeat && (k === 'Enter' || k === 'Space') && this.onStart) {
        const started = this.onStart();
        if (started && k === 'Space') this.spaceLock = true;
      }
      if (k === 'Space' && !e.repeat && !this.spaceLock) this.jumpPressed = true;
      this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => {
      if (inForm(e)) return;
      this.keys.delete(e.code);
      if (e.code === 'Space') this.spaceLock = false;
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.touchJumps.clear();
      this.spaceLock = false;
    });

    this._setupStick();
    this._setupTouchJump();
  }

  // スティック・ボタン類以外の画面を指で触るとジャンプ。押し続けている間は jumpHeld
  _setupTouchJump() {
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      if (e.target && e.target.closest && e.target.closest('#stick, button, .overlay')) return;
      this.touchJumps.add(e.pointerId);
      this.jumpPressed = true;
    });
    const end = (e) => this.touchJumps.delete(e.pointerId);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  // ジャンプボタンを押し続けているか
  get jumpHeld() {
    return (this.keys.has('Space') && !this.spaceLock) || this.touchJumps.size > 0;
  }

  // フレームの最後に呼ぶ：「押した瞬間」の情報を捨てる
  endFrame() {
    this.jumpPressed = false;
  }

  _setupStick() {
    const base = document.getElementById('stick');
    const knob = document.getElementById('stick-knob');
    if (!base || !knob) return;
    let activeId = null;

    const update = (e) => {
      const r = base.getBoundingClientRect();
      const radius = r.width / 2;
      let dx = e.clientX - (r.left + radius);
      let dy = e.clientY - (r.top + radius);
      const len = Math.hypot(dx, dy);
      if (len > radius) {
        dx = (dx / len) * radius;
        dy = (dy / len) * radius;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const dead = 0.12;
      let nx = dx / radius;
      let ny = -dy / radius;
      if (Math.hypot(nx, ny) < dead) {
        nx = 0;
        ny = 0;
      }
      this.stick.x = nx;
      this.stick.y = ny;
    };
    const end = (e) => {
      if (e.pointerId !== activeId) return;
      activeId = null;
      knob.style.transform = 'translate(0px, 0px)';
      this.stick.x = 0;
      this.stick.y = 0;
    };
    base.addEventListener('pointerdown', (e) => {
      if (activeId !== null) return;
      activeId = e.pointerId;
      base.setPointerCapture(e.pointerId);
      update(e);
      e.preventDefault();
    });
    base.addEventListener('pointermove', (e) => {
      if (e.pointerId === activeId) update(e);
    });
    base.addEventListener('pointerup', end);
    base.addEventListener('pointercancel', end);
  }

  // 移動入力ベクトル（長さ 1 以下に正規化）
  getVector() {
    const k = this.keys;
    let x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    let y = (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0) - (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0);
    x += this.stick.x;
    y += this.stick.y;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }
}
